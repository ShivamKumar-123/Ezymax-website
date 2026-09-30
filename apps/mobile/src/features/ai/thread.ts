// The AI Trader conversation: what the client asked, the strategy drafts the service returned, backtests and
// deployments started from them. It lives outside the screen (a request keeps going when the client navigates
// away) and is kept on this phone per user, so /ai reopens where it was. The server stays the source of truth:
// drafts are validated there, saved strategies and versions are created there, and nothing is ever deployed
// without the client's explicit confirmation in the Deploy sheet.
//
// One conversation is one strategy: the first Backtest / Deploy saves it (origin "ai"), later changes are saved as
// new versions of it. "New strategy" starts a fresh conversation (saved strategies stay in Algo).
import { i18n } from "@/i18n";
import { kv } from "@/lib/kv";
import { createStore } from "@/lib/store";
import { onSignOut, sessionStore } from "@/session";
import { fetchers as algoFetchers, refreshAlgo } from "@/features/algo/api";
import {
  cancelBacktest,
  createStrategy,
  deployStrategy,
  draftStrategy,
  fetchBacktest,
  saveVersion,
  startBacktest,
  validateSpec,
  type AiReply,
  type BacktestStatus,
  type BacktestSummary,
  type Built,
  type RiskLimits,
  type StrategySpec,
} from "./api";
import { runningDeployment, withoutFailed } from "./conversation";
import { specKey } from "./spec";
import type { ApiError } from "@/lib/api";

export type SavedRef = { strategyId: number; versionId: number; version: number; key: string };

export type AiMessage =
  | { id: string; kind: "user"; at: number; text: string }
  | { id: string; kind: "draft"; at: number; prompt: string; status: AiReply["status"]; questions: string[]; assumptions: string[]; built: Built; edited: boolean; saved?: SavedRef }
  | { id: string; kind: "error"; at: number; text: string; prompt?: string }
  | { id: string; kind: "notice"; at: number; text: string }
  | {
      id: string;
      kind: "backtest";
      at: number;
      backtestId: number;
      strategyId: number;
      versionId: number;
      version: number;
      name: string;
      params: { from: number; to: number; initialBalance: number; symbol: string; timeframe: string };
      status: BacktestStatus;
      progress: number;
      stage: string | null;
      summary: BacktestSummary | null;
      error: string | null;
      equity?: number[];
    }
  | { id: string; kind: "deployed"; at: number; deploymentId: number; strategyId: number; version: number; login: number; accountType: "demo" | "live"; name: string; symbol: string; timeframe: string };

export type DraftMessage = Extract<AiMessage, { kind: "draft" }>;
export type BacktestMessage = Extract<AiMessage, { kind: "backtest" }>;

type Pending = { id: string; prompt: string; startedAt: number };
export type ThreadState = { owner: number | null; messages: AiMessage[]; pending: Pending | null; strategyId: number | null };

const MAX_MESSAGES = 40;
const keyOf = (user: number) => `kalks.ai.thread.${user}`;
const FINAL: BacktestStatus[] = ["done", "failed", "cancelled"];

export const threadStore = createStore<ThreadState>({ owner: null, messages: [], pending: null, strategyId: null });

let seq = 0;
const newId = () => `${Date.now().toString(36)}-${(++seq).toString(36)}`;
let controller: AbortController | null = null;

/* ---- persistence (per user, this phone) ---- */

function persist() {
  const s = threadStore.get();
  if (s.owner === null) return;
  kv.setJSON(keyOf(s.owner), { messages: s.messages.slice(-MAX_MESSAGES), strategyId: s.strategyId });
}

function patch(fn: (s: ThreadState) => ThreadState, save = true) {
  threadStore.set(fn);
  if (save) persist();
}

function update(id: string, fn: (m: AiMessage) => AiMessage, save = true) {
  patch((s) => ({ ...s, messages: s.messages.map((m) => (m.id === id ? fn(m) : m)) }), save);
}

function push(m: AiMessage) {
  patch((s) => ({ ...s, messages: [...s.messages, m].slice(-MAX_MESSAGES) }));
}

