'use client';

/**
 * Loads the self-hosted TradingView Charting Library standalone bundle once
 * and resolves when `window.TradingView` is available. Shared by the inline
 * terminal chart and the /chart page so the load logic lives in one place.
 */

const LIBRARY_SRC = '/charting_library/charting_library.standalone.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TradingView?: any;
  }
}

let loadPromise: Promise<void> | null = null;

export function loadChartLibrary(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.TradingView) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LIBRARY_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('library load error')));
      return;
    }
    const s = document.createElement('script');
    s.src = LIBRARY_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loadPromise = null; // allow retry
      reject(new Error('Failed to load charting library'));
    };
    document.head.appendChild(s);
  });
  return loadPromise;
}
