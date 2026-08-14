"use client";

import { animated, easings, useSpring } from "@react-spring/web";
import type { ElementType } from "react";

import type { Tags } from "@/types/springs";
import type { SectionState } from "./experience";

/**
 * Phase-driven fade/slide reveal — the `.is-visible` / `.is-leaving` content
 * states from style.css. Content enters from +30px below and leaves up to
 * -30px, mirroring the source's three resting states. Spring-based (no existing
 * springs/ primitive expresses a 3-state, externally-driven scroll reveal).
 */

const HIDDEN_BELOW = { opacity: 0, y: 30 };
const VISIBLE = { opacity: 1, y: 0 };
const HIDDEN_ABOVE = { opacity: 0, y: -30 };

// Approximates the source's `cubic-bezier(0.2, 1, 0.2, 1)` 1.2s transition.
const REVEAL_CONFIG = { duration: 1200, easing: easings.easeOutQuart };

export interface RevealProps {
  state: SectionState;
  tag?: Tags;
  className?: string;
  delay?: number;
  /** When false the element starts visible (used for title blocks). */
  enterAnimated?: boolean;
  children: React.ReactNode;
}

export const Reveal = ({
  state,
  tag = "div",
  className,
  delay = 0,
  enterAnimated = true,
  children,
}: RevealProps) => {
  const target =
    state === "visible"
      ? VISIBLE
      : state === "after"
        ? HIDDEN_ABOVE
        : HIDDEN_BELOW;

  const styles = useSpring({
    from: enterAnimated ? HIDDEN_BELOW : VISIBLE,
    to: target,
    delay,
    config: REVEAL_CONFIG,
  });

  const Tag = animated[tag] as ElementType;

  return (
    // react-spring serialises the initial spring style differently on server vs
    // client; values converge on mount, so suppress the cosmetic mismatch.
    <Tag className={className} style={styles} suppressHydrationWarning>
      {children}
    </Tag>
  );
};
