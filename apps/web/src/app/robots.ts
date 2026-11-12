import type { MetadataRoute } from "next";
import { landing } from "@/data/landing";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/app/"] },
    sitemap: `${landing.url}/sitemap.xml`,
  };
}
