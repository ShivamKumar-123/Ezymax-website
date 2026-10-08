import { AlertTriangle } from "lucide-react";

import { PageHero } from "@/components/sections/shared/PageHero";
import type { LegalBlock, LegalDoc } from "@/content/schema";

/**
 * Renders a legal document from its block list.
 *
 * The blocks are not flattened into paragraphs on purpose. A `callout` —
 * "You may lose your invested capital" — has to stay visually separated from
 * the prose around it; a risk disclosure whose warnings read as body text is
 * a risk disclosure that has failed at its one job.
 */
function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "text":
      return <p>{block.text}</p>;

    case "list":
      return (
        <ul className="list-disc space-y-2 pl-5 marker:text-orange-400">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );

    case "callout":
      return (
        <div className="flex items-start gap-3 rounded-card border-l-2 border-orange-500 glass px-5 py-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-400" />
          <div>
            <p className="font-medium text-ink">{block.title}</p>
            <p className="mt-1 text-sm">{block.text}</p>
          </div>
        </div>
      );

    case "contact":
      return (
        <div className="rounded-card border border-line bg-bg-2/60 px-5 py-4 text-sm">
          <p className="font-medium text-ink">{block.team}</p>
          <p className="mt-2">
            <a
              href={`mailto:${block.email}`}
              className="text-orange-400 hover:underline"
            >
              {block.email}
            </a>
          </p>
          <p className="mt-1">{block.phone}</p>
          <p className="mt-1">{block.address}</p>
        </div>
      );
  }
}

export function LegalTemplate({ doc }: { doc: LegalDoc }) {
  return (
    <>
      <PageHero eyebrow="Legal" headline={doc.title} compact />
      <section className="relative pb-24">
        <div className="container-x max-w-3xl">
          <p className="font-mono text-xs tracking-wide text-dim uppercase">
            {doc.updated}
          </p>
          <div className="mt-6 flex items-start gap-3 rounded-card border border-orange-500/30 bg-orange-500/10 p-5 text-sm text-orange-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{doc.intro}</p>
          </div>
          <div className="mt-10 space-y-10">
            {doc.sections.map((section) => (
              <div key={section.heading}>
                <h2 className="font-display text-2xl font-semibold text-ink">
                  {section.heading}
                </h2>
                <div className="mt-4 space-y-4 text-base leading-relaxed text-muted">
                  {section.blocks.map((block, i) => (
                    <Block key={i} block={block} />
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
