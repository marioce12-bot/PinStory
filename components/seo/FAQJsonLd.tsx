import type { Locale } from "@/lib/i18n";

export function FAQJsonLd({ lang }: { lang: Locale }) {
  const mainEntity =
    lang === "fr"
      ? [
          {
            "@type": "Question",
            name: "Qu’est-ce qu’une carte souvenir personnalisée ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Une carte souvenir personnalisée est une carte interactive qui regroupe vos moments importants avec lieux, textes, photos et QR Code de partage.",
            },
          },
          {
            "@type": "Question",
            name: "PinStory est-il une bonne idée cadeau pour un couple ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Oui, PinStory permet de créer une carte émotionnelle retraçant une rencontre, un voyage, un anniversaire ou une histoire d’amour.",
            },
          },
        ]
      : [
          {
            "@type": "Question",
            name: "What is a custom memory map?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "A custom memory map is an interactive map that brings together meaningful places, texts, photos and a QR Code for easy sharing.",
            },
          },
          {
            "@type": "Question",
            name: "Is PinStory a good anniversary gift idea?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes, PinStory is designed as a unique anniversary gift idea for couples, families and travelers who want to relive meaningful memories.",
            },
          },
        ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity,
        }),
      }}
    />
  );
}
