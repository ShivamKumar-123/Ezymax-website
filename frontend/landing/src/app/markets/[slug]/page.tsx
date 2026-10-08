import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MarketTemplate } from "@/components/templates/MarketTemplate";
import { getMarket, markets } from "@/content/markets";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return markets.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getMarket(slug);
  if (!page) return {};
  return pageMetadata({
    title: page.seo.title,
    description: page.seo.description,
    path: `/markets/${slug}`,
  });
}

export default async function MarketPage({ params }: Props) {
  const { slug } = await params;
  const page = getMarket(slug);
  if (!page) notFound();
  return <MarketTemplate page={page} />;
}
