import type { Metadata } from "next";

import { CTABand } from "@/components/sections/shared/CTABand";
import { FeatureList } from "@/components/sections/shared/FeatureList";
import { PageHero } from "@/components/sections/shared/PageHero";
import { PlanTable } from "@/components/sections/shared/PlanTable";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { earnPage } from "@/content/earn";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Earn",
  description:
    "Stake an unallocated balance at a rate shown before you commit, and earn tighter spreads, lower commission and better terms through XP rather than deposit size.",
  path: "/earn",
});

export default function EarnPage() {
  const e = earnPage;
  return (
    <>
      <PageHero
        eyebrow={e.eyebrow}
        headline={e.headline}
        highlight={e.highlight}
        sub={e.sub}
        ctas={e.cta.ctas}
        badges={e.badges}
      />

      <FeatureList
        eyebrow="Staking"
        heading={e.stakingHeading}
        features={e.staking}
        columns={3}
      />

      <section className="relative pb-4">
        <div className="container-x">
          <Reveal>
            <p className="max-w-3xl text-sm leading-relaxed text-dim">
              {e.stakingNote}
            </p>
          </Reveal>
        </div>
      </section>

      <FeatureList
        eyebrow="Rewards"
        heading={e.rewardsHeading}
        features={e.rewards}
        columns={3}
        numbered
      />

      <section className="relative py-16 md:py-24">
        <div className="container-x">
          <Reveal>
            <SectionHeading
              eyebrow="The ladder"
              heading={e.ladderHeading}
              highlight="XP rises"
              className="mb-10"
            />
          </Reveal>
          <PlanTable data={e.ladder} footnote={e.ladderFootnote} />
        </div>
      </section>

      <CTABand block={e.cta} />
    </>
  );
}
