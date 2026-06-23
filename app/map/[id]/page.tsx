import type { Metadata } from "next";
import { MapViewer } from "@/components/map/MapViewer";
import { getDemoMap } from "@/lib/demo-map";
import { getDictionary } from "@/lib/i18n";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { MemoryMap } from "@/lib/types";

async function getMemoryMap(id: string): Promise<MemoryMap> {
  const supabase = getSupabaseAdmin();

  if (!supabase) return getDemoMap(id);

  const { data: map } = await supabase.from("maps").select("*").eq("id", id).single();
  if (!map) return getDemoMap(id);

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
    created_at: map.created_at,
    expires_at: map.expires_at,
    payment_status: map.payment_status,
    qr_code_url: map.qr_code_url,
    custom_qr_logo_url: map.custom_qr_logo_url,
    points: (points || []).map((point) => ({
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
    })),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const map = await getMemoryMap(id);
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
  const dictionary = getDictionary(map.lang);
  const isExpired = Boolean(map.expires_at && new Date(map.expires_at) < new Date());

  if (isExpired) {
    return (
      <main className="section">
        <h1 className="section-title">{dictionary.map.expired}</h1>
        <p className="section-copy">
          {map.lang === "en"
            ? "The creator can upgrade this memory to keep it forever."
            : "Le créateur peut transformer ce souvenir en formule Éternel pour le conserver."}
        </p>
      </main>
    );
  }

  return <MapViewer map={map} dictionary={dictionary} />;
}
