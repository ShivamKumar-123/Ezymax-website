"use client";

import Image from "next/image";

import { Inview } from "@/components/animation/springs/in-view";
import { ArrowRight } from "@/components/ui/icons";
import { PullQuote } from "@/components/ui/pull-quote";
import { SectionHeading } from "@/components/ui/section-heading";
import type { staking } from "@/data/mocks/home";

export interface StakingProps {
  content: typeof staking;
}

export const Staking = ({ content }: StakingProps) => (
  <section id="staking" className="relative z-10">
    <div className="shell px-5 py-20 sm:px-8 lg:py-28">
      <SectionHeading
        eyebrow={content.eyebrow}
        heading={content.heading}
        intro={content.intro}
      />

      <p className="mt-10 text-sm font-medium font-mono tracking-label text-foreground/45 uppercase">
        {content.flow}
      </p>

      <ol className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-stretch">
        {content.steps.map((step, index) => (
          <Inview
            key={step}
            tag="li"
            mode="once"
            delayIn={index * 110}
            from={{ opacity: 0, y: 28 }}
            to={{ opacity: 1, y: 0 }}
            config={{ tension: 200, friction: 22 }}
            className="flex flex-1 items-center gap-4"
          >
            <span className="flex flex-1 items-center gap-4 rounded-card bg-glass p-6 backdrop-blur-glass">
              <span className="grid size-10 shrink-0 place-items-center rounded-pill bg-ink text-sm font-medium text-white">
                {index + 1}
              </span>
              <span>
                <span className="block text-xs font-mono tracking-label text-foreground/45 uppercase">
                  Step {index + 1}
                </span>
                <span className="block text-lg font-medium">{step}</span>
              </span>
            </span>
            {index < content.steps.length - 1 ? (
              <ArrowRight className="hidden shrink-0 text-xl text-foreground/30 sm:block" />
            ) : null}
          </Inview>
        ))}
      </ol>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_0.85fr]">
      <Inview
        tag="div"
        mode="once"
        from={{ opacity: 0, y: 24 }}
        to={{ opacity: 1, y: 0 }}
        config={{ tension: 180, friction: 26 }}
        className="rounded-card border border-line bg-surface/60 p-8 backdrop-blur-sm"
      >
        <p className="max-w-3xl text-sm leading-relaxed text-foreground/60">
          {content.body}
        </p>
        <ul className="mt-6 flex flex-wrap gap-3">
          {content.points.map((point) => (
            <li
              key={point}
              className="inline-flex rounded-pill bg-surface px-4 py-2 text-sm text-foreground/70"
            >
              {point}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-foreground/45">Note: {content.note}</p>
        <p className="mt-2 text-xs text-foreground/45">{content.footnote}</p>
      </Inview>

        <Inview
          tag="figure"
          mode="once"
          delayIn={120}
          from={{ opacity: 0, scale: 0.97 }}
          to={{ opacity: 1, scale: 1 }}
          config={{ tension: 180, friction: 26 }}
          className="relative min-h-72 overflow-hidden rounded-card ring-1 ring-accent/25"
        >
          <Image
            src={content.image}
            alt={content.imageAlt}
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover object-center"
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.75),transparent_60%)]"
          />
        </Inview>
      </div>

      <PullQuote>{content.quote}</PullQuote>
    </div>
  </section>
);
