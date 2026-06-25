'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';

type Prize = {
  id: string;
  slug: string;
  label: string;
  weight: number;
  probability: number;
  payout_kind: 'xp' | 'ac' | 'cashback' | 'nothing';
  payout_amount: number;
  display_order: number;
};

type SpinResult = {
  prize_id: string;
  label: string;
  payout_kind: Prize['payout_kind'];
  payout_amount: number;
  ac_cost: number;
  new_xp: number;
  new_ac_balance: number;
};

// Alternating bright gold / deep walnut so each wedge reads as a distinct
// slice. Earlier we used 7 near-identical gold tones and the wheel looked
// like a flat disc.
const SLICE_COLOURS = ['#d6a93d', '#3a2a10'];

export default function SpinWheel({
  onResult,
  acBalance,
  onAcChange,
}: {
  onResult?: (r: SpinResult) => void;
  acBalance: number;
  onAcChange?: (balance: number) => void;
}) {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [costAc, setCostAc] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [lastWin, setLastWin] = useState<SpinResult | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get<{ cost_ac: number; prizes: Prize[] }>('/play/spin/prizes');
        if (cancelled) return;
        setPrizes(r.prizes);
        setCostAc(r.cost_ac);
      } catch (err: any) {
        toast.error(err?.message || 'Could not load wheel');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sliceCount = prizes.length || 8;
  const sliceAngle = 360 / sliceCount;

  const conicGradient = useMemo(() => {
    if (prizes.length === 0) return 'transparent';
    const stops: string[] = [];
    prizes.forEach((_, i) => {
      const c = SLICE_COLOURS[i % SLICE_COLOURS.length];
      const start = (i * sliceAngle).toFixed(2);
      const end = ((i + 1) * sliceAngle).toFixed(2);
      stops.push(`${c} ${start}deg ${end}deg`);
    });
    return `conic-gradient(${stops.join(', ')})`;
  }, [prizes, sliceAngle]);

  const handleSpin = async () => {
    if (spinning) return;
    if (acBalance < costAc) {
      toast.error(`Not enough FXArtha Coins. Need ${costAc} FXA.`);
      return;
    }
    setSpinning(true);
    try {
      const res = await api.post<SpinResult>('/play/spin', {});
      // Find the prize index, compute the target angle so the pointer at the
      // top of the wheel lands on its slice center, then add several full
      // rotations for visual flair.
      const prizeIdx = prizes.findIndex((p) => p.id === res.prize_id);
      const target = prizeIdx >= 0
        // Pointer is at 12 o'clock; conic-gradient starts at 12 o'clock and
        // grows clockwise. To land on slice `i`, we rotate the wheel CCW by
        // (i + 0.5) * sliceAngle. Add 6 spins for flair.
        ? -((prizeIdx + 0.5) * sliceAngle) - 360 * 6
        : -360 * 6;
      // Animation runs via CSS transition on the rotation transform.
      setAngle((prev) => {
        // Normalise so subsequent spins always go further in the same direction.
        const base = prev - (prev % 360);
        return base + target;
      });
      // After ~3.5s (matches the CSS transition), commit results + toast.
      window.setTimeout(() => {
        setLastWin(res);
        if (res.payout_kind === 'nothing') {
          toast(`No win this time — try again!`, { icon: '🎰' });
        } else if (res.payout_kind === 'xp') {
          toast.success(`+${res.payout_amount} XP`);
        } else {
          toast.success(`+${res.payout_amount} FXA`);
        }
        onResult?.(res);
        onAcChange?.(res.new_ac_balance);
        setSpinning(false);
      }, 3500);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'insufficient_ac') toast.error('Not enough FXArtha Coins');
      else if (detail === 'spin_unavailable') toast.error('Spin is temporarily unavailable');
      else toast.error(detail || err?.message || 'Spin failed');
      setSpinning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-text-secondary text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading wheel…
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative w-[300px] h-[300px] sm:w-[360px] sm:h-[360px]">
        {/* Pointer at 12 o'clock */}
        <div
          aria-hidden
          className="absolute top-[-14px] left-1/2 -translate-x-1/2 w-0 h-0 z-10"
          style={{
            borderLeft: '14px solid transparent',
            borderRight: '14px solid transparent',
            borderTop: '22px solid #d6a93d',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
          }}
        />
        {/* Wheel */}
        <div
          ref={wheelRef}
          className="absolute inset-0 rounded-full border-4 border-[#d6a93d]/45 overflow-hidden"
          style={{
            background: conicGradient,
            transform: `rotate(${angle}deg)`,
            transition: spinning ? 'transform 3.4s cubic-bezier(0.17, 0.67, 0.30, 0.99)' : 'none',
            boxShadow: '0 0 32px rgba(214,169,61,0.18), inset 0 0 32px rgba(0,0,0,0.4)',
          }}
        >
          {prizes.map((p, i) => {
            // Each label sits on a radius-tall vertical strip pinned to the
            // wheel centre (origin-bottom) and rotated to the slice's mid-
            // angle, so the text lands near the rim of its slice. Using a
            // half-height strip (= the radius) makes this scale with the
            // wheel size — the old `translateY(-38%)` was a % of the tiny
            // label element, so labels collapsed onto the centre hub and
            // were invisible (the "empty wheel"). The span counter-rotates
            // so the text always reads horizontally.
            const rot = i * sliceAngle + sliceAngle / 2;
            const isLight = (i % 2) === 0;
            return (
              <div
                key={p.id}
                aria-hidden
                className="absolute left-1/2 top-0 h-1/2 origin-bottom pointer-events-none"
                style={{ transform: `translateX(-50%) rotate(${rot}deg)` }}
              >
                <span
                  className={
                    'inline-block mt-3 text-[10px] sm:text-[11px] font-extrabold whitespace-nowrap drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)] ' +
                    (isLight ? 'text-bg-base' : 'text-[#f5e6b8]')
                  }
                  style={{ transform: `rotate(${-rot}deg)` }}
                >
                  {p.label}
                </span>
              </div>
            );
          })}
        </div>
        {/* Center hub */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-16 h-16 rounded-full bg-bg-base border-2 border-[#d6a93d] flex items-center justify-center"
            style={{ boxShadow: '0 0 18px rgba(214,169,61,0.5)' }}
          >
            <Sparkles size={22} className="text-[#d6a93d]" />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSpin}
        disabled={spinning || acBalance < costAc}
        className="inline-flex items-center gap-2 px-7 py-3 rounded-lg text-sm font-bold bg-[#d6a93d] text-bg-base hover:brightness-110 disabled:opacity-60 transition-all"
      >
        {spinning ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Spinning…
          </>
        ) : (
          <>
            <Coins size={16} /> Spin for {costAc} FXA
          </>
        )}
      </button>

      {lastWin && !spinning && (
        <div className="text-center text-xs text-text-tertiary">
          Last spin: <span className="text-text-primary font-semibold">{lastWin.label}</span>
        </div>
      )}
    </div>
  );
}
