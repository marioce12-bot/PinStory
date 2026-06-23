import type { Locale } from "@/lib/i18n";

export function ProductJsonLd({ lang }: { lang: Locale }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "MyInstants",
    image: "https://www.myinstantsmap.com/images/og-preview.jpg",
    description:
      lang === "fr"
        ? "Créez une carte souvenir interactive personnalisée, accessible par QR Code."
        : "Create a personalized interactive memory map, accessible through a QR Code.",
    brand: {
      "@type": "Brand",
      name: "MyInstants",
    },
    offers: [
      {
        "@type": "Offer",
        name: "Souvenir",
        price: "9.90",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        url: `https://www.myinstantsmap.com/${lang}`,
      },
      {
        "@type": "Offer",
        name: lang === "fr" ? "Éternel" : "Eternal",
        price: "39.90",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        url: `https://www.myinstantsmap.com/${lang}`,
      },
    ],
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
}
