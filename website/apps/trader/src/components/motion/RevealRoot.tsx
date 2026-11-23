'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Scroll reveals without hiding content from no-JS visitors or crawlers.
 * An inline script in <head> (REVEAL_BOOT) adds html.reveal-armed before first paint when motion is allowed; this
 * component then marks [data-reveal] / [data-split] elements .is-in as they enter the viewport. If hydration never
 * happens, the boot script disarms itself after a few seconds so nothing stays invisible.
 */
export const REVEAL_BOOT = `(function(){try{var d=document.documentElement;if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('reveal-armed');setTimeout(function(){if(!window.__revealReady)d.classList.remove('reveal-armed')},4000)}if(/(?:^|; )googtrans=\\/en\\/(?!en)/.test(document.cookie))d.classList.add('gt-on')}catch(e){}})();`;

declare global {
  interface Window {
    __revealReady?: boolean;
  }
}

export default function RevealRoot() {
  const pathname = usePathname();

  useEffect(() => {
    window.__revealReady = true;
    const html = document.documentElement;
    if (!html.classList.contains('reveal-armed')) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );

    const scan = () => {
      document.querySelectorAll('[data-reveal]:not(.is-in), [data-split]:not(.is-in)').forEach((el) => io.observe(el));
    };
    scan();
    // Content that streams in after navigation (Suspense boundaries) is picked up too.
    const mo = new MutationObserver(() => scan());
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, [pathname]);

  return null;
}
