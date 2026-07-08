'use client';

export type Theme = 'light' | 'dark';

const KEY = 'ib-theme';

/** Apply the theme to <html> — IB globals.css keys off [data-theme] + .theme-dark. */
export function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  el.setAttribute('data-theme', t);
  el.classList.toggle('theme-dark', t === 'dark');
}

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    return (localStorage.getItem(KEY) as Theme) || 'dark';
  } catch {
    return 'dark';
  }
}

export function setTheme(t: Theme) {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
  applyTheme(t);
}
