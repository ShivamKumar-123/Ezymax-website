// Small shared helpers for the Academy screens (evaluated at render time, so they follow the current language).
import type { MessageKey, T } from "@/i18n";
import type { BlockColor } from "@/theme/tokens";
import type { Level, PhaseT, Track } from "./api";

/** Phase colour blocks: the palette in turn, so the learning path reads as a sequence of distinct steps. */
const PHASE_COLORS: BlockColor[] = ["ember", "gold", "mint", "periwinkle"];
export const phaseColor = (order: number): BlockColor => PHASE_COLORS[(Math.max(1, order) - 1) % PHASE_COLORS.length]!;

export const TRACK_LABEL: Record<Track, MessageKey> = { fundamental: "academy.track.fundamental", technical: "academy.track.technical" };
export const TRACK_SHORT: Record<Track, MessageKey> = { fundamental: "academy.trackShort.fundamental", technical: "academy.trackShort.technical" };

/** Levels are English enums from the service. */
export const levelLabel = (t: T, l: Level | string) => t.dyn(`academy.level.${String(l).toLowerCase()}`, String(l));

export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** 45 -> "45 min", 60 -> "1h", 66 -> "1h 6m" (the web's wording). */
export function fmtMin(t: T, m: number): string {
  if (m >= 60) return m % 60 ? t("academy.duration.hoursMin", { h: Math.floor(m / 60), m: m % 60 }) : t("academy.duration.hours", { h: Math.floor(m / 60) });
  return t("academy.duration.min", { count: m });
}

export type PhaseState = "certified" | "examReady" | "inProgress" | "notStarted";

/** Where the learner is in a phase (the web's phase card state). */
export function phaseState(p: PhaseT): PhaseState {
  if (p.certificate) return "certified";
  if (p.progress.done === p.progress.total && p.progress.total > 0) return "examReady";
  if (p.progress.done > 0) return "inProgress";
  return "notStarted";
}

export const PHASE_STATE_LABEL: Record<PhaseState, MessageKey> = {
  certified: "academy.state.certified",
  examReady: "academy.state.examReady",
  inProgress: "academy.state.inProgress",
  notStarted: "academy.state.notStarted",
};

/** "01", "02" … for the big phase numbers. */
export const two = (n: number) => String(n).padStart(2, "0");

/** The first chapter of a phase the learner hasn't completed (both tracks, in order). */
export const nextOpenChapter = (p: PhaseT) => p.sections.flatMap((s) => s.chapters).find((c) => !c.progress.completed) ?? null;
