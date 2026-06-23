import type { Plan } from "@/lib/plans";
import { PLAN_LIMITS } from "@/lib/plans";

export type FedaPayCheckoutInput = {
  mapId: string;
  plan: Exclude<Plan, "free">;
  lang: string;
  email: string;
  title?: string;
  appUrl?: string;
};

export type FedaPayCheckout = {
  transactionId: string;
  checkoutUrl: string;
};

type FedaPayTransactionResponse = {
  id?: string | number;
  "v1/transaction"?: {
    id?: string | number;
    url?: string;
  };
  transaction?: {
    id?: string | number;
    url?: string;
  };
  url?: string;
};

type FedaPayTokenResponse = {
  url?: string;
  token?: {
    url?: string;
  };
  "v1/token"?: {
    url?: string;
  };
};

function getFedaPayBaseUrl() {
  const environment = process.env.FEDAPAY_ENVIRONMENT || process.env.FEDAPAY_MODE || "live";
  return environment === "sandbox" || environment === "test"
    ? "https://sandbox-api.fedapay.com/v1"
    : "https://api.fedapay.com/v1";
}

function getPlanAmount(plan: Exclude<Plan, "free">) {
  const envKey =
    plan === "mini"
      ? "FEDAPAY_AMOUNT_MINI"
      : plan === "souvenir"
        ? "FEDAPAY_AMOUNT_SOUVENIR"
        : "FEDAPAY_AMOUNT_ETERNAL";
  const envAmount = Number(process.env[envKey]);
  if (Number.isFinite(envAmount) && envAmount > 0) return Math.round(envAmount);
  return PLAN_LIMITS[plan].price;
}

async function parseFedaPayResponse<T>(response: Response) {
  const text = await response.text();
  let payload: T & { message?: string; error?: string };

  try {
    payload = JSON.parse(text) as T & { message?: string; error?: string };
  } catch {
    payload = { message: text } as T & { message?: string; error?: string };
  }

  if (!response.ok) {
    throw new Error(payload.error || payload.message || `FedaPay request failed with status ${response.status}`);
  }

  return payload;
}

export async function createFedaPayCheckout(input: FedaPayCheckoutInput): Promise<FedaPayCheckout> {
  const secretKey = process.env.FEDAPAY_SECRET_KEY;
  if (!secretKey) {
    throw new Error("FedaPay is not configured. Missing FEDAPAY_SECRET_KEY.");
  }

  const appUrl = input.appUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const currency = process.env.FEDAPAY_CURRENCY || "USD";
  const baseUrl = getFedaPayBaseUrl();
  const amount = getPlanAmount(input.plan);
  const description = input.title
    ? `PinStory - ${input.title}`
    : `PinStory - ${input.plan}`;

  const transactionResponse = await fetch(`${baseUrl}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      description,
      amount,
      currency: { iso: currency },
      callback_url: `${appUrl}/${input.lang}/checkout/success?mapId=${input.mapId}`,
      customer: {
        email: input.email,
      },
      metadata: {
        mapId: input.mapId,
        plan: input.plan,
        provider: "fedapay",
      },
      custom_metadata: {
        mapId: input.mapId,
        plan: input.plan,
        provider: "fedapay",
      },
    }),
  });

  const transactionPayload = await parseFedaPayResponse<FedaPayTransactionResponse>(transactionResponse);
  const transaction = transactionPayload["v1/transaction"] || transactionPayload.transaction || transactionPayload;
  const transactionId = transaction.id ? String(transaction.id) : "";

  if (!transactionId) {
    throw new Error("FedaPay did not return a transaction id.");
  }

  const tokenResponse = await fetch(`${baseUrl}/transactions/${transactionId}/token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  const tokenPayload = await parseFedaPayResponse<FedaPayTokenResponse>(tokenResponse);
  const checkoutUrl = tokenPayload.url || tokenPayload.token?.url || tokenPayload["v1/token"]?.url || transaction.url;

  if (!checkoutUrl) {
    throw new Error("FedaPay did not return a checkout URL.");
  }

  return { transactionId, checkoutUrl };
}
