// 📖 Docs: obsidian/frontend/components/ui.md
import { AnimatedGradientBorder } from "./animated-gradient-border";
import { LayersIcon } from "./icons";

/**
 * Frosted pill label with the layers glyph and an animated shimmer ring —
 * the `.top-label` element from style.css.
 */
export interface EyebrowProps {
  children: React.ReactNode;
  className?: string;
}

const SHIMMER_RING =
  "linear-gradient(90deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.08))";

export const Eyebrow = ({ children, className }: EyebrowProps) => (
  <span
    className={`relative inline-flex items-center gap-2 rounded-full bg-surface-glass px-5 py-2.5 text-eyebrow font-medium text-foreground shadow-glass-eyebrow backdrop-blur-md${
      className ? ` ${className}` : ""
    }`}
  >
    <AnimatedGradientBorder
      gradient={SHIMMER_RING}
      durationMs={3000}
      className="rounded-full"
    />
    <LayersIcon className="relative size-3.5 shrink-0" />
    <span className="relative">{children}</span>
  </span>
);
