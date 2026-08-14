"use client";

import { Eyebrow } from "./ui/eyebrow";
import { GlassButton } from "./ui/glass-button";
import type { ExperienceCopy } from "./content";

import { useExperiencePhase } from "./experience";
import { Reveal } from "./reveal";
import { SectionTitle } from "./section-title";

// TextEngine lays its words out as inline-blocks, so `text-align: center` alone
// doesn't reliably centre them — drive centring with a flex container instead.
export const HERO_TITLE_CLASS =
  "flex flex-wrap justify-center font-display text-display font-normal leading-title tracking-title text-center text-foreground text-fade-trailing";

export interface HeroSectionProps {
  content: ExperienceCopy;
}

export const HeroSection = ({ content }: HeroSectionProps) => {
  const state = useExperiencePhase((s) => s.hero);

  return (
    <section
      aria-label="Introduction"
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-5 text-center"
    >
      <Reveal state={state} className="mb-10">
        <Eyebrow>{content.eyebrow}</Eyebrow>
      </Reveal>

      <Reveal state={state} enterAnimated={false} className="mb-6 max-w-title">
        <SectionTitle
          tag="h1"
          text={content.titleLines.join(" ")}
          className={HERO_TITLE_CLASS}
        />
      </Reveal>

      <Reveal
        state={state}
        tag="p"
        className="mb-12 max-w-lead text-lead leading-normal text-muted"
      >
        {content.subtitle}
      </Reveal>

      <Reveal
        state={state}
        className="flex gap-4 max-md:w-full max-md:max-w-75 max-md:flex-col"
      >
        {content.buttons.map((button) => (
          <GlassButton
            key={button.label}
            variant={button.withArrow ? "primary" : "secondary"}
            withArrow={button.withArrow}
          >
            {button.label}
          </GlassButton>
        ))}
      </Reveal>
    </section>
  );
};
