'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X, Lock, Check, CandlestickChart, CheckSquare, Flame, Users, ArrowRight, Sparkles,
} from 'lucide-react';

/**
 * Rank-ladder level popup — a horizontal track of every tier (Novice → Mythic)
 * in the landing "Obsidian & Lime" theme: cleared tiers are glossy lime with a
 * check, the current one glows + pulses with a floating "YOU" marker, upcoming
 * tiers are frosted-locked. A lime rail with a moving shimmer + leading glow-dot
 * fills to exact progress, the track auto-scrolls to centre you, and "XP to
 * next" counts up.
 *
 * Mirrors the backend ladder (rewards_service.LEVEL_LABELS / LEVEL_THRESHOLDS).
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
const MAX_LEVEL = LEVELS.length; // 10

// Landing "Obsidian & Lime" palette.
const ACCENT = '#ccff00';
const ACCENT_HI = '#eaff8a';
const ON_ACCENT = '#0a0a0a';

const COL = 96;      // px per tier column
const YOU_ROW = 30;  // px reserved above nodes for the YOU marker
const NODE = 46;     // px node diameter
const RAIL_TOP = YOU_ROW + NODE / 2;

const WAYS = [
  { icon: CandlestickChart, title: 'Place trades', desc: 'Every trade you open earns XP.' },
  { icon: CheckSquare, title: 'Complete missions', desc: 'Daily & weekly missions give big XP.' },
  { icon: Flame, title: 'Keep your streak', desc: 'Check in daily to stack bonuses.' },
  { icon: Users, title: 'Invite friends', desc: 'Earn XP when referrals start trading.' },
];

function fmtXp(v: number): string {
  if (v >= 1000) {
    const k = v / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  }
  return String(v);
}

/** Ease-out count-up from 0 → value over ~900ms. */
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

