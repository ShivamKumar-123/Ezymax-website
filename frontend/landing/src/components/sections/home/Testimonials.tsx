import { Quote } from "lucide-react";
import { testimonials } from "@/content/home";
import { GlassCard } from "@/components/ui/GlassCard";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function Testimonials() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="container-x">
        <Reveal>
          <SectionHeading eyebrow={testimonials.eyebrow} heading={testimonials.heading} highlight={testimonials.highlight} align="center" />
        </Reveal>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {testimonials.items.map((t, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <GlassCard className="flex h-full flex-col justify-between gap-8">
                <div>
                  <Quote className="size-6 text-orange-400" />
                  <p className="mt-5 text-base leading-relaxed text-ink">&ldquo;{t.quote}&rdquo;</p>
                </div>
                <div className="flex items-center gap-3 border-t border-line pt-5">
                  <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/40 to-ember-deep/40 font-display text-sm font-semibold text-ink">
                    {t.name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">{t.name}</p>
                    <p className="text-xs text-muted">
                      {t.role}, {t.company}
                    </p>
                  </div>
                  {t.placeholder ? <span className="ml-auto bracket-muted text-[9px]">pending</span> : null}
                </div>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
