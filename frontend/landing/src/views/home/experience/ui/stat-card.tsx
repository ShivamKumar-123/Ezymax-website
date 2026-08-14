// 📖 Docs: obsidian/frontend/components/ui.md
import type { StatCardContent } from "../content";

/**
 * Frosted statistic card — the `.dna-card` surface from style.css. Positioning
 * and orbit motion are owned by the parent that mounts it; this renders only
 * the visual surface and content.
 */
export interface StatCardProps {
  content: StatCardContent;
}

export const StatCard = ({ content }: StatCardProps) => (
  <article
    aria-label={content.title}
    className="w-[var(--width-card)] rounded-3xl border border-border-glass-strong bg-surface-card p-10 shadow-glass-card backdrop-blur-lg max-sm:p-6"
  >
    {/* A stat callout, not a section heading — kept as <p> to avoid an
        h1 → h3 level skip while the cards float between sections. */}
    <p className="mb-8 font-display text-kicker font-semibold uppercase tracking-wider text-foreground/90">
      {content.title}
    </p>
    <p className="mb-6 inline-block font-display text-stat font-semibold leading-none text-gradient-accent">
      {content.stat}
    </p>
    <p className="font-display text-lead font-normal leading-normal text-muted">
      {content.description}
    </p>
  </article>
);
