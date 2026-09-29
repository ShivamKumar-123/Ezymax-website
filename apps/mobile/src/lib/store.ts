// Minimal external store (useSyncExternalStore) for app-wide state: session, accounts, preferences.
// Components subscribe with a selector and re-render only when the selected slice changes.
import { useCallback, useRef, useSyncExternalStore } from "react";

export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(fn: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set(next) {
      const v = typeof next === "function" ? (next as (p: T) => T)(state) : next;
      if (Object.is(v, state)) return;
      state = v;
      subs.forEach((f) => f());
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

const identity = <T,>(x: T) => x;

/** Subscribe to `store`, re-rendering only when `select(state)` changes (by `equal`, default Object.is). */
export function useStore<T, S = T>(store: Store<T>, select: (s: T) => S = identity as (s: T) => S, equal: (a: S, b: S) => boolean = Object.is): S {
  const last = useRef<{ s: S } | null>(null);
  const getSnapshot = useCallback(() => {
    const next = select(store.get());
    if (last.current && equal(last.current.s, next)) return last.current.s;
    last.current = { s: next };
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, select]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export const shallowEqual = (a: unknown, b: unknown) => {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const ka = Object.keys(a as object);
  if (ka.length !== Object.keys(b as object).length) return false;
  return ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
};
