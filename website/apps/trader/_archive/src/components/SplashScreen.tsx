'use client';

import { useEffect, useState } from 'react';
import { BRAND_NAME } from '@/lib/brand';
import { BrandLogo } from '@/components/BrandLogo';

/**
 * Full-screen branded splash shown on every full page load / refresh.
 *
 * Because this is mounted once in the root layout, its mount effect runs
 * only on a real page load — client-side route changes (next/link) do NOT
 * remount it, so the splash never reappears while navigating the SPA.
 *
 * Renders immediately (covers first paint), holds for a beat while the
 * logo animates, then fades out and unmounts so it never blocks clicks.
 */
export default function SplashScreen() {
  const [hidden, setHidden] = useState(false);   // triggers the fade-out
  const [removed, setRemoved] = useState(false);  // unmounts after fade

  useEffect(() => {
    // Short hold + quick fade so the splash is barely a flicker — pages
    // appear almost instantly instead of being blocked for ~1.5s.
    const fade = setTimeout(() => setHidden(true), 250);
    const remove = setTimeout(() => setRemoved(true), 650);
    return () => { clearTimeout(fade); clearTimeout(remove); };
  }, []);

  if (removed) return null;

  return (
    <div className={`brand-splash${hidden ? ' brand-splash--hidden' : ''}`} aria-hidden="true">
      {/* The splash ground is a fixed #08090b whatever the user's theme,
          so this is one of the few places that pins the reversed mark
          instead of following data-theme. */}
      <BrandLogo tone="reversed" decorative className="brand-splash__bg" />

      <div className="brand-splash__inner">
        <BrandLogo tone="reversed" alt={BRAND_NAME} className="brand-splash__logo" />
      </div>
    </div>
  );
}
