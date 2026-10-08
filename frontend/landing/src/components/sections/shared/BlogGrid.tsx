"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ArticleMeta } from "@/content/schema";
import { blogImage } from "@/content/images";
import { Picture } from "@/components/ui/Picture";

export function BlogGrid({ articles, categories }: { articles: ArticleMeta[]; categories: readonly string[] }) {
  const [active, setActive] = useState<string>("All");
  const list = active === "All" ? articles : articles.filter((a) => a.category === active);
  return (
    <div>
      <div className="mb-10 flex flex-wrap gap-2">
        {["All", ...categories].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActive(c)}
            className={cn(
              "rounded-full border px-4 py-2 text-xs font-medium transition-colors",
              active === c ? "border-orange-500 bg-orange-500 text-black" : "border-line text-muted hover:border-orange-500/50 hover:text-ink",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a, i) => (
          <Link
            key={a.slug}
            href={`/blog/${a.slug}`}
            className="group relative flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-all duration-500 ease-out-expo hover:-translate-y-1 hover:border-orange-500/40"
          >
            <div className="relative aspect-[16/10]">
              <Picture image={blogImage(a.slug)} className="absolute inset-0" rounded="rounded-none" sizes="(max-width: 640px) 100vw, 33vw" />
              <span className="absolute top-4 left-4 rounded-full bg-black/55 px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-ink uppercase backdrop-blur-md">{a.category}</span>
              <span className="absolute top-4 right-4 font-mono text-xs text-ink/70">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <div className="relative p-6">
              <h3 className="font-display text-xl font-semibold leading-snug text-ink">{a.title}</h3>
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">{a.excerpt}</p>
              <div className="mt-5 flex items-center justify-between text-xs text-dim">
                <span>
                  {new Date(a.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {a.readingTime}
                </span>
                <ArrowUpRight className="size-4 text-orange-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </div>
          </Link>
        ))}
      </div>
      {list.length === 0 ? <p className="mt-10 text-sm text-muted">No articles in this category yet.</p> : null}
    </div>
  );
}
