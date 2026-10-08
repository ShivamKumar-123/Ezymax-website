import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { articles, blogCategories, blogPage } from "@/content/blog";
import { PageHero } from "@/components/sections/shared/PageHero";
import { BlogGrid } from "@/components/sections/shared/BlogGrid";

export const metadata: Metadata = pageMetadata({
  title: "Blog",
  description: "Insights for brokers and prop firms: starting a brokerage, prop firm business, trading technology, liquidity and risk, regulation updates.",
  path: "/blog",
});

export default function BlogPage() {
  return (
    <>
      <PageHero eyebrow={blogPage.eyebrow} headline={blogPage.headline} highlight={blogPage.highlight} sub={blogPage.sub} compact />
      <section className="relative pb-24">
        <div className="container-x">
          <BlogGrid articles={articles} categories={blogCategories} />
        </div>
      </section>
    </>
  );
}
