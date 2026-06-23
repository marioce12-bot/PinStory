import type { MetadataRoute } from "next";

const SITE_URL = "https://www.myinstantsmap.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/fr", "/en"], disallow: ["/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
