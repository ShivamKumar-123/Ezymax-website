import { solutions } from "./solutions";
import { products } from "./products";
import { articles } from "./blog";
import { legalDocs } from "./legal";

export type RouteEntry = { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" };

/** Every public route on the site. Used by sitemap.ts and verification scripts. */
export function allRoutes(): RouteEntry[] {
  const top: RouteEntry[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/solutions", priority: 0.9, changeFrequency: "monthly" },
    { path: "/products", priority: 0.9, changeFrequency: "monthly" },
    { path: "/liquidity", priority: 0.8, changeFrequency: "monthly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
    { path: "/services", priority: 0.8, changeFrequency: "monthly" },
    { path: "/about", priority: 0.7, changeFrequency: "monthly" },
    { path: "/careers", priority: 0.6, changeFrequency: "monthly" },
    { path: "/partners", priority: 0.6, changeFrequency: "monthly" },
    { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
    { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.8, changeFrequency: "yearly" },
  ];
  const solutionRoutes = solutions.map<RouteEntry>((s) => ({
    path: `/solutions/${s.slug}`,
    priority: 0.8,
    changeFrequency: "monthly",
  }));
  const productRoutes = products.map<RouteEntry>((p) => ({
    path: `/products/${p.slug}`,
    priority: 0.8,
    changeFrequency: "monthly",
  }));
  const blogRoutes = articles.map<RouteEntry>((a) => ({
    path: `/blog/${a.slug}`,
    priority: 0.6,
    changeFrequency: "monthly",
  }));
  const legalRoutes = legalDocs.map<RouteEntry>((d) => ({
    path: `/legal/${d.slug}`,
    priority: 0.3,
    changeFrequency: "yearly",
  }));
  return [...top, ...solutionRoutes, ...productRoutes, ...blogRoutes, ...legalRoutes];
}
