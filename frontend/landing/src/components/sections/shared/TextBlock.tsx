import { cn } from "@/lib/cn";
import { Reveal } from "@/components/ui/Reveal";

type TextBlockProps = {
  heading: string;
  paragraphs: string[];
  eyebrow?: string;
  dropcap?: boolean;
  aside?: React.ReactNode;
  className?: string;
};

/** Heading on the left, prose on the right, like the "Who We Are?" layout in the reference. */
export function TextBlock({ heading, paragraphs, eyebrow, dropcap = true, aside, className }: TextBlockProps) {
  return (
    <section className={cn("relative overflow-hidden py-16 md:py-24", className)}>
      <div className="container-x grid gap-10 lg:grid-cols-[0.8fr_1.4fr_0.8fr]">
        <Reveal>
          {eyebrow ? <span className="bracket">{eyebrow}</span> : null}
          <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.02] text-ink md:text-5xl">{heading}</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="space-y-5 text-lg leading-relaxed text-muted md:text-xl">
            {paragraphs.map((p, i) => (
              <p key={i} className={cn(i === 0 && dropcap && "dropcap")}>
                {p}
              </p>
            ))}
          </div>
        </Reveal>
        {aside ? <Reveal delay={0.2}>{aside}</Reveal> : <div className="hidden lg:block" />}
      </div>
    </section>
  );
}
