import { MarkReady } from "@/components/common/mark-ready";
import { PageHero } from "@/components/ui/page-hero";

import type { LegalBlock, LegalDoc } from "@/data/mocks/legal";

/**
 * Presentational renderer for a legal document (Privacy / Terms / Risk).
 * Server Component — the only client leaf is `PageHero`. Content is passed
 * in via `doc` (data lives in `src/data/mocks/legal.ts`).
 */
export const LegalDocument = ({ doc }: { doc: LegalDoc }) => (
  <>
    <MarkReady />
    <main id="main">
      <PageHero
        eyebrow={doc.eyebrow}
        heading={doc.title}
        intro={doc.intro}
        backHref="/"
        backLabel="Back to home"
      />

      <div className="shell px-5 pb-28 sm:px-8">
        <p className="text-sm text-foreground/45">{doc.updated}</p>

        <div className="mt-12 flex max-w-3xl flex-col gap-12">
          {doc.sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold tracking-display text-foreground sm:text-2xl">
                {section.heading}
              </h2>
              <div className="flex flex-col gap-4">
                {section.blocks.map((block, i) => (
                  <Block key={i} block={block} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  </>
);

const Block = ({ block }: { block: LegalBlock }) => {
  switch (block.kind) {
    case "text":
      return <p className="leading-relaxed text-foreground/70">{block.text}</p>;

    case "list":
      return (
        <ul className="flex flex-col gap-2">
          {block.items.map((item) => (
            <li
              key={item}
              className="relative pl-5 leading-relaxed text-foreground/70 before:absolute before:left-0 before:top-[0.6em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-accent"
            >
              {item}
            </li>
          ))}
        </ul>
      );

    case "callout":
      return (
        <div className="rounded-2xl border border-accent/30 bg-accent/[0.06] p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            {block.title}
          </p>
          <p className="mt-2 leading-relaxed text-foreground/80">{block.text}</p>
        </div>
      );

    case "contact":
      return (
        <div className="rounded-2xl border border-line bg-surface p-6">
          <p className="font-semibold text-foreground">FX Artha {block.team}</p>
          <dl className="mt-3 flex flex-col gap-1 text-sm text-foreground/60">
            <div className="flex gap-2">
              <dt className="text-foreground/45">Email</dt>
              <dd>
                <a href={`mailto:${block.email}`} className="text-accent hover:underline">
                  {block.email}
                </a>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-foreground/45">Phone</dt>
              <dd>{block.phone}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-foreground/45">Address</dt>
              <dd>{block.address}</dd>
            </div>
          </dl>
        </div>
      );
  }
};
