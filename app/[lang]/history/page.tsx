import { notFound } from "next/navigation";
import { HistoryLookup } from "@/components/history/HistoryLookup";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { isLocale } from "@/lib/i18n";

export default async function HistoryPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <main className="section history-page">
      <BrandLogo href={`/${lang}`} />
      <HistoryLookup lang={lang} />
    </main>
  );
}
