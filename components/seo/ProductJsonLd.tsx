import type { Locale } from "@/lib/i18n";

export function ProductJsonLd({ lang }: { lang: Locale }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "PinStory",
    image: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.pinstory.app"}/images/og-preview.jpg`,
    description:
      lang === "ar"
        ? "أنشئ خريطة ذكريات تفاعلية مخصصة يمكن الوصول إليها عبر رمز QR."
        : lang === "fr"
        ? "Créez une carte souvenir interactive personnalisée, accessible par QR Code."
        : "Create a personalized interactive memory map, accessible through a QR Code.",
    brand: {
      "@type": "Brand",
      name: "PinStory",
    },
    offers: [
      {
        "@type": "Offer",
        name: "Mini",
        price: "2.00",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.pinstory.app"}/${lang}`,
      },
      {
        "@type": "Offer",
        name: "Souvenir",
        price: "5.00",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.pinstory.app"}/${lang}`,
      },
      {
        "@type": "Offer",
        name: lang === "ar" ? "أبدي" : lang === "fr" ? "Éternel" : "Eternal",
        price: "33.00",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.pinstory.app"}/${lang}`,
      },
    ],
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
}
