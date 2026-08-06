'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X, CandlestickChart, CheckSquare, Flame, Users, ArrowRight, Sparkles, Trophy,
} from 'lucide-react';

/**
 * Animated level-progress popup. Opens from the dashboard "Lvl N" badge and
 * shows where you are, the next tier, how much XP is left, and concrete ways
 * to earn it — with a ring + bar that animate in, and a counting-up number.
 *
 * Mirrors the backend ladder (rewards_service.LEVEL_LABELS). xpIntoLevel /
 * xpForNextLevel come straight from /rewards/state.
 */
const LEVEL_LABELS = [
  'Novice', 'Apprentice', 'Skilled Trader', 'Veteran', 'Expert',
  'Master', 'Champion', 'Legend', 'Sovereign', 'Mythic',
];
const MAX_LEVEL = LEVEL_LABELS.length; // 10 = Mythic

const GOLD = '#d6a93d';

const WAYS = [
  { icon: CandlestickChart, title: 'Place trades', desc: 'Every trade you open earns XP.' },
  { icon: CheckSquare, title: 'Complete missions', desc: 'Daily & weekly missions give big XP.' },
  { icon: Flame, title: 'Keep your streak', desc: 'Check in daily to stack streak bonuses.' },
  { icon: Users, title: 'Invite friends', desc: 'Earn XP when referrals start trading.' },
];

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
  const pct = isMax ? 100 : Math.min(100, Math.max(0, Math.round((xpIntoLevel / xpForNextLevel) * 100)));
  const remaining = isMax ? 0 : Math.max(0, xpForNextLevel - xpIntoLevel);
  const nextLabel = isMax ? levelLabel : (LEVEL_LABELS[level] ?? 'Mythic');

  // Kick the animations one tick after mount so CSS transitions run.
  const [go, setGo] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGo(true));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const remainingCount = useCountUp(remaining, go);
  const pctCount = useCountUp(pct, go);

  // SVG ring geometry.
  const R = 52;
  const C = 2 * Math.PI * R;
  const dash = go ? C * (1 - pct / 100) : C; // full offset = empty, animates to target

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
        className="relative w-full max-w-md overflow-hidden rounded-2xl p-6 shadow-2xl"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          transform: go ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.98)',
          opacity: go ? 1 : 0,
          transition: 'transform 320ms cubic-bezier(0.22,1,0.36,1), opacity 320ms ease',
        }}
      >
        {/* Soft gold glow backdrop */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: 'rgba(214,169,61,0.18)' }}
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <X size={16} />
        </button>

        {/* ── Ring + level ── */}
        <div className="relative flex flex-col items-center">
          <div className="relative grid place-items-center">
            <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
              <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(214,169,61,0.14)" strokeWidth="8" />
              <circle
                cx="64" cy="64" r={R} fill="none" stroke={GOLD} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={dash}
                style={{ transition: 'stroke-dashoffset 1100ms cubic-bezier(0.22,1,0.36,1)' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Level</span>
              <span className="text-3xl font-extrabold leading-none" style={{ color: GOLD }}>{level}</span>
              <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-text-secondary">
                <Trophy size={11} style={{ color: GOLD }} /> {levelLabel}
              </span>
            </div>
          </div>
        </div>

        {/* ── Progress line: current → next ── */}
        {isMax ? (
          <div className="mt-5 text-center">
            <p className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: GOLD }}>
              <Sparkles size={15} /> Max level reached — you&apos;re {levelLabel}!
            </p>
            <p className="mt-1 text-xs text-text-tertiary">You&apos;ve climbed the entire ladder. 🏆</p>
          </div>
        ) : (
          <>
            <div className="mt-5 flex items-center justify-between text-xs">
              <span className="font-semibold text-text-primary">Lvl {level} · {levelLabel}</span>
              <span className="font-semibold text-text-tertiary">Lvl {level + 1} · {nextLabel}</span>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(214,169,61,0.12)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: go ? `${pct}%` : '0%',
                  background: `linear-gradient(90deg, ${GOLD}, #f0c869)`,
                  transition: 'width 1100ms cubic-bezier(0.22,1,0.36,1)',
                }}
              />
            </div>
            <p className="mt-3 text-center text-sm text-text-secondary">
              <span className="font-bold tabular-nums" style={{ color: GOLD }}>{remainingCount.toLocaleString()}</span>
              {' '}XP to reach{' '}
              <span className="font-semibold text-text-primary">Level {level + 1} · {nextLabel}</span>
              <span className="ml-1 text-text-tertiary tabular-nums">({pctCount}% there)</span>
            </p>
          </>
        )}

        {/* ── How to level up ── */}
        {!isMax && (
          <div className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              How to level up
            </p>
            <div className="grid grid-cols-1 gap-2">
              {WAYS.map((w, i) => (
                <div
                  key={w.title}
                  className="flex items-center gap-3 rounded-xl p-2.5"
                  style={{
                    background: 'var(--bg-hover, rgba(255,255,255,0.03))',
                    border: '1px solid var(--border-primary)',
                    opacity: go ? 1 : 0,
                    transform: go ? 'translateY(0)' : 'translateY(6px)',
                    transition: `opacity 400ms ease ${180 + i * 90}ms, transform 400ms ease ${180 + i * 90}ms`,
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
