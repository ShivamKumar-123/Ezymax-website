import { MarkReady } from "@/components/common/mark-ready";
import { SectionCards } from "@/components/common/sections/section-cards";
import { SectionTable } from "@/components/common/sections/section-table";
import { SectionText } from "@/components/common/sections/section-text";
import { PageHero } from "@/components/ui/page-hero";

import {
  earnActivity,
  earnHero,
  earnLadder,
  earnPartners,
  earnRewards,
  earnStaking,
} from "@/data/mocks/earn";

/** Earn view — Server Component. Every section below is a client leaf. */
export const EarnView = () => (
  <>
    <MarkReady />
    <main id="main">
      <PageHero
        eyebrow={earnHero.eyebrow}
        heading={earnHero.heading}
        intro={earnHero.intro}
        backHref="/"
        backLabel={earnHero.backLabel}
      />

      <SectionText
        id={earnStaking.id}
        eyebrow={earnStaking.eyebrow}
        heading={earnStaking.heading}
        body={earnStaking.body}
        points={earnStaking.points}
        note={earnStaking.note}
      />

      <SectionCards
        id={earnRewards.id}
        eyebrow={earnRewards.eyebrow}
        heading={earnRewards.heading}
        intro={earnRewards.intro}
        cards={earnRewards.cards}
        columns={3}
      />

      <SectionTable
        id={earnLadder.id}
        eyebrow={earnLadder.eyebrow}
        heading={earnLadder.heading}
        columns={earnLadder.columns}
        rows={earnLadder.rows}
        footnote={earnLadder.footnote}
      />

      <SectionText
        id={earnActivity.id}
        eyebrow={earnActivity.eyebrow}
        heading={earnActivity.heading}
        body={earnActivity.body}
        note={earnActivity.note}
      />

      <SectionText
        id={earnPartners.id}
        eyebrow={earnPartners.eyebrow}
        heading={earnPartners.heading}
        body={earnPartners.body}
        points={earnPartners.points}
        cta={earnPartners.cta}
        ctaTarget="trade"
        quote={earnPartners.quote}
      />
    </main>
  </>
);
