"use client";

// 📖 Docs: obsidian/frontend/components/ui.md
import { animated, easings, useSpring } from "@react-spring/web";

/**
 * Looping gradient ring drawn as an overlay element.
 *
 * The source used a CSS `@keyframes gradientBorder` animation on a `::before`
 * pseudo-element — both banned here (hard rule #1, ADR-0002). This recreates it
 * with a spring loop driving `background-position`, and the standard
 * mask-composite trick to punch out everything but the 1px ring. Purely
 * decorative, so `aria-hidden`.
 */

export interface AnimatedGradientBorderProps {
  /** CSS gradient image painted into the ring. */
  gradient: string;
  /** Loop duration in ms (source used 3000–4000). */
  durationMs?: number;
  /** Ring thickness in px. */
  thickness?: number;
  /** Radius / inset utilities (e.g. "rounded-full"). */
  className?: string;
}

export const AnimatedGradientBorder = ({
  gradient,
  durationMs = 3000,
  thickness = 1,
  className,
}: AnimatedGradientBorderProps) => {
  const styles = useSpring({
    from: { backgroundPosition: "0% 0%" },
    to: { backgroundPosition: "200% 0%" },
    loop: true,
    config: { duration: durationMs, easing: easings.linear },
  });

  return (
    <animated.span
      aria-hidden="true"
      suppressHydrationWarning
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        padding: thickness,
        backgroundImage: gradient,
        backgroundSize: "200% 100%",
        WebkitMask:
          "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
        pointerEvents: "none",
        ...styles,
      }}
    />
  );
};
