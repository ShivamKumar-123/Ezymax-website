'use client';

import Image from 'next/image';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { PanelCard } from './PanelCard';

export interface PnlBreakdown {
  today: number;
  this_week: number;
  this_month: number;
  all_time: number;
}

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
    .format(Number.isFinite(n) ? n : 0);

/**
 * P&L tiles — the EXISTING /portfolio/summary pnl_breakdown, shown as
 * the reference's stacked stat tiles ("Total income / Total paid").
 */
export function PnlTiles({ pnl }: { pnl: PnlBreakdown | null }) {
  const rows: Array<{ label: string; value: number | null }> = [
    { label: 'P&L today', value: pnl ? pnl.today : null },
    { label: 'P&L this week', value: pnl ? pnl.this_week : null },
    { label: 'P&L this month', value: pnl ? pnl.this_month : null },
    { label: 'P&L all time', value: pnl ? pnl.all_time : null },
  ];
  return (
    /* One outer panel holding all four, rather than four sibling cards.
       h-full + flex keeps the panel level with MainWalletCard and
       PerformanceCard either side of it in the dashboard grid. */
    <PanelCard padding="sm" className="h-full flex flex-col">
      <div className="grid flex-1 grid-cols-2 gap-3">
        {rows.map(({ label, value }) => {
          const up = (value ?? 0) >= 0;
          const Icon = up ? TrendingUp : TrendingDown;
          return (
            <div
              key={label}
              className="stat-tile relative overflow-hidden flex flex-col justify-between p-3"
            >
              {/* Artwork fills the tile. Decorative, so aria-hidden; the
                  tile's own dark ground shows through until it paints.

                  boxb1.png is a purpose-sized 356×220 red gradient that
                  runs clean to every edge, so it needs none of the
                  scale/origin cropping the previous artwork required to
                  hide its baked-in black band and corners. Plain cover. */}
              <Image
                src="/images/dashboard/boxb1.png"
                alt=""
                aria-hidden
                fill
                sizes="(max-width: 768px) 50vw, 180px"
                className="object-cover"
              />
              <div className="relative flex items-center justify-between">
                <span
                  className="text-[10px] uppercase tracking-[0.12em] font-semibold"
                  style={{ color: 'rgba(255,255,255,0.82)' }}
                >
                  {label}
                </span>
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.20)', color: '#ffffff' }}
                >
                  <Icon size={12} />
                </span>
              </div>
              {/* The figure used to be red for gains and a softer red for
                  losses. Both are unreadable on red artwork, so it is
                  white now and direction is carried by the arrow glyph
                  and the +/- sign — which the old code already called the
                  unambiguous cue. */}
              <p
                className="relative mt-2 text-lg font-extrabold tabular-nums leading-none"
                style={{ color: value == null ? 'rgba(255,255,255,0.55)' : '#ffffff' }}
              >
                {value == null ? '—' : `${value >= 0 ? '+' : ''}${fmtUsd(value)}`}
              </p>
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
}
