"use client";

import { Eyebrow } from "./ui/eyebrow";
import { GlassButton } from "./ui/glass-button";
import type { ExperienceCopy } from "./content";

import { useExperiencePhase } from "./experience";
import { HERO_TITLE_CLASS } from "./hero-section";
import { Reveal } from "./reveal";
import { SectionTitle } from "./section-title";

export interface GalaxySectionProps {
  content: ExperienceCopy;
}

export const GalaxySection = ({ content }: GalaxySectionProps) => {
  const state = useExperiencePhase((s) => s.galaxy);

  return (
    <section
      aria-label="Our product ecosystem"
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-between px-5 py-[15vh] text-center"
    >
      {/* A dark wash under the copy. The stage behind it went from the
          source project's blue/orange to the brand lime, which is a much
          brighter ring, and white text stopped reading against it. Radial
          so the glow still shows at the edges — it darkens where the words
          are, not the whole frame. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(60%_45%_at_50%_50%,rgba(0,0,0,0.72),rgba(0,0,0,0.45)_55%,transparent_80%)]"
      />
      <div className="flex flex-col items-center">
        <Reveal state={state} className="mb-10">
          <Eyebrow>{content.eyebrow}</Eyebrow>
        </Reveal>

        {state === "visible" && (
          <Reveal state={state} enterAnimated={false} className="max-w-title">
            <SectionTitle
              tag="h2"
              text={content.titleLines.join(" ")}
              className={HERO_TITLE_CLASS}
            />
          </Reveal>
        )}
      </div>

      <div className="flex flex-col items-center">
        <Reveal
          state={state}
          tag="p"
          className="mb-8 max-w-lead text-lead leading-normal text-muted"
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
