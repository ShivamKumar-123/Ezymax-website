import { Info } from "lucide-react";
import type { SolutionPage } from "@/content/schema";
import { PageHero } from "@/components/sections/shared/PageHero";
import { FeatureList } from "@/components/sections/shared/FeatureList";
import { TextBlock } from "@/components/sections/shared/TextBlock";
import { Timeline } from "@/components/sections/shared/Timeline";
import { CTABand } from "@/components/sections/shared/CTABand";
import { Reveal } from "@/components/ui/Reveal";

export function SolutionTemplate({ page }: { page: SolutionPage }) {
  return (
    <>
      <PageHero
        eyebrow={page.hero.eyebrow}
        headline={page.hero.headline}
        highlight={page.hero.highlight}
        sub={page.hero.sub}
        ctas={page.hero.ctas}
        badges={page.hero.badges}
      />
      <FeatureList eyebrow={page.hero.eyebrow} heading={page.featuresHeading} features={page.features} columns={page.features.length > 6 ? 4 : 3} numbered />
      {page.whoItsFor ? <TextBlock eyebrow="Who it's for" heading={page.whoItsFor.heading} paragraphs={page.whoItsFor.paragraphs} /> : null}
      {page.whyItMatters ? (
        <TextBlock eyebrow={page.whyItMatters.heading} heading={page.whyItMatters.heading} paragraphs={page.whyItMatters.paragraphs} dropcap={false} />
      ) : null}
      {page.timeline ? <Timeline eyebrow="Process" heading={page.timelineHeading ?? "Our process"} steps={page.timeline} /> : null}
      {page.note ? (
        <section className="relative py-6">
          <div className="container-x">
            <Reveal>
              <div className="flex items-start gap-4 rounded-card border-l-2 border-orange-500 glass px-6 py-5">
                <Info className="mt-0.5 size-5 shrink-0 text-orange-400" />
                <p className="text-sm leading-relaxed text-muted">{page.note}</p>
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}
      <CTABand block={page.cta} />
    </>
  );
}