/** Loads the signed-in user's conversation (once per user); resumes backtests that were still running. */
export function hydrateThread() {
  const user = sessionStore.get().user?.id ?? null;
  const s = threadStore.get();
  if (user === s.owner) return;
  const saved = user !== null ? kv.getJSON<{ messages?: AiMessage[]; strategyId?: number | null }>(keyOf(user)) : null;
  let messages = Array.isArray(saved?.messages) ? saved!.messages : [];
  // a request that was still running when the app closed never answered: say so, and offer to ask again
  const last = messages[messages.length - 1];
  if (last?.kind === "user") messages = [...messages, { id: newId(), kind: "error", at: Date.now(), text: i18n.t("mobileAi.interrupted"), prompt: last.text }];
  threadStore.set({ owner: user, messages, pending: null, strategyId: saved?.strategyId ?? null });
  for (const m of messages) if (m.kind === "backtest" && !FINAL.includes(m.status)) void pollBacktest(m.id, m.backtestId);
}

onSignOut(() => {
  controller?.abort();
  controller = null;
  const s = threadStore.get();
  if (s.owner !== null) kv.remove(keyOf(s.owner));
  threadStore.set({ owner: null, messages: [], pending: null, strategyId: null });
});

/* ---- selectors ---- */

export function latestDraft(messages: AiMessage[]): DraftMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.kind === "draft") return m;
  }
  return null;
}

export function draftById(id: string): DraftMessage | null {
  const m = threadStore.get().messages.find((x) => x.id === id);
  return m?.kind === "draft" ? m : null;
}

/* ---- asking the assistant ---- */

/**
 * Sends an instruction. With a draft in the conversation the assistant edits it; otherwise it starts one.
 * `retryOf`: the error bubble of a request that failed; asking again replaces that exchange (its message and the
 * error) instead of repeating the message under it.
 */
export async function ask(prompt: string, context: { symbol: string; timeframe: string }, retryOf?: string) {
  const text = prompt.trim();
  if (!text || threadStore.get().pending) return;
  const current = latestDraft(threadStore.get().messages);
  const pending: Pending = { id: newId(), prompt: text, startedAt: Date.now() };
  controller?.abort();
  const ctl = new AbortController();
  controller = ctl;
  patch((s) => ({ ...s, pending, messages: [...withoutFailed(s.messages, retryOf), { id: newId(), kind: "user" as const, at: Date.now(), text }].slice(-MAX_MESSAGES) }));
  const spec = current?.built.spec;
  const r = await draftStrategy({ prompt: text, symbol: spec?.symbol ?? context.symbol, timeframe: spec?.timeframe ?? context.timeframe, current: spec }, ctl.signal);
  if (controller === ctl) controller = null;
  // a newer request or a sign-out replaced this one
  if (threadStore.get().pending?.id !== pending.id) return;
  if (r.ok) {
    const d = r.data;
    push({ id: newId(), kind: "draft", at: Date.now(), prompt: text, status: d.status, questions: d.questions ?? [], assumptions: d.assumptions ?? [], built: d.result, edited: false });
  } else if (r.error.code === "aborted") {
    push({ id: newId(), kind: "notice", at: Date.now(), text: i18n.t("mobileAi.cancelled") });
  } else {
    push({ id: newId(), kind: "error", at: Date.now(), text: errorText(r.error), prompt: text });
  }
  patch((s) => ({ ...s, pending: null }));
}

export function stopAsking() {
  controller?.abort();
}

/** Starts over: a fresh conversation (strategies already saved stay in Algo). */
export function newThread() {
  controller?.abort();
  controller = null;
  patch((s) => ({ ...s, messages: [], pending: null, strategyId: null }));
}

