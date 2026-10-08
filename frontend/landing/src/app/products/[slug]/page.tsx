import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, products } from "@/content/products";
import { pageMetadata } from "@/lib/seo";
import { ProductTemplate } from "@/components/templates/ProductTemplate";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getProduct(slug);
  if (!page) return {};
  return pageMetadata({ title: page.seo.title, description: page.seo.description, path: `/products/${slug}` });
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const page = getProduct(slug);
  if (!page) notFound();
  return <ProductTemplate page={page} />;
}
