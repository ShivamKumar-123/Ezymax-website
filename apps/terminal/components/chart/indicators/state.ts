"use client";

import * as React from "react";
import { toast } from "@/lib/notify";
import {
  INDICATOR_DEFS,
  indicatorLabel,
  makeInstance,
  migrateIndicators,
  normalizeParams,
  type IndicatorInstance,
  type IndicatorType,
} from "@/lib/indicators";
import type { ChartType } from "@/lib/trading";
import type { ChartTab, useTerminal } from "@/lib/store";

type Terminal = ReturnType<typeof useTerminal>;

/* ------------------------------------------------------------------ */
/* Tiny external stores (dialog state, favourites, user templates)     */
/* ------------------------------------------------------------------ */

function createStore<S>(init: () => S, persistKey?: string) {
  let state: S | null = null;
  const subs = new Set<() => void>();
  const get = (): S => {
    if (state === null) {
      state = init();
      if (persistKey && typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(persistKey);
          if (raw) state = JSON.parse(raw) as S;
        } catch {
          /* ignore */
        }
      }
    }
    return state;
  };
  const set = (next: S | ((s: S) => S)) => {
    state = typeof next === "function" ? (next as (s: S) => S)(get()) : next;
    if (persistKey) {
      try {
        localStorage.setItem(persistKey, JSON.stringify(state));
      } catch {
        /* ignore */
      }
    }
    subs.forEach((f) => f());
  };
  const subscribe = (f: () => void) => {
    subs.add(f);
    return () => subs.delete(f);
  };
  const initial = init();
  const use = () => React.useSyncExternalStore(subscribe, get, () => initial);
  return { get, set, use };
}

/* ---- dialogs ---- */

export interface IndUi {
  /** Tab id the "Indicators" browser is open for. */
  list: string | null;
  settings: { tabId: string; uid: string } | null;
  saveTemplate: string | null;
}
const ui = createStore<IndUi>(() => ({ list: null, settings: null, saveTemplate: null }));
export const useIndUi = ui.use;
export const openIndicatorList = (tabId: string) => ui.set((s) => ({ ...s, list: tabId }));
export const openIndicatorSettings = (tabId: string, uid: string) => ui.set((s) => ({ ...s, settings: { tabId, uid } }));
export const openSaveTemplate = (tabId: string) => ui.set((s) => ({ ...s, saveTemplate: tabId }));
export const closeIndUi = (k: keyof IndUi) => ui.set((s) => ({ ...s, [k]: null }));

/* ---- favourites ---- */

