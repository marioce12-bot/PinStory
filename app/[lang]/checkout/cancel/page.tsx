import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function CheckoutCancelPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dictionary = getDictionary(lang);

  return (
    <main className="section">
      <BrandLogo href={`/${lang}`} />
      <h1 className="section-title">{lang === "en" ? "Payment cancelled" : "Paiement annulé"}</h1>
      <p className="section-copy">
        {lang === "en"
          ? "No payment was captured. You can return to the configurator to adjust your memory map."
          : "Aucun paiement n’a été capturé. Vous pouvez retourner au configurateur pour ajuster votre carte."}
      </p>
      <Link className="btn-cta" href={`/${lang}/create`}>
        {dictionary.cta.continue}
      </Link>
    </main>
  );
}
