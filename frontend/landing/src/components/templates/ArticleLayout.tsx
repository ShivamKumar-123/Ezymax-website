import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import type { ArticleMeta } from "@/content/schema";
import { articles } from "@/content/blog";
import { Badge } from "@/components/ui/Badge";
import { CTABand } from "@/components/sections/shared/CTABand";
import { finalCta } from "@/content/home";
import { blogImage } from "@/content/images";
import { Picture } from "@/components/ui/Picture";

export function ArticleLayout({ meta, children }: { meta: ArticleMeta; children: ReactNode }) {
  const related = articles.filter((a) => a.slug !== meta.slug).slice(0, 3);
  const date = new Date(meta.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return (
    <>
      <section className="relative overflow-hidden pt-36 pb-10 md:pt-44">
        <div className="pointer-events-none absolute -top-40 right-[-10%] h-[480px] w-[680px] ember-glow opacity-60" aria-hidden />
        <div className="container-x relative max-w-3xl">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink">
            <ArrowLeft className="size-4" /> All articles
          </Link>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Badge variant="bracket">{meta.category}</Badge>
            <span className="text-xs text-dim">
              {date} · {meta.readingTime}
            </span>
          </div>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.04] text-ink md:text-5xl lg:text-6xl">{meta.title}</h1>
          <p className="mt-6 text-lg leading-relaxed text-muted md:text-xl">{meta.excerpt}</p>
          <div className="mt-8 rounded-card border border-orange-500/30 bg-orange-500/10 px-5 py-4 text-sm text-orange-200">
            Draft outline. This article is a stub with intro and section headings, ready to be expanded.
          </div>
        </div>
        <div className="container-x group mt-10 max-w-5xl">
          <Picture image={blogImage(meta.slug)} className="aspect-[21/9]" rounded="rounded-panel" sizes="(max-width: 1024px) 100vw, 1024px" priority />
        </div>
      </section>
      <section className="relative pb-20">
        <article className="container-x max-w-3xl">{children}</article>
      </section>
      <section className="relative py-10">
        <div className="container-x">
          <span className="bracket">Keep reading</span>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {related.map((a) => (
              <Link key={a.slug} href={`/blog/${a.slug}`} className="group overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-orange-500/40">
                <Picture image={blogImage(a.slug)} className="aspect-[16/9]" rounded="rounded-none" sizes="33vw" />
                <div className="p-5">
                <span className="bracket-muted text-[10px]">{a.category}</span>
                <h3 className="mt-3 font-display text-lg font-semibold leading-snug text-ink">{a.title}</h3>
                <span className="mt-4 inline-flex items-center gap-1 text-xs text-orange-400">
                  Read <ArrowUpRight className="size-3.5" />
                </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <CTABand block={finalCta} />
    </>
  );
}
