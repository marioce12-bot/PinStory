import { NextResponse } from "next/server";
import { getPlanExpiry } from "@/lib/plans";
import { getSupabaseAdmin } from "@/lib/supabase";
import { validateMapPayload } from "@/lib/validation";

function createId() {
  return `map_${crypto.randomUUID().replaceAll("-", "").slice(0, 14)}`;
}

export async function POST(request: Request) {
  const payload = await request.json();
  const validation = validateMapPayload(payload);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const data = payload as Record<string, unknown>;
  const id = createId();
  const createdAt = new Date();
  const expiresAt = getPlanExpiry(validation.plan, createdAt);
  const paymentStatus = validation.plan === "free" ? "free" : "pending";

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error: mapError } = await supabase.from("maps").insert({
      id,
      client_email: String(data.client_email || ""),
      lang: validation.lang,
      plan: validation.plan,
      theme_style: validation.theme,
      title: String(data.title || "MyInstants"),
      message: String(data.message || ""),
      created_at: createdAt.toISOString(),
      expires_at: expiresAt,
      payment_status: paymentStatus,
    });

    if (mapError) return NextResponse.json({ error: mapError.message }, { status: 500 });

    const { error: pointsError } = await supabase.from("map_points").insert(
      validation.points.map((point, index) => ({
        map_id: id,
        point_order: index + 1,
        title: point.title,
        date: point.date || null,
        description: point.description,
        longitude: point.longitude,
        latitude: point.latitude,
        media_url: point.media_url || null,
        media_type: point.media_type || null,
      })),
    );

    if (pointsError) return NextResponse.json({ error: pointsError.message }, { status: 500 });
  }

  if (validation.plan !== "free") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.json({ id, checkoutUrl: `${appUrl}/${validation.lang}/checkout/success?mapId=${id}` });
  }

  return NextResponse.json({ id });
}
