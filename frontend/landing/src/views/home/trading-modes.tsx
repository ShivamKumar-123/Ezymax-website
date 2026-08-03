"use client";

import Image from "next/image";

import { Inview } from "@/components/animation/springs/in-view";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SectionHeading } from "@/components/ui/section-heading";
import type { tradingModes } from "@/data/mocks/home";

export interface TradingModesProps {
  content: typeof tradingModes;
}

export const TradingModes = ({ content }: TradingModesProps) => (
  <section id="earning" className="relative z-10">
    <div className="shell px-5 py-20 sm:px-8 lg:py-28">
      <SectionHeading
        eyebrow={content.eyebrow}
        heading={content.heading}
        intro={content.intro}
      />

      <div className="mt-10">
        <Eyebrow>{content.label}</Eyebrow>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
        <ul className="grid grid-cols-1 gap-6">
        {content.modes.map((mode, index) => (
          <Inview
            key={mode.index}
            tag="li"
            mode="once"
            delayIn={index * 90}
            from={{ opacity: 0, y: 32 }}
            to={{ opacity: 1, y: 0 }}
            config={{ tension: 180, friction: 26 }}
            className="rounded-card border border-line bg-glass p-8 backdrop-blur-glass transition-all duration-[var(--duration-normal)] ease-entrance hover:border-accent/50"
          >
            <span className="text-sm font-medium text-foreground/40 tabular-nums">
              {mode.index}
            </span>
            <h3 className="mt-3 text-2xl font-medium tracking-display">
              {mode.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/60">
              {mode.body}
            </p>
            <ul className="mt-6 flex flex-col gap-2">
              {mode.points.map((point) => (
                <li
                  key={point}
                  className="flex items-center gap-3 text-sm text-foreground/70"
                >
                  <span className="size-1.5 shrink-0 rounded-pill bg-accent" />
                  {point}
                </li>
              ))}
            </ul>
          </Inview>
        ))}
        </ul>

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
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover object-center"
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.8),transparent_55%)]"
          />
          <figcaption className="absolute inset-x-6 bottom-6 text-sm text-foreground/75">
            {content.note}
          </figcaption>
        </Inview>
      </div>
    </div>
  </section>
);
