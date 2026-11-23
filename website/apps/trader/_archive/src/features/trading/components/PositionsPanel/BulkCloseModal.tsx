'use client';

import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { X } from 'lucide-react';
import type { Position } from '@/stores/tradingStore';
import type { BulkCloseType } from './positionsPanel.utils';

interface BulkCloseModalProps {
  bulkConfirm: BulkCloseType | null;
  setBulkConfirm: React.Dispatch<React.SetStateAction<BulkCloseType | null>>;
  positions: Position[];
  profitPositions: Position[];
  lossPositions: Position[];
  bulkBusy: boolean;
  onExecute: (type: BulkCloseType) => void;
}

export function BulkCloseModal({
  bulkConfirm,
  setBulkConfirm,
  positions,
  profitPositions,
  lossPositions,
  bulkBusy,
  onExecute,
}: BulkCloseModalProps) {
  if (!bulkConfirm || typeof document === 'undefined') return null;

  const countMap = { all: positions.length, profit: profitPositions.length, loss: lossPositions.length };
  const labelMap = {
    all: 'Close All Positions',
    profit: 'Close Profitable Positions',
    loss: 'Close Losing Positions',
  };
  const descMap = {
    all: `Close all ${positions.length} open position${positions.length !== 1 ? 's' : ''} at market price.`,
    profit: `Close ${profitPositions.length} profitable position${profitPositions.length !== 1 ? 's' : ''} at market price.`,
    loss: `Close ${lossPositions.length} losing position${lossPositions.length !== 1 ? 's' : ''} at market price.`,
  };
  const count = countMap[bulkConfirm];
  const shell = clsx(
    'relative w-full max-w-[280px] rounded-xl border p-3.5 shadow-2xl overflow-hidden pointer-events-auto',
    'bg-card border-border-primary',
  );

  return createPortal(
    <div className="fixed inset-0 p-0" style={{ zIndex: 2147483646, isolation: 'isolate' }}>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Dismiss"
        className="absolute inset-0 z-0 m-0 h-full w-full cursor-default border-0 bg-black/60 p-0 backdrop-blur-sm"
        onClick={() => setBulkConfirm(null)}
      />
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          className={shell}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 id="bulk-close-title" className="text-sm font-bold pr-2 text-text-primary">
              {labelMap[bulkConfirm]}
            </h3>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBulkConfirm(null); }}
              className={clsx(
                'shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors',
                'bg-bg-hover text-text-tertiary hover:text-text-primary',
              )}
              aria-label="Close"
            >
              <X className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
          <p className={clsx('text-xs text-text-secondary', 'mb-2')}>{descMap[bulkConfirm]}</p>
          {count === 0 ? (
            <>
              <p className="text-[11px] mb-3 text-text-tertiary">No matching positions found.</p>
              <button
                type="button"
                onClick={() => setBulkConfirm(null)}
                className={clsx('w-full py-2.5 font-bold rounded-lg text-sm', 'bg-bg-hover text-text-primary')}
              >
                OK
              </button>
            </>
          ) : (
            <>
              <p className="text-[11px] mb-4 text-text-tertiary">This action cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBulkConfirm(null)}
                  className={clsx(
                    'flex-1 py-2.5 font-bold rounded-lg text-sm active:scale-[0.98] transition-all',
                    'bg-bg-hover text-text-primary',
                  )}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onExecute(bulkConfirm)}
                  disabled={bulkBusy}
                  className="flex-1 py-2.5 bg-sell text-white font-bold rounded-lg shadow-lg shadow-sell/20 active:scale-[0.98] transition-all disabled:opacity-50 text-sm"
                >
                  {bulkBusy ? 'Closing…' : 'Confirm'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
