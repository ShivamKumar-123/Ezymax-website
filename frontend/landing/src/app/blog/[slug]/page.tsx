import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { articles, getArticle } from "@/content/blog";
import { pageMetadata } from "@/lib/seo";
import { ArticleLayout } from "@/components/templates/ArticleLayout";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const meta = getArticle(slug);
  if (!meta) return {};
  return { ...pageMetadata({ title: meta.title, description: meta.excerpt, path: `/blog/${slug}` }), openGraph: { type: "article", publishedTime: meta.date } };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const meta = getArticle(slug);
  if (!meta) notFound();
  const { default: Post } = await import(`@/content/blog/${slug}.mdx`);
  return (
    <ArticleLayout meta={meta}>
      <Post />
    </ArticleLayout>
  );
}
