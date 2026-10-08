"use client";

import * as React from "react";
import { toast as sonner, type ExternalToast } from "sonner";

/**
 * Terminal notifications: every toast is shown by sonner *and* kept in a per-browser history
 * (localStorage, newest first, capped at 100) that the title-bar bell lists. Import `toast` from here
 * instead of "sonner" so nothing is missed. The Journal is separate and unchanged.
 */

export type NoteKind = "success" | "error" | "warning" | "info";
export interface Note {
  id: string;
  ts: number;
  kind: NoteKind;
  title: string;
  text?: string;
  read: boolean;
}

const KEY = "ezymex.terminal.notifications";
const CAP = 100;

let notes: Note[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: Note[] = [];

function load(): Note[] {
  if (notes) return notes;
  notes = [];
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    const list = raw ? (JSON.parse(raw) as Note[]) : [];
    if (Array.isArray(list)) notes = list.filter((n) => n && typeof n.id === "string" && typeof n.title === "string").slice(0, CAP);
  } catch {
    /* storage blocked or corrupt: start empty */
  }
  return notes;
}

function commit(next: Note[]) {
  notes = next.slice(0, CAP);
  try {
    localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    /* storage full or blocked: history lives for this session */
  }
  listeners.forEach((l) => l());
}

// other tabs of the terminal share the same history
if (typeof window !== "undefined")
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    notes = null;
    load();
    listeners.forEach((l) => l());
  });

const text = (v: unknown): string | undefined => (typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined);

function record(kind: NoteKind, message: unknown, data?: ExternalToast) {
  const title = text(message);
  if (!title) return;
  const desc = text(data?.description);
  const now = Date.now();
  const list = load();
  // a toast re-shown with the same id (e.g. the guest notice) replaces its previous entry
  const id = data?.id !== undefined ? `t:${String(data.id)}` : `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  commit([{ id, ts: now, kind, title, text: desc, read: false }, ...list.filter((n) => n.id !== id)]);
}

type Msg = Parameters<typeof sonner>[0];

function show(message: Msg, data?: ExternalToast) {
  record("info", message, data);
  return sonner(message, data);
}

/** How long a toast stays (paused while hovered): quick for news, longer for problems. Explicit durations win. */
const DURATION: Record<NoteKind, number> = { info: 3000, success: 3000, warning: 5000, error: 6000 };
const timed = (kind: NoteKind, data?: ExternalToast): ExternalToast => ({ ...data, duration: data?.duration ?? DURATION[kind] });

export const toast = Object.assign((message: Msg, data?: ExternalToast) => show(message, timed("info", data)), {
  success: (message: Msg, data?: ExternalToast) => (record("success", message, data), sonner.success(message, timed("success", data))),
  error: (message: Msg, data?: ExternalToast) => (record("error", message, data), sonner.error(message, timed("error", data))),
  warning: (message: Msg, data?: ExternalToast) => (record("warning", message, data), sonner.warning(message, timed("warning", data))),
  info: (message: Msg, data?: ExternalToast) => (record("info", message, data), sonner.info(message, timed("info", data))),
  message: (message: Msg, data?: ExternalToast) => (record("info", message, data), sonner.message(message, timed("info", data))),
  dismiss: sonner.dismiss,
});

export const notifications = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  get: () => load(),
  markAllRead: () => commit(load().map((n) => (n.read ? n : { ...n, read: true }))),
  markRead: (id: string) => commit(load().map((n) => (n.id === id && !n.read ? { ...n, read: true } : n))),
  clear: () => commit([]),
};

export function useNotifications() {
  return React.useSyncExternalStore(notifications.subscribe, notifications.get, () => EMPTY);
}
