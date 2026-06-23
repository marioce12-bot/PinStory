import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.pinstory.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const safeLang: Locale = lang === "en" ? "en" : "fr";
  const dictionary = getDictionary(safeLang);

  return {
    metadataBase: new URL(SITE_URL),
    title: dictionary.seo.title,
    description: dictionary.seo.description,
    alternates: {
      canonical: `/${safeLang}`,
      languages: {
        "fr-FR": "/fr",
        "en-US": "/en",
        "x-default": "/fr",
      },
    },
    openGraph: {
      type: "website",
      siteName: "PinStory",
      locale: safeLang === "fr" ? "fr_FR" : "en_US",
      alternateLocale: safeLang === "fr" ? ["en_US"] : ["fr_FR"],
      title: dictionary.seo.title,
      description: dictionary.seo.description,
      url: `${SITE_URL}/${safeLang}`,
      images: [
        {
          url: "/images/og-preview.jpg",
          width: 1200,
          height: 630,
          alt:
            safeLang === "fr"
              ? "Aperçu de la carte interactive PinStory"
              : "Preview of the PinStory interactive memory map",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: dictionary.seo.title,
      description: dictionary.seo.description,
      images: ["/images/og-preview.jpg"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return children;
}
