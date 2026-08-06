'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X, Coins, Flame, CheckSquare, Gift, TrendingUp, ShoppingBag, ArrowRight,
} from 'lucide-react';

/**
 * "Where do my FXA come from?" popup, opened from the dashboard FXA chip.
 * FXA (FXArtha Coins) = rewards `ac_balance`. It's earned from streak check-ins,
 * missions and reward events, and spent in the Rewards Store — so this explains
 * the sources and links to earn / spend. Landing "Obsidian & Lime" theme.
 */
const ACCENT = '#ccff00';
const ACCENT_HI = '#eaff8a';
const ON_ACCENT = '#0a0a0a';

const EARN = [
  { icon: Flame, title: 'Daily check-ins', desc: 'Keep your streak alive to earn FXA every day.' },
  { icon: CheckSquare, title: 'Complete missions', desc: 'Daily & weekly missions pay out FXA.' },
  { icon: Gift, title: 'Rewards & bonuses', desc: 'Promotions, milestones and level-ups drop FXA.' },
  { icon: TrendingUp, title: 'Trading activity', desc: 'Stay active on the platform to keep earning.' },
];

/** Ease-out count-up (supports decimals) from 0 → value over ~900ms. */
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

export default function FxaDetailsModal({
  balance,
  onClose,
}: {
  balance: number;
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

  const shown = useCountUp(balance, go);

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="FXA coins"
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

        {/* ── Coin hero ── */}
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
            <Coins size={26} style={{ color: ON_ACCENT }} />
          </div>
          <p className="mt-3 text-3xl font-extrabold tabular-nums" style={{ color: ACCENT }}>
            {shown.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="ml-1 text-lg font-bold text-text-secondary">FXA</span>
          </p>
          <p className="mt-1 text-xs text-text-tertiary">
            FXArtha Coins — your on-platform reward currency
          </p>
        </div>

        {/* ── How you earn FXA ── */}
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
            Where your FXA come from
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

        {/* ── Spend note ── */}
        <div
          className="mt-3 flex items-center gap-3 rounded-2xl p-3"
          style={{ background: 'rgba(204,255,0,0.06)', border: '1px solid rgba(204,255,0,0.22)' }}
        >
          <ShoppingBag size={16} style={{ color: ACCENT }} className="shrink-0" />
          <p className="text-[11px] text-text-secondary">
            Spend FXA on perks, discounts and prizes in the <span className="font-semibold text-text-primary">Rewards Store</span>.
          </p>
        </div>

        {/* ── CTAs ── */}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => { onClose(); router.push('/earn/store'); }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold transition-transform hover:brightness-105 active:scale-[0.98]"
            style={{ background: `linear-gradient(90deg, ${ACCENT_HI}, ${ACCENT})`, color: ON_ACCENT, boxShadow: '0 10px 28px rgba(204,255,0,0.30)' }}
          >
            Rewards Store <ArrowRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => { onClose(); router.push('/earn/tasks'); }}
            className="rounded-2xl px-4 py-3 text-sm font-bold text-text-primary transition-colors hover:bg-bg-hover"
            style={{ border: '1px solid var(--border-primary)' }}
          >
            Missions
          </button>
        </div>
      </div>
    </div>
  );
}
