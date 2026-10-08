"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/ui/Logo";
import { site } from "@/content/site";

type Phase = "show" | "fade" | "gone";

/**
 * Short brand splash on the first visit of a session.
 * Driven by timers and CSS transitions only, so it never depends on an animation
 * frame loop (which browsers pause in background tabs).
 */
export function Preloader() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("show");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("sz-preloader") === "1";
    } catch {}
    const skip = reduce || seen;
    const fadeTimer = window.setTimeout(() => setPhase("fade"), skip ? 0 : 1100);
    const goneTimer = window.setTimeout(
      () => {
        setPhase("gone");
        try {
          sessionStorage.setItem("sz-preloader", "1");
        } catch {}
      },
      skip ? 50 : 1700,
    );
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(goneTimer);
    };
  }, [reduce]);

  if (phase === "gone") return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] flex flex-col items-center justify-center bg-bg transition-opacity duration-500 ease-in-out",
        phase === "fade" && "pointer-events-none opacity-0",
      )}
      aria-hidden
    >
      <div className="pointer-events-none absolute h-72 w-[36rem] ember-glow opacity-70" />
      <div className="relative text-ink">
        <Logo className="h-8 md:h-10" />
      </div>
      <p className="relative mt-5 font-mono text-[11px] tracking-[0.2em] text-muted uppercase">{site.tagline}</p>
    </div>
  );
}
