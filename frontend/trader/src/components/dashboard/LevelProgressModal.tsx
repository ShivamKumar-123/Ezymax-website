'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X, Lock, Check, CandlestickChart, CheckSquare, Flame, Users, ArrowRight, Sparkles,
} from 'lucide-react';

/**
 * Rank-ladder level popup. A horizontal track of every tier (Novice → Mythic):
 * cleared tiers are gold, the current one glows with a "YOU" marker, upcoming
 * ones are locked. A gold rail fills to your exact progress, the track
 * auto-scrolls to centre you, and the "XP to next" counts up.
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

const GOLD = '#d6a93d';

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

  // Rail fill: full segments up to the current node + partial into the next.
  const railPct = isMax ? 100 : ((level - 1 + intoPct) / (MAX_LEVEL - 1)) * 100;

  const [go, setGo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setGo(true));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    // Centre the current tier in the scroll track.
    const t = setTimeout(() => {
      const sc = scrollRef.current;
      const cur = currentRef.current;
      if (sc && cur) sc.scrollLeft = cur.offsetLeft - sc.clientWidth / 2 + cur.clientWidth / 2;
    }, 60);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const remainingCount = useCountUp(remaining, go);
  const COL = 92; // px per tier column

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Level progress"
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl p-6 shadow-2xl"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          transform: go ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.98)',
          opacity: go ? 1 : 0,
          transition: 'transform 320ms cubic-bezier(0.22,1,0.36,1), opacity 320ms ease',
        }}
      >
        <div aria-hidden className="pointer-events-none absolute -top-16 left-1/4 h-40 w-40 rounded-full blur-3xl" style={{ background: 'rgba(214,169,61,0.16)' }} />

        <button
          type="button" onClick={onClose} aria-label="Close"
          className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <X size={16} />
        </button>

        {/* ── Heading ── */}
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Your rank</p>
          <h2 className="mt-0.5 text-xl font-extrabold text-text-primary">
            Level {level} · <span style={{ color: GOLD }}>{levelLabel}</span>
          </h2>
          {isMax ? (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: GOLD }}>
              <Sparkles size={15} /> Max rank — you&apos;ve topped the ladder! 🏆
            </p>
          ) : (
            <p className="mt-1 text-sm text-text-secondary">
              <span className="font-bold tabular-nums" style={{ color: GOLD }}>{remainingCount.toLocaleString()}</span>
              {' '}XP to reach{' '}
              <span className="font-semibold text-text-primary">Level {level + 1} · {nextLabel}</span>
            </p>
          )}
        </div>

        {/* ── Horizontal rank track ── */}
        <div ref={scrollRef} className="mt-6 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
          <div className="relative" style={{ width: MAX_LEVEL * COL, paddingTop: 26 }}>
            {/* Rail (dim) + gold fill, centred on the node row */}
            <div className="absolute" style={{ left: COL / 2, right: COL / 2, top: 26 + 18 }}>
              <div className="h-[3px] w-full rounded-full" style={{ background: 'rgba(214,169,61,0.14)' }} />
              <div
                className="absolute left-0 top-0 h-[3px] rounded-full"
                style={{
                  width: go ? `${railPct}%` : '0%',
                  background: `linear-gradient(90deg, ${GOLD}, #f0c869)`,
                  boxShadow: '0 0 8px rgba(214,169,61,0.5)',
                  transition: 'width 1200ms cubic-bezier(0.22,1,0.36,1)',
                }}
              />
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
                  <div
                    key={lv.label}
                    ref={current ? currentRef : undefined}
                    className="flex shrink-0 flex-col items-center"
                    style={{ width: COL }}
                  >
                    {/* YOU marker above the current node */}
                    <div className="relative flex h-6 items-end">
                      {current && (
                        <span
                          className="mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                          style={{
                            background: GOLD, color: '#1a1408',
                            boxShadow: '0 4px 14px rgba(214,169,61,0.45)',
                            opacity: go ? 1 : 0,
                            transform: go ? 'translateY(0)' : 'translateY(6px)',
                            transition: 'opacity 400ms ease 500ms, transform 400ms ease 500ms',
                          }}
                        >
                          <span className="size-1.5 rounded-full bg-[#1a1408]" /> YOU
                        </span>
                      )}
                    </div>

                    {/* Node circle */}
                    <div
                      className="grid size-9 place-items-center rounded-full"
                      style={{
                        background: on ? GOLD : 'var(--bg-card)',
                        border: `2px solid ${on ? GOLD : next ? 'rgba(214,169,61,0.55)' : 'var(--border-primary)'}`,
                        boxShadow: current ? '0 0 0 4px rgba(214,169,61,0.22), 0 0 18px rgba(214,169,61,0.55)' : 'none',
                        transform: go ? 'scale(1)' : 'scale(0.6)',
                        opacity: go ? 1 : 0,
                        transition: `transform 420ms cubic-bezier(0.22,1,0.36,1) ${i * 70}ms, opacity 360ms ease ${i * 70}ms`,
                      }}
                    >
                      {passed ? (
                        <Check size={16} style={{ color: '#1a1408' }} strokeWidth={3} />
                      ) : current ? (
                        <Sparkles size={15} style={{ color: '#1a1408' }} />
                      ) : (
                        <Lock size={13} style={{ color: next ? GOLD : 'var(--text-tertiary, #8a8a8a)' }} />
                      )}
                    </div>

                    {/* Labels */}
                    <p
                      className="mt-2 px-1 text-center text-[10px] font-bold uppercase leading-tight tracking-wide"
                      style={{ color: on ? GOLD : locked ? 'var(--text-tertiary, #8a8a8a)' : 'var(--text-secondary)' }}
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
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">How to rank up</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {WAYS.map((w, i) => (
                <div
                  key={w.title}
                  className="flex items-center gap-2.5 rounded-xl p-2.5"
                  style={{
                    background: 'var(--bg-hover, rgba(255,255,255,0.03))',
                    border: '1px solid var(--border-primary)',
                    opacity: go ? 1 : 0,
                    transform: go ? 'translateY(0)' : 'translateY(6px)',
                    transition: `opacity 400ms ease ${300 + i * 80}ms, transform 400ms ease ${300 + i * 80}ms`,
                  }}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: 'rgba(214,169,61,0.12)' }}>
                    <w.icon size={15} style={{ color: GOLD }} />
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
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-transform active:scale-[0.98]"
          style={{ background: GOLD, color: '#1a1408' }}
        >
          {isMax ? 'View your rewards' : 'Go to Rewards & missions'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
