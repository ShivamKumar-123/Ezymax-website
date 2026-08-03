"use client";

import { animated, useSpring } from "@react-spring/web";
import { useEffect, useRef, useState } from "react";

export interface TypewriterProps {
  /** Cycled in order; the first phrase is also the static SEO/SR text. */
  phrases: readonly string[];
  /** Gate the loop (e.g. behind the intro `ready` flag). */
  enabled?: boolean;
  /** ms per typed character. */
  typeMs?: number;
  /** ms per deleted character. */
  deleteMs?: number;
  /** Pause on a fully typed phrase. */
  holdMs?: number;
  /** Pause on the empty line before the next phrase. */
  restMs?: number;
  className?: string;
}

type Phase = "typing" | "holding" | "deleting" | "resting";

/**
 * Write-and-delete typewriter loop. Deliberately NOT TextEngine: the engine
 * animates glyph position/opacity of fixed text, while a typewriter changes
 * WHICH text exists over time — state-driven content, the same category as
 * the scroll counters (ADR-0021). The caret blink is a looping spring, not a
 * CSS keyframe. Under prefers-reduced-motion the first phrase renders static.
 */
export const Typewriter = ({
  phrases,
  enabled = true,
  typeMs = 45,
  deleteMs = 22,
  holdMs = 2800,
  restMs = 450,
  className,
}: TypewriterProps) => {
  const [text, setText] = useState("");
  const [reduced, setReduced] = useState(false);
  const stateRef = useRef<{ index: number; length: number; phase: Phase }>({
    index: 0,
    length: 0,
    phase: "typing",
  });

  const caret = useSpring({
    from: { opacity: 1 },
    to: { opacity: 0 },
    loop: { reverse: true },
    config: { duration: 480 },
  });

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!enabled || reduced || phrases.length === 0) return;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const state = stateRef.current;
      const phrase = phrases[state.index % phrases.length];

      switch (state.phase) {
        case "typing": {
          state.length += 1;
          setText(phrase.slice(0, state.length));
          if (state.length >= phrase.length) state.phase = "holding";
          timer = setTimeout(tick, state.phase === "holding" ? holdMs : typeMs);
          return;
        }
        case "holding": {
          state.phase = "deleting";
          timer = setTimeout(tick, deleteMs);
          return;
        }
        case "deleting": {
          state.length -= 1;
          setText(phrase.slice(0, state.length));
          if (state.length <= 0) state.phase = "resting";
          timer = setTimeout(
            tick,
            state.phase === "resting" ? restMs : deleteMs,
          );
          return;
        }
        case "resting": {
          state.index = (state.index + 1) % phrases.length;
          state.phase = "typing";
          timer = setTimeout(tick, typeMs);
        }
      }
    };

    timer = setTimeout(tick, typeMs);
    return () => clearTimeout(timer);
  }, [enabled, reduced, phrases, typeMs, deleteMs, holdMs, restMs]);

  const display = reduced ? (phrases[0] ?? "") : text;

  return (
    <span className={className}>
      <span className="sr-only">{phrases[0]}</span>
      <span aria-hidden>
        {display}
        {reduced ? null : (
          <animated.span
            style={caret}
            className="ml-[0.06em] inline-block h-[0.82em] w-[0.07em] translate-y-[0.06em] rounded-pill bg-accent"
          />
        )}
      </span>
    </span>
  );
};
