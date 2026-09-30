// Small shared helpers for the Academy screens (evaluated at render time, so they follow the current language).
import type { MessageKey, T } from "@/i18n";
import { colors, type BlockColor } from "@/theme/tokens";
import type { Certificate, Level, PhaseT, Track } from "./api";
import { tint } from "./tint";

/** Phase colour blocks: the palette in turn, so the learning path reads as a sequence of distinct steps. */
const PHASE_COLORS: BlockColor[] = ["ember", "gold", "mint", "periwinkle"];
export const phaseColor = (order: number): BlockColor => PHASE_COLORS[(Math.max(1, order) - 1) % PHASE_COLORS.length]!;

/**
 * What a colour means in the Academy (green and red stay reserved for money). Since the web colour family, the
 * "mint" block tone is a lighter ember, so it can't tell right from wrong next to ember: settled things are the warm
 * off-white, a wrong answer is ember, a picked (not yet graded) exam answer and awards are gold.
 */
export const TONE = {
  /** right answer, completed chapter / track, passed quiz or exam */
  done: colors.cream,
  /** wrong answer */
  wrong: colors.ember,
  /** an exam answer picked before submitting */
  chosen: colors.gold,
  /** certified phase, the exam to take next */
  award: colors.gold,
} as const;

/** Secondary text on a colour block: ink at 78 %, at least 4.5:1 on every block colour (ember 4.7, light ember 5.7,
 *  gold 6.7, sand 8.0, off-white 9.3). The kit's ink2 (66 %) is 3.7:1 on ember and 4.3:1 on light ember. */
export const inkSoft = tint(colors.ink, 0.78);
/** The big decorative phase number on a phase block: 3:1 or more on every block colour (large text; ink3 is 2.4:1 on
 *  ember). */
export const inkNumeral = tint(colors.ink, 0.6);

/** The block tone of a passed quiz or exam result (a failed one is gold). */
export const DONE_BLOCK: BlockColor = "cream";

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

export type CertItem = { code: string; issuedAt: string; n: number; title: string; url?: string; scorePct?: number };

/**
 * The certificates to show, by phase: the list (exam score, the service's verification link), plus any certificate
 * the catalog names that the list doesn't have (yet): while the list loads, or when it can't be loaded, a learner
 * still sees their certificates, never "no certificates yet".
 */
export function certificatesOf(phases: PhaseT[], listed: Certificate[] | undefined): CertItem[] {
  const list = listed ?? [];
  const known = new Set(list.map((c) => c.code));
  return [
    ...list.map((c): CertItem => ({ code: c.code, issuedAt: c.issued_at, n: c.phase_order, title: c.phase_title, url: c.verify_url, scorePct: c.score_pct })),
    ...phases.flatMap((p): CertItem[] => (p.certificate && !known.has(p.certificate.code) ? [{ code: p.certificate.code, issuedAt: p.certificate.issued_at, n: p.order, title: p.title }] : [])),
  ].sort((a, b) => a.n - b.n);
}

/** The last seven days (oldest first) the way the service counts learning days: UTC dates. */
export function utcWeek(now = Date.now()): { key: string; date: Date }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now - (6 - i) * 86_400_000);
    return { key: date.toISOString().slice(0, 10), date };
  });
}
