import type { MetadataRoute } from "next";

const SITE_URL = "https://www.myinstantsmap.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/fr`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: { fr: `${SITE_URL}/fr`, en: `${SITE_URL}/en` } },
    },
    {
      url: `${SITE_URL}/en`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: { fr: `${SITE_URL}/fr`, en: `${SITE_URL}/en` } },
    },
  ];
}