/** The error of an AI / save / run call in the reader's language (the server's text when we don't know the code). */
export function errorText(e: ApiError): string {
  switch (e.code) {
    case "module_disabled":
      return i18n.t("mobileAi.error.module");
    case "viewer_read_only":
    case "viewer_out_of_scope":
      return i18n.t("mobileAi.error.viewOnly");
    case "staff_read_only":
      return i18n.t("mobileAi.error.staffReadOnly");
    case "ai_refused":
      return i18n.t("mobileAi.error.refused");
    case "ai_truncated":
      return i18n.t("mobileAi.error.truncated");
    case "rate_limited": {
      // the algo service sends retryAfter (seconds): the AI's hourly allowance, or Claude being busy
      const secs = (e as { retryAfter?: number }).retryAfter ?? e.retry_after;
      return secs ? i18n.t("mobileAi.error.rateLimited", { minutes: Math.max(1, Math.ceil(secs / 60)) }) : e.message;
    }
    default:
      if (e.status === 503 && e.code === "unavailable") return i18n.t("mobileAi.error.unavailable");
      return e.message;
  }
}

/* ---- editing a draft ---- */

/** Applies edited key fields: the service validates them; the draft shows the result (errors included). */
export async function applyEdit(draftId: string, spec: StrategySpec): Promise<{ ok: true; built: Built } | { ok: false; error: string }> {
  const r = await validateSpec(spec);
  if (!r.ok) return { ok: false, error: errorText(r.error) };
  update(draftId, (m) => (m.kind === "draft" ? { ...m, built: r.data, edited: true } : m));
  return { ok: true, built: r.data };
}

/* ---- saving (first run saves the strategy, later changes become versions) ---- */

type SaveResult = { ok: true; saved: SavedRef; name: string } | { ok: false; error: string };

/** Saves in flight, per draft and spec: a Backtest and a Deploy started while the first save is still on its way
 *  share it, so the strategy (or version) is created once. */
const saving = new Map<string, Promise<SaveResult>>();

function ensureSaved(draftId: string): Promise<SaveResult> {
  const d = draftById(draftId);
  if (!d) return Promise.resolve({ ok: false, error: i18n.t("common.errorRetry") });
  const key = specKey(d.built.spec);
  if (d.saved && d.saved.key === key) return Promise.resolve({ ok: true, saved: d.saved, name: d.built.spec.name });
  const k = `${draftId}:${key}`;
  const running = saving.get(k);
  if (running) return running;
  const p = save(d, key).finally(() => saving.delete(k));
  saving.set(k, p);
  return p;
}

async function save(d: DraftMessage, key: string): Promise<SaveResult> {
  const draftId = d.id;
  const spec = d.built.spec;
  const body = { spec, name: spec.name, prompt: d.prompt };
  const lineage = threadStore.get().strategyId;
  let r = lineage ? await saveVersion(lineage, { ...body, note: d.edited ? "edited in the app" : "AI Trader" }) : await createStrategy(body);
  // the strategy was archived or removed elsewhere: start a new one
  if (!r.ok && lineage && (r.status === 404 || r.error.code === "archived")) r = await createStrategy(body);
  if (!r.ok) return { ok: false, error: errorText(r.error) };
  if (!r.data.valid) return { ok: false, error: i18n.t("mobileAi.error.invalid") };
  const saved: SavedRef = { strategyId: r.data.id, versionId: r.data.versionId, version: r.data.version, key };
  patch((s) => ({ ...s, strategyId: saved.strategyId, messages: s.messages.map((m) => (m.id === draftId && m.kind === "draft" ? { ...m, saved } : m)) }));
  refreshAlgo();
  return { ok: true, saved, name: spec.name };
}

/* ---- backtests ---- */

export async function runBacktest(draftId: string, opts: { days: number; initialBalance: number; login?: number }): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await ensureSaved(draftId);
  if (!s.ok) return s;
  const to = Math.floor(Date.now() / 1000);
  const from = to - opts.days * 86_400;
  const r = await startBacktest({ strategyId: s.saved.strategyId, versionId: s.saved.versionId, from, to, initialBalance: opts.initialBalance, login: opts.login });
  if (!r.ok) return { ok: false, error: errorText(r.error) };
  const d = draftById(draftId);
  const id = newId();
  push({
    id,
    kind: "backtest",
    at: Date.now(),
    backtestId: r.data.id,
    strategyId: s.saved.strategyId,
    versionId: s.saved.versionId,
    version: s.saved.version,
    name: s.name,
    params: { from, to, initialBalance: opts.initialBalance, symbol: d?.built.spec.symbol ?? "", timeframe: d?.built.spec.timeframe ?? "" },
    status: r.data.status ?? "queued",
    progress: 0,
    stage: null,
    summary: null,
    error: null,
  });
  refreshAlgo();
  void pollBacktest(id, r.data.id);
  return { ok: true };
}

