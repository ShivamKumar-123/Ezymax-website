import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

type BulletListProps = {
  eyebrow?: string;
  heading?: string;
  highlight?: string;
  sub?: string;
  bullets: string[];
  className?: string;
};

export function BulletList({ eyebrow, heading, highlight, sub, bullets, className }: BulletListProps) {
  return (
    <section className={cn("relative py-16 md:py-24", className)}>
      <div className="container-x grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <SectionHeading eyebrow={eyebrow} heading={heading ?? "Key features"} highlight={highlight} sub={sub} />
        </Reveal>
        <ul className="grid gap-3 sm:grid-cols-2">
          {bullets.map((b, i) => (
            <Reveal key={b} delay={Math.min(i * 0.05, 0.4)}>
              <li className="flex h-full items-start gap-3 rounded-card glass px-5 py-4 text-sm leading-relaxed text-ink">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
                  <Check className="size-3" />
                </span>
                {b}
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
