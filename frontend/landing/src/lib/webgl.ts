"use client";

import { useSyncExternalStore } from "react";

let cached: boolean | null = null;

/** Returns true when the browser can create a WebGL2 (or WebGL1) context. Result is cached. */
export function canUseWebGL(): boolean {
  if (typeof window === "undefined") return false;
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    cached = Boolean(gl);
  } catch {
    cached = false;
  }
  return cached;
}

const noopSubscribe = () => () => {};

/** False during SSR and hydration, then the real capability. */
export function useWebGL(): boolean {
  return useSyncExternalStore(noopSubscribe, canUseWebGL, () => false);
}
