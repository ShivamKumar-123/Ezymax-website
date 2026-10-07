"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Hover } from "@/components/animation/springs/hover";
import { Inview } from "@/components/animation/springs/in-view";
import { BrandLogo } from "@/components/ui/brand-logo";
import { GridIcon } from "@/components/ui/icons";
import { useUi } from "@/lib/ui-store";

/**
 * Logo + a single menu control. The whole navigation — links and both CTAs —
 * lives in the slide-in panel, see `nav-menu.tsx`.
 */
export const Header = () => {
  const ready = useUi((state) => state.ready);
  const setMenuOpen = useUi((state) => state.setMenuOpen);

  // Two states, both about keeping the logo and Menu readable over whatever is
  // behind them. Scrolled: a solid blurred bar, so they never sit directly on
  // body copy. At rest: a soft top-down scrim rather than nothing — the intro
  // stage now runs on phones, where its glow reaches the very top of the screen
  // and washed both controls out. A gradient keeps the hero looking open in a
  // way a full bar would not.
  //
  // Lenis drives the native window scroll here (no transformed wrapper), so
  // scrollY is accurate and `fixed` behaves normally.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Inview
      tag="header"
      enabled={ready}
      mode="once"
      delayIn={150}
      from={{ opacity: 0, y: -14 }}
      to={{ opacity: 1, y: 0 }}
      config={{ tension: 210, friction: 26 }}
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-[var(--duration-fast)] ease-entrance ${
        scrolled
          ? "bg-background/80 backdrop-blur-md"
          : "bg-gradient-to-b from-background/85 via-background/45 to-transparent"
      }`}
    >
      <div className="shell flex items-center justify-between gap-6 px-5 py-5 sm:px-8 sm:py-6">
        <Link href="/" aria-label="Ezymax home">
          <Hover
            tag="span"
            from={{ scale: 1 }}
            to={{ scale: 1.04 }}
            config={{ tension: 320, friction: 18 }}
            className="flex items-center"
          >
            <BrandLogo tone="dark" className="h-11" />
          </Hover>
        </Link>

        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMenuOpen(true)}
          className="rounded-control border border-line bg-white/5 backdrop-blur-sm transition-colors duration-[var(--duration-fast)] ease-entrance hover:border-accent hover:bg-white/10"
        >
          <Hover
            tag="span"
            from={{ scale: 1 }}
            to={{ scale: 1.05 }}
            config={{ tension: 320, friction: 18 }}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium font-mono tracking-label uppercase"
          >
            <GridIcon className="text-sm text-accent" />
            Menu
          </Hover>
        </button>
      </div>
    </Inview>
  );
};
