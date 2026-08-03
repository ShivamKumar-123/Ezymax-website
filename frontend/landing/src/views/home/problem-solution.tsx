"use client";

import Image from "next/image";

import { Inview } from "@/components/animation/springs/in-view";
import { PullQuote } from "@/components/ui/pull-quote";
import { SectionHeading } from "@/components/ui/section-heading";
import type { problemSolution } from "@/data/mocks/home";

export interface ProblemSolutionProps {
  content: typeof problemSolution;
}

type Card = (typeof problemSolution)["cards"][number];

/**
 * Hero-scale split row: big art on one side, the step sequence on the other,
 * sides alternating per row (broker = image right, FX Artha = image left).
 * The art carries the meaning — red for the custodial problem, lime for the
 * contract-settled path.
 */
const SplitRow = ({ card, index }: { card: Card; index: number }) => {
  const isSolution = index === 1;

  return (
    <Inview
      tag="li"
      mode="once"
      from={{ opacity: 0, y: 48 }}
      to={{ opacity: 1, y: 0 }}
      config={{ tension: 180, friction: 26 }}
    >
      <article className="group grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2 lg:gap-12">
        <div
          className={`flex flex-col justify-center py-4 lg:py-10 ${
            isSolution ? "lg:order-2" : ""
          }`}
        >
          <span
            className={`inline-flex items-center gap-3 font-mono text-sm tracking-label uppercase ${
              isSolution ? "text-accent" : "text-foreground/60"
            }`}
          >
            <span
              className={`h-px w-10 ${isSolution ? "bg-accent" : "bg-foreground/40"}`}
            />
            {String(index + 1).padStart(2, "0")}
          </span>

          <h3
            className={`mt-4 text-4xl leading-display font-bold tracking-display sm:text-5xl lg:text-6xl ${
              isSolution ? "text-accent" : "text-foreground"
            }`}
          >
            {card.title}
          </h3>

          <ol className="mt-8 flex flex-col gap-3 text-base leading-relaxed text-foreground/70 sm:text-lg">
            {card.steps.map((step, stepIndex) => (
              <li key={step} className="flex items-baseline gap-4">
                <span
                  className={`font-mono text-xs tabular-nums ${
                    isSolution ? "text-accent-from" : "text-foreground/40"
                  }`}
                >
                  {String(stepIndex + 1).padStart(2, "0")}
                </span>
                {step}
              </li>
            ))}
          </ol>

          <p
            className={`mt-8 text-lg font-bold tracking-display ${
              isSolution ? "text-accent-from" : "text-foreground/60"
            }`}
          >
            → {card.closing}
          </p>
        </div>

        <div
          className={`relative min-h-72 overflow-hidden rounded-card ring-1 sm:min-h-96 lg:min-h-[75lvh] ${
            isSolution ? "ring-accent/40 lg:order-1" : "ring-line"
          }`}
        >
          <Image
            src={card.image}
            alt=""
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover object-center opacity-70 transition-opacity duration-[var(--duration-normal)] ease-entrance group-hover:opacity-90"
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.7),rgba(0,0,0,.15)_50%,rgba(0,0,0,.35))]"
          />
          <span
            aria-hidden
            className="absolute right-6 bottom-4 font-mono text-8xl font-bold text-white/[0.07] tabular-nums select-none"
          >
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
      </article>
    </Inview>
  );
};

export const ProblemSolution = ({ content }: ProblemSolutionProps) => (
  <section id="protocol" className="relative z-10">
    <div className="shell px-5 py-20 sm:px-8 lg:py-28">
      <SectionHeading
        eyebrow={content.eyebrow}
        heading={content.heading}
        intro={content.intro}
      />

      <ul className="mt-14 flex flex-col gap-16 lg:gap-24">
        {content.cards.map((card, index) => (
          <SplitRow key={card.title} card={card} index={index} />
        ))}
      </ul>

      <PullQuote>{content.quote}</PullQuote>
    </div>
  </section>
);
