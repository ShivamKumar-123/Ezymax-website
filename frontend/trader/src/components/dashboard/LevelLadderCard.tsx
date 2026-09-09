'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Lock, Check, Sparkles, ArrowRight } from 'lucide-react';

/**
 * Inline rank-ladder card for the dashboard — the same horizontal tier track
 * as the level popup, but shown directly on the page (no click needed).
 * Cleared tiers are lime with a check, the current one glows with a "YOU"
 * marker, upcoming tiers are locked; a lime rail fills to exact progress and
 * auto-scrolls to centre the current tier. Landing "Obsidian & Lime" theme.
 */
const LEVELS = [
  { label: 'Novice', xp: 0 },
  { label: 'Apprentice', xp: 500 },
  { label: 'Skilled Trader', xp: 1500 },
  { label: 'Veteran', xp: 3000 },
  { label: 'Expert', xp: 5000 },
  { label: 'Master', xp: 8000 },
  { label: 'Champion', xp: 12000 },
  { label: 'Legend', xp: 18000 },
  { label: 'Sovereign', xp: 26000 },
  { label: 'Mythic', xp: 36000 },
];
const MAX_LEVEL = LEVELS.length;

const ACCENT = '#ccff00';
const ACCENT_HI = '#eaff8a';
const ON_ACCENT = '#0a0a0a';

const COL = 92;
const YOU_ROW = 28;
const NODE = 44;
const RAIL_TOP = YOU_ROW + NODE / 2;

function fmtXp(v: number): string {
  if (v >= 1000) {
    const k = v / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  }
  return String(v);
}

function useCountUp(value: number, run: boolean, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, run, ms]);
  return n;
}

export interface LevelBenefits {
  spread_discount_pct: number;
  swap_discount_pct: number;
  commission_discount_pct: number;
}

