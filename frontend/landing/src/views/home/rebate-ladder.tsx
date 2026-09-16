"use client";

import { Inview } from "@/components/animation/springs/in-view";
import type { rebateLadder } from "@/data/mocks/home";

export interface RebateLadderProps {
  content: typeof rebateLadder;
}

/**
 * The four rebate tiers, read left to right as a ladder.
 *
 * The rail above the cards is the whole point: a partner should see at a
 * glance that these are rungs of one ladder, not four unrelated plans. It
 * lights up to the tier being hovered, and the numbers are the same ones the
 * IB portal's calculator pays out on.
 */

/** Rungs reached, drawn as pips under each crest. */
const Pips = ({ filled, total }: { filled: number; total: number }) => (
  <span className="mt-4 flex items-center justify-center gap-1.5" aria-hidden>
    {Array.from({ length: total }).map((_, i) => (
      <span
        key={i}
        className={`size-1.5 rounded-pill ${i < filled ? "bg-accent" : "bg-white/20"}`}
      />
    ))}
  </span>
);

/** Tier crest. One drawing, its detail growing with the rung. */
const Crest = ({ rung }: { rung: number }) => (
  <svg
    viewBox="0 0 120 120"
    className="h-28 w-28 text-accent"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden
  >
    {/* blade */}
    <path d="M60 14v74" />
    <path d="M60 14l4 8-4 6-4-6 4-8z" />
    {/* guard */}
    <path d="M44 88h32" />
    <path d="M52 94h16" />
    {/* laurels — one pair per rung */}
    {Array.from({ length: rung }).map((_, i) => {
      const y = 34 + i * 13;
      const spread = 16 + i * 5;
      return (
        <g key={i}>
          <path d={`M60 ${y}c-${spread} 2-${spread + 4} 10-${spread - 2} 16`} />
          <path d={`M60 ${y}c${spread} 2 ${spread + 4} 10 ${spread - 2} 16`} />
        </g>
      );
    })}
    {/* crown, top rung only */}
    {rung >= 4 ? (
      <path d="M40 26l6-10 14 8 14-8 6 10" />
    ) : null}
  </svg>
);

export const RebateLadder = ({ content }: RebateLadderProps) => (
  <section id="rebate-ladder" className="relative z-10">
    <div className="shell px-5 py-20 sm:px-8 lg:py-28">
    <Inview
      tag="div"
      mode="once"
      from={{ opacity: 0, y: 16 }}
      to={{ opacity: 1, y: 0 }}
      config={{ tension: 200, friction: 24 }}
    >
      <h3 className="text-2xl font-bold tracking-display sm:text-3xl">
        {content.heading}
      </h3>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/60">
        {content.intro}
      </p>
    </Inview>

    {/* Rail — the rung markers sit on it, one per card. */}
    <div className="relative mt-12 hidden h-px w-full bg-white/10 lg:block" aria-hidden>
      <span className="absolute inset-y-0 left-0 w-full bg-[linear-gradient(to_right,transparent,var(--accent))]" />
      <span className="absolute inset-0 grid grid-cols-4">
        {content.tiers.map((tier, index) => (
          <span key={tier.name} className="relative">
            <span
              className={`absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-pill ${
                index === content.tiers.length - 1
                  ? "bg-accent shadow-glow"
                  : "bg-white/35"
              }`}
            />
          </span>
        ))}
      </span>
    </div>

    <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:mt-6 lg:grid-cols-4">
      {content.tiers.map((tier, index) => {
        const isTop = index === content.tiers.length - 1;
        return (
          <Inview
            key={tier.name}
            tag="article"
            mode="once"
            delayIn={index * 110}
            from={{ opacity: 0, y: 28 }}
            to={{ opacity: 1, y: 0 }}
            config={{ tension: 200, friction: 22 }}
            className={`flex flex-col rounded-card-sm p-7 ring-1 backdrop-blur-glass transition-colors duration-[var(--duration-normal)] ${
              isTop
                ? "bg-glass ring-accent/40 hover:ring-accent/70"
                : "bg-glass ring-line hover:ring-white/25"
            }`}
          >
            <div className="flex flex-col items-center">
              <Crest rung={index + 1} />
              <Pips filled={index + 1} total={content.tiers.length} />
            </div>

            <p className="mt-7 text-xs font-mono tracking-label text-foreground/45 uppercase">
              {tier.label}
            </p>
            <p className={`mt-1 text-2xl font-bold ${index > 0 ? "text-accent" : ""}`}>
              {tier.name}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-foreground/60">
              {tier.rule}
            </p>

            <p className="mt-auto pt-6">
              <span className="block border-t border-line pt-5 text-base font-bold">
                {tier.rate}
              </span>
            </p>
          </Inview>
        );
      })}
    </div>

      <p className="mt-6 text-xs text-foreground/45">{content.note}</p>
    </div>
  </section>
);