const favs = createStore<string[]>(() => ["sma", "ema", "bb", "rsi", "macd"], "kalks.terminal.indicatorFavourites");
export const useIndicatorFavourites = favs.use;
export function toggleFavourite(t: IndicatorType) {
  favs.set((f) => (f.includes(t) ? f.filter((x) => x !== t) : [...f, t]));
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export function addIndicator(T: Terminal, tabId: string, type: IndicatorType, opts: { configure?: boolean; quiet?: boolean } = {}) {
  const tab = T.ws.tabs.find((t) => t.id === tabId);
  if (!tab) return;
  const inst = makeInstance(type, tab.indicators);
  T.updateTab(tabId, (t) => ({ indicators: [...t.indicators, inst] }));
  if (opts.configure) openIndicatorSettings(tabId, inst.uid);
  if (!opts.quiet) toast(`${indicatorLabel(type, inst.params)} added`, { description: `${tab.symbol}, ${tab.tf}` });
  return inst;
}

export function removeIndicator(T: Terminal, tabId: string, uid: string) {
  const tab = T.ws.tabs.find((t) => t.id === tabId);
  const inst = tab?.indicators.find((x) => x.uid === uid);
  if (!tab || !inst) return;
  T.updateTab(tabId, (t) => ({ indicators: t.indicators.filter((x) => x.uid !== uid) }));
  toast(`${indicatorLabel(inst.type, normalizeParams(inst.type, inst.params))} removed`, { description: `${tab.symbol}, ${tab.tf}` });
}

export function patchIndicator(T: Terminal, tabId: string, uid: string, patch: Partial<IndicatorInstance>) {
  T.updateTab(tabId, (t) => ({ indicators: t.indicators.map((x) => (x.uid === uid ? { ...x, ...patch } : x)) }));
}

export const toggleIndicator = (T: Terminal, tabId: string, inst: IndicatorInstance) => patchIndicator(T, tabId, inst.uid, { visible: !inst.visible });

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

export type TemplateIndicator = Omit<IndicatorInstance, "uid">;
export interface ChartTemplate {
  id: string;
  name: string;
  type: ChartType;
  indicators: TemplateIndicator[];
  builtin?: boolean;
}

const ti = (type: IndicatorType, params: Record<string, number | string> = {}, style?: IndicatorInstance["style"]): TemplateIndicator => ({ type, params: normalizeParams(type, params), visible: true, ...(style ? { style } : {}) });

export const BUILTIN_TEMPLATES: ChartTemplate[] = [
  { id: "b-default", name: "Default", type: "candles", indicators: [], builtin: true },
  { id: "b-trend", name: "Trend (SMA 20 · SMA 200 · EMA 50)", type: "candles", indicators: [ti("sma", { period: 20 }), ti("sma", { period: 200 }, { ma: { color: "info" } }), ti("ema", { period: 50 })], builtin: true },
  { id: "b-vol", name: "Volatility (BB · Keltner · ATR)", type: "candles", indicators: [ti("bb"), ti("keltner"), ti("atr")], builtin: true },
  { id: "b-mom", name: "Momentum (MACD · RSI)", type: "candles", indicators: [ti("macd"), ti("rsi")], builtin: true },
  { id: "b-intraday", name: "Intraday (VWAP · EMA 9/21 · Stochastic)", type: "candles", indicators: [ti("vwap"), ti("ema", { period: 9 }, { ma: { color: "ember" } }), ti("ema", { period: 21 }), ti("stoch")], builtin: true },
  { id: "b-ichimoku", name: "Ichimoku", type: "candles", indicators: [ti("ichimoku")], builtin: true },
  { id: "b-bw", name: "Bill Williams (Alligator · Fractals · AO · AC)", type: "candles", indicators: [ti("alligator"), ti("fractals"), ti("ao"), ti("ac")], builtin: true },
  { id: "b-line", name: "Clean line", type: "line", indicators: [], builtin: true },
];

const userTpl = createStore<ChartTemplate[]>(() => [], "kalks.terminal.templates");
export const useUserTemplates = userTpl.use;

const strip = (i: IndicatorInstance): TemplateIndicator => ({ type: i.type, params: i.params, visible: i.visible, ...(i.style ? { style: i.style } : {}), ...(i.levels ? { levels: i.levels } : {}) });

export function saveTemplate(name: string, tab: ChartTab) {
  const clean = name.trim();
  const tpl: ChartTemplate = { id: `u-${Date.now().toString(36)}`, name: clean, type: tab.type, indicators: tab.indicators.map(strip) };
  userTpl.set((l) => [...l.filter((x) => x.name.toLowerCase() !== clean.toLowerCase()), tpl]);
  toast.success(`Template "${clean}" saved`, { description: `${tpl.indicators.length} indicator${tpl.indicators.length === 1 ? "" : "s"} · ${tab.type}` });
}

export function deleteTemplate(id: string) {
  const t = userTpl.get().find((x) => x.id === id);
  userTpl.set((l) => l.filter((x) => x.id !== id));
  if (t) toast(`Template "${t.name}" deleted`);
}

export const templateExists = (name: string) => userTpl.get().some((x) => x.name.toLowerCase() === name.trim().toLowerCase());

/** Fresh instances (new uids) for a template, validated against the registry. */
export const templateInstances = (tpl: ChartTemplate): IndicatorInstance[] => migrateIndicators(tpl.indicators.map((x) => ({ ...x, uid: "" })));

export function applyTemplate(T: Terminal, tabIds: string[], tpl: ChartTemplate) {
  for (const id of tabIds) T.updateTab(id, { indicators: templateInstances(tpl), type: tpl.type });
  toast(`Template "${tpl.name}" applied`, { description: tabIds.length > 1 ? `${tabIds.length} charts` : undefined });
}

const sig = (l: { type: string; params: unknown }[]) => JSON.stringify(l.map((x) => [x.type, x.params]));
export const templateMatches = (tpl: ChartTemplate, tab: ChartTab) => tpl.type === tab.type && sig(tpl.indicators) === sig(tab.indicators);

export const shortList = (tab: ChartTab) => tab.indicators.map((i) => indicatorLabel(i.type, normalizeParams(i.type, i.params)));

export { INDICATOR_DEFS };
