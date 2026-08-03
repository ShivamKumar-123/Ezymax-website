import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

/**
 * Generates `/sitemap.xml`. One entry per public route — extend this list when
 * a route is added (ideally derived from a routes manifest).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/trade", "/platform", "/earn", "/protection", "/company"];

  return routes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: route === "" ? 1 : 0.8,
  }));
}
