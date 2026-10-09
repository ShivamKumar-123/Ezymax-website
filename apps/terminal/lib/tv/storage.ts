"use client";

// What TradingView charts keep in the browser: each chart tab's own layout (indicators, drawings, chart type, scales;
// `widget.save()`), and the trader's indicator / drawing / chart templates (the library's save-load adapter, local).
// Symbol and timeframe stay in the terminal workspace (lib/store.tsx), which owns the tabs.
import type { TvSaveLoadAdapter } from "./types";

const PREFIX = "ezymex.terminal.tv.";
const TEMPLATES = `${PREFIX}templates`;

const read = <T>(key: string): T | undefined => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
};
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage full or blocked: the chart keeps working, unsaved */
  }
};

/** The saved TradingView layout of chart tab `tabId`, if any. */
export const readTvState = (tabId: string) => read<object>(PREFIX + tabId);
export const writeTvState = (tabId: string, state: object) => write(PREFIX + tabId, state);

/** A closed tab's layout goes with it. */
export function forgetTvState(tabId: string) {
  try {
    localStorage.removeItem(PREFIX + tabId);
  } catch {
    /* blocked */
  }
}

/** Reset workspace: every tab's layout (templates stay, they are the trader's). */
export function forgetAllTvState() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX) && k !== TEMPLATES) localStorage.removeItem(k);
    }
  } catch {
    /* blocked */
  }
}

type Templates = { study: Record<string, string>; drawing: Record<string, Record<string, string>>; chart: Record<string, Record<string, unknown>> };
const templates = (): Templates => ({ study: {}, drawing: {}, chart: {}, ...read<Partial<Templates>>(TEMPLATES) });
const edit = (f: (t: Templates) => void) => {
  const t = templates();
  f(t);
  write(TEMPLATES, t);
};

/** Templates kept in this browser (the library's "Save indicator template…", drawing and chart templates). Chart
 *  layouts are not saved by name: every tab is one. */
export const templateStore: TvSaveLoadAdapter = {
  getAllCharts: async () => [],
  removeChart: async () => {},
  saveChart: async () => Promise.reject(new Error("chart layouts are the terminal's tabs")),
  getChartContent: async () => Promise.reject(new Error("no saved layouts")),
  getAllStudyTemplates: async () => Object.keys(templates().study).map((name) => ({ name })),
  removeStudyTemplate: async ({ name }) => edit((t) => void delete t.study[name]),
  saveStudyTemplate: async ({ name, content }) => edit((t) => void (t.study[name] = content)),
  getStudyTemplateContent: async ({ name }) => templates().study[name] ?? Promise.reject(new Error("not found")),
  getDrawingTemplates: async (tool) => Object.keys(templates().drawing[tool] ?? {}),
  loadDrawingTemplate: async (tool, name) => templates().drawing[tool]?.[name] ?? Promise.reject(new Error("not found")),
  removeDrawingTemplate: async (tool, name) => edit((t) => void delete t.drawing[tool]?.[name]),
  saveDrawingTemplate: async (tool, name, content) => edit((t) => void (t.drawing[tool] = { ...t.drawing[tool], [name]: content })),
  getChartTemplateContent: async (name) => ({ content: templates().chart[name] }),
  getAllChartTemplates: async () => Object.keys(templates().chart),
  saveChartTemplate: async (name, content) => edit((t) => void (t.chart[name] = content)),
  removeChartTemplate: async (name) => edit((t) => void delete t.chart[name]),
};
