import { NextResponse } from "next/server";
import Stripe from "stripe";
import { isPlan, PLAN_LIMITS } from "@/lib/plans";

export async function POST(request: Request) {
  const { plan, mapId, lang = "fr" } = (await request.json()) as { plan?: string; mapId?: string; lang?: string };

  if (!plan || !isPlan(plan) || plan === "free") {
    return NextResponse.json({ error: "A paid plan is required." }, { status: 400 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceId = PLAN_LIMITS[plan].stripePriceId;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!stripeKey || !priceId) {
    return NextResponse.json({ checkoutUrl: `${appUrl}/${lang}/checkout/success?mapId=${mapId || "demo"}` });
  }

  const stripe = new Stripe(stripeKey);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/${lang}/checkout/success?mapId=${mapId || "{CHECKOUT_SESSION_ID}"}`,
    cancel_url: `${appUrl}/${lang}/checkout/cancel`,
    metadata: { plan, mapId: mapId || "" },
  });

  return NextResponse.json({ checkoutUrl: session.url });
}
