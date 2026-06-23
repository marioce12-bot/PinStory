import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.pinstory.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/fr`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: { fr: `${SITE_URL}/fr`, en: `${SITE_URL}/en`, ar: `${SITE_URL}/ar` } },
    },
    {
      url: `${SITE_URL}/en`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: { fr: `${SITE_URL}/fr`, en: `${SITE_URL}/en`, ar: `${SITE_URL}/ar` } },
    },
    {
      url: `${SITE_URL}/ar`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: { fr: `${SITE_URL}/fr`, en: `${SITE_URL}/en`, ar: `${SITE_URL}/ar` } },
    },
  ];
}
