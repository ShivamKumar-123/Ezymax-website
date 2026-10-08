import { cn } from "@/lib/cn";
import type { CtaBlock } from "@/content/schema";
import { images } from "@/content/images";
import { CtaButton } from "@/components/ui/Button";
import { Picture } from "@/components/ui/Picture";
import { Reveal } from "@/components/ui/Reveal";

export function CTABand({ block, className }: { block: CtaBlock; className?: string }) {
  return (
    <section className={cn("relative py-16 md:py-24", className)}>
      <div className="container-x">
        <Reveal>
          <div className="relative overflow-hidden rounded-panel border border-line bg-bg-2 px-6 py-20 text-center md:px-12 md:py-28">
            <Picture image={images.cta} className="absolute inset-0 opacity-70" rounded="rounded-none" sizes="100vw" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/70 via-bg/55 to-bg/85" aria-hidden />
            <div className="relative mx-auto max-w-3xl">
              <h2 className="font-display text-4xl font-semibold leading-[1.02] text-ink md:text-6xl">{block.heading}</h2>
              {block.sub ? <p className="mx-auto mt-5 max-w-xl text-lg text-ink/80">{block.sub}</p> : null}
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                {block.ctas.map((cta, i) => (
                  <CtaButton key={cta.label} cta={cta} icon={i === 0} />
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
