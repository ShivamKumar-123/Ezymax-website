import type { Metadata } from "next";
import { site } from "@/content/site";

type PageMeta = {
  title: string;
  description: string;
  path: string;
};

/** Builds consistent per-page metadata with canonical and Open Graph URLs. */
export function pageMetadata({ title, description, path }: PageMeta): Metadata {
  const url = new URL(path, site.url).toString();
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | ${site.name}`,
      description,
      url,
      siteName: site.name,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${site.name}`,
      description,
    },
  };
}
