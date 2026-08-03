"use client";

import { animated, useSpring } from "@react-spring/web";
import Link from "next/link";
import { useEffect, useState } from "react";

import { NavPage, type NavPageKey } from "@/components/common/chrome/nav-page";
import { BrandLogo } from "@/components/ui/brand-logo";
import { ArrowRight, Close } from "@/components/ui/icons";
import { PillButton } from "@/components/ui/pill-button";
import { useClock } from "@/hooks/use-clock";
import { useScroll } from "@/hooks/smooth-scroll/use-scroll";
import { tradeConfig } from "@/lib/site";
import { useUi } from "@/lib/ui-store";
import type { navPages } from "@/data/mocks/nav-pages";
import type { headerCta, navGroups, navLabels } from "@/data/mocks/site";

export interface NavMenuProps {
  groups: typeof navGroups;
  cta: typeof headerCta;
  labels: typeof navLabels;
  pages: typeof navPages;
}

/** ms between each group's entrance — the sequence readers actually notice. */
const STAGGER = 55;

/**
 * Half-page navigation drawer. Slides in from the right over a dimmed
 * backdrop; the link groups then cascade in one after another. Clicking a
 * group slides a full page panel down over the menu (`NavPage`) carrying the
 * same content the routed page renders; only `Home` navigates directly.
 */
export const NavMenu = ({ groups, cta, labels, pages }: NavMenuProps) => {
  const open = useUi((state) => state.menuOpen);
  const setMenuOpen = useUi((state) => state.setMenuOpen);
  const startScroll = useScroll((state) => state.start);
  const stopScroll = useScroll((state) => state.stop);
  const clock = useClock();
  const [entered, setEntered] = useState(false);
  const [active, setActive] = useState<NavPageKey | null>(null);

  useEffect(() => {
    if (!open) return;
    stopScroll();
    const id = requestAnimationFrame(() => setEntered(true));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
      setEntered(false);
      setActive(null);
      startScroll();
    };
  }, [open, setMenuOpen, startScroll, stopScroll]);

  const backdrop = useSpring({
    opacity: open ? 1 : 0,
    config: { tension: 280, friction: 32 },
  });
  const panel = useSpring({
    x: open ? 0 : 100,
    config: { tension: 210, friction: 28 },
  });

  if (!open) return null;

  const close = () => setMenuOpen(false);

  const cascade = entered
    ? "translate-x-0 opacity-100"
    : "translate-x-8 opacity-0";

  return (
    <div className="fixed inset-0 z-[115]">
      <animated.button
        type="button"
        aria-label="Close menu"
        onClick={close}
        style={backdrop}
        className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm"
      />

      <animated.aside
        aria-label="Menu"
        style={{ transform: panel.x.to((x) => `translateX(${x}%)`) }}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-ink/95 text-foreground backdrop-blur-xl sm:w-1/2"
      >
        <div className="flex items-center justify-between px-6 py-5 sm:px-10 sm:py-6">
          <BrandLogo tone="dark" className="h-10" />
          <button
            type="button"
            onClick={close}
            className="inline-flex items-center gap-2 rounded-control border border-line px-4 py-2 text-xs font-medium font-mono tracking-label text-foreground/70 uppercase transition-colors duration-[var(--duration-fast)] ease-entrance hover:border-accent hover:text-accent"
          >
            <Close className="text-sm" />
            Close
          </button>
        </div>

        <nav
          aria-label="Site"
          className="flex flex-1 flex-col justify-center overflow-y-auto px-6 sm:px-10"
        >
          <ul className="flex flex-col">
            {groups.map((group, index) => (
              <li
                key={group.label}
                style={{ transitionDelay: `${index * STAGGER + 120}ms` }}
                className={`border-b border-line/60 py-3 transition-all duration-500 ease-out ${cascade}`}
              >
                {group.label === "Home" ? (
                  <Link
                    href={group.href}
                    onClick={close}
                    className="group flex w-full items-baseline gap-4 text-left"
                  >
                    <span className="w-6 text-xs font-normal text-foreground/30 tabular-nums transition-colors duration-[var(--duration-normal)] ease-entrance group-hover:text-accent">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-2xl font-bold tracking-display text-foreground/75 transition-colors duration-[var(--duration-normal)] ease-entrance group-hover:text-accent sm:text-3xl">
                      {group.label}
                    </span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActive(group.label)}
                    className="group flex w-full items-baseline gap-4 text-left"
                  >
                    <span className="w-6 text-xs font-normal text-foreground/30 tabular-nums transition-colors duration-[var(--duration-normal)] ease-entrance group-hover:text-accent">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-2xl font-bold tracking-display text-foreground/75 transition-colors duration-[var(--duration-normal)] ease-entrance group-hover:text-accent sm:text-3xl">
                      {group.label}
                    </span>
                    <span className="ml-auto inline-flex rotate-90 self-center text-sm text-foreground/40 transition-colors duration-[var(--duration-normal)] ease-entrance group-hover:text-accent">
                      <ArrowRight />
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div
            style={{ transitionDelay: `${groups.length * STAGGER + 160}ms` }}
            className={`mt-8 flex flex-wrap items-center gap-3 transition-all duration-500 ease-out ${cascade}`}
          >
            <PillButton variant="dark" arrow="right" href={tradeConfig.register}>
              {cta.openAccount}
            </PillButton>
            <PillButton variant="outline" href={tradeConfig.login}>
              {cta.login}
            </PillButton>
          </div>
        </nav>

        <p className="border-t border-line px-6 py-5 text-xs font-mono tracking-label text-foreground/45 uppercase sm:px-10">
          Local time — {clock.time}
        </p>
      </animated.aside>

      <NavPage
        active={active}
        pages={pages}
        labels={labels}
        onBack={() => setActive(null)}
        onClose={close}
      />
    </div>
  );
};
