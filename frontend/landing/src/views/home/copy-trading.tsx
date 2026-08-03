"use client";

import { easings } from "@react-spring/web";
import TextEngine from "spring-text-engine";

import { Inview } from "@/components/animation/springs/in-view";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PullQuote } from "@/components/ui/pull-quote";
import type { copyTrading } from "@/data/mocks/home";

export interface CopyTradingProps {
  content: typeof copyTrading;
}

/**
 * No performance statistics here on purpose: only numbers generated
 * on-platform get published, and there are none yet. Unverifiable ROI/volume
 * claims are what scammy copy platforms lead with.
 */
export const CopyTrading = ({ content }: CopyTradingProps) => (
  <section id="copy-trading" className="relative z-10">
    <div className="shell px-5 py-20 sm:px-8 lg:py-28">
      <div className="flex flex-col gap-5">
        <Inview
          tag="div"
          mode="once"
          from={{ opacity: 0, y: 10 }}
          to={{ opacity: 1, y: 0 }}
          config={{ tension: 200, friction: 24 }}
        >
          <Eyebrow>{content.eyebrow}</Eyebrow>
        </Inview>

        <TextEngine
          tag="h2"
          mode="once"
          delayIn={120}
          className="max-w-[22ch] justify-start text-left text-3xl leading-display font-bold tracking-display sm:text-4xl md:text-5xl"
          lineIn={{ y: "0%", opacity: 1 }}
          lineOut={{ y: "100%", opacity: 0 }}
          lineStagger={100}
          lineConfig={{ duration: 900, easing: easings.easeOutCubic }}
          overflow
        >
          {content.headlineLines.join(" ")}
        </TextEngine>

        <Inview
          tag="div"
          mode="once"
          delayIn={220}
          from={{ opacity: 0, y: 12 }}
          to={{ opacity: 1, y: 0 }}
          config={{ tension: 200, friction: 24 }}
          className="flex flex-wrap items-center gap-4"
        >
          <ul className="flex -space-x-3">
            {content.avatars.map((initials) => (
              <li
                key={initials}
                className="grid size-11 place-items-center rounded-pill bg-ink text-xs font-medium text-white ring-2 ring-background"
              >
                {initials}
              </li>
            ))}
            <li className="grid size-11 place-items-center rounded-pill bg-accent text-sm font-medium text-white ring-2 ring-background">
              +
            </li>
          </ul>
          <p className="max-w-xl text-sm leading-relaxed text-foreground/60">
            {content.intro}
          </p>
        </Inview>
      </div>

      <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {content.features.map((feature, index) => (
          <Inview
            key={feature.title}
            tag="li"
            mode="once"
            delayIn={index * 90}
            from={{ opacity: 0, y: 24 }}
            to={{ opacity: 1, y: 0 }}
            config={{ tension: 200, friction: 24 }}
            className="rounded-card border border-line bg-glass p-7 backdrop-blur-glass transition-all duration-[var(--duration-normal)] ease-entrance hover:-translate-y-2 hover:border-accent/50"
          >
            <h3 className="text-xl font-medium">{feature.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-foreground/60">
              {feature.body}
            </p>
          </Inview>
        ))}
      </ul>

      <Inview
        tag="p"
        mode="once"
        from={{ opacity: 0, y: 12 }}
        to={{ opacity: 1, y: 0 }}
        config={{ tension: 200, friction: 24 }}
        className="mt-8 text-xs leading-relaxed text-foreground/45"
      >
        {content.disclaimer}
      </Inview>

      <PullQuote>{content.quote}</PullQuote>
    </div>
  </section>
);
