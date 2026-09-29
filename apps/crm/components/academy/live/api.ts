"use client";

// Browser client for the Academy BFF (/api/academy/*, see app/api/academy/[...path]/route.ts).

import * as React from "react";
import { createFormatter } from "@kalks/i18n";
import { tr } from "@kalks/i18n/react";

export type Level = "Beginner" | "Intermediate" | "Advanced" | "Professional";
export type Track = "fundamental" | "technical";

export type ChapterProgress = { read_pct: number; quiz_best: number | null; quiz_total: number | null; completed: boolean; completed_at: string | null };
export type ChapterCard = { slug: string; title: string; summary: string; minutes: number; order: number; questions: number; progress: ChapterProgress };
export type SectionT = { slug: string; track: Track; title: string; summary: string; chapters: ChapterCard[] };
export type ExamState = { questions: number; pass_mark: number; unlocked: boolean; best_pct: number | null; passed: boolean; attempts: number };
export type CertRef = { code: string; issued_at: string };
export type PhaseT = {
  slug: string;
  order: number;
  title: string;
  level: Level;
  summary: string;
  minutes: number;
  progress: { done: number; total: number };
  sections: SectionT[];
  exam: ExamState | null;
  certificate: CertRef | null;
};
export type Me = {
  chapters_done: number;
  chapters_total: number;
  minutes_done: number;
  minutes_total: number;
  quiz_avg: number | null;
  certificates: number;
  streak: number;
  active_days: string[];
  continue: { slug: string; title: string; minutes: number; read_pct: number; started: boolean; phase: { slug: string; order: number; title: string } } | null;
};
export type Catalog = { lang: string; phases: PhaseT[]; me: Me };

export type Question = { question: string; options: string[] };
export type Practice = { label: string; symbol?: string | null } | null;
export type ChapterView = {
  chapter: { slug: string; title: string; summary: string; body: string; takeaways: string[]; practice: Practice; minutes: number; words: number; quiz: Question[]; updated_at: string; lang: string };
  phase: { slug: string; order: number; title: string; level: Level };
  section: { slug: string; track: Track; title: string; index: number; count: number; chapters: { slug: string; title: string; completed: boolean }[] };
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
  progress: ChapterProgress;
};
export type QuizResult = { index: number; choice: number; correct: boolean; answer: number; explanation: string };
export type QuizReply = {
  results: QuizResult[];
  score: number;
  total: number;
  all_answered: boolean;
  passed: boolean;
  pass_pct: number;
  completed: boolean;
  completed_now: boolean;
  phase: { slug: string; done: number; total: number; exam_unlocked: boolean };
};
export type ExamView = {
  phase: { slug: string; order: number; title: string; level: Level };
  exam: { pass_mark: number; questions: Question[]; count: number };
  unlocked: boolean;
  chapters_done: number;
  chapters_total: number;
  attempts: { pct: number; passed: boolean; at: string }[];
  certificate: { code: string; issued_at: string; score_pct: number } | null;
};
export type ExamReply = { score: number; total: number; pct: number; pass_mark: number; passed: boolean; results: QuizResult[]; certificate: ExamView["certificate"]; certificate_issued: boolean };
export type Certificate = { code: string; phase: string; phase_order: number; phase_title: string; level: Level; score_pct: number; issued_at: string; learner_name: string; verify_url: string };
export type Term = { slug: string; term: string; category: string; definition: string; related: { slug: string; term: string }[] };
export type Glossary = { terms: Term[]; categories: { name: string; count: number }[]; total: number };

export class AcademyError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function academyApi<T>(path: string, init?: { body?: unknown; signal?: AbortSignal; keepalive?: boolean }): Promise<T> {
  const post = init?.body !== undefined;
  let res: Response;
  try {
    res = await fetch(`/api/academy/${path}`, {
      method: post ? "POST" : "GET",
      headers: post ? { "content-type": "application/json" } : undefined,
      body: post ? JSON.stringify(init!.body) : undefined,
      cache: "no-store",
      signal: init?.signal,
      keepalive: init?.keepalive,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new AcademyError(0, "network", tr("common.networkError"));
  }
  const data = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.assign(`/api/auth/expired?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    throw new AcademyError(res.status, data.error?.code ?? "error", data.error?.message ?? tr("common.errorRetry"));
  }
  return data as T;
}

/** Loads `path` once (and again on `reload()`); `path = null` waits. */
export function useAcademy<T>(path: string | null) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<AcademyError | null>(null);
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);
  React.useEffect(() => {
    if (!path) return;
    const ctl = new AbortController();
    academyApi<T>(path, { signal: ctl.signal })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        setError(e instanceof AcademyError ? e : new AcademyError(0, "error", tr("common.errorRetry")));
      });
    return () => ctl.abort();
  }, [path, tick]);
  return { data, error, loading: data === null && error === null, reload, setData };
}

export const LEVEL_TONE: Record<Level, "up" | "gold" | "ember" | "info"> = { Beginner: "up", Intermediate: "gold", Advanced: "ember", Professional: "info" };
// translation keys; render with t(TRACK_LABEL[track])
export const TRACK_LABEL = { fundamental: "academy.track.fundamental", technical: "academy.track.technical" } as const satisfies Record<Track, string>;
export const TRACK_SHORT = { fundamental: "academy.trackShort.fundamental", technical: "academy.trackShort.technical" } as const satisfies Record<Track, string>;
/** Translated level label (levels are English enums from the service). */
export const levelLabel = (l: Level) => tr.dyn(`academy.level.${l.toLowerCase()}`, l);

/** Cover photo per phase (by order). */
export const PHASE_COVER = ["/assets/photos/finance.jpg", "/assets/photos/trading-screen.jpg", "/assets/photos/charts.jpg", "/assets/photos/nyc.jpg", "/assets/photos/analytics.jpg", "/assets/photos/dashboard.jpg", "/assets/photos/gold.jpg", "/assets/photos/skyscrapers.jpg"];
export const coverOf = (order: number) => PHASE_COVER[(order - 1 + PHASE_COVER.length) % PHASE_COVER.length]!;

// evaluated at render time, so they follow the current language
export const fmtMin = (m: number) => (m >= 60 ? (m % 60 ? tr("academy.duration.hoursMin", { h: Math.floor(m / 60), m: m % 60 }) : tr("academy.duration.hours", { h: Math.floor(m / 60) })) : tr("academy.duration.min", { count: m }));
export const fmtDay = (iso: string) => createFormatter(tr.locale).date(iso);
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
