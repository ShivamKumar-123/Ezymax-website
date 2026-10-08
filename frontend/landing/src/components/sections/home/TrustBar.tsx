import { trustBar } from "@/content/home";
import { Reveal } from "@/components/ui/Reveal";
import { StatTile } from "@/components/ui/StatTile";
import { Globe } from "lucide-react";

export function TrustBar() {
  return (
    <section id="trust" className="relative py-10 md:py-16">
      <div className="container-x">
        <Reveal>
          <div className="relative overflow-hidden rounded-panel border border-line bg-bg-2/80 px-6 py-10 shadow-card md:px-12 md:py-14">
            <div className="pointer-events-none absolute -top-40 right-0 h-80 w-[560px] ember-glow opacity-40" aria-hidden />
            <div className="relative grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:items-start">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line text-orange-400">
                  <Globe className="size-4" />
                </span>
                <div>
                  <p className="font-display text-2xl font-medium leading-snug text-ink md:text-3xl">
                    We&apos;re a results-driven technology partner{" "}
                    <span className="text-muted">for brokers, prop firms and fintechs.</span>
                  </p>
                  <p className="mt-3 text-sm text-muted">{trustBar.line}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
                {trustBar.stats.map((s, i) => (
                  <Reveal key={s.label} delay={i * 0.08}>
                    <StatTile value={s.value} label={s.label} size="sm" />
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
