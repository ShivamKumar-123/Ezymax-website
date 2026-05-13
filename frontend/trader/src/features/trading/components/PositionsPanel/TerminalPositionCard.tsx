'use client';

import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import type { Position } from '@/stores/tradingStore';
import { formatPositionOpenedAt } from './positionsPanel.utils';

interface TerminalPositionCardProps {
  pos: Position;
  digits: number;
  marginExposureLine: string;
  swapsFeeLine: string;
  onCloseFull: () => void;
  onPartialClose: () => void;
}

/** Terminal card view: compact; close / partial close open the same modal as table layout. */
export function TerminalPositionCard({
  pos,
  digits,
  marginExposureLine,
  swapsFeeLine,
  onCloseFull,
  onPartialClose,
}: TerminalPositionCardProps) {
  const pnl = pos.profit || 0;
  const cur = pos.current_price;
  const priceDown = cur != null && (pos.side === 'buy' ? cur < pos.open_price : cur > pos.open_price);

  return (
    <div className="w-full max-w-[300px] rounded-lg border border-border-primary bg-card overflow-hidden shadow-md">
      <div className="px-2.5 pt-2 pb-2 flex justify-between gap-2 border-b border-border-primary">
        <div className="min-w-0">
          <div className="text-xs font-bold text-text-primary font-mono tracking-tight">{pos.symbol}</div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span
              className={clsx(
                'text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded',
                pos.side === 'buy' ? 'bg-[#2962FF]/18 text-[#2962FF]' : 'bg-[#ff5252]/18 text-[#ff5252]',
              )}
            >
              {pos.side}
            </span>
            <span className="text-[10px] text-text-tertiary tabular-nums">{pos.lots} Lots</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className={clsx(
              'inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums border',
              pnl >= 0
                ? 'bg-green-500/10 border-green-500/20 text-[#2196f3]'
                : 'bg-red-500/10 border-red-500/20 text-[#ff5252]',
            )}
          >
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
          </div>
          <div className="flex justify-end gap-0.5 mt-1">
            <span className="text-[8px] font-semibold uppercase px-1 py-0.5 rounded bg-bg-secondary text-text-tertiary">
              SL
            </span>
            <span className="text-[8px] font-semibold uppercase px-1 py-0.5 rounded bg-bg-secondary text-text-tertiary">
              TP
            </span>
          </div>
        </div>
      </div>

      <div className="px-2.5 py-1.5 flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <div className="text-[8px] font-bold uppercase tracking-wide text-text-tertiary">Entry price</div>
          <div className="text-[11px] font-mono font-semibold text-text-primary tabular-nums leading-tight">
            {pos.open_price.toFixed(digits)}
          </div>
          <div className="text-[8px] text-text-tertiary mt-0.5 leading-tight">{formatPositionOpenedAt(pos.created_at)}</div>
        </div>
        <ArrowRight className="w-3 h-3 text-text-tertiary shrink-0 mt-3" aria-hidden />
        <div className="min-w-0 flex-1 text-right">
          <div className="text-[8px] font-bold uppercase tracking-wide text-text-tertiary">Current price</div>
          <div className="text-[11px] font-mono font-semibold tabular-nums inline-flex items-center justify-end gap-0.5 text-text-primary leading-tight">
            {cur != null ? cur.toFixed(digits) : '—'}
            {cur != null &&
              (priceDown ? (
                <TrendingDown className="w-3 h-3 text-[#ff5252]" aria-hidden />
              ) : (
                <TrendingUp className="w-3 h-3 text-[#2196f3]" aria-hidden />
              ))}
          </div>
        </div>
      </div>

      <div className="px-2.5 pb-1.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
        <div>
          <div className="text-[8px] font-semibold uppercase text-text-tertiary mb-px">Stop loss</div>
          <div className="font-mono text-text-primary leading-tight">
            {pos.stop_loss != null ? pos.stop_loss.toFixed(digits) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[8px] font-semibold uppercase text-text-tertiary mb-px">Take profit</div>
          <div className="font-mono text-text-primary leading-tight">
            {pos.take_profit != null ? pos.take_profit.toFixed(digits) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[8px] font-semibold uppercase text-text-tertiary mb-px">Swaps / Fee</div>
          <div className="font-mono text-text-secondary tabular-nums text-[10px] leading-tight">{swapsFeeLine}</div>
        </div>
        <div>
          <div className="text-[8px] font-semibold uppercase text-text-tertiary mb-px">Margin / Exposure</div>
          <div className="font-mono text-text-secondary tabular-nums text-[10px] leading-tight break-all">
            {marginExposureLine}
          </div>
        </div>
      </div>

      <p className="px-2.5 pb-1 text-[8px] text-text-tertiary font-mono truncate" title={pos.id}>
        POSITION ID: {pos.id}
      </p>

      <div className="px-2.5 pb-2 pt-0.5 flex flex-col gap-1.5 border-t border-border-primary">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCloseFull();
          }}
          className="w-full py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-[#ff5252]/12 text-[#ff5252] border border-[#ff5252]/35 hover:bg-[#ff5252]/18 transition-colors"
        >
          Close
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPartialClose();
          }}
          className="w-full py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-bg-secondary text-text-primary border border-border-primary hover:bg-bg-hover transition-colors"
        >
          Partial close
        </button>
      </div>
    </div>
  );
}
