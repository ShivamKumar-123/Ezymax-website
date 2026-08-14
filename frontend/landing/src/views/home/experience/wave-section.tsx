"use client";

import { Eyebrow } from "./ui/eyebrow";
import { GlassButton } from "./ui/glass-button";
import type { ExperienceCopy } from "./content";

import { useExperiencePhase } from "./experience";
import { Reveal } from "./reveal";
import { SectionTitle } from "./section-title";

const WAVE_TITLE_CLASS =
  "flex flex-wrap justify-start font-display text-display-sm font-normal leading-title tracking-title text-left text-foreground text-fade-trailing";

export interface WaveSectionProps {
  content: ExperienceCopy;
}

export const WaveSection = ({ content }: WaveSectionProps) => {
  const state = useExperiencePhase((s) => s.wave);

  return (
    <section
      aria-label="The pull of results"
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-15 px-[10vw] text-left max-lg:flex-col max-lg:items-start max-lg:justify-center max-lg:gap-8 max-lg:px-6"
    >
      <div className="flex max-w-title-sm flex-1 flex-col items-start max-lg:max-w-full">
        <Reveal state={state} className="mb-6">
          <Eyebrow>{content.eyebrow}</Eyebrow>
        </Reveal>

        {state !== "before" && (
          <Reveal state={state} enterAnimated={false}>
            <SectionTitle
              tag="h2"
              text={content.titleLines.join(" ")}
              className={WAVE_TITLE_CLASS}
            />
          </Reveal>
        )}
      </div>

      <div className="flex max-w-lead-sm flex-1 flex-col items-start max-lg:max-w-full">
        <Reveal
          state={state}
          tag="p"
          className="mb-10 text-left text-lead leading-normal text-muted"
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
      </div>
    </section>
  );
};
