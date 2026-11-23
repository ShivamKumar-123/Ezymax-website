'use client';

/**
 * Margin-usage donut — visualizes the EXISTING account fields
 * (margin_used vs equity) in the reference's ring-chart style. Same
 * hand-rolled SVG approach as ScoreDonut in profile/TradingOverview.
 */
export function MarginDonut({
  marginUsed,
  equity,
}: {
  marginUsed: number;
  equity: number;
}) {
  const pct = equity > 0 ? Math.min(100, Math.max(0, (marginUsed / equity) * 100)) : 0;
  const size = 116;
  const r = 46;
  const c = 2 * Math.PI * r;
  const dash = c * (pct / 100);
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="var(--bg-active)" strokeWidth={11}
          />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="#E12019" strokeWidth={11} strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-extrabold tabular-nums text-text-primary">
            {pct.toFixed(0)}%
          </span>
          <span className="text-[9px] uppercase tracking-[0.12em] font-semibold text-text-tertiary">
            Margin used
          </span>
        </div>
      </div>
    </div>
  );
}
