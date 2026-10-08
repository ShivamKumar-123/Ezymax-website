import type { Metadata } from 'next';
import { HomeHero } from '@/components/hero/HomeHero';
import { ProductsBento } from '@/components/home/ProductsBento';
import { OptionsBand } from '@/components/home/OptionsBand';
import { OptionsTeaser, WhyEzymex, StatsBand, AccountsTeaser, PlatformShowcase, GlobalBand } from '@/components/home/HomeSections';
import { CtaBand } from '@/components/ui/CtaBand';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <ProductsBento />
      <OptionsBand />
      <OptionsTeaser />
      <StatsBand />
      <WhyEzymex />
      <PlatformShowcase />
      <AccountsTeaser />
      <GlobalBand />
      <div className="hidden h-[var(--section-y)] lg:block" />
      <CtaBand options />
    </>
  );
}
