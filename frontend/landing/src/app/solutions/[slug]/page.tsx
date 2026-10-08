import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSolution, solutions } from "@/content/solutions";
import { pageMetadata } from "@/lib/seo";
import { SolutionTemplate } from "@/components/templates/SolutionTemplate";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return solutions.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getSolution(slug);
  if (!page) return {};
  return pageMetadata({ title: page.seo.title, description: page.seo.description, path: `/solutions/${slug}` });
}

export default async function SolutionPage({ params }: Props) {
  const { slug } = await params;
  const page = getSolution(slug);
  if (!page) notFound();
  return <SolutionTemplate page={page} />;
}
