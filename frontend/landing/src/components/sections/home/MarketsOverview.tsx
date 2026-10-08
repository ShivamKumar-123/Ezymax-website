import { marketsOverview } from "@/content/home";
import { markets } from "@/content/markets";
import { marketImage } from "@/content/images";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ImageCard } from "@/components/ui/ImageCard";
import { ArrowLink } from "@/components/ui/ArrowLink";

export function MarketsOverview() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="container-x">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-end">
          <Reveal>
            <SectionHeading eyebrow={marketsOverview.eyebrow} heading={marketsOverview.heading} highlight={marketsOverview.highlight} />
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-lg text-lg leading-relaxed text-muted lg:ml-auto">{marketsOverview.intro}</p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((s, i) => (
            <Reveal key={s.slug} delay={Math.min(i * 0.07, 0.4)}>
              <ImageCard title={s.nav.label} body={s.summary} href={`/markets/${s.slug}`} image={marketImage(s.slug)} index={i} />
            </Reveal>
          ))}
          <Reveal delay={0.35} className="flex items-center justify-center rounded-card border border-dashed border-line p-8">
            <div className="text-center">
              <p className="max-w-[22ch] font-display text-xl font-medium text-ink">Four markets, one account, one set of rules.</p>
              <ArrowLink href="/markets" className="mt-4">
                View all markets
              </ArrowLink>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
