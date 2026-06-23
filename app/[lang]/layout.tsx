import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.pinstory.app";

const localeMeta = {
  fr: {
    og: "fr_FR",
    alt: "Aperçu de la carte interactive PinStory",
  },
  en: {
    og: "en_US",
    alt: "Preview of the PinStory interactive memory map",
  },
  ar: {
    og: "ar_AR",
    alt: "معاينة خريطة الذكريات التفاعلية من PinStory",
  },
} satisfies Record<Locale, { og: string; alt: string }>;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const safeLang: Locale = isLocale(lang) ? lang : "en";
  const dictionary = getDictionary(safeLang);
  const alternates = Object.entries(localeMeta)
    .filter(([locale]) => locale !== safeLang)
    .map(([, meta]) => meta.og);

  return {
    metadataBase: new URL(SITE_URL),
    title: dictionary.seo.title,
    description: dictionary.seo.description,
    alternates: {
      canonical: `/${safeLang}`,
      languages: {
        "fr-FR": "/fr",
        "en-US": "/en",
        "ar": "/ar",
        "x-default": "/en",
      },
    },
    openGraph: {
      type: "website",
      siteName: "PinStory",
      locale: localeMeta[safeLang].og,
      alternateLocale: alternates,
      title: dictionary.seo.title,
      description: dictionary.seo.description,
      url: `${SITE_URL}/${safeLang}`,
      images: [
        {
          url: "/images/og-preview.jpg",
          width: 1200,
          height: 630,
          alt: localeMeta[safeLang].alt,
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
