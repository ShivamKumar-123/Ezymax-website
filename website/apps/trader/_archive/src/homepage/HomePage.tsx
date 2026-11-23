'use client';

import './homepage.css';
import { useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Hero } from './sections/Hero';
import { Logos } from './sections/Logos';
import { Features } from './sections/Features';
import { Accessible } from './sections/Accessible';
import { QuickDeploy } from './sections/QuickDeploy';
import { AiPowered } from './sections/AiPowered';
import { Pricing } from './sections/Pricing';
import { Testimonials } from './sections/Testimonials';
import { Marquee } from './sections/Marquee';

/**
 * Public homepage. Section order mirrors the reference design exactly:
 *
 *   1. Navbar        logo · Home▾ About Services▾ Pages▾ Contact · Login · Sign up free
 *   2. Hero          headline, sub copy, CTA pair, dashboard image slot, orange glow
 *   3. Logos         trust line + five partner marks
 *   4. Features      "Core features" 4-up bordered grid
 *   5. Accessible    image left / copy right
 *   6. QuickDeploy   copy left / image right, ticked list
 *   7. AiPowered     black rounded panel, photo + two stats
 *   8. Pricing       Monthly/Annually toggle, three plans
 *   9. Testimonials  black band, 3×2 cards
 *  10. Marquee       "Start building software ✦" ticker
 *  11. Footer        brand, Primary Pages, Utility Pages, newsletter
 *
 * Everything is scoped under .kx (see homepage.css) so it never touches
 * the rest of the app.
 */
export default function HomePage() {
  // Smooth in-page scrolling while the homepage is mounted; restored on leave.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'smooth';
    return () => {
      html.style.scrollBehavior = prev;
    };
  }, []);

  return (
    <div className="kx">
      <Navbar />
      <main>
        <Hero />
        <Logos />
        <Features />
        <Accessible />
        <QuickDeploy />
        <AiPowered />
        <Pricing />
        <Testimonials />
        <Marquee />
      </main>
      <Footer />
    </div>
  );
}
