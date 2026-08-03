import { MarkReady } from "@/components/common/mark-ready";
import { SectionCards } from "@/components/common/sections/section-cards";
import { SectionText } from "@/components/common/sections/section-text";
import { PageHero } from "@/components/ui/page-hero";

import {
  tradeHero,
  tradeMargin,
  tradeMarkets,
  tradeModes,
  tradeSettlement,
} from "@/data/mocks/trade";

/** Trade view — Server Component. Every section below is a client leaf. */
export const TradeView = () => (
  <>
    <MarkReady />
    <main id="main">
      <PageHero
        eyebrow={tradeHero.eyebrow}
        heading={tradeHero.heading}
        intro={tradeHero.intro}
        backHref="/"
        backLabel={tradeHero.backLabel}
      />

      <SectionCards
        id={tradeMarkets.id}
        eyebrow={tradeMarkets.eyebrow}
        heading={tradeMarkets.heading}
        intro={tradeMarkets.intro}
        cards={tradeMarkets.cards}
        columns={2}
      />

      <SectionCards
        id={tradeModes.id}
        eyebrow={tradeModes.eyebrow}
        heading={tradeModes.heading}
        cards={tradeModes.cards}
        columns={2}
        note={tradeModes.note}
      />

      <SectionCards
        id={tradeSettlement.id}
        eyebrow={tradeSettlement.eyebrow}
        heading={tradeSettlement.heading}
        intro={tradeSettlement.intro}
        cards={tradeSettlement.cards}
        columns={4}
        note={tradeSettlement.note}
      />

      <SectionText
        id={tradeMargin.id}
        eyebrow={tradeMargin.eyebrow}
        heading={tradeMargin.heading}
        body={tradeMargin.body}
        points={tradeMargin.points}
        note={tradeMargin.note}
        cta={tradeMargin.cta}
        ctaTarget="trade"
      />
    </main>
  </>
);
