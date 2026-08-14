"use client";

import { useEffect, useRef } from "react";

import { subscribeToTicker } from "@/lib/animation/ticker";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PillButton } from "@/components/ui/pill-button";

import { ParticleCanvas, EXPERIENCE_SCREENS } from "./particle-canvas";
import { HeroSection } from "./hero-section";
import { DnaCards } from "./dna-cards";
import { WaveSection } from "./wave-section";
import { GalaxySection } from "./galaxy-section";
import { homeContent } from "./content";

/**
 * The ported "New Era" intro experience, wired into the FX Artha home in place
 * of the old hero. On desktop a fixed WebGL stage (particle morph + the four
 * scroll-revealed overlays) plays over a tall scroll driver, then fades out to
 * hand off to the normal FX Artha sections below. On mobile (WebGL off) it
 * collapses to a simple centred hero.
 */
export const NewEraExperience = () => {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // Fade the whole fixed stage out over the last part of the experience so
    // the content sections below scroll in cleanly.
    const update = () => {
      const scrollTop =
        document.documentElement.scrollTop || document.body.scrollTop;
      const expHeight = window.innerHeight * EXPERIENCE_SCREENS;
      const raw = expHeight > 0 ? scrollTop / expHeight : 0;
      const opacity = 1 - Math.min(Math.max((raw - 1) / 0.25, 0), 1);
      stage.style.opacity = String(opacity);
      stage.style.pointerEvents = opacity < 0.05 ? "none" : "";
    };

    update();
    const unsub = subscribeToTicker(update, () => 0);
    return () => unsub();
  }, []);

  return (
    <section id="home" aria-label="Introduction">
      {/* Desktop: fixed particle-experience stage. */}
      <div ref={stageRef} className="fixed inset-0 z-0 hidden md:block">
        <ParticleCanvas />
        <HeroSection content={homeContent.hero} />
        <DnaCards cards={homeContent.cards} />
        <WaveSection content={homeContent.wave} />
        <GalaxySection content={homeContent.galaxy} />
      </div>

      {/* Desktop scroll driver — gives the experience its scroll length, plus a
          ~2.5-screen tail so the stage fully fades out BEFORE the content
          sections below scroll in (otherwise the last (galaxy) beat overlaps
          the first FX Artha section). */}
      <div
        aria-hidden="true"
        className="hidden md:block"
        style={{ height: `${(EXPERIENCE_SCREENS + 2.5) * 100}vh` }}
      />

      {/* Mobile fallback: a simple centred hero (no WebGL). */}
      <div className="flex min-h-lvh flex-col items-center justify-center px-5 text-center md:hidden">
        <div className="mb-8">
          <Eyebrow>{homeContent.hero.eyebrow}</Eyebrow>
        </div>
        <h1 className="max-w-[18ch] text-4xl font-bold leading-display tracking-display">
          {homeContent.hero.titleLines.join(" ")}
        </h1>
        <p className="mt-6 max-w-md text-base leading-normal text-foreground/60">
          {homeContent.hero.subtitle}
        </p>
        <div className="mt-10 flex w-full max-w-xs flex-col gap-4">
          {homeContent.hero.buttons.map((b) => (
            <PillButton
              key={b.label}
              variant={b.withArrow ? "dark" : "outline"}
              arrow={b.withArrow ? "up-right" : undefined}
            >
              {b.label}
            </PillButton>
          ))}
        </div>
      </div>
    </section>
  );
};
