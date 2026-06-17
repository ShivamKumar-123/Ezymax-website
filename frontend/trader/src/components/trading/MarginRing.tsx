'use client';

// Compact circular progress ring for the trader's Margin Level. Plain
// SVG, no chart library. The percentage is what the broker normally
// shows — equity / margin_used × 100. Above 200% = healthy green,
// 100-200% = amber, < 100% = red (near stop-out).
//
// Visual fill scales to a "safety ceiling" of 500% — anything at or
// above that shows a fully-closed ring (so a healthy 1000% account
// reads as "full / safe" rather than "60% of some arbitrary 1000% cap").
// Color still encodes the absolute state (red/amber/green).

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

function MarginRingInner({ marginLevel, size = 64, className }: Props) {
  const stroke = Math.max(4, Math.round(size * 0.11));
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  // Fill saturates at 500% — anything ≥ 500% reads as a full ring (safe).
  // Below 500% the arc shrinks linearly, so the visual fill correlates
  // with the colour band: red < 100% (~20% arc), amber 100–200%
  // (20–40% arc), green ≥ 200% (40%+ arc, full at 500%).
  const fill = Math.max(0, Math.min(1, (marginLevel || 0) / 500));
  const dashOffset = circumference * (1 - fill);
  const color = colorFor(marginLevel);

  const labelPct = Number.isFinite(marginLevel) ? marginLevel : 0;
  // Compact format so the value always fits inside the ring:
  //   ≥ 10,000% → "22k%" (no decimal), 1,000–9,999% → "1.5k%", else "850%".
  const labelText =
    labelPct >= 10000
      ? `${Math.round(labelPct / 1000)}k%`
      : labelPct >= 1000
        ? `${(labelPct / 1000).toFixed(1)}k%`
        : `${labelPct.toFixed(0)}%`;

  // Inner usable width (ring diameter minus the stroke on both sides).
  // Scale the value font down for longer strings so it never collides
  // with the ring — monospace glyphs are ~0.6em wide.
  const innerWidth = size - stroke * 2;
  const valueFont = Math.max(
    9,
    Math.min(
      Math.round(size * 0.24),
      Math.floor((innerWidth * 0.88) / Math.max(3, labelText.length) / 0.6),
    ),
  );
  const labelFont = Math.max(6, Math.round(size * 0.125));

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
        <span
          className="uppercase tracking-wide text-text-tertiary leading-none font-semibold"
          style={{ fontSize: labelFont }}
        >
          Margin
        </span>
        <span
          className="font-extrabold font-mono tabular-nums leading-none mt-0.5"
          style={{ fontSize: valueFont, color }}
        >
          {labelText}
        </span>
      </div>
    </div>
  );
}

export default memo(MarginRingInner);
