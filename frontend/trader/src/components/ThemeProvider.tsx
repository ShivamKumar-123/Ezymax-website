'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';

const LIGHT_BG = '#ffffff';
const LIGHT_TEXT = '#0A0A0A';
const DARK_BG = '#0a0a0a';
const DARK_TEXT = '#ffffff';

// Brand red → black glow for dark mode. A warm radial bloom anchored at
// the top of the viewport that fades into pure black — keeps the Ezymex
// red (#CC0000) present without washing out chart/panel surfaces.
const DARK_BG_IMAGE =
  'radial-gradient(125% 75% at 50% -10%, rgba(204,0,0,0.30) 0%, rgba(150,55,16,0.13) 28%, rgba(10,10,10,0) 60%)';
// Light mode is a clean white surface with a whisper of red at the top.
const LIGHT_BG_IMAGE =
  'radial-gradient(120% 70% at 50% -10%, rgba(204,0,0,0.06) 0%, rgba(255,255,255,0) 45%)';

/**
 * Forces theme on html, body, and wrapper so every element gets correct CSS variables.
 * Dark mode paints an red→black gradient; light mode stays white + red.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((s) => s.theme);
  const isLight = theme === 'light';

  useEffect(() => {
    const bg = isLight ? LIGHT_BG : DARK_BG;
    const bgImage = isLight ? LIGHT_BG_IMAGE : DARK_BG_IMAGE;
    const txt = isLight ? LIGHT_TEXT : DARK_TEXT;
    const cls = isLight ? 'theme-light' : 'theme-dark';
    const removeCls = isLight ? 'theme-dark' : 'theme-light';

    // backgroundColor + backgroundImage are set as SEPARATE properties (not
    // the `background` shorthand) so the flat base colour never resets the
    // gradient — and the gradient stays pinned to the viewport while scrolling.
    for (const el of [document.documentElement, document.body]) {
      el.setAttribute('data-theme', theme);
      el.classList.add(cls);
      el.classList.remove(removeCls);
      el.style.backgroundColor = bg;
      el.style.backgroundImage = bgImage;
      el.style.backgroundAttachment = 'fixed';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.color = txt;
    }
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
        backgroundColor: isLight ? LIGHT_BG : DARK_BG,
        backgroundImage: isLight ? LIGHT_BG_IMAGE : DARK_BG_IMAGE,
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
        color: isLight ? LIGHT_TEXT : DARK_TEXT,
      }}
    >
      {children}
    </div>
  );
}
