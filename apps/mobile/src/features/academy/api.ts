// Academy data (App -> /api/mobile/academy/* -> the Client Area's Academy BFF -> services/academy). The same
// server answers as the web Client Area: the learner comes from the bearer session, quizzes and exams are graded by
// the service (the app never receives an answer before submitting), a chapter is complete when its quiz is passed
// (>= 60 %), a phase exam unlocks when every chapter of the phase is complete and passing it issues the certificate.
//
// Screens open on the last answer kept on the phone (useQuery persist) and refresh in the background. After a
// confirmed change (reading progress, a quiz, an exam) the cached answers are patched with the server's reply, so
// every screen agrees without refetching the whole course.
import { API_BASE } from "@/lib/config";
import { api, apiGet, type ApiError, type ApiResult } from "@/lib/api";
import { getQueryData, invalidate, prefetch, setQueryData, useQuery } from "@/lib/query";
import { i18n } from "@/i18n";
import { onSignOut } from "@/session";

export type { ApiError };

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
export type Continue = { slug: string; title: string; minutes: number; read_pct: number; started: boolean; phase: { slug: string; order: number; title: string } };
export type Me = {
  chapters_done: number;
  chapters_total: number;
  minutes_done: number;
  minutes_total: number;
  quiz_avg: number | null;
  certificates: number;
  streak: number;
  active_days: string[];
  continue: Continue | null;
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
  answered: number;
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

/* ---- language: content is served in the reader's language (English when not translated) ---- */

const lang = () => i18n.locale;
const q = (l: string) => `?lang=${encodeURIComponent(l)}`;

/* ---- query keys (all under "academy/", so invalidate("academy/") refreshes whatever is on screen) ---- */

export const KEYS = {
  catalog: (l = lang()) => `academy/catalog/${l}`,
  chapter: (slug: string, l = lang()) => `academy/chapter/${l}/${slug}`,
  glossary: (l = lang()) => `academy/glossary/${l}`,
  exam: (phase: string, l = lang()) => `academy/exam/${l}/${phase}`,
  certificates: () => "academy/certificates",
  certSvg: (code: string) => `academy/cert-svg/${code}`,
};

const STALE = { catalog: 60_000, chapter: 10 * 60_000, glossary: 24 * 3600_000, exam: 30_000, certificates: 5 * 60_000, svg: 24 * 3600_000 };

/* ---- fetchers ---- */

export const fetchCatalog = (l = lang()) => apiGet<Catalog>(`academy/catalog${q(l)}`);
export const fetchChapter = (slug: string, l = lang()) => apiGet<ChapterView>(`academy/chapters/${encodeURIComponent(slug)}${q(l)}`);
export const fetchGlossary = (l = lang()) => apiGet<Glossary>(`academy/glossary${q(l)}`, { timeoutMs: 30_000 });
export const fetchExam = (phase: string, l = lang()) => apiGet<ExamView>(`academy/exams/${encodeURIComponent(phase)}${q(l)}`);
export const fetchCertificates = () => apiGet<{ certificates: Certificate[] }>("academy/me/certificates");

/** The certificate image (public SVG, served by the Academy BFF): its text, drawn natively by react-native-svg. */
export async function fetchCertificateSvg(code: string): Promise<ApiResult<string>> {
  try {
    const res = await fetch(`${API_BASE}/api/mobile/academy/certificates/${encodeURIComponent(code)}/image`, { credentials: "omit", headers: { accept: "image/svg+xml" } });
    const text = await res.text();
    if (res.ok && text.includes("<svg")) return { ok: true, status: res.status, data: text };
    return { ok: false, status: res.status, error: { code: res.status === 404 ? "not_found" : "unavailable", message: i18n.t("academy.unavailable.text") } };
  } catch {
    return { ok: false, status: 0, error: { code: "network", message: i18n.t("auth.apiError.network") } };
  }
}

/* ---- screen data ---- */

export const useCatalog = (enabled = true) => useQuery(KEYS.catalog(), () => fetchCatalog(), { persist: true, staleMs: STALE.catalog, enabled });
export const useChapter = (slug: string | null) => useQuery(slug ? KEYS.chapter(slug) : null, () => fetchChapter(slug!), { persist: true, staleMs: STALE.chapter });
export const useGlossary = () => useQuery(KEYS.glossary(), () => fetchGlossary(), { persist: true, staleMs: STALE.glossary });
export const useExam = (phase: string | null) => useQuery(phase ? KEYS.exam(phase) : null, () => fetchExam(phase!), { persist: true, staleMs: STALE.exam });
export const useCertificates = (enabled = true) => useQuery(KEYS.certificates(), fetchCertificates, { persist: true, staleMs: STALE.certificates, enabled });
export const useCertificateSvg = (code: string | null) => useQuery(code ? KEYS.certSvg(code) : null, () => fetchCertificateSvg(code!), { persist: true, staleMs: STALE.svg });

/** Warm a screen's data on press-in, so it opens on content. */
export const prefetchAcademy = {
  chapter: (slug: string) => prefetch(KEYS.chapter(slug), () => fetchChapter(slug), { persist: true, staleMs: STALE.chapter }),
  catalog: () => prefetch(KEYS.catalog(), () => fetchCatalog(), { persist: true, staleMs: STALE.catalog }),
  glossary: () => prefetch(KEYS.glossary(), () => fetchGlossary(), { persist: true, staleMs: STALE.glossary }),
  exam: (phase: string) => prefetch(KEYS.exam(phase), () => fetchExam(phase), { persist: true, staleMs: STALE.exam }),
  certificates: () => prefetch(KEYS.certificates(), fetchCertificates, { persist: true, staleMs: STALE.certificates }),
};

/* ---- writes (graded and stored by the service; the app shows the server's answer) ---- */

/**
 * Records how far the chapter was read (the service keeps the maximum). `l` = the language the chapter is shown in.
 * `patch`: also update the cached chapter / catalog (done when the reader leaves the chapter; while reading, a patch
 * would re-render the open reader and the phase screen under it for nothing).
 */
export async function postProgress(slug: string, readPct: number, l: string, patch = true): Promise<ApiResult<{ progress: ChapterProgress }>> {
  const r = await api<{ progress: ChapterProgress }>(`academy/chapters/${encodeURIComponent(slug)}/progress${q(l)}`, { method: "POST", body: { read_pct: Math.max(0, Math.min(100, Math.round(readPct))) } });
  if (r.ok) lastProgress.set(slug, r.data.progress);
  if (r.ok && patch) patchProgress(slug, r.data.progress);
  return r;
}

/** The last stored progress per chapter (applied to the caches when the reader leaves); forgotten on sign-out. */
const lastProgress = new Map<string, ChapterProgress>();
onSignOut(() => lastProgress.clear());

/** The reader is leaving the chapter: bring the cached chapter and catalog up to the stored progress. */
export function settleProgress(slug: string) {
  const p = lastProgress.get(slug);
  if (p) patchProgress(slug, p);
}

/** Checks the answers given so far: every answered question is graded at once; the attempt counts when all are. */
export async function postQuiz(slug: string, answers: (number | null)[], l: string): Promise<ApiResult<QuizReply>> {
  const r = await api<QuizReply>(`academy/chapters/${encodeURIComponent(slug)}/quiz${q(l)}`, { method: "POST", body: { answers } });
  if (r.ok && r.data.all_answered) applyQuiz(slug, r.data);
  return r;
}

/** Submits the final exam in the language it was loaded in (the reader's). */
export async function postExam(phase: string, answers: number[], l = lang()): Promise<ApiResult<ExamReply>> {
  const r = await api<ExamReply>(`academy/exams/${encodeURIComponent(phase)}${q(l)}`, { method: "POST", body: { answers } });
  if (r.ok) {
    if (getQueryData<ExamView>(KEYS.exam(phase))) {
      setQueryData<ExamView>(KEYS.exam(phase), (prev) => ({ ...prev!, attempts: [{ pct: r.data.pct, passed: r.data.passed, at: new Date().toISOString() }, ...prev!.attempts].slice(0, 10), certificate: r.data.certificate ?? prev!.certificate }), true);
    }
    // best score, certificate and streak come from the server
    invalidate("academy/catalog/");
    if (r.data.certificate_issued) invalidate(KEYS.certificates());
  }
  return r;
}

/* ---- cache patches after confirmed writes ---- */

function mapChapterCards(cat: Catalog, slug: string, fn: (c: ChapterCard, p: PhaseT) => ChapterCard): Catalog {
  let hit = false;
  const phases = cat.phases.map((p) => {
    let changed = false;
    const sections = p.sections.map((s) => {
      const i = s.chapters.findIndex((c) => c.slug === slug);
      if (i < 0) return s;
      hit = changed = true;
      const chapters = s.chapters.slice();
      chapters[i] = fn(chapters[i]!, p);
      return { ...s, chapters };
    });
    return changed ? { ...p, sections } : p;
  });
  return hit ? { ...cat, phases } : cat;
}

function patchProgress(slug: string, progress: ChapterProgress) {
  const ck = KEYS.chapter(slug);
  if (getQueryData<ChapterView>(ck)) setQueryData<ChapterView>(ck, (v) => ({ ...v!, progress: { ...v!.progress, ...progress } }), true);
  const cat = getQueryData<Catalog>(KEYS.catalog());
  if (!cat) return;
  let next = mapChapterCards(cat, slug, (c) => (c.progress.read_pct === progress.read_pct ? c : { ...c, progress: { ...c.progress, read_pct: progress.read_pct } }));
  // "continue where you left off" follows the chapter being read
  if (next.me.continue?.slug === slug) next = { ...next, me: { ...next.me, continue: { ...next.me.continue, read_pct: progress.read_pct, started: true } } };
  if (next !== cat) setQueryData(KEYS.catalog(), next, true);
}

function applyQuiz(slug: string, r: QuizReply) {
  const ck = KEYS.chapter(slug);
  const prog = (p: ChapterProgress): ChapterProgress => ({
    ...p,
    quiz_best: Math.max(p.quiz_best ?? 0, r.score),
    quiz_total: r.total,
    completed: p.completed || r.completed,
    completed_at: p.completed_at ?? (r.completed ? new Date().toISOString() : null),
  });
  if (getQueryData<ChapterView>(ck)) {
    setQueryData<ChapterView>(
      ck,
      (v) => ({ ...v!, progress: prog(v!.progress), section: { ...v!.section, chapters: v!.section.chapters.map((c) => (c.slug === slug ? { ...c, completed: c.completed || r.completed } : c)) } }),
      true,
    );
  }
  const cat = getQueryData<Catalog>(KEYS.catalog());
  if (cat) {
    let next = mapChapterCards(cat, slug, (c) => ({ ...c, progress: prog(c.progress) }));
    if (r.completed_now) {
      next = {
        ...next,
        phases: next.phases.map((p) => (p.slug === r.phase.slug ? { ...p, progress: { done: r.phase.done, total: r.phase.total }, exam: p.exam ? { ...p.exam, unlocked: r.phase.exam_unlocked } : p.exam } : p)),
        me: { ...next.me, chapters_done: Math.min(next.me.chapters_total, next.me.chapters_done + 1) },
      };
    }
    setQueryData(KEYS.catalog(), next, true);
  }
  // other chapters' next-up, streak, quiz average and the phase exam come from the server
  if (r.completed_now) {
    invalidate("academy/catalog/");
    invalidate(`academy/exam/${lang()}/${r.phase.slug}`);
  }
}
