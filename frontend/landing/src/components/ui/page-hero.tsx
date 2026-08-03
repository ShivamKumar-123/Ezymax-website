"use client";

import { easings } from "@react-spring/web";
import TextEngine from "spring-text-engine";

import { Inview } from "@/components/animation/springs/in-view";
import { BackLink } from "@/components/ui/back-link";
import { Eyebrow } from "@/components/ui/eyebrow";

export interface PageHeroProps {
  eyebrow: string;
  heading: string;
  intro?: string;
  backHref: string;
  backLabel: string;
}

/**
 * Sub-page opener: back link + eyebrow + line-revealed h1 + optional intro.
 * The h1 twin of `SectionHeading` — kept separate so every page keeps exactly
 * one h1 (html-semantics.md).
 */
export const PageHero = ({
  eyebrow,
  heading,
  intro,
  backHref,
  backLabel,
}: PageHeroProps) => (
  <header className="shell px-5 pt-28 pb-4 sm:px-8 sm:pt-32">
    <Inview
      tag="div"
      mode="once"
      from={{ opacity: 0, y: 10 }}
      to={{ opacity: 1, y: 0 }}
      config={{ tension: 200, friction: 24 }}
      className="flex flex-col items-start gap-6"
    >
      <BackLink href={backHref}>{backLabel}</BackLink>
      <Eyebrow>{eyebrow}</Eyebrow>
    </Inview>

    <TextEngine
      tag="h1"
      mode="once"
      delayIn={140}
      className="mt-5 max-w-[18ch] justify-start text-left text-4xl leading-display font-bold tracking-display sm:text-5xl md:text-6xl"
      lineIn={{ y: "0%", opacity: 1 }}
      lineOut={{ y: "100%", opacity: 0 }}
      lineStagger={100}
      lineConfig={{ duration: 900, easing: easings.easeOutCubic }}
      overflow
    >
      {heading}
    </TextEngine>

    {intro ? (
      <Inview
        tag="p"
        mode="once"
        delayIn={240}
        from={{ opacity: 0, y: 12 }}
        to={{ opacity: 1, y: 0 }}
        config={{ tension: 200, friction: 24 }}
        className="mt-6 max-w-2xl text-base leading-relaxed text-foreground/60"
      >
        {intro}
      </Inview>
    ) : null}
  </header>
);
