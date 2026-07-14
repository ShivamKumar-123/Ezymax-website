'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
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

// Temu-style warm palette. The single "jackpot" slice (largest payout) gets
// the saturated orange with white text; the rest cycle cream/gold/white so
// adjacent slices always contrast.
const JACKPOT_FILL = '#ff7d1a';
const SLICE_FILLS = ['#ffe9c4', '#ffc95e', '#fff7ea'];
const SLICE_TEXT = '#7c3a00';

const SIZE = 300; // SVG viewBox size; wheel scales responsively via CSS
const C = SIZE / 2; // center
const R = SIZE / 2; // wedge radius (fills the rotating layer)
const RIM_DOTS = 16;

function polar(angleDeg: number, radius: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180; // 0deg = 12 o'clock
  return [C + radius * Math.cos(rad), C + radius * Math.sin(rad)];
}

function wedgePath(startDeg: number, endDeg: number): string {
  const [x0, y0] = polar(startDeg, R);
  const [x1, y1] = polar(endDeg, R);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 ${largeArc} 1 ${x1} ${y1} Z`;
}

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

  // The most valuable prize is the highlighted "jackpot" slice.
  const jackpotIdx = useMemo(() => {
    let best = -1;
    let bestAmt = -1;
    prizes.forEach((p, i) => {
      if (p.payout_kind !== 'nothing' && p.payout_amount > bestAmt) {
        bestAmt = p.payout_amount;
        best = i;
      }
    });
    return best;
  }, [prizes]);

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
        // Pointer is at 12 o'clock; slice 0 starts at 12 o'clock and grows
        // clockwise. To land on slice `i`, rotate the wheel CCW by
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
      <div className="relative w-[300px] h-[300px] sm:w-[380px] sm:h-[380px]">
        {/* Static outer ring with blinking rim bulbs */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(180deg, #fff8ee 0%, #ffe9cd 100%)',
            boxShadow:
              '0 10px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,150,40,0.35), inset 0 -4px 10px rgba(210,120,20,0.25)',
          }}
        >
          {Array.from({ length: RIM_DOTS }).map((_, i) => {
            const a = (i * 2 * Math.PI) / RIM_DOTS;
            // Bulbs sit on the ring band, ~48% of the radius from centre.
            const x = 50 + 48 * Math.sin(a);
            const y = 50 - 48 * Math.cos(a);
            return (
              <span
                key={i}
                className="absolute w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  background: i % 2 === 0 ? '#ff7d1a' : '#ffd25e',
                  boxShadow: '0 0 6px rgba(255,140,30,0.9)',
                  animation: `fx-rim-blink 1.2s ease-in-out ${i % 2 === 0 ? '0s' : '0.6s'} infinite`,
                }}
              />
            );
          })}
        </div>

        {/* Rotating wheel face */}
        <div
          ref={wheelRef}
          className="absolute inset-[13px] rounded-full overflow-hidden"
          style={{
            transform: `rotate(${angle}deg)`,
            transition: spinning ? 'transform 3.4s cubic-bezier(0.17, 0.67, 0.30, 0.99)' : 'none',
            boxShadow: 'inset 0 0 24px rgba(160,80,0,0.18)',
          }}
        >
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full block">
            {prizes.map((p, i) => {
              const isJackpot = i === jackpotIdx;
              const fill = isJackpot ? JACKPOT_FILL : SLICE_FILLS[i % SLICE_FILLS.length];
              return (
                <path
                  key={p.id}
                  d={wedgePath(i * sliceAngle, (i + 1) * sliceAngle)}
                  fill={fill}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              );
            })}
            {prizes.map((p, i) => {
              const isJackpot = i === jackpotIdx;
              const mid = (i + 0.5) * sliceAngle;
              // Radial label: rotate the group to the slice's mid-angle, then
              // rotate the text -90° about its anchor so it reads from the
              // centre outward along the radius (Temu-style).
              const labelR = R * 0.62;
              const [lx, ly] = polar(0, labelR); // point on the vertical radius
              return (
                <g key={p.id} transform={`rotate(${mid} ${C} ${C})`} aria-hidden>
                  <text
                    x={lx}
                    y={ly}
                    transform={`rotate(-90 ${lx} ${ly})`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={sliceCount > 8 ? 11 : 13}
                    fontWeight={800}
                    fill={isJackpot ? '#ffffff' : SLICE_TEXT}
                    style={{ letterSpacing: '0.02em' }}
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Center hub */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-[76px] h-[76px] rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(180deg, #ffffff 0%, #fff1dc 100%)',
              border: '3px solid #ff9c3f',
              boxShadow: '0 4px 14px rgba(180,90,0,0.35), 0 0 0 5px rgba(255,255,255,0.85)',
            }}
          >
            <Sparkles size={26} style={{ color: '#ff7d1a' }} />
          </div>
        </div>

        {/* Pin pointer at 12 o'clock */}
        <svg
          aria-hidden
          width="36"
          height="48"
          viewBox="0 0 36 48"
          className="absolute -top-4 left-1/2 -translate-x-1/2 z-10"
          style={{ filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.45))' }}
        >
          <path
            d="M18 47 C 10 33 1 26.5 1 16.5 A 17 16 0 1 1 35 16.5 C 35 26.5 26 33 18 47 Z"
            fill="#3a3a3a"
            stroke="#ffffff"
            strokeWidth="2"
          />
          <circle cx="18" cy="16.5" r="6" fill="#ffffff" />
        </svg>
      </div>

      {/* Rounded orange pill CTA */}
      <button
        type="button"
        onClick={handleSpin}
        disabled={spinning || acBalance < costAc}
        className="inline-flex items-center justify-center gap-2 w-full max-w-[320px] px-8 py-3.5 rounded-full text-base font-extrabold text-white disabled:opacity-60 transition-all active:scale-[0.98]"
        style={{
          background: 'linear-gradient(180deg, #ff9a3d 0%, #ff7d1a 55%, #f56a00 100%)',
          boxShadow: '0 6px 18px rgba(255,125,26,0.45), inset 0 1px 0 rgba(255,255,255,0.35)',
        }}
      >
        {spinning ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Spinning…
          </>
        ) : (
          <>Spin for {costAc} FXA</>
        )}
      </button>

      {lastWin && !spinning && (
        <div className="text-center text-xs text-text-tertiary">
          Last spin: <span className="text-text-primary font-semibold">{lastWin.label}</span>
        </div>
      )}

      <style jsx global>{`
        @keyframes fx-rim-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
      `}</style>
    </div>
  );
}
