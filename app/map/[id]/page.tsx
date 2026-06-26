import type { Metadata } from "next";
import { MapViewer } from "@/components/map/MapViewer";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { getDemoMap } from "@/lib/demo-map";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { getDictionary, type Locale } from "@/lib/i18n";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { MemoryMap, MemoryPoint } from "@/lib/types";

type StoredPoint = MemoryPoint & {
  mediaUrl?: string;
  mediaType?: "image" | "video";
  image?: string;
};

function normalizePoint(point: Partial<StoredPoint>, index: number): MemoryPoint {
  const mediaUrl = point.media_url || point.mediaUrl || point.image || undefined;
  const mediaType = point.media_type || point.mediaType || (mediaUrl ? "image" : undefined);

  return {
    id: point.id || `point-${index + 1}`,
    order: point.order || index + 1,
    title: point.title || point.place_name || "Souvenir",
    date: point.date || undefined,
    description: point.description || "",
    place_name: point.place_name || point.location_query || point.title || "Lieu souvenir",
    location_query: point.location_query || point.place_name || point.title,
    longitude: Number(point.longitude),
    latitude: Number(point.latitude),
    media_url: mediaUrl,
    media_type: mediaType,
  };
}

async function getMemoryMap(id: string): Promise<MemoryMap | null> {
  const firebaseDb = getFirebaseDb();
  if (firebaseDb) {
    const snapshot = await firebaseDb.collection("maps").doc(id).get();
    if (snapshot.exists) {
      const data = snapshot.data() as Omit<MemoryMap, "points"> & { points?: MemoryPoint[] };

      return {
        id: data.id || id,
        client_email: data.client_email || "",
        lang: data.lang || "fr",
        plan: data.plan || "free",
        theme_style: data.theme_style || "minimalist",
        title: data.title || "PinStory",
        message: data.message || "",
        finalMessage: data.finalMessage || undefined,
        created_at: data.created_at || new Date().toISOString(),
        expires_at: data.expires_at || null,
        payment_status: data.payment_status || "free",
        secret_code: data.secret_code || undefined,
        audioUrl: data.audioUrl || undefined,
        qr_code_url: data.qr_code_url,
        custom_qr_logo_url: data.custom_qr_logo_url,
        points: (data.points || []).map((point, index) => normalizePoint(point as StoredPoint, index)),
      };
    }

    return null;
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) return getDemoMap(id);

  const { data: map } = await supabase.from("maps").select("*").eq("id", id).single();
  if (!map) return null;

  const { data: points } = await supabase
    .from("map_points")
    .select("*")
    .eq("map_id", id)
    .order("point_order", { ascending: true });

  return {
    id: map.id,
    client_email: map.client_email,
    lang: map.lang,
    plan: map.plan,
    theme_style: map.theme_style,
    title: map.title || "PinStory",
    message: map.message || "",
    finalMessage: map.finalMessage || undefined,
    created_at: map.created_at,
    expires_at: map.expires_at,
    payment_status: map.payment_status,
    secret_code: map.secret_code || undefined,
    audioUrl: map.audioUrl || undefined,
    qr_code_url: map.qr_code_url,
    custom_qr_logo_url: map.custom_qr_logo_url,
    points: (points || []).map((point, index) => normalizePoint({
      id: point.id,
      order: point.point_order,
      title: point.title,
      date: point.date || undefined,
      description: point.description || "",
      place_name: point.place_name || point.location_query || point.title,
      location_query: point.location_query || point.place_name || point.title,
      longitude: point.longitude,
      latitude: point.latitude,
      media_url: point.media_url || undefined,
      media_type: point.media_type || undefined,
    }, index)),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const map = await getMemoryMap(id);
  if (!map) {
    return {
      title: "Souvenir indisponible | PinStory",
      description: "Ce souvenir n’est plus disponible ou n’existe pas.",
      robots: { index: false, follow: true },
    };
  }
  const isEnglish = map.lang === "en";

  return {
    title: `${map.title || (isEnglish ? "Your memory map" : "Votre carte souvenir")} | PinStory`,
    description: isEnglish
      ? "Discover an interactive memory map created with PinStory."
      : "Découvrez une carte souvenir interactive créée avec PinStory.",
    robots: { index: false, follow: true },
    openGraph: {
      title: `${map.title} | PinStory`,
      description: map.message || (isEnglish ? "A story mapped on an interactive memory map." : "Une histoire gravée sur une carte interactive."),
      images: [
        {
          url: "/images/og-preview.jpg",
          width: 1200,
          height: 630,
          alt: isEnglish ? "PinStory memory map" : "Carte souvenir interactive PinStory",
        },
      ],
    },
  };
}

export default async function PublicMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const map = await getMemoryMap(id);
  if (!map) {
    return <UnavailableMap lang="fr" />;
  }
  const dictionary = getDictionary(map.lang);
  const isExpired = Boolean(map.expires_at && new Date(map.expires_at) < new Date());

  if (isExpired) {
    return <UnavailableMap lang={map.lang} />;
  }

  return <MapViewer map={map} dictionary={dictionary} />;
}

function UnavailableMap({ lang }: { lang: Locale }) {
  const isArabic = lang === "ar";
  const isEnglish = lang === "en";

  return (
    <main className="section unavailable-memory-page">
      <BrandLogo href={`/${lang}`} />
      <h1 className="section-title">
        {isArabic ? "هذا التذكار غير متاح" : isEnglish ? "This memory is no longer available" : "Ce souvenir n’est plus disponible"}
      </h1>
      <p className="section-copy">
        {isArabic
          ? "قد يكون الرابط منتهياً أو لم يعد موجوداً. يمكنك إنشاء PinStory جديد لتقديمه لشخص قريب منك."
          : isEnglish
            ? "This link may have expired or no longer exist. You can create a new PinStory to offer someone you love."
            : "Ce lien a peut-être expiré ou n’existe plus. Vous pouvez créer un nouveau PinStory à offrir à vos proches."}
      </p>
      <a className="btn-cta" href={`/${lang}`}>{isArabic ? "إنشاء تذكار" : isEnglish ? "Create a memory" : "Créer un souvenir"}</a>
    </main>
  );
}
