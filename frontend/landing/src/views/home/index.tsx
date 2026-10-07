import { SectionCards } from "@/components/common/sections/section-cards";
import { NewEraExperience } from "@/views/home/experience";
import { CopyTrading } from "@/views/home/copy-trading";
import { FinalCta } from "@/views/home/final-cta";
import { HowItWorks } from "@/views/home/how-it-works";
import { MarginCalculator } from "@/views/home/margin-calculator";
import { ProblemSolution } from "@/views/home/problem-solution";
import { RebateLadder } from "@/views/home/rebate-ladder";
import { Referral } from "@/views/home/referral";
import { Rewards } from "@/views/home/rewards";
import { Staking } from "@/views/home/staking";
import { TickerBand } from "@/views/home/ticker-band";
import { TradeInsurance } from "@/views/home/trade-insurance";
import { TradingModes } from "@/views/home/trading-modes";

import {
  automaticPnl,
  copyTrading,
  finalCta,
  howItWorks,
  marginCalculator,
  problemSolution,
  rebateLadder,
  referral,
  rewards,
  staking,
  tickerBand,
  tradeInsurance,
  tradingModes,
  whyEzymex,
} from "@/data/mocks/home";

/**
 * Home view — Server Component. Every section below is a client leaf. Site
 * chrome (header, drawer, footer, modal, cursor) mounts in the root layout.
 */
export const HomeView = () => {
  return (
    <>
      <main id="main">
        {/* Ported "New Era" intro experience (replaces the old hero). The FX
            Ezymex content sections below scroll in after it. */}
        <NewEraExperience />
        <ProblemSolution content={problemSolution} />
        <TickerBand content={tickerBand} />
        {/* Partner rates sit here, above the margin calculator — the pitch a
            partner is scrolling for, before the trader-side maths. */}
        <RebateLadder content={rebateLadder} />
        <MarginCalculator content={marginCalculator} />
        <HowItWorks content={howItWorks} />
        <SectionCards
          id={automaticPnl.id}
          eyebrow={automaticPnl.eyebrow}
          heading={automaticPnl.heading}
          intro={automaticPnl.intro}
          cards={automaticPnl.cards}
          columns={4}
          note={automaticPnl.note}
        />
        <TradingModes content={tradingModes} />
        <TradeInsurance content={tradeInsurance} />
        <Rewards content={rewards} />
        <CopyTrading content={copyTrading} />
        <Staking content={staking} />
        <Referral content={referral} />
        <SectionCards
          id={whyEzymex.id}
          eyebrow={whyEzymex.eyebrow}
          heading={whyEzymex.heading}
          cards={whyEzymex.cards}
          columns={3}
        />
        <FinalCta content={finalCta} />
      </main>
    </>
  );
};