const polling = new Set<number>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Downsamples an equity curve to at most `n` points for the card's sparkline. */
function sparkline(points: { equity: number }[] | undefined, n = 48): number[] | undefined {
  if (!points?.length) return undefined;
  if (points.length <= n) return points.map((p) => p.equity);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(points[Math.round((i * (points.length - 1)) / (n - 1))]!.equity);
  return out;
}

async function pollBacktest(msgId: string, backtestId: number) {
  if (polling.has(backtestId)) return;
  polling.add(backtestId);
  const owner = threadStore.get().owner;
  try {
    let delay = 700;
    for (let i = 0; i < 600; i++) {
      if (threadStore.get().owner !== owner || !threadStore.get().messages.some((m) => m.id === msgId)) return;
      const r = await fetchBacktest(backtestId);
      if (r.ok) {
        const b = r.data;
        const final = FINAL.includes(b.status);
        // progress updates stay in memory; a status change (running, done…) is also written to the phone
        const prev = threadStore.get().messages.find((m) => m.id === msgId);
        const changed = prev?.kind === "backtest" && prev.status !== b.status;
        update(msgId, (m) => (m.kind === "backtest" ? { ...m, status: b.status, progress: b.progress, stage: b.stage, summary: b.summary, error: b.error, equity: final ? sparkline(b.report?.equity) : m.equity } : m), changed || final);
        if (final) {
          refreshAlgo();
          return;
        }
      } else if (r.status === 404 || r.status === 403) {
        update(msgId, (m) => (m.kind === "backtest" ? { ...m, status: "failed", error: errorText(r.error) } : m));
        return;
      }
      await sleep(delay);
      delay = Math.min(3000, Math.round(delay * 1.35));
    }
  } finally {
    polling.delete(backtestId);
  }
}

/** Asks the service to cancel a running backtest; the card follows the job's own status (polled). */
export async function stopBacktest(msgId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = threadStore.get().messages.find((x) => x.id === msgId);
  if (m?.kind !== "backtest" || FINAL.includes(m.status)) return { ok: true };
  const r = await cancelBacktest(m.backtestId);
  return r.ok ? { ok: true } : { ok: false, error: errorText(r.error) };
}

/* ---- deploying (only from the Deploy sheet, after the client confirmed) ---- */

export async function deploy(draftId: string, account: { login: number; type: "demo" | "live" }, risk: RiskLimits): Promise<{ ok: true; deploymentId: number } | { ok: false; error: string }> {
  const s = await ensureSaved(draftId);
  if (!s.ok) return s;
  const r = await deployStrategy({ strategyId: s.saved.strategyId, versionId: s.saved.versionId, login: account.login, risk });
  let deploymentId: number | null = r.ok ? r.data.id : null;
  // an earlier Deploy whose answer was lost (network) already started this version on that account: the service
  // refuses a second one ("exists"), so the conversation shows the one that runs. A deployment the conversation
  // already shows keeps the service's refusal ("already running on that account").
  if (!r.ok && r.error.code === "exists") {
    const list = await algoFetchers.deployments();
    const running = list.ok ? runningDeployment(list.data.items, s.saved.versionId, account.login) : null;
    if (running !== null && !threadStore.get().messages.some((m) => m.kind === "deployed" && m.deploymentId === running)) deploymentId = running;
  }
  if (deploymentId === null) return { ok: false, error: r.ok ? i18n.t("common.errorRetry") : errorText(r.error) };
  const d = draftById(draftId);
  push({
    id: newId(),
    kind: "deployed",
    at: Date.now(),
    deploymentId,
    strategyId: s.saved.strategyId,
    version: s.saved.version,
    login: account.login,
    accountType: account.type,
    name: s.name,
    symbol: d?.built.spec.symbol ?? "",
    timeframe: d?.built.spec.timeframe ?? "",
  });
  refreshAlgo();
  return { ok: true, deploymentId };
}
