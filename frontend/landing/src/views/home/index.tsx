import { SectionCards } from "@/components/common/sections/section-cards";
import { CopyTrading } from "@/views/home/copy-trading";
import { FinalCta } from "@/views/home/final-cta";
import { Hero } from "@/views/home/hero";
import { HowItWorks } from "@/views/home/how-it-works";
import { IntroVideo } from "@/views/home/intro-video";
import { MarginCalculator } from "@/views/home/margin-calculator";
import { ProblemSolution } from "@/views/home/problem-solution";
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
  heroContent,
  howItWorks,
  introContent,
  marginCalculator,
  problemSolution,
  referral,
  rewards,
  staking,
  tickerBand,
  tradeInsurance,
  tradingModes,
  whyArtha,
} from "@/data/mocks/home";

/**
 * Home view — Server Component. Every section below is a client leaf. Site
 * chrome (header, drawer, footer, modal, cursor) mounts in the root layout.
 */
export const HomeView = () => {
  return (
    <>
      <IntroVideo content={introContent} />
      <main id="main">
        <Hero content={heroContent} />
        <ProblemSolution content={problemSolution} />
        <TickerBand content={tickerBand} />
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
          id={whyArtha.id}
          eyebrow={whyArtha.eyebrow}
          heading={whyArtha.heading}
          cards={whyArtha.cards}
          columns={3}
        />
        <FinalCta content={finalCta} />
      </main>
    </>
  );
};
