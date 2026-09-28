"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Card, Chip, PageHeader, cn } from "@kalks/ui";
import { useAcademy, type Glossary } from "./api";
import { AcademyUnavailable, BackLink, PageSkeleton } from "./shared";

export function LiveGlossary() {
  const sp = useSearchParams();
  const { data, error, reload } = useAcademy<Glossary>("glossary");
  const [q, setQ] = React.useState(sp.get("q") ?? "");
  const [cat, setCat] = React.useState<string>("");
  const [flash, setFlash] = React.useState<string | null>(null);

  const list = React.useMemo(() => {
    const n = q.trim().toLowerCase();
    return (data?.terms ?? []).filter((t) => (!cat || t.category === cat) && (!n || t.term.toLowerCase().includes(n) || t.definition.toLowerCase().includes(n)));
  }, [data, q, cat]);
  // exact / prefix matches first when searching
  const sorted = React.useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return list;
    const rank = (t: string) => (t.toLowerCase() === n ? 0 : t.toLowerCase().startsWith(n) ? 1 : t.toLowerCase().includes(n) ? 2 : 3);
    return [...list].sort((a, b) => rank(a.term) - rank(b.term) || a.term.localeCompare(b.term));
  }, [list, q]);
  const letters = React.useMemo(() => Array.from(new Set((data?.terms ?? []).map((t) => t.term[0]!.toUpperCase()))).sort(), [data]);

  if (error) return <AcademyUnavailable error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;

  const jump = (slug: string) => {
    setQ("");
    setCat("");
    setFlash(slug);
    requestAnimationFrame(() => document.getElementById(`term-${slug}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    setTimeout(() => setFlash(null), 1600);
  };

  return (
    <div className="pb-16">
      <BackLink href="/academy">Academy</BackLink>
      <PageHeader title="Glossary" subtitle={`${data.total} trading terms, from ask price to yield curve, in plain language.`} />
      <Card className="sticky top-20 z-10 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex h-10 flex-1 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5">
            <Search className="size-4 text-fg-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search terms and definitions" aria-label="Search terms" data-testid="glossary-search" className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-fg-3" autoFocus={!!sp.get("q")} />
            {q && (
              <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="text-fg-3 hover:text-fg">
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            <button type="button" onClick={() => setCat("")} className={cn("h-8 shrink-0 rounded-full border px-3 text-[12px]", !cat ? "border-ember/40 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-3 hover:text-fg")}>
              All
            </button>
            {data.categories.map((c) => (
              <button key={c.name} type="button" onClick={() => setCat(cat === c.name ? "" : c.name)} className={cn("h-8 shrink-0 rounded-full border px-3 text-[12px]", cat === c.name ? "border-ember/40 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-3 hover:text-fg")}>
                {c.name} <span className="k-num text-fg-3">{c.count}</span>
              </button>
            ))}
          </div>
        </div>
        {!q && !cat && (
          <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-3">
            {letters.map((l) => (
              <a key={l} href={`#letter-${l}`} className="k-num grid size-7 place-items-center rounded-full text-[12px] text-fg-3 hover:bg-surface-3 hover:text-fg">
                {l}
              </a>
            ))}
          </div>
        )}
      </Card>

      <div className="k-num mb-3 mt-5 text-[12.5px] text-fg-3" data-testid="glossary-count">
        {sorted.length} {sorted.length === 1 ? "term" : "terms"}
      </div>
      {sorted.length === 0 ? (
        <Card className="py-14 text-center text-[13.5px] text-fg-3">No terms match “{q}”. Try a shorter word.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {sorted.map((t, i) => {
            const first = !q && !cat && (i === 0 || sorted[i - 1]!.term[0]!.toUpperCase() !== t.term[0]!.toUpperCase());
            return (
              <Card key={t.slug} id={`term-${t.slug}`} className={cn("scroll-mt-40 p-5 transition-colors", flash === t.slug && "border-ember/60")} data-testid="glossary-term">
                {first && <span id={`letter-${t.term[0]!.toUpperCase()}`} className="block scroll-mt-44" />}
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[15.5px] font-medium tracking-tight">{t.term}</h3>
                  <Chip size="sm">{t.category}</Chip>
                </div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-2">{t.definition}</p>
                {t.related.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px]">
                    <span className="text-fg-3">Related:</span>
                    {t.related.map((r) => (
                      <button key={r.slug} type="button" onClick={() => jump(r.slug)} className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-fg-2 hover:text-fg">
                        {r.term}
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
