"use client";

// Drawing edits with undo / redo, and the drawing rail's switches (magnet, lock, hide). docs/TERMINAL-DESIGN.md §2.2.
// Every change to a chart's drawings (add, move, delete, clear) goes through editDrawings(), which keeps the list before
// the change on that chart's undo stack. The stacks live outside the workspace (they are not saved) and start over when
// a chart changes market or timeframe: drawings are anchored to the bars of one series.
import * as React from "react";
import { tr } from "@ezymex/i18n/react";
import { toast } from "@/lib/notify";
import type { ChartTab, Drawing, useTerminal } from "@/lib/store";

type Terminal = ReturnType<typeof useTerminal>;

/* ------------------------------------------------------------------ */
/* Undo / redo                                                         */
/* ------------------------------------------------------------------ */

interface Stack {
  /** "symbol|tf" the snapshots belong to */
  key: string;
  past: Drawing[][];
  future: Drawing[][];
}
const LIMIT = 100;
const stacks = new Map<string, Stack>();
const subs = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

function stackOf(tab: ChartTab): Stack {
  const key = `${tab.symbol}|${tab.tf}`;
  let s = stacks.get(tab.id);
  if (!s || s.key !== key) {
    s = { key, past: [], future: [] };
    stacks.set(tab.id, s);
  }
  return s;
}

/** Change a chart's drawings as one undoable step (`fn` returns the same array for "no change"). */
export function editDrawings(T: Terminal, tabId: string, fn: (d: Drawing[]) => Drawing[]) {
  const tab = T.ws.tabs.find((x) => x.id === tabId);
  if (!tab) return;
  const next = fn(tab.drawings);
  if (next === tab.drawings) return;
  const s = stackOf(tab);
  s.past.push(tab.drawings);
  if (s.past.length > LIMIT) s.past.shift();
  s.future = [];
  T.updateTab(tabId, { drawings: next });
  emit();
}

function step(T: Terminal, tabId: string, back: boolean): boolean {
  const tab = T.ws.tabs.find((x) => x.id === tabId);
  if (!tab) return false;
  const s = stackOf(tab);
  const to = (back ? s.past : s.future).pop();
  if (!to) return false;
  (back ? s.future : s.past).push(tab.drawings);
  T.updateTab(tabId, { drawings: to });
  if (T.selectedDrawing && !to.some((d) => d.id === T.selectedDrawing)) T.selectDrawing(null);
  emit();
  return true;
}

/** Undo the last drawing change on a chart (Ctrl/⌘+Z, the toolbar, the command palette). */
export function undoDrawings(T: Terminal, tabId = T.ws.activeId) {
  if (!step(T, tabId, true)) toast(tr("chart.toolbar.nothingToUndo"), { id: "draw-undo" });
}

/** Redo the last undone drawing change (Ctrl/⌘+Shift+Z or Ctrl+Y). */
export function redoDrawings(T: Terminal, tabId = T.ws.activeId) {
  if (!step(T, tabId, false)) toast(tr("chart.toolbar.nothingToRedo"), { id: "draw-undo" });
}

/** Whether a chart has something to undo / redo (toolbar buttons). */
export function useDrawingHistory(tab: ChartTab) {
  React.useSyncExternalStore(subscribe, () => version, () => 0);
  const s = stacks.get(tab.id);
  const live = !!s && s.key === `${tab.symbol}|${tab.tf}`;
  return { canUndo: live && s!.past.length > 0, canRedo: live && s!.future.length > 0 };
}

/* ------------------------------------------------------------------ */
/* Magnet, lock, hide (every chart; remembered in this browser)        */
/* ------------------------------------------------------------------ */

export interface DrawPrefs {
  /** snap drawing points to the nearest open / high / low / close of the bar under the pointer */
  magnet: boolean;
  /** drawings can't be moved or deleted one by one (new ones can still be drawn) */
  locked: boolean;
  /** drawings aren't shown (picking a drawing tool shows them again) */
  hidden: boolean;
}
const PREFS_KEY = "ezymex.terminal.drawPrefs";
const NO_PREFS: DrawPrefs = { magnet: false, locked: false, hidden: false };
let prefs: DrawPrefs | null = null;

/** Current switches (read in event handlers). */
export function drawPrefs(): DrawPrefs {
  if (prefs) return prefs;
  prefs = NO_PREFS;
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(PREFS_KEY) : null;
    if (raw) prefs = { ...NO_PREFS, ...(JSON.parse(raw) as Partial<DrawPrefs>) };
  } catch {
    /* storage blocked */
  }
  return prefs;
}

export function setDrawPrefs(patch: Partial<DrawPrefs>) {
  const cur = drawPrefs();
  if ((Object.keys(patch) as (keyof DrawPrefs)[]).every((k) => cur[k] === patch[k])) return;
  prefs = { ...cur, ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage blocked */
  }
  emit();
}

export function useDrawPrefs(): DrawPrefs {
  return React.useSyncExternalStore(subscribe, drawPrefs, () => NO_PREFS);
}

/** Toast explaining why a locked drawing doesn't move or delete. */
export function lockedNotice() {
  toast(tr("chart.tool.locked"), { description: tr("chart.tool.lockedText"), id: "draw-locked" });
}

/* ------------------------------------------------------------------ */
/* Delete                                                              */
/* ------------------------------------------------------------------ */

/** Delete / Backspace: remove the selected drawing (undoable; not while drawings are locked). */
export function deleteSelectedDrawing(T: Terminal) {
  const id = T.selectedDrawing;
  if (!id) return;
  if (drawPrefs().locked) return lockedNotice();
  const tab = T.ws.tabs.find((x) => x.drawings.some((d) => d.id === id));
  if (!tab) return;
  editDrawings(T, tab.id, (ds) => ds.filter((d) => d.id !== id));
  T.selectDrawing(null);
  toast(tr("order.toast.objectDeleted"));
}

/** Remove every drawing of a chart (undoable). Returns how many were removed. */
export function clearDrawings(T: Terminal, tabId: string): number {
  const n = T.ws.tabs.find((x) => x.id === tabId)?.drawings.length ?? 0;
  if (n) editDrawings(T, tabId, () => []);
  T.selectDrawing(null);
  return n;
}
