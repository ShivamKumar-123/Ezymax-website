import { AlertTriangle } from "lucide-react";
import type { LegalDoc } from "@/content/schema";
import { PageHero } from "@/components/sections/shared/PageHero";

export function LegalTemplate({ doc }: { doc: LegalDoc }) {
  return (
    <>
      <PageHero eyebrow="Legal" headline={doc.title} compact />
      <section className="relative pb-24">
        <div className="container-x max-w-3xl">
          <p className="font-mono text-xs tracking-wide text-dim uppercase">Last updated {doc.updated}</p>
          <div className="mt-6 flex items-start gap-3 rounded-card border border-orange-500/30 bg-orange-500/10 p-5 text-sm text-orange-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{doc.intro}</p>
          </div>
          <div className="mt-10 space-y-10">
            {doc.sections.map((s) => (
              <div key={s.heading}>
                <h2 className="font-display text-2xl font-semibold text-ink">{s.heading}</h2>
                <div className="mt-4 space-y-4 text-base leading-relaxed text-muted">
                  {s.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
