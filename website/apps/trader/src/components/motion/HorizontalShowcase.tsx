'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export type ShowcaseSlide = {
  src: string;
  /** Intrinsic size of the (focused, cropped) screenshot. */
  w: number;
  h: number;
  url: string;
  t: string;
  d: string;
  alt: string;
};

/** Same query as `.sc` in globals.css: pin only where heading, screenshot and caption fit in one screen. */
const PIN_QUERY = '(min-width: 1024px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)';

/**
 * Platform showcase.
 * - Wide and tall enough screens: the section pins and the slides travel sideways as you scroll. Each screenshot
 *   is sized to the viewport height and its caption sits beside it, so nothing is ever below the fold.
 * - Phones, short screens and reduced motion: a swipeable snap carousel with previous / next buttons and the
 *   caption under each screenshot.
 */
export function HorizontalShowcase({ slides, intro }: { slides: ShowcaseSlide[]; intro: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add(PIN_QUERY, () => {
      const s = section.current;
      const t = track.current;
      if (!s || !t) return;
      t.scrollLeft = 0;
      const distance = () => Math.max(0, t.scrollWidth - window.innerWidth);
      const tween = gsap.to(t, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: s,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.8,
          invalidateOnRefresh: true,
          anticipatePin: 1,
          onUpdate: (self) => {
            if (bar.current) bar.current.style.transform = `scaleX(${self.progress})`;
          },
        },
      });
      return () => tween.kill();
    });
    return () => mm.revert();
  }, []);

  // Carousel mode: track which slide is in view.
  const onScroll = useCallback(() => {
    const t = track.current;
    if (!t || window.matchMedia(PIN_QUERY).matches) return;
    const kids = Array.from(t.children) as HTMLElement[];
    const left = t.scrollLeft + t.clientWidth * 0.3;
    let i = 0;
    kids.forEach((k, n) => {
      if (k.offsetLeft - kids[0].offsetLeft <= left) i = n;
    });
    setIndex(i);
  }, []);

  const go = (dir: 1 | -1) => {
    const t = track.current;
    if (!t) return;
    const kids = Array.from(t.children) as HTMLElement[];
    const next = Math.min(kids.length - 1, Math.max(0, index + dir));
    t.scrollTo({ left: kids[next].offsetLeft - kids[0].offsetLeft, behavior: 'smooth' });
  };

  // GSAP's pin wraps the section in a .pin-spacer div. This plain wrapper keeps the spacer inside a node React owns,
  // so leaving the page removes the wrapper instead of the moved section (that threw "removeChild: not a child").
  return (
    <div>
      <section ref={section} className="sc relative overflow-hidden py-24" aria-roledescription="carousel" aria-label="Ezymex platform tour">
        <div className="container-site sc-intro">{intro}</div>
        <div ref={track} onScroll={onScroll} className="sc-track no-scrollbar">
          {slides.map((s, i) => (
            <article
              key={s.src}
              className="sc-slide"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${slides.length}: ${s.t}`}
              style={{ ['--ar' as string]: String(s.w / s.h) }}
            >
              <figure className="sc-frame relative overflow-hidden rounded-[18px] border border-white/10 bg-ink-3 rim">
                <div className="flex h-[34px] items-center gap-2 border-b border-white/[0.07] bg-[#0d0d11] px-3.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="mx-auto hidden rounded-full border border-white/[0.07] bg-white/[0.03] px-4 py-0.5 text-[11px] text-fg-3 sm:block">
                    {s.url}
                  </span>
                </div>
                <Image src={s.src} alt={s.alt} width={s.w} height={s.h} sizes="(min-width: 1024px) 1400px, 88vw" />
              </figure>
              <div className="sc-cap mt-5 flex items-start gap-4">
                <span className="t-pixel text-[1.6rem] text-ember">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">{s.t}</h3>
                  <p className="t-body mt-1.5">{s.d}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="container-site sc-nav mt-6 flex items-center justify-between gap-4">
          <p className="num text-sm text-fg-2" aria-live="polite">
            {String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous slide" className="arrow-circle disabled:opacity-35">
              <ArrowLeft size={18} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={index === slides.length - 1}
              aria-label="Next slide"
              className="arrow-circle disabled:opacity-35"
            >
              <ArrowRight size={18} aria-hidden />
            </button>
          </div>
        </div>
        <div className="container-site sc-bar">
          <div className="h-px w-full bg-white/10">
            <div ref={bar} className="h-px origin-left scale-x-0 bg-ember" />
          </div>
        </div>
      </section>
    </div>
  );
}
