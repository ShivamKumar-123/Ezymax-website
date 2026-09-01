'use client';

/**
 * BrandCard — the shared card shell for the logged-in app (dashboard
 * sections, account cards). Theme-aware:
 *
 *   • Light  — clean white card, soft grey tile inside, hairline ring,
 *              gentle shadow. No brand gradient: keeps the cream canvas calm.
 *   • Dark   — the brand look: light, luminous orange fading into deep
 *              black, Vantablack tile inside, heavy orange + black shadow.
 *
 * `useBrandTone()` exposes the same light/dark flag plus ready-made class
 * strings for text, pills and buttons that sit on the shell, so callers
 * never hard-code white-on-orange.
 */

import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { useWarmTheme } from '@/stores/warmThemeStore';

export function useBrandTone() {
  const dark = useWarmTheme((s) => s.dark);
  return {
    dark,
    /** Primary text on the shell header. */
    text: dark ? 'text-white' : 'text-text-primary',
    /** Secondary text on the shell header. */
    muted: dark ? 'text-white/75' : 'text-text-secondary',
    /** Tertiary / separators. */
    faint: dark ? 'text-white/40' : 'text-text-tertiary',
    /** Small status pill (emphasised). */
    pill: dark ? 'bg-white/20 text-white' : 'bg-black/[0.06] text-text-primary',
    /** Small status pill (quiet). */
    pillQuiet: dark ? 'bg-black/25 text-white/75' : 'bg-black/[0.04] text-text-secondary',
    /** Icon button on the shell header. */
    iconBtn: dark ? 'text-white/80 hover:bg-white/15 hover:text-white' : 'text-text-secondary hover:bg-black/[0.06] hover:text-text-primary',
    /** Outline button on the tile. */
    outlineBtn: dark
      ? 'border border-white/40 text-white hover:bg-white hover:text-black'
      : 'border border-border-primary text-text-primary hover:bg-crx-charcoal hover:text-crx-charcoal-ink',
    /** Text inside the tile. */
    tileText: dark ? 'text-white' : 'text-text-primary',
    tileMuted: dark ? 'text-white/60' : 'text-text-secondary',
    tileFaint: dark ? 'text-white/30' : 'text-text-tertiary',
  };
}

export const BRAND_SHELL_DARK =
  'text-white bg-[linear-gradient(168deg,#FF8A50_0%,#F0561F_16%,#8A2E10_38%,#1A0905_64%,#000000_100%)] ring-1 ring-[#FF8A50]/40 shadow-[0_30px_70px_-22px_rgba(240,86,31,0.6),0_24px_48px_-24px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.18)]';
export const BRAND_SHELL_LIGHT =
  'text-text-primary bg-white ring-1 ring-black/[0.06] shadow-[0_14px_36px_-18px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.9)]';
export const BRAND_TILE_DARK = 'bg-black text-white ring-1 ring-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';
export const BRAND_TILE_LIGHT = 'bg-[#F4F4F1] text-text-primary ring-1 ring-black/[0.04]';

export default function BrandCard({
  header,
  children,
  className,
  tileClassName,
  id,
}: {
  header?: ReactNode;
  children: ReactNode;
  className?: string;
  tileClassName?: string;
  id?: string;
}) {
  const { dark } = useBrandTone();
  return (
    <div
      id={id}
      className={clsx('rounded-[24px] p-1.5 pt-2 transition-shadow', dark ? BRAND_SHELL_DARK : BRAND_SHELL_LIGHT, className)}
    >
      {header ? <div className="px-2.5">{header}</div> : null}
      <div className={clsx('rounded-[18px] p-4', header ? 'mt-1.5' : 'mt-0', dark ? BRAND_TILE_DARK : BRAND_TILE_LIGHT, tileClassName)}>
        {children}
      </div>
    </div>
  );
}
