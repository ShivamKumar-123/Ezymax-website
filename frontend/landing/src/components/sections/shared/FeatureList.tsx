import { cn } from "@/lib/cn";
import { getIcon } from "@/lib/icons";
import type { Feature } from "@/content/schema";
import { GlassCard } from "@/components/ui/GlassCard";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

type FeatureListProps = {
  eyebrow?: string;
  heading?: string;
  highlight?: string;
  sub?: string;
  features: Feature[];
  columns?: 2 | 3 | 4;
  numbered?: boolean;
  className?: string;
};

const cols = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function FeatureList({ eyebrow, heading, highlight, sub, features, columns = 3, numbered, className }: FeatureListProps) {
  return (
    <section className={cn("relative py-16 md:py-24", className)}>
      <div className="container-x">
        {heading ? (
          <Reveal>
            <SectionHeading eyebrow={eyebrow} heading={heading} highlight={highlight} sub={sub} className="mb-12" />
          </Reveal>
        ) : null}
        <div className={cn("grid gap-4", cols[columns])}>
          {features.map((f, i) => {
            const Icon = getIcon(f.icon);
            return (
              <Reveal key={f.title} delay={Math.min(i * 0.06, 0.4)}>
                <GlassCard hover className="flex h-full flex-col gap-5">
                  <div className="flex items-start justify-between">
                    <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface-2 text-orange-400">
                      <Icon className="size-5" />
                    </span>
                    {numbered ? <span className="font-mono text-xs text-dim">{String(i + 1).padStart(2, "0")}</span> : null}
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold leading-snug text-ink">{f.title}</h3>
                    {f.body ? <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p> : null}
                  </div>
                </GlassCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
