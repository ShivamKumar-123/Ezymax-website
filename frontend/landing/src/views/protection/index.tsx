import { MarkReady } from "@/components/common/mark-ready";
import { SectionCards } from "@/components/common/sections/section-cards";
import { SectionFaq } from "@/components/common/sections/section-faq";
import { SectionTable } from "@/components/common/sections/section-table";
import { SectionText } from "@/components/common/sections/section-text";
import { PageHero } from "@/components/ui/page-hero";

import {
  protectionCta,
  protectionFaq,
  protectionHero,
  protectionInsurance,
  protectionTools,
} from "@/data/mocks/protection";

/** Protection view — Server Component. Every section below is a client leaf. */
export const ProtectionView = () => (
  <>
    <MarkReady />
    <main id="main">
      <PageHero
        eyebrow={protectionHero.eyebrow}
        heading={protectionHero.heading}
        intro={protectionHero.intro}
        backHref="/"
        backLabel={protectionHero.backLabel}
      />

      <SectionTable
        id={protectionInsurance.id}
        eyebrow={protectionInsurance.eyebrow}
        heading={protectionInsurance.heading}
        intro={protectionInsurance.intro}
        columns={protectionInsurance.columns}
        rows={protectionInsurance.rows}
        footnote={protectionInsurance.footnote}
      />

      <SectionFaq
        id={protectionFaq.id}
        eyebrow={protectionFaq.eyebrow}
        heading={protectionFaq.heading}
        intro={protectionFaq.intro}
        items={protectionFaq.items}
      />

      <SectionCards
        id={protectionTools.id}
        eyebrow={protectionTools.eyebrow}
        heading={protectionTools.heading}
        cards={protectionTools.cards}
        columns={4}
        quote={protectionTools.quote}
      />

      <SectionText
        id={protectionCta.id}
        eyebrow={protectionCta.eyebrow}
        heading={protectionCta.heading}
        body={protectionCta.body}
        cta={protectionCta.cta}
        ctaTarget="trade"
      />
    </main>
  </>
);
