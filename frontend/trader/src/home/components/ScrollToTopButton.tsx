'use client';

import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';

/**
 * Floating "back to top" button — appears after the visitor scrolls
 * past ~30% of the viewport height. Sits bottom-right and is offset
 * far enough above the ChatBot bubble so the two don't overlap on
 * mobile.
 */
export function ScrollToTopButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShow(window.scrollY > window.innerHeight * 0.3);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollUp = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      aria-label="Scroll back to top"
      onClick={scrollUp}
      style={{
        position: 'fixed',
        right: '1.25rem',
        bottom: 'calc(5.25rem + env(safe-area-inset-bottom, 0px))',
        zIndex: 60,
        width: '2.75rem',
        height: '2.75rem',
        borderRadius: '9999px',
        background: 'rgba(232, 93, 61,0.92)',
        color: '#ffffff',
        border: '1px solid rgba(232, 93, 61,0.6)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(12px)',
        pointerEvents: show ? 'auto' : 'none',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
      }}
    >
      <ChevronUp size={20} aria-hidden />
    </button>
  );
}
