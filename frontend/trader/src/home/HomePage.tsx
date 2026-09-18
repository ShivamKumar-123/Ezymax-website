'use client';

import './styles.css';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { MarketsGrid } from './components/MarketsGrid';
import { Rewards } from './components/Rewards';
import { PlatformShowcase } from './components/PlatformShowcase';
import { Stats } from './components/Stats';
import { TraderPaths } from './components/TraderPaths';
import { JoinPanel } from './components/JoinPanel';
import { Pourquoi } from './components/Pourquoi';
import { Faq } from './components/Faq';
import { CtaFooter } from './components/CtaFooter';

/**
 * Public marketing home.
 *
 * Section order follows the reference layout (2026-09-02):
 *
 *   1. Hero            headline, CTA pair, reserved product shot
 *   2. Ticker          live market strip (rendered inside <Hero />)
 *   3. MarketsGrid     3×2 market tiles + CTA pair
 *   4. Rewards         two image-led offer cards + CTA pair
 *   5. PlatformShowcase  screenshot left, ticked capability list right
 *   6. Stats           tinted rounded trust panel
 *   7. TraderPaths     "everything you need", split by audience
 *   8. JoinPanel       numbered signup steps + portrait image
 *   9. CtaFooter       closing CTA band + black footer
 *
 * `Pourquoi` (why-choose-us) and `Faq` have no counterpart in the
 * reference, which runs straight from the join panel to the footer. They
 * are kept — the copy is live content — and placed after the reference's
 * own flow so the sequence above still reads as designed. The testimonial
 * marquee that sat between them was removed on request (2026-09-02).
 *
 * `LiveChartSection` moved off the homepage to /markets, where the
 * instrument directory belongs; the reference puts a market ticker here,
 * not a full charting widget.
 */
export default function BrandHomePage() {
  return (
    <div className="brand-home">
      <Navbar />
      <main>
        <Hero />
        <MarketsGrid />
        <Rewards />
        <PlatformShowcase />
        <Stats />
        <TraderPaths />
        <JoinPanel />
        <Pourquoi />
        <Faq />
        <CtaFooter />
      </main>
    </div>
  );
}
