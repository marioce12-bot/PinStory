import type { Locale } from "@/lib/i18n";

export function ProductJsonLd({ lang }: { lang: Locale }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "PinStory",
    image: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.pinstory.app"}/images/og-preview.jpg`,
    description:
      lang === "fr"
        ? "Créez une carte souvenir interactive personnalisée, accessible par QR Code."
        : "Create a personalized interactive memory map, accessible through a QR Code.",
    brand: {
      "@type": "Brand",
      name: "PinStory",
    },
    offers: [
      {
        "@type": "Offer",
        name: "Souvenir",
        price: "9.90",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        url: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.pinstory.app"}/${lang}`,
      },
      {
        "@type": "Offer",
        name: lang === "fr" ? "Éternel" : "Eternal",
        price: "39.90",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        url: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.pinstory.app"}/${lang}`,
      },
    ],
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
}
