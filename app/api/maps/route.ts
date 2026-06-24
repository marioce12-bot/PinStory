import { NextResponse } from "next/server";
import { getAccountId, hashAccountSecret, isValidAccountSecret } from "@/lib/account-secret";
import { createFedaPayCheckout } from "@/lib/fedapay";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { getPlanExpiry } from "@/lib/plans";
import { getSupabaseAdmin } from "@/lib/supabase";
import { validateMapPayload } from "@/lib/validation";

function createId() {
  return `map_${crypto.randomUUID().replaceAll("-", "").slice(0, 14)}`;
}

async function countFreeMiniMapsForEmail(email: string) {
  const firebaseDb = getFirebaseDb();
  if (firebaseDb) {
    const snapshot = await firebaseDb.collection("maps").where("client_email", "==", email).get();
    return snapshot.docs.filter((doc) => {
      const data = doc.data() as { plan?: string; expires_at?: string | null; payment_status?: string | null };
      return data.plan === "mini" && data.payment_status === "free";
    }).length;
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data } = await supabase.from("maps").select("plan, expires_at, payment_status").eq("client_email", email);
    return (data || []).filter((map) => map.plan === "mini" && map.payment_status === "free").length;
  }

  return 0;
}

async function verifyOrCreateAccountSecret(email: string, secret: string) {
  if (!isValidAccountSecret(secret)) {
    return { ok: false as const, error: "Choose a secret code of at least 4 characters for your account." };
  }

  const firebaseDb = getFirebaseDb();
  if (!firebaseDb) return { ok: true as const };

  const accountRef = firebaseDb.collection("account_profiles").doc(getAccountId(email));
  const account = await accountRef.get();
  const secretHash = hashAccountSecret(secret.trim());

  if (!account.exists) {
    await accountRef.set({
      email,
      secret_hash: secretHash,
      created_at: new Date().toISOString(),
    });
    return { ok: true as const };
  }

  const data = account.data() as { secret_hash?: string } | undefined;
  if (data?.secret_hash !== secretHash) {
    return { ok: false as const, error: "Incorrect account secret code for this email." };
  }

  return { ok: true as const };
}

export async function POST(request: Request) {
  const payload = await request.json();
  const appUrl = new URL(request.url).origin;
  const validation = validateMapPayload(payload);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  if (validation.plan === "free") {
    return NextResponse.json({ error: "The free plan has been replaced by Mini." }, { status: 400 });
  }

  const data = payload as Record<string, unknown>;
  const id = createId();
  const clientEmail = String(data.client_email || "").trim().toLowerCase();
  const createdAt = new Date();
  const expiresAt = getPlanExpiry(validation.plan, createdAt);

  if (!clientEmail) {
    return NextResponse.json({ error: "Email is required to create a PinStory." }, { status: 400 });
  }

  const accountSecret = String(data.account_secret || "");
  const accountVerification = await verifyOrCreateAccountSecret(clientEmail, accountSecret);
  if (!accountVerification.ok) {
    return NextResponse.json({ error: accountVerification.error }, { status: 403 });
  }

  const freeMiniCount = validation.plan === "mini" ? await countFreeMiniMapsForEmail(clientEmail) : 0;
  const isComplimentaryMini = validation.plan === "mini" && freeMiniCount < 2;
  const paymentStatus = isComplimentaryMini ? "free" : "pending";

  const mapRecord = {
    id,
    client_email: clientEmail,
    lang: validation.lang,
    plan: validation.plan,
    theme_style: validation.theme,
    title: String(data.title || "PinStory"),
    message: String(data.message || ""),
    finalMessage: String(data.finalMessage || ""),
    created_at: createdAt.toISOString(),
    expires_at: expiresAt,
    payment_status: paymentStatus,
    secret_code: typeof data.secret_code === "string" && data.secret_code.trim() ? data.secret_code.trim() : null,
    account_id: getAccountId(clientEmail),
    audioUrl: typeof data.audioUrl === "string" && data.audioUrl.trim() ? data.audioUrl.trim() : null,
    points: validation.points.map((point, index) => ({
      id: point.id || crypto.randomUUID(),
      order: index + 1,
      title: point.title || point.place_name,
      date: point.date || null,
      description: point.description || "",
      place_name: point.place_name,
      location_query: point.location_query || point.place_name,
      longitude: point.longitude,
      latitude: point.latitude,
      media_url: point.media_url || null,
      media_type: point.media_type || null,
    })),
  };

  const firebaseDb = getFirebaseDb();
  if (firebaseDb) {
    await firebaseDb.collection("maps").doc(id).set(mapRecord);
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error: mapError } = await supabase.from("maps").insert({
      id: mapRecord.id,
      client_email: mapRecord.client_email,
      lang: mapRecord.lang,
      plan: mapRecord.plan,
      theme_style: mapRecord.theme_style,
      title: mapRecord.title,
      message: mapRecord.message,
      finalMessage: mapRecord.finalMessage,
      created_at: mapRecord.created_at,
      expires_at: mapRecord.expires_at,
      payment_status: mapRecord.payment_status,
      secret_code: mapRecord.secret_code,
      audioUrl: mapRecord.audioUrl,
    });

    if (mapError) return NextResponse.json({ error: mapError.message }, { status: 500 });

    const { error: pointsError } = await supabase.from("map_points").insert(
      mapRecord.points.map((point, index) => ({
        map_id: id,
        point_order: index + 1,
        title: point.title,
        date: point.date || null,
        description: point.description,
        place_name: point.place_name,
        location_query: point.location_query || point.place_name,
        longitude: point.longitude,
        latitude: point.latitude,
        media_url: point.media_url || null,
        media_type: point.media_type || null,
      })),
    );

    if (pointsError) return NextResponse.json({ error: pointsError.message }, { status: 500 });
  }

  if (!isComplimentaryMini) {
    const checkout = await createFedaPayCheckout({
      mapId: id,
      plan: validation.plan,
      lang: validation.lang,
      email: clientEmail,
      title: mapRecord.title,
      appUrl,
    });

    if (firebaseDb) {
      await firebaseDb.collection("maps").doc(id).set(
        {
          fedapay_transaction_id: checkout.transactionId,
          payment_provider: "fedapay",
        },
        { merge: true },
      );
    }

    return NextResponse.json({
      id,
      checkoutUrl: checkout.checkoutUrl,
      transactionId: checkout.transactionId,
      provider: "fedapay",
    });
  }

  return NextResponse.json({ id, complimentary: true });
}
