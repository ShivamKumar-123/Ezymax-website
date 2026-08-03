"use client";

import Image from "next/image";

import { Inview } from "@/components/animation/springs/in-view";
import { PullQuote } from "@/components/ui/pull-quote";
import { SectionHeading } from "@/components/ui/section-heading";
import type { howItWorks } from "@/data/mocks/home";

export interface HowItWorksProps {
  content: typeof howItWorks;
}

export const HowItWorks = ({ content }: HowItWorksProps) => (
  <section id="how-it-works" className="relative z-10 bg-surface/70 text-foreground backdrop-blur-sm">
    <div className="shell px-5 py-20 sm:px-8 lg:py-28">
      <SectionHeading
        eyebrow={content.eyebrow}
        heading={content.heading}
        intro={content.intro}
        tone="light"
      />

      <Inview
        tag="div"
        mode="once"
        from={{ opacity: 0, y: 24 }}
        to={{ opacity: 1, y: 0 }}
        config={{ tension: 180, friction: 26 }}
        className="relative mt-12 h-40 overflow-hidden rounded-card ring-1 ring-accent/25 sm:h-56"
      >
        <Image
          src={content.band}
          alt={content.bandAlt}
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,.85),rgba(0,0,0,.15),rgba(0,0,0,.85))]"
        />
      </Inview>

      <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {content.steps.map((step, index) => (
          <Inview
            key={step.title}
            tag="li"
            mode="once"
            delayIn={index * 70}
            from={{ opacity: 0, y: 28 }}
            to={{ opacity: 1, y: 0 }}
            config={{ tension: 200, friction: 24 }}
            className="group relative overflow-hidden rounded-card-sm bg-glass p-6 ring-1 ring-white/10 backdrop-blur-glass transition-colors duration-[var(--duration-normal)] ease-entrance hover:bg-white/[0.07] hover:ring-accent/40"
          >
            <span
              aria-hidden
              className="absolute -top-4 right-3 text-6xl font-bold text-white/[0.05] tabular-nums transition-colors duration-[var(--duration-normal)] ease-entrance group-hover:text-accent/15"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="relative block h-px w-10 bg-accent" />
            <h3 className="relative mt-4 text-lg font-medium">{step.title}</h3>
            <p className="relative mt-2 text-sm leading-relaxed text-white/55">
              {step.body}
            </p>
          </Inview>
        ))}
      </ol>

      <PullQuote tone="light">{content.quote}</PullQuote>
    </div>
  </section>
);
