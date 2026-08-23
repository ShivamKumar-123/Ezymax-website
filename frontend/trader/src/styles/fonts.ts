/**
 * Marketing-site fonts — set up via `next/font/google` so Next.js
 * self-hosts the files (no runtime fetch to fonts.gstatic.com), subsets
 * to Latin only, and exposes them as CSS variables the rest of the app
 * binds to via Tailwind.
 *
 * Each font exports a `variable` token; we apply all three to the
 * <html> element in `src/app/layout.tsx` so any descendant component
 * (marketing landing, trader app chrome, etc.) can pick them up.
 *
 * Weights match the design-system type scale:
 *   - Fraunces        300 / 400 / 600  — display / serif headlines
 *   - Inter Tight     400 / 500 / 600  — body + UI text
 *   - JetBrains Mono  400 / 500        — prices, spreads, tickers
 *
 * Trader app's existing Inter (loaded via CDN @import in globals.css)
 * is unchanged — the marketing fonts ride alongside it. When the
 * trader-app fonts get migrated to next/font, drop the CDN line and
 * everything else still works.
 */
import { Space_Grotesk, Plus_Jakarta_Sans, JetBrains_Mono, Onest, Poppins, Instrument_Serif } from 'next/font/google';

// Crextio dashboard theme font — Poppins, the soft geometric sans of
// the Nixtio/Crextio reference. Bound to `font-crextio` in
// tailwind.config.ts; applied on the DashboardShell wrapper.
export const fontCrextio = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal'],
  variable: '--font-crextio',
  display: 'swap',
});

// Textura landing theme font — Onest, ported from the
// next16-claude-starter design system (obsidian/frontend/design-system.md).
// Bound to `font-onest` in tailwind.config.ts; applied on the
// (landing) route group wrapper.
export const fontOnest = Onest({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal'],
  variable: '--font-onest',
  display: 'swap',
});

// Marketing-display font — Space Grotesk. Modern geometric sans
// with subtle character, used for H1/H2/H3 marketing headlines.
export const fontDisplay = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal'],
  variable: '--font-display',
  display: 'swap',
});

// Body font — Plus Jakarta Sans. Clean, highly legible humanist
// sans for paragraphs and UI text.
export const fontBody = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal'],
  variable: '--font-body',
  display: 'swap',
});

export const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal'],
  variable: '--font-mono',
  display: 'swap',
});

// Numeric font — Space Grotesk at heavier weights for the "solid"
// ValutaSolid-style look on balances / prices / P&L. Tabular-nums
// (applied via the `tabular-nums` utility at each call-site) keeps
// digits aligned. The Tailwind `mono` family points here first, so
// every existing `font-mono` number picks this up automatically.
export const fontNumeric = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal'],
  variable: '--font-numeric',
  display: 'swap',
});

// Editorial italic serif for the AI builder hero ("How can I help you
// build today?") — the Mindora-style headline. Bound to `font-editorial`.
export const fontEditorial = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-editorial',
  display: 'swap',
});

/** Joined `className` to drop straight onto <html>. */
export const fontVariableClass = [
  fontDisplay.variable,
  fontBody.variable,
  fontMono.variable,
  fontNumeric.variable,
  fontOnest.variable,
  fontCrextio.variable,
  fontEditorial.variable,
].join(' ');
