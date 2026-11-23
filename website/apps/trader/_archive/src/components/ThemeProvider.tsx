'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';

/* Fallbacks only. The real values are read from the CSS custom properties
   after the theme class is applied — these inline styles beat the stylesheet,
   so hardcoding them here silently overrode the palette (a #0a0a0a body kept
   the vantablack theme off pure black, and a #ffffff body ignored the light
   theme's warm canvas). Keep the fallbacks roughly in sync anyway. */
const LIGHT_BG = '#f4f3ef';
const LIGHT_TEXT = '#111827';
const DARK_BG = '#000000';
const DARK_TEXT = '#ffffff';

/** Resolve a CSS custom property from :root, falling back when unset. */
function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Forces theme on html, body, and wrapper so every element gets correct CSS variables.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((s) => s.theme);
  const isLight = theme === 'light';

  useEffect(() => {
    const cls = isLight ? 'theme-light' : 'theme-dark';
    const removeCls = isLight ? 'theme-dark' : 'theme-light';

    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.add(cls);
    document.documentElement.classList.remove(removeCls);

    // Read AFTER the class swap so the values come from the active palette.
    const bg = cssVar('--bg-base', isLight ? LIGHT_BG : DARK_BG);
    const txt = cssVar('--text-primary', isLight ? LIGHT_TEXT : DARK_TEXT);
    document.documentElement.style.backgroundColor = bg;
    document.documentElement.style.color = txt;

    document.body.setAttribute('data-theme', theme);
    document.body.classList.add(cls);
    document.body.classList.remove(removeCls);
    document.body.style.backgroundColor = bg;
    document.body.style.color = txt;
  }, [theme, isLight]);

  return (
    <div
      data-theme={theme}
      className={isLight ? 'theme-light' : 'theme-dark'}
      style={{
        minHeight: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: isLight ? LIGHT_BG : DARK_BG,
        color: isLight ? LIGHT_TEXT : DARK_TEXT,
      }}
    >
      {children}
    </div>
  );
}
