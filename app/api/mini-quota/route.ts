import { NextResponse } from "next/server";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { getSupabaseAdmin } from "@/lib/supabase";

const MINI_FREE_QUOTA = 2;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function countUsedMiniTrials(email: string) {
  const firebaseDb = getFirebaseDb();

  if (firebaseDb) {
    const snapshot = await firebaseDb.collection("maps").where("client_email", "==", email).get();
    return snapshot.docs.filter((doc) => {
      const data = doc.data() as { plan?: string; payment_status?: string | null };
      return data.plan === "mini" && data.payment_status === "free";
    }).length;
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data } = await supabase.from("maps").select("plan, payment_status").eq("client_email", email);
    return (data || []).filter((map) => map.plan === "mini" && map.payment_status === "free").length;
  }

  return 0;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = normalizeEmail(url.searchParams.get("email") || "");

  if (!email || !email.includes("@")) {
    return NextResponse.json({
      knownAccount: false,
      quota: MINI_FREE_QUOTA,
      used: 0,
      remaining: MINI_FREE_QUOTA,
    });
  }

  const used = await countUsedMiniTrials(email);
  const remaining = Math.max(MINI_FREE_QUOTA - used, 0);

  return NextResponse.json({
    knownAccount: true,
    quota: MINI_FREE_QUOTA,
    used,
    remaining,
  });
}
