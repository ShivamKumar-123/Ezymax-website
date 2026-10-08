import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLegalDoc, legalDocs } from "@/content/legal";
import { pageMetadata } from "@/lib/seo";
import { LegalTemplate } from "@/components/templates/LegalTemplate";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return legalDocs.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) return {};
  return { ...pageMetadata({ title: doc.title, description: `${doc.title} for SetupZero.`, path: `/legal/${slug}` }), robots: { index: false } };
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();
  return <LegalTemplate doc={doc} />;
}
