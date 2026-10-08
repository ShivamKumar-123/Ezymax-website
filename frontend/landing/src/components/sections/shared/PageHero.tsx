import { cn } from "@/lib/cn";
import type { Cta } from "@/content/schema";
import { Badge } from "@/components/ui/Badge";
import { CtaButton } from "@/components/ui/Button";
import { Highlighted } from "@/components/ui/Highlighted";
import { Reveal } from "@/components/ui/Reveal";
import { HeroScene } from "@/components/three/HeroScene";

type PageHeroProps = {
  eyebrow?: string;
  headline: string;
  highlight?: string;
  sub?: string;
  ctas?: Cta[];
  badges?: string[];
  compact?: boolean;
  className?: string;
};

/** Inner-page hero: copy on the left, the animated glossy ring on the right. */
export function PageHero({ eyebrow, headline, highlight, sub, ctas, badges, compact, className }: PageHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden pt-36 md:pt-44",
        compact ? "pb-14 md:pb-20 lg:min-h-[600px]" : "pb-16 md:pb-24 lg:min-h-[700px]",
        className,
      )}
    >
      <div className="pointer-events-none absolute -top-40 right-[-10%] h-[560px] w-[760px] ember-glow opacity-70" aria-hidden />
      <div className="pointer-events-none absolute -top-20 left-[-20%] h-[380px] w-[520px] rounded-full bg-orange-700/20 blur-[120px]" aria-hidden />

      {/* Big animated ring, same as the home hero */}
      <div className="pointer-events-none absolute inset-y-0 right-[-8%] hidden w-[62%] lg:block" aria-hidden>
        <HeroScene />
      </div>

      <div className="container-x relative z-10">
        <div className="max-w-3xl lg:max-w-[54%]">
          <Reveal>
            {eyebrow ? <Badge variant="bracket">{eyebrow}</Badge> : null}
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.02] text-ink sm:text-5xl md:text-6xl lg:text-[64px]">
              <Highlighted text={headline} highlight={highlight} />
            </h1>
          </Reveal>
          {sub ? (
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted md:text-xl">{sub}</p>
            </Reveal>
          ) : null}
          {ctas && ctas.length > 0 ? (
            <Reveal delay={0.18}>
              <div className="mt-8 flex flex-wrap gap-3">
                {ctas.map((cta, i) => (
                  <CtaButton key={cta.label} cta={cta} icon={i === 0} />
                ))}
              </div>
            </Reveal>
          ) : null}
          {badges && badges.length > 0 ? (
            <Reveal delay={0.26}>
              <div className="mt-10 flex flex-wrap gap-2">
                {badges.map((b) => (
                  <Badge key={b} variant="pill">
                    {b}
                  </Badge>
                ))}
              </div>
            </Reveal>
          ) : null}
        </div>
      </div>
    </section>
  );
}
