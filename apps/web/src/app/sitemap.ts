import type { MetadataRoute } from "next";
import { landing } from "@/data/landing";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: landing.url, changeFrequency: "weekly", priority: 1 }];
}
