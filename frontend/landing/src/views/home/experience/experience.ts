import { create } from "zustand";

/**
 * Shared state for the scroll experience.
 *
 * `ParticleCanvas` owns the single smoothed scroll value and, each frame,
 * publishes it two ways:
 *  - `experienceProgress.current` — a mutable read by the per-frame card
 *    animator (no React re-render).
 *  - `useExperiencePhase` — coarse section states updated **only when they
 *    change**, so overlay springs re-render at phase boundaries, not 60×/s.
 *
 * Thresholds mirror the `currentScroll` comparisons in the source script.js.
 */

/** Live smoothed scroll progress, 0 (top) → 1 (bottom). */
export const experienceProgress = { current: 0 };

export type SectionState = "before" | "visible" | "after";

/** Scroll-progress windows for each overlay, ported from script.js. */
export const PHASE = {
  hero: { leave: 0.02 },
  dna: { in: 0.15, full: 0.18, fadeStart: 0.35, out: 0.38, spanEnd: 0.38 },
  wave: { in: 0.48, out: 0.62 },
  galaxy: { in: 0.93 },
} as const;

export interface ExperiencePhase {
  hero: SectionState;
  wave: SectionState;
  galaxy: SectionState;
  dnaActive: boolean;
  /** Recompute states from progress; only writes when something changed. */
  sync: (progress: number) => void;
}

const heroState = (p: number): SectionState =>
  p < PHASE.hero.leave ? "visible" : "after";

const waveState = (p: number): SectionState => {
  if (p < PHASE.wave.in) return "before";
  if (p <= PHASE.wave.out) return "visible";
  return "after";
};

const galaxyState = (p: number): SectionState =>
  p >= PHASE.galaxy.in ? "visible" : "before";

export const useExperiencePhase = create<ExperiencePhase>((set, get) => ({
  hero: "visible",
  wave: "before",
  galaxy: "before",
  dnaActive: false,
  sync: (p) => {
    const hero = heroState(p);
    const wave = waveState(p);
    const galaxy = galaxyState(p);
    const dnaActive = p > PHASE.dna.in && p < PHASE.dna.spanEnd;
    const s = get();
    if (
      s.hero === hero &&
      s.wave === wave &&
      s.galaxy === galaxy &&
      s.dnaActive === dnaActive
    ) {
      return;
    }
    set({ hero, wave, galaxy, dnaActive });
  },
}));
