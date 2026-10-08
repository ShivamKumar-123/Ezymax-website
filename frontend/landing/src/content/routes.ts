import { legalDocs } from "./legal";
import { markets } from "./markets";
import { platformProducts } from "./platform";

export type RouteEntry = {
  path: string;
  priority: number;
  changeFrequency: "weekly" | "monthly" | "yearly";
};

/**
 * Every public route on the site. Used by sitemap.ts.
 *
 * This is derived from the content arrays rather than listed by hand, which
 * is what keeps the sitemap from advertising a page that no longer exists —
 * the `[slug]` routes use `dynamicParams = false`, so a path here that the
 * content does not produce is a hard 404 in the sitemap.
 */
export function allRoutes(): RouteEntry[] {
  const top: RouteEntry[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/markets", priority: 0.9, changeFrequency: "monthly" },
    { path: "/platform", priority: 0.9, changeFrequency: "monthly" },
    { path: "/protection", priority: 0.8, changeFrequency: "monthly" },
    { path: "/earn", priority: 0.8, changeFrequency: "monthly" },
    { path: "/about", priority: 0.7, changeFrequency: "monthly" },
    { path: "/partners", priority: 0.6, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.8, changeFrequency: "yearly" },
  ];
  const marketRoutes = markets.map<RouteEntry>((m) => ({
    path: `/markets/${m.slug}`,
    priority: 0.8,
    changeFrequency: "monthly",
  }));
  const platformRoutes = platformProducts.map<RouteEntry>((p) => ({
    path: `/platform/${p.slug}`,
    priority: 0.8,
    changeFrequency: "monthly",
  }));
  const legalRoutes = legalDocs.map<RouteEntry>((d) => ({
    path: `/legal/${d.slug}`,
    priority: 0.3,
    changeFrequency: "yearly",
  }));
  return [...top, ...marketRoutes, ...platformRoutes, ...legalRoutes];
}
