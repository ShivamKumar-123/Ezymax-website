// 📖 Docs: obsidian/frontend/components/ui.md
/**
 * Inline icon set used by the home experience — ported verbatim from the
 * `<svg>` glyphs in the source index.html. `currentColor` lets them inherit
 * text colour; decorative by default (`aria-hidden`).
 */

export interface IconProps {
  className?: string;
}

/** Stacked-layers glyph shown in every eyebrow label. */
export const LayersIcon = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    aria-hidden="true"
  >
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

/** Diagonal arrow inside the primary button's circular badge. */
export const ArrowIcon = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    aria-hidden="true"
  >
    <path d="M7 17L17 7M17 7H7M17 7v10" />
  </svg>
);
