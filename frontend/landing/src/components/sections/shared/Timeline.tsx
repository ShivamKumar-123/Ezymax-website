import { cn } from "@/lib/cn";
import type { Step } from "@/content/schema";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StepCard } from "@/components/ui/StepCard";

type TimelineProps = {
  eyebrow?: string;
  heading?: string;
  highlight?: string;
  sub?: string;
  steps: Step[];
  className?: string;
};

export function Timeline({ eyebrow, heading, highlight, sub, steps, className }: TimelineProps) {
  const cols =
    steps.length >= 6 ? "sm:grid-cols-2 lg:grid-cols-3" : steps.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <section className={cn("relative py-16 md:py-24", className)}>
      <div className="container-x">
        {heading ? (
          <Reveal>
            <SectionHeading eyebrow={eyebrow} heading={heading} highlight={highlight} sub={sub} className="mb-12" />
          </Reveal>
        ) : null}
        <div className={cn("grid gap-x-8 gap-y-10", cols)}>
          {steps.map((s, i) => (
            <Reveal key={s.step} delay={Math.min(i * 0.08, 0.4)}>
              <StepCard {...s} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
