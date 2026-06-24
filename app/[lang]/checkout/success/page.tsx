import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ mapId?: string }>;
}) {
  const { lang } = await params;
  const { mapId } = await searchParams;
  if (!isLocale(lang)) notFound();
  const dictionary = getDictionary(lang);

  return (
    <main className="section">
      <BrandLogo href={`/${lang}`} />
      <h1 className="section-title">{lang === "en" ? "Your memory is ready" : "Votre souvenir est prêt"}</h1>
      <p className="section-copy">
        {lang === "en"
          ? "Payment was confirmed. Your interactive memory map is now active."
          : "Le paiement est confirmé. Votre carte souvenir interactive est maintenant active."}
      </p>
      <div className="hero-actions">
        <Link className="btn-cta" href={mapId ? `/${lang}/share?mapId=${mapId}` : `/${lang}/create`}>
          {mapId ? (lang === "en" ? "Get link and QR Code" : "Obtenir le lien et le QR Code") : dictionary.cta.start}
        </Link>
      </div>
    </main>
  );
}