export default function LevelLadderCard({
  level,
  levelLabel,
  xpIntoLevel,
  xpForNextLevel,
  benefits,
  nextLevelBenefits,
}: {
  level: number;
  levelLabel: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  benefits?: LevelBenefits | null;
  nextLevelBenefits?: LevelBenefits | null;
}) {
  const isMax = level >= MAX_LEVEL || xpForNextLevel <= 0;
  const intoPct = xpForNextLevel > 0 ? Math.min(1, Math.max(0, xpIntoLevel / xpForNextLevel)) : 1;
  const remaining = isMax ? 0 : Math.max(0, xpForNextLevel - xpIntoLevel);
  const nextLabel = isMax ? levelLabel : (LEVELS[level]?.label ?? 'Mythic');
  const railPct = isMax ? 100 : ((level - 1 + intoPct) / (MAX_LEVEL - 1)) * 100;

  const [go, setGo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setGo(true));
    const t = setTimeout(() => {
      const sc = scrollRef.current;
      const cur = currentRef.current;
      if (sc && cur) sc.scrollTo({ left: cur.offsetLeft - sc.clientWidth / 2 + cur.clientWidth / 2, behavior: 'smooth' });
    }, 300);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t);
    };
  }, []);

  const remainingCount = useCountUp(remaining, go);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-5 sm:p-6"
      style={{ background: 'radial-gradient(120% 90% at 85% -10%, rgba(204,255,0,0.08), transparent 55%), var(--bg-card)', borderColor: 'rgba(204,255,0,0.18)' }}
    >
      <style>{`
        @keyframes llPing { 0%{transform:scale(1);opacity:.6} 80%{transform:scale(1.85);opacity:0} 100%{opacity:0} }
        @keyframes llBob  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes llShim { 0%{transform:translateX(-140%)} 100%{transform:translateX(360%)} }
      `}</style>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/45 to-transparent" aria-hidden />

      {/* Heading */}
      <div className="relative flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">Your rank</p>
          <h2 className="mt-0.5 text-lg font-extrabold tracking-tight text-text-primary sm:text-xl">
            Level {level} · <span style={{ color: 'var(--accent-ink)' }}>{levelLabel}</span>
          </h2>
          {!isMax ? (
            <p className="mt-0.5 text-xs text-text-secondary">
              <span className="font-bold tabular-nums" style={{ color: 'var(--accent-ink)' }}>{remainingCount.toLocaleString()}</span>
              {' '}XP to <span className="font-semibold text-text-primary">Level {level + 1} · {nextLabel}</span>
            </p>
          ) : (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--accent-ink)' }}>
              <Sparkles size={13} /> Max rank reached 🏆
            </p>
          )}
        </div>
        <Link
          href="/rewards"
          className="inline-flex items-center gap-1 rounded-lg border border-accent/30 bg-accent/[0.06] px-3 py-1.5 text-xs font-bold transition-colors hover:bg-accent/12"
          style={{ color: 'var(--accent-ink)' }}
        >
          Rewards <ArrowRight size={13} />
        </Link>
      </div>

      {/* What this level is worth at the desk */}
      {benefits && (benefits.spread_discount_pct > 0 || benefits.swap_discount_pct > 0 || benefits.commission_discount_pct > 0) && (
        <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
          {([
            ['Spread', benefits.spread_discount_pct, nextLevelBenefits?.spread_discount_pct],
            ['Swap', benefits.swap_discount_pct, nextLevelBenefits?.swap_discount_pct],
            ['Commission', benefits.commission_discount_pct, nextLevelBenefits?.commission_discount_pct],
          ] as const)
            .filter(([, pct]) => pct > 0)
            .map(([label, pct, next]) => (
              <span
                key={label}
                className="inline-flex items-baseline gap-1 rounded-full border border-accent/25 bg-accent/[0.07] px-2.5 py-1 text-[11px] font-semibold text-text-secondary"
                title={
                  typeof next === 'number' && next > pct
                    ? `${next}% at Level ${level + 1}`
                    : undefined
                }
              >
                <span className="tabular-nums font-bold" style={{ color: 'var(--accent-ink)' }}>{pct}%</span>
                <span>off {label.toLowerCase()}</span>
              </span>
            ))}
        </div>
      )}

      {/* Track */}
      <div ref={scrollRef} className="mt-5 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin]">
        {/* Fill the card, but never below the width the ten columns need —
           past that the wrapper above scrolls. It used to be a fixed
           MAX_LEVEL * COL, which on a wide dashboard left the whole right
           half of the card empty. */}
        <div className="relative w-full" style={{ minWidth: MAX_LEVEL * COL }}>
          <div
            className="absolute"
            style={{
              left: `${50 / MAX_LEVEL}%`,
              right: `${50 / MAX_LEVEL}%`,
              top: RAIL_TOP - 2.5,
            }}
          >
            <div className="h-[5px] w-full rounded-full" style={{ background: 'var(--border-primary)' }} />
            <div
              className="absolute left-0 top-0 h-[5px] overflow-hidden rounded-full"
              style={{
                width: go ? `${railPct}%` : '0%',
                background: `linear-gradient(90deg, #a6d600, ${ACCENT} 70%, ${ACCENT_HI})`,
                transition: 'width 1300ms cubic-bezier(0.22,1,0.36,1)',
              }}
            >
              <div className="absolute inset-y-0 w-1/3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)', animation: 'llShim 2.4s linear infinite' }} />
            </div>
          </div>

          <div className="relative flex">
            {LEVELS.map((lv, i) => {
              const num = i + 1;
              const passed = num < level;
              const current = num === level;
              const next = num === level + 1;
              const locked = num > level;
              const on = passed || current;
              return (
                <div
                  key={lv.label}
                  ref={current ? currentRef : undefined}
                  className="flex flex-1 flex-col items-center"
                  style={{ minWidth: COL }}
                >
                  <div className="flex items-end justify-center" style={{ height: YOU_ROW }}>
                    {current && (
                      <span
                        className="mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wide"
                        style={{
                          background: `linear-gradient(90deg, ${ACCENT_HI}, ${ACCENT})`, color: ON_ACCENT,
                          boxShadow: '0 4px 14px rgba(204,255,0,0.45)',
                          opacity: go ? 1 : 0, transition: 'opacity 400ms ease 500ms',
                          animation: go ? 'llBob 2.6s ease-in-out infinite 600ms' : undefined,
                        }}
                      >
                        <span className="size-1.5 rounded-full" style={{ background: ON_ACCENT }} /> YOU
                      </span>
                    )}
                  </div>

                  <div className="relative grid place-items-center" style={{ width: NODE, height: NODE }}>
                    {current && go && (
                      <span className="absolute inset-0 rounded-full" style={{ border: `2px solid ${ACCENT}`, animation: 'llPing 1.9s ease-out infinite' }} />
                    )}
                    <div
                      className="grid size-full place-items-center rounded-full"
                      style={{
                        background: on ? `radial-gradient(circle at 32% 28%, ${ACCENT_HI}, ${ACCENT} 62%, #a6d600)` : 'var(--bg-tertiary)',
                        border: on ? '1.5px solid rgba(255,255,255,0.35)' : `1.5px solid ${next ? 'rgba(204,255,0,0.55)' : 'var(--border-primary)'}`,
                        boxShadow: current
                          ? '0 0 0 5px rgba(204,255,0,0.14), 0 0 22px rgba(204,255,0,0.55), inset 0 1px 0 rgba(255,255,255,0.5)'
                          : passed ? '0 5px 14px rgba(204,255,0,0.25), inset 0 1px 0 rgba(255,255,255,0.45)' : 'none',
                        transform: go ? (current ? 'scale(1.06)' : 'scale(1)') : 'scale(0.5)',
                        opacity: go ? 1 : 0,
                        transition: `transform 440ms cubic-bezier(0.34,1.56,0.64,1) ${i * 60}ms, opacity 340ms ease ${i * 60}ms`,
                      }}
                    >
                      {passed ? <Check size={17} style={{ color: ON_ACCENT }} strokeWidth={3.2} />
                        : current ? <Sparkles size={16} style={{ color: ON_ACCENT }} />
                        : <Lock size={13} style={{ color: next ? 'var(--accent-ink)' : 'var(--text-tertiary)' }} />}
                    </div>
                  </div>

                  <p className="mt-2 px-1 text-center text-[9px] font-bold uppercase leading-tight tracking-wide"
                    style={{ color: on ? 'var(--accent-ink)' : next ? 'color-mix(in srgb, var(--accent-ink) 75%, transparent)' : locked ? 'var(--text-tertiary, #8a8a8a)' : 'var(--text-secondary)' }}>
                    {lv.label}
                  </p>
                  <p className="mt-0.5 text-center text-[9px] font-semibold tabular-nums text-text-tertiary">
                    {fmtXp(lv.xp)} XP{next ? ' · next' : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
