import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { getSupabaseAdmin } from "@/lib/supabase";

type FedaPayWebhookPayload = {
  name?: string;
  event?: string;
  entity?: FedaPayTransaction;
  data?: {
    entity?: FedaPayTransaction;
    transaction?: FedaPayTransaction;
  };
  transaction?: FedaPayTransaction;
};

type FedaPayTransaction = {
  id?: string | number;
  status?: string;
  metadata?: Record<string, unknown>;
  custom_metadata?: Record<string, unknown>;
};

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyWebhookSignature(body: string, request: Request) {
  const secret = process.env.FEDAPAY_WEBHOOK_SECRET;
  if (!secret) return true;

  const signature = request.headers.get("x-fedapay-signature") || request.headers.get("fedapay-signature");
  if (!signature) return false;

  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const normalizedSignature = signature.replace(/^sha256=/, "");

  return safeCompare(expected, normalizedSignature);
}

function getTransaction(payload: FedaPayWebhookPayload) {
  return payload.entity || payload.data?.entity || payload.data?.transaction || payload.transaction || null;
}

function getMapId(transaction: FedaPayTransaction | null) {
  const metadata = transaction?.metadata || transaction?.custom_metadata || {};
  const mapId = metadata.mapId || metadata.map_id;
  return typeof mapId === "string" ? mapId : null;
}

function isPaidEvent(payload: FedaPayWebhookPayload, transaction: FedaPayTransaction | null) {
  const eventName = payload.name || payload.event || "";
  const status = transaction?.status || "";

  return eventName.includes("approved") || status === "approved" || status === "paid" || status === "successful";
}

async function findMapIdByTransactionId(transactionId: string) {
  const db = getFirebaseDb();
  if (!db) return null;

  const snapshot = await db.collection("maps").where("fedapay_transaction_id", "==", transactionId).limit(1).get();
  const doc = snapshot.docs[0];
  return doc?.id || null;
}

async function markMapPaid(mapId: string, transactionId?: string) {
  const db = getFirebaseDb();
  if (db) {
    await db.collection("maps").doc(mapId).set(
      {
        payment_status: "paid",
        payment_provider: "fedapay",
        fedapay_transaction_id: transactionId || null,
        paid_at: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase.from("maps").update({ payment_status: "paid" }).eq("id", mapId);
  }
}

export async function POST(request: Request) {
  const body = await request.text();

  if (!verifyWebhookSignature(body, request)) {
    return NextResponse.json({ error: "Invalid FedaPay webhook signature." }, { status: 401 });
  }

  let payload: FedaPayWebhookPayload;
  try {
    payload = JSON.parse(body) as FedaPayWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const transaction = getTransaction(payload);
  const transactionId = transaction?.id ? String(transaction.id) : undefined;

  if (!isPaidEvent(payload, transaction)) {
    return NextResponse.json({ received: true, ignored: true, reason: "not_paid_event" });
  }

  const mapId = getMapId(transaction) || (transactionId ? await findMapIdByTransactionId(transactionId) : null);

  if (!mapId) {
    return NextResponse.json({ received: true, ignored: true, reason: "missing_map_id" });
  }

  await markMapPaid(mapId, transactionId);

  return NextResponse.json({ received: true, mapId, payment_status: "paid" });
}
