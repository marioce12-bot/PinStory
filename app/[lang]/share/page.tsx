import { notFound } from "next/navigation";
import { SharePanel } from "@/components/share/SharePanel";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { isLocale } from "@/lib/i18n";

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ mapId?: string }>;
}) {
  const { lang } = await params;
  const { mapId } = await searchParams;
  if (!isLocale(lang)) notFound();

  return (
    <main className="section share-page">
      <BrandLogo href={`/${lang}`} />
      <SharePanel lang={lang} mapId={mapId} />
    </main>
  );
}