export default function LevelProgressModal({
  level,
  levelLabel,
  xpIntoLevel,
  xpForNextLevel,
  onClose,
}: {
  level: number;
  levelLabel: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  onClose: () => void;
}) {
  const router = useRouter();
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
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      const sc = scrollRef.current;
      const cur = currentRef.current;
      if (sc && cur) sc.scrollTo({ left: cur.offsetLeft - sc.clientWidth / 2 + cur.clientWidth / 2, behavior: 'smooth' });
    }, 260);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const remainingCount = useCountUp(remaining, go);

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Level progress"
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
    >
      <style>{`
        @keyframes lvlPing { 0%{transform:scale(1);opacity:.65} 80%{transform:scale(1.9);opacity:0} 100%{opacity:0} }
        @keyframes lvlBob  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes lvlShim { 0%{transform:translateX(-140%)} 100%{transform:translateX(360%)} }
        @keyframes lvlHead { 0%,100%{box-shadow:0 0 8px 2px rgba(204,255,0,.7)} 50%{box-shadow:0 0 16px 5px rgba(204,255,0,.95)} }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl p-6 shadow-2xl"
        style={{
          background: 'radial-gradient(120% 90% at 80% -10%, rgba(204,255,0,0.10), transparent 55%), var(--bg-card)',
          border: '1px solid rgba(204,255,0,0.16)',
          transform: go ? 'translateY(0) scale(1)' : 'translateY(14px) scale(0.97)',
          opacity: go ? 1 : 0,
          transition: 'transform 340ms cubic-bezier(0.22,1,0.36,1), opacity 340ms ease',
        }}
      >
        <button
          type="button" onClick={onClose} aria-label="Close"
          className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <X size={16} />
        </button>

        {/* ── Heading ── */}
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">Your rank</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-text-primary">
            Level {level} ·{' '}
            <span style={{ background: `linear-gradient(90deg, ${ACCENT_HI}, ${ACCENT})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              {levelLabel}
            </span>
          </h2>
          {isMax ? (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: ACCENT }}>
              <Sparkles size={15} /> Max rank — you&apos;ve topped the ladder! 🏆
            </p>
          ) : (
            <p className="mt-1 text-sm text-text-secondary">
              <span className="font-extrabold tabular-nums" style={{ color: ACCENT }}>{remainingCount.toLocaleString()}</span>
              {' '}XP to reach{' '}
              <span className="font-semibold text-text-primary">Level {level + 1} · {nextLabel}</span>
            </p>
          )}
        </div>

        {/* ── Horizontal rank track ── */}
        <div ref={scrollRef} className="mt-6 overflow-x-auto pb-3 pt-1 [scrollbar-width:thin]">
          <div className="relative" style={{ width: MAX_LEVEL * COL }}>
            {/* Rail: dim base + gold fill (with shimmer) + leading glow-head */}
            <div className="absolute" style={{ left: COL / 2, right: COL / 2, top: RAIL_TOP - 2.5 }}>
              <div className="h-[5px] w-full rounded-full" style={{ background: 'rgba(204,255,0,0.12)' }} />
              <div
                className="absolute left-0 top-0 h-[5px] overflow-hidden rounded-full"
                style={{
                  width: go ? `${railPct}%` : '0%',
                  background: `linear-gradient(90deg, #a6d600, ${ACCENT} 70%, ${ACCENT_HI})`,
                  transition: 'width 1300ms cubic-bezier(0.22,1,0.36,1)',
                }}
              >
                {/* moving shimmer */}
                <div
                  className="absolute inset-y-0 w-1/3"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent)', animation: 'lvlShim 2.4s linear infinite' }}
                />
              </div>
              {/* glowing head at the fill tip */}
              {!isMax && (
                <div
                  className="absolute size-2.5 rounded-full"
                  style={{
                    left: go ? `${railPct}%` : '0%', top: -1.5, marginLeft: -5,
                    background: ACCENT_HI, animation: 'lvlHead 1.6s ease-in-out infinite',
                    transition: 'left 1300ms cubic-bezier(0.22,1,0.36,1)',
                  }}
                />
              )}
            </div>

            {/* Nodes */}
            <div className="relative flex">
              {LEVELS.map((lv, i) => {
                const num = i + 1;
                const passed = num < level;
                const current = num === level;
                const next = num === level + 1;
                const locked = num > level;
                const on = passed || current;
                return (
                  <div key={lv.label} ref={current ? currentRef : undefined} className="group flex shrink-0 flex-col items-center" style={{ width: COL }}>
                    {/* YOU marker */}
                    <div className="flex items-end justify-center" style={{ height: YOU_ROW }}>
                      {current && (
                        <div
                          className="relative mb-1"
                          style={{ opacity: go ? 1 : 0, transition: 'opacity 400ms ease 620ms', animation: go ? 'lvlBob 2.6s ease-in-out infinite 700ms' : undefined }}
                        >
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wide"
                            style={{ background: `linear-gradient(90deg, ${ACCENT_HI}, ${ACCENT})`, color: ON_ACCENT, boxShadow: '0 6px 18px rgba(204,255,0,0.5)' }}
                          >
                            <span className="size-1.5 rounded-full" style={{ background: ON_ACCENT }} /> YOU
                          </span>
                          {/* pointer */}
                          <span
                            className="absolute left-1/2 top-full -translate-x-1/2"
                            style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `6px solid ${ACCENT}` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Node */}
                    <div className="relative grid place-items-center" style={{ width: NODE, height: NODE }}>
                      {/* pulsing ping ring for current */}
                      {current && go && (
                        <span
                          className="absolute inset-0 rounded-full"
                          style={{ border: `2px solid ${ACCENT}`, animation: 'lvlPing 1.9s ease-out infinite' }}
                        />
                      )}
                      <div
                        className="grid size-full place-items-center rounded-full transition-transform duration-200 group-hover:scale-110"
                        style={{
                          background: on
                            ? `radial-gradient(circle at 32% 28%, ${ACCENT_HI}, ${ACCENT} 62%, #a6d600)`
                            : 'rgba(255,255,255,0.03)',
                          border: on
                            ? '1.5px solid rgba(255,255,255,0.35)'
                            : `1.5px solid ${next ? 'rgba(204,255,0,0.55)' : 'rgba(255,255,255,0.12)'}`,
                          boxShadow: current
                            ? '0 0 0 5px rgba(204,255,0,0.14), 0 0 26px rgba(204,255,0,0.6), inset 0 1px 0 rgba(255,255,255,0.55)'
                            : passed
                              ? '0 6px 16px rgba(204,255,0,0.28), inset 0 1px 0 rgba(255,255,255,0.5)'
                              : next ? '0 0 14px rgba(204,255,0,0.18)' : 'none',
                          transform: go ? (current ? 'scale(1.06)' : 'scale(1)') : 'scale(0.5)',
                          opacity: go ? 1 : 0,
                          transition: `transform 460ms cubic-bezier(0.34,1.56,0.64,1) ${i * 70}ms, opacity 360ms ease ${i * 70}ms`,
                        }}
                      >
                        {passed ? (
                          <Check size={18} style={{ color: ON_ACCENT }} strokeWidth={3.2} />
                        ) : current ? (
                          <Sparkles size={17} style={{ color: ON_ACCENT }} />
                        ) : (
                          <Lock size={14} style={{ color: next ? ACCENT : 'rgba(255,255,255,0.35)' }} />
                        )}
                      </div>
                    </div>

                    {/* Labels */}
                    <p
                      className="mt-2.5 px-1 text-center text-[10px] font-bold uppercase leading-tight tracking-wide"
                      style={{ color: on ? ACCENT : next ? 'rgba(204,255,0,0.75)' : locked ? 'var(--text-tertiary, #8a8a8a)' : 'var(--text-secondary)', textShadow: current ? '0 0 12px rgba(204,255,0,0.55)' : 'none' }}
                    >
                      {lv.label}
                    </p>
                    <p className="mt-0.5 text-center text-[10px] font-semibold tabular-nums text-text-tertiary">
                      {fmtXp(lv.xp)} XP{next ? ' · next' : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── How to level up ── */}
        {!isMax && (
          <div className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">How to rank up</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {WAYS.map((w, i) => (
                <div
                  key={w.title}
                  className="flex items-center gap-2.5 rounded-2xl p-2.5 transition-colors hover:border-[rgba(204,255,0,0.35)]"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-primary)',
                    opacity: go ? 1 : 0,
                    transform: go ? 'translateY(0)' : 'translateY(6px)',
                    transition: `opacity 400ms ease ${360 + i * 80}ms, transform 400ms ease ${360 + i * 80}ms`,
                  }}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: 'rgba(204,255,0,0.12)' }}>
                    <w.icon size={16} style={{ color: ACCENT }} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary">{w.title}</p>
                    <p className="text-[11px] text-text-tertiary">{w.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CTA ── */}
        <button
          type="button"
          onClick={() => { onClose(); router.push('/rewards'); }}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-extrabold transition-transform hover:brightness-105 active:scale-[0.98]"
          style={{ background: `linear-gradient(90deg, ${ACCENT_HI}, ${ACCENT})`, color: ON_ACCENT, boxShadow: '0 10px 28px rgba(204,255,0,0.32)' }}
        >
          {isMax ? 'View your rewards' : 'Go to Rewards & missions'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
