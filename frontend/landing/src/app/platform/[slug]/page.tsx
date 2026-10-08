import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlatformTemplate } from "@/components/templates/PlatformTemplate";
import { getPlatformProduct, platformProducts } from "@/content/platform";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return platformProducts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getPlatformProduct(slug);
  if (!page) return {};
  return pageMetadata({
    title: page.seo.title,
    description: page.seo.description,
    path: `/platform/${slug}`,
  });
}

export default async function PlatformItemPage({ params }: Props) {
  const { slug } = await params;
  const page = getPlatformProduct(slug);
  if (!page) notFound();
  return <PlatformTemplate page={page} />;
}
