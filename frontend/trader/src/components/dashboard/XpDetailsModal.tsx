'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X, Zap, TrendingUp, CheckSquare, Flame, Wallet, ArrowRight, Trophy,
} from 'lucide-react';

/**
 * "What is XP?" popup, opened from the dashboard XP chip. Mirrors
 * FxaDetailsModal. XP (experience points) is the total experience that drives
 * your level — earned from trading, missions, deposits and daily streaks.
 * Landing "Obsidian & Lime" theme.
 */
const ACCENT = '#ccff00';
const ACCENT_HI = '#eaff8a';
const ON_ACCENT = '#0a0a0a';

const EARN = [
  { icon: TrendingUp, title: 'Place trades', desc: 'Every trade you open earns XP.' },
  { icon: CheckSquare, title: 'Complete missions', desc: 'Daily & weekly missions grant XP.' },
  { icon: Wallet, title: 'Fund & stay active', desc: 'Deposits and activity keep XP flowing.' },
  { icon: Flame, title: 'Daily streaks', desc: 'Check in every day for bonus XP.' },
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
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, run, ms]);
  return n;
}

export default function XpDetailsModal({
  total,
  level,
  levelLabel,
  xpIntoLevel,
  xpForNextLevel,
  onViewLadder,
  onClose,
}: {
  total: number;
  level: number;
  levelLabel: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  onViewLadder?: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
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

  const shown = useCountUp(total, go);
  const pct = xpForNextLevel > 0 ? Math.min(100, (xpIntoLevel / xpForNextLevel) * 100) : 0;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Experience points"
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-3xl p-6 shadow-2xl"
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

        {/* ── XP hero ── */}
        <div className="flex flex-col items-center pt-1 text-center">
          <div
            className="grid size-16 place-items-center rounded-full"
            style={{
              background: `radial-gradient(circle at 32% 28%, ${ACCENT_HI}, ${ACCENT} 62%, #a6d600)`,
              border: '1.5px solid rgba(255,255,255,0.35)',
              boxShadow: '0 0 0 5px rgba(204,255,0,0.12), 0 0 26px rgba(204,255,0,0.5), inset 0 1px 0 rgba(255,255,255,0.55)',
              transform: go ? 'scale(1)' : 'scale(0.6)',
              transition: 'transform 460ms cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <Zap size={26} style={{ color: ON_ACCENT }} />
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-extrabold tabular-nums truncate" style={{ color: ACCENT }}>
            {Math.round(shown).toLocaleString()}
            <span className="ml-1 text-lg font-bold text-text-secondary">XP</span>
          </p>
          <p className="mt-1 text-xs text-text-tertiary">
            Experience Points — earn XP to level up
          </p>
        </div>

        {/* ── Level progress ── */}
        <div
          className="mt-5 rounded-2xl p-3.5"
          style={{ background: 'rgba(204,255,0,0.06)', border: '1px solid rgba(204,255,0,0.22)' }}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text-primary">Lvl {level} · {levelLabel}</span>
            <span className="tabular-nums text-text-tertiary">{xpIntoLevel.toLocaleString()} / {xpForNextLevel.toLocaleString()} XP</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: go ? `${pct}%` : '0%',
                background: `linear-gradient(90deg, ${ACCENT_HI}, ${ACCENT} 55%, #a6d600)`,
                boxShadow: '0 0 12px rgba(204,255,0,0.55)',
                transition: 'width 700ms cubic-bezier(0.22,1,0.36,1) 150ms',
              }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-text-tertiary">
            {Math.max(0, xpForNextLevel - xpIntoLevel).toLocaleString()} XP to the next level
          </p>
        </div>

        {/* ── How you earn XP ── */}
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
            How you earn XP
          </p>
          <div className="grid grid-cols-1 gap-2">
            {EARN.map((w, i) => (
              <div
                key={w.title}
                className="flex items-center gap-3 rounded-2xl p-2.5"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-primary)',
                  opacity: go ? 1 : 0,
                  transform: go ? 'translateY(0)' : 'translateY(6px)',
                  transition: `opacity 400ms ease ${180 + i * 80}ms, transform 400ms ease ${180 + i * 80}ms`,
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

        {/* ── CTAs ── */}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => { onClose(); onViewLadder?.(); }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold transition-transform hover:brightness-105 active:scale-[0.98]"
            style={{ background: `linear-gradient(90deg, ${ACCENT_HI}, ${ACCENT})`, color: ON_ACCENT, boxShadow: '0 10px 28px rgba(204,255,0,0.30)' }}
          >
            <Trophy size={16} /> View Level Ladder
          </button>
          <button
            type="button"
            onClick={() => { onClose(); router.push('/earn/tasks'); }}
            className="rounded-2xl px-4 py-3 text-sm font-bold text-text-primary transition-colors hover:bg-bg-hover"
            style={{ border: '1px solid var(--border-primary)' }}
          >
            Missions <ArrowRight size={14} className="inline" />
          </button>
        </div>
      </div>
    </div>
  );
}
