import { NextResponse } from "next/server";
import { createFedaPayCheckout } from "@/lib/fedapay";
import { isPlan } from "@/lib/plans";

export async function POST(request: Request) {
  try {
    const appUrl = new URL(request.url).origin;
    const {
      plan,
      mapId,
      lang = "en",
      email,
      title,
    } = (await request.json()) as {
      plan?: string;
      mapId?: string;
      lang?: string;
      email?: string;
      title?: string;
    };

    if (!plan || !isPlan(plan) || plan === "free") {
      return NextResponse.json({ error: "A paid plan is required." }, { status: 400 });
    }

    if (!mapId) {
      return NextResponse.json({ error: "Missing map id." }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "Missing customer email." }, { status: 400 });
    }

    const checkout = await createFedaPayCheckout({
      mapId,
      plan,
      lang,
      email,
      title,
      appUrl,
    });

    return NextResponse.json({
      checkoutUrl: checkout.checkoutUrl,
      transactionId: checkout.transactionId,
      provider: "fedapay",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create FedaPay checkout.",
      },
      { status: 500 },
    );
  }
}
