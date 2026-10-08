import { ArrowDown } from "lucide-react";
import { heroFloatingStats, heroTypewriter, homeHero } from "@/content/home";
import { Badge } from "@/components/ui/Badge";
import { CtaButton } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { FloatingStat } from "@/components/ui/StatTile";
import { Typewriter } from "@/components/ui/Typewriter";
import { HeroScene } from "@/components/three/HeroScene";

export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col overflow-hidden pt-28 md:pt-36">
      {/* Orange-to-red glow field behind the scene */}
      <div className="pointer-events-none absolute top-[5%] left-[28%] h-[75vh] w-[80vw] ember-glow opacity-80" aria-hidden />
      <div className="pointer-events-none absolute -top-20 left-[-15%] h-[420px] w-[520px] rounded-full bg-orange-700/15 blur-[140px]" aria-hidden />

      {/* 3D scene (desktop) or CSS fallback */}
      <div className="absolute inset-y-0 right-0 w-full lg:left-[34%] lg:w-auto">
        <HeroScene />
      </div>
      <div className="pointer-events-none absolute top-[10%] left-[38%] hidden h-[65vh] w-[62vw] ember-glow opacity-30 mix-blend-screen lg:block" aria-hidden />

      <div className="container-x relative z-10 flex flex-1 flex-col">
        <div className="max-w-2xl">
          <Reveal>
            <Badge variant="bracket">{homeHero.eyebrow}</Badge>
          </Reveal>
          <Reveal delay={0.06}>
            <h1 className="mt-6 font-display text-[44px] font-semibold leading-[1] text-ink sm:text-6xl md:text-7xl lg:text-[84px]">
              <span className="block">Launch Your Brokerage</span>
              <span className="block min-h-[1em] highlight">
                <Typewriter phrases={heroTypewriter} />
              </span>
              <span className="block">Fully Set Up.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted md:text-xl">{homeHero.sub}</p>
          </Reveal>
          <Reveal delay={0.22}>
            <div className="mt-9 flex flex-wrap gap-3">
              {homeHero.ctas?.map((cta, i) => (
                <CtaButton key={cta.label} cta={cta} icon={i === 0} />
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-10 flex flex-wrap gap-2">
              {homeHero.badges?.map((b) => (
                <Badge key={b} variant="pill">
                  {b}
                </Badge>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Floating glass stats over the scene */}
        <div className="pointer-events-none absolute right-0 bottom-28 hidden flex-col items-end gap-4 lg:flex">
          <Reveal delay={0.5}>
            <FloatingStat {...heroFloatingStats[0]} className="animate-float" />
          </Reveal>
          <Reveal delay={0.62}>
            <FloatingStat {...heroFloatingStats[1]} className="mr-20 animate-float-delayed" />
          </Reveal>
        </div>

        <div className="mt-auto flex items-center justify-end pt-16 pb-10">
          <a href="#trust" className="group inline-flex items-center gap-2 text-xs font-medium text-muted transition-colors hover:text-ink">
            Scroll to explore
            <ArrowDown className="size-4 animate-bounce text-orange-400" />
          </a>
        </div>
      </div>
    </section>
  );
}
