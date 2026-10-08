'use client';

import { ShieldAlert } from 'lucide-react';

/**
 * Margin level as a ring, in the shape of the reference layout's circular
 * time tracker.
 *
 * The number in the middle is the one that decides whether positions get
 * closed for you, so the ring is marked at the two published thresholds
 * rather than running a plain 0–100%: amber at the 80% margin call, red at
 * the 50% stop-out. A healthy account sits far above both, so the arc is
 * scaled against 200% and clamped — past that the exact figure stops
 * carrying information.
 */

const MARGIN_CALL = 80;
const STOP_OUT = 50;
/** Where the arc tops out. Above this, more margin tells you nothing new. */
const FULL_SCALE = 200;

export function MarginRingCard({
  marginLevel,
  marginUsed,
  freeMargin,
  fmt,
}: {
  /** Equity / used margin, as a percentage. `null` when nothing is open. */
  marginLevel: number | null;
  marginUsed: number;
  freeMargin: number;
  fmt: (n: number) => string;
}) {
  // No open positions means no ratio exists, so the arc is empty rather
  // than full — a complete ring would read as a healthy maximum.
  const pct = marginLevel === null ? 0 : Math.min(marginLevel / FULL_SCALE, 1);
  const tone =
    marginLevel === null
      ? 'var(--border-secondary)'
      : marginLevel <= STOP_OUT
        ? '#ef4444'
        : marginLevel <= MARGIN_CALL
          ? '#f59e0b'
          : '#22c55e';

  const R = 48;
  const C = 2 * Math.PI * R;

  return (
    <div
      className="flex h-full flex-col lg-surface p-5"
    >
      <div className="mb-1 flex items-start justify-between">
        <p className="text-sm font-semibold text-text-primary">Margin level</p>
        <ShieldAlert size={16} className="text-text-tertiary" />
      </div>

      <div className="flex flex-1 items-center justify-center py-3">
        <div className="relative">
          <svg width="124" height="124" viewBox="0 0 140 140">
            <circle
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke="var(--bg-active)"
              strokeWidth="11"
            />
            <circle
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={tone}
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct)}
              transform="rotate(-90 70 70)"
              style={{ transition: 'stroke-dashoffset .6s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums text-text-primary">
              {marginLevel === null ? '—' : `${Math.round(marginLevel)}%`}
            </span>
            <span className="mt-0.5 max-w-[96px] text-center text-[10px] leading-tight text-text-tertiary">
              {marginLevel === null ? 'no positions open' : 'of used margin'}
            </span>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="lg-surface-raised px-3 py-2">
          <dt className="text-text-tertiary">Used</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-text-primary">
            {fmt(marginUsed)}
          </dd>
        </div>
        <div className="lg-surface-raised px-3 py-2">
          <dt className="text-text-tertiary">Free</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-text-primary">
            {fmt(freeMargin)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-[10px] leading-relaxed text-text-tertiary">
        Margin call at {MARGIN_CALL}%, stop-out at {STOP_OUT}%.
      </p>
    </div>
  );
}
