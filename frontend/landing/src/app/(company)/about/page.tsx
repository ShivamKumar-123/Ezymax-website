import type { Metadata } from "next";

import { SectionShell } from "@/components/layout/SectionShell";
import { CTABand } from "@/components/sections/shared/CTABand";
import { FeatureList } from "@/components/sections/shared/FeatureList";
import { PageHero } from "@/components/sections/shared/PageHero";
import { TextBlock } from "@/components/sections/shared/TextBlock";
import { GlassCard } from "@/components/ui/GlassCard";
import { Picture } from "@/components/ui/Picture";
import { Reveal } from "@/components/ui/Reveal";
import { aboutPage } from "@/content/about";
import { images } from "@/content/images";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "Ezymex is an invite-only CFD trading platform covering forex, indices, commodities and crypto, with published margin rules and stated conflicts of interest.",
  path: "/about",
});

/**
 * The "in numbers" band, the partner-logo cluster and the team grid that used
 * to sit between the values and the CTA are gone. Their content was a
 * placeholder file ("TODO: confirm before launch"), a years-in-business count
 * nobody could source, and four anonymous team cards under a note saying the
 * real ones would be added later.
 */
export default function AboutPage() {
  const a = aboutPage;
  return (
    <>
      <PageHero
        eyebrow={a.eyebrow}
        headline={a.headline}
        highlight={a.highlight}
        sub={a.sub}
        ctas={a.cta.ctas}
      />
      <TextBlock
        eyebrow="Overview"
        heading={a.storyHeading}
        paragraphs={a.story}
        aside={
          <div className="group">
            <Picture image={images.about} className="aspect-[4/5]" />
          </div>
        }
      />
      <SectionShell variant="panel">
        <div className="grid gap-8 md:grid-cols-2">
          {[a.mission, a.vision].map((m, i) => (
            <Reveal key={m.heading} delay={i * 0.1}>
              <GlassCard className="h-full">
                <span className="bracket">{m.heading}</span>
                <p className="mt-5 font-display text-2xl font-medium leading-snug text-ink md:text-3xl">
                  {m.body}
                </p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </SectionShell>
      <FeatureList
        eyebrow="How we work"
        heading={a.valuesHeading}
        features={a.values}
        columns={4}
        numbered
      />
      <CTABand block={a.cta} />
    </>
  );
}
