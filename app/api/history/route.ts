import { NextResponse } from "next/server";
import { getAccountId, hashAccountSecret, isValidAccountSecret } from "@/lib/account-secret";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { getSupabaseAdmin } from "@/lib/supabase";

type StoredMap = {
  id: string;
  client_email?: string;
  lang?: string;
  plan?: string;
  title?: string;
  message?: string;
  created_at?: string;
  expires_at?: string | null;
  payment_status?: string | null;
  points?: unknown[];
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isActiveUsableMap(map: StoredMap) {
  const isNotExpired = !map.expires_at || new Date(map.expires_at) > new Date();
  const isUsableStatus = map.payment_status === "free" || map.payment_status === "paid";
  return isNotExpired && isUsableStatus;
}

function toHistoryItem(map: StoredMap, origin: string) {
  return {
    id: map.id,
    title: map.title || "PinStory",
    message: map.message || "",
    plan: map.plan || "free",
    lang: map.lang || "en",
    created_at: map.created_at || null,
    expires_at: map.expires_at || null,
    points_count: Array.isArray(map.points) ? map.points.length : 0,
    url: `${origin}/map/${map.id}`,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = normalizeEmail(url.searchParams.get("email") || "");
  const accountSecret = url.searchParams.get("account_secret") || "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  if (!isValidAccountSecret(accountSecret)) {
    return NextResponse.json({ error: "A valid account secret code is required." }, { status: 400 });
  }

  const origin = url.origin;
  const firebaseDb = getFirebaseDb();

  if (firebaseDb) {
    const account = await firebaseDb.collection("account_profiles").doc(getAccountId(email)).get();
    if (!account.exists) {
      return NextResponse.json({ error: "No PinStory account was found for this email." }, { status: 404 });
    }

    const accountData = account.data() as { secret_hash?: string } | undefined;
    if (accountData?.secret_hash !== hashAccountSecret(accountSecret.trim())) {
      return NextResponse.json({ error: "Incorrect account secret code." }, { status: 403 });
    }

    const snapshot = await firebaseDb.collection("maps").where("client_email", "==", email).get();
    const maps = snapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<StoredMap, "id">) }))
      .filter(isActiveUsableMap)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .map((map) => toHistoryItem(map, origin));

    return NextResponse.json({ maps });
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase.from("maps").select("*").eq("client_email", email);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const maps = (data || [])
      .map((map) => map as StoredMap)
      .filter(isActiveUsableMap)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .map((map) => toHistoryItem(map, origin));

    return NextResponse.json({ maps });
  }

  return NextResponse.json({ maps: [] });
}
