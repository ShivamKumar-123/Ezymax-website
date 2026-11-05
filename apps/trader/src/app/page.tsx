import type { Metadata } from 'next';
import { HomeHero } from '@/components/hero/HomeHero';
import { VideoStage } from '@/components/hero/VideoStage';
import { ProductsBento } from '@/components/home/ProductsBento';
import { OptionsBand } from '@/components/home/OptionsBand';
import { OptionsTeaser, WhyEzymex, StatsBand, AccountsTeaser, GlobalBand } from '@/components/home/HomeSections';
import { CtaBand } from '@/components/ui/CtaBand';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return (
    <>
      <HomeHero stage={<VideoStage />} />
      <ProductsBento />
      <OptionsBand />
      <OptionsTeaser />
      <StatsBand />
      <WhyEzymex />
      <AccountsTeaser />
      <GlobalBand />
      <div className="hidden h-[var(--section-y)] lg:block" />
      <CtaBand options />
    </>
  );
}
