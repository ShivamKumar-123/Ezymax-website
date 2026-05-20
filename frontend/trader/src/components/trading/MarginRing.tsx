'use client';

// Compact circular progress ring for the trader's Margin Level. Plain
// SVG, no chart library. The percentage is what the broker normally
// shows — equity / margin_used × 100. Above 200% = healthy green,
// 100-200% = amber, < 100% = red (near stop-out).
//
// The percentage is clamped to [0, 999] for display so a near-zero
// margin_used doesn't blow the ring to infinity.

import { memo } from 'react';
import { clsx } from 'clsx';

interface Props {
  /** Live margin level percentage (e.g. 1076.21 for 1076.21%). */
  marginLevel: number;
  /** Pixel size of the square SVG; default tuned for the positions header strip. */
  size?: number;
  className?: string;
}

function colorFor(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return '#6b7280';
  if (pct < 100) return '#ef4444';        // sub-100% → near stop-out
  if (pct < 200) return '#f59e0b';        // 100-200% → squeeze warning
  return '#22c55e';                       // > 200% → healthy
}

function MarginRingInner({ marginLevel, size = 56, className }: Props) {
  const stroke = Math.max(4, Math.round(size * 0.12));
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  // Map [0, 1000%] → [0, 1] for the visual fill. Above 1000% always full.
  const fill = Math.max(0, Math.min(1, (marginLevel || 0) / 1000));
  const dashOffset = circumference * (1 - fill);
  const color = colorFor(marginLevel);

  const labelPct = Number.isFinite(marginLevel) ? marginLevel : 0;
  const labelText = labelPct >= 1000
    ? `${(labelPct / 1000).toFixed(1)}k%`
    : `${labelPct.toFixed(0)}%`;

  return (
    <div
      className={clsx('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      title={`Margin Level: ${labelPct.toFixed(2)}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 600ms ease, stroke 300ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[8px] uppercase tracking-wider text-text-tertiary leading-none">
          Margin
        </span>
        <span
          className="text-[10px] font-bold font-mono tabular-nums leading-tight mt-0.5"
          style={{ color }}
        >
          {labelText}
        </span>
      </div>
    </div>
  );
}

export default memo(MarginRingInner);
