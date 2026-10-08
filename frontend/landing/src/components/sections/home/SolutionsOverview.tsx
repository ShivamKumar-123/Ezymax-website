import { solutionsOverview } from "@/content/home";
import { solutions } from "@/content/solutions";
import { solutionImage } from "@/content/images";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ImageCard } from "@/components/ui/ImageCard";
import { ArrowLink } from "@/components/ui/ArrowLink";

export function SolutionsOverview() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="container-x">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-end">
          <Reveal>
            <SectionHeading eyebrow={solutionsOverview.eyebrow} heading={solutionsOverview.heading} highlight={solutionsOverview.highlight} />
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-lg text-lg leading-relaxed text-muted lg:ml-auto">{solutionsOverview.intro}</p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {solutions.map((s, i) => (
            <Reveal key={s.slug} delay={Math.min(i * 0.07, 0.4)}>
              <ImageCard title={s.nav.label} body={s.summary} href={`/solutions/${s.slug}`} image={solutionImage(s.slug)} index={i} />
            </Reveal>
          ))}
          <Reveal delay={0.35} className="flex items-center justify-center rounded-card border border-dashed border-line p-8">
            <div className="text-center">
              <p className="max-w-[22ch] font-display text-xl font-medium text-ink">You don&apos;t need everything, just what works.</p>
              <ArrowLink href="/solutions" className="mt-4">
                View all solutions
              </ArrowLink>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
