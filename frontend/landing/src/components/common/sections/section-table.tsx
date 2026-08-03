"use client";

import { Inview } from "@/components/animation/springs/in-view";
import { PullQuote } from "@/components/ui/pull-quote";
import { SectionHeading } from "@/components/ui/section-heading";

export interface SectionTableProps {
  id: string;
  eyebrow: string;
  heading: string;
  intro?: string;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
  footnote?: string;
  quote?: string;
}

/** Spec-table section — tiers, ladders, term sheets. */
export const SectionTable = ({
  id,
  eyebrow,
  heading,
  intro,
  columns,
  rows,
  footnote,
  quote,
}: SectionTableProps) => (
  <section id={id} aria-label={eyebrow} className="relative z-10">
    <div className="shell px-5 py-20 sm:px-8 lg:py-28">
      <SectionHeading eyebrow={eyebrow} heading={heading} intro={intro} />

      <Inview
        tag="div"
        mode="once"
        delayIn={160}
        from={{ opacity: 0, y: 24 }}
        to={{ opacity: 1, y: 0 }}
        config={{ tension: 180, friction: 26 }}
        className="mt-12 overflow-x-auto rounded-card border border-line bg-glass backdrop-blur-glass"
      >
        <table className="w-full min-w-md text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="px-6 py-4 text-xs font-medium font-mono tracking-label text-foreground/45 uppercase"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row[0]}
                className="border-b border-line/60 transition-colors duration-[var(--duration-fast)] ease-entrance last:border-b-0 hover:bg-white/[0.03]"
              >
                {row.map((cell, cellIndex) =>
                  cellIndex === 0 ? (
                    <th
                      key={cell}
                      scope="row"
                      className="px-6 py-4 font-medium text-foreground"
                    >
                      {cell}
                    </th>
                  ) : (
                    <td
                      key={cell}
                      className="px-6 py-4 text-foreground/65 tabular-nums"
                    >
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Inview>

      {footnote ? (
        <Inview
          tag="p"
          mode="once"
          from={{ opacity: 0, y: 12 }}
          to={{ opacity: 1, y: 0 }}
          config={{ tension: 200, friction: 24 }}
          className="mt-6 text-xs leading-relaxed text-foreground/45"
        >
          {footnote}
        </Inview>
      ) : null}

      {quote ? <PullQuote>{quote}</PullQuote> : null}
    </div>
  </section>
);
