"use client";

import { LiquidReveal } from "@/components/common/liquid-reveal";
import { Typewriter } from "@/components/ui/typewriter";
import { useUi } from "@/lib/ui-store";
import type { heroContent } from "@/data/mocks/home";

export interface HeroProps {
  content: typeof heroContent;
}

export const Hero = ({ content }: HeroProps) => {
  const ready = useUi((state) => state.ready);

  return (
    // No background fill and no `isolate`: the section stays translucent so
    // the fixed lime cursor canvas underneath glows through the hero too,
    // rather than only appearing below it. Reusing that canvas keeps this to
    // one WebGL context.
    <section id="home" className="relative z-10 overflow-hidden rounded-b-card">
      {/* Both hero images, back with the brush animation: the jpg is the
          always-shown base, the png paints in along the cursor trail. */}
      <LiquidReveal
        beforeSrc={content.beforeSrc}
        afterSrc={content.afterSrc}
        alt="FX Artha trading platform"
        className="absolute inset-0 z-0 opacity-75"
      />

      {/* Dark on the left where the copy sits; opens up on the right so the
          art reads. */}
      <span className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(to_right,rgba(0,0,0,.88),rgba(0,0,0,.5)_45%,transparent)]" />

      {/* Lime wash, screen-blended so it lifts the highlights instead of
          flattening the art. */}
      <span className="pointer-events-none absolute inset-0 z-[2] mix-blend-screen bg-[radial-gradient(120%_80%_at_78%_55%,rgba(204,255,0,.22),rgba(158,199,0,.08)_45%,transparent_70%)]" />

      <div className="shell relative z-20 flex min-h-lvh flex-col justify-center px-5 py-32 sm:px-8">
        <h1 className="max-w-[16ch] min-h-[3.4em] text-left text-5xl leading-display font-bold tracking-display sm:text-6xl lg:text-7xl">
          <Typewriter phrases={content.headlineVariants} enabled={ready} />
        </h1>
      </div>
    </section>
  );
};
