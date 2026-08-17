'use client';

/**
 * Backtest run dialog — period (30/90/180/365 days) + commission per lot.
 * On success it hands the full result back to the caller, which keeps
 * session-run history and refreshes the metric tiles.
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Play } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { inputCls } from '@/components/ai-strategies/shared';
import { aiApi, type BacktestResult } from '@/lib/ai-strategies';

const BACKTEST_DAYS = [30, 90, 180, 365] as const;

export interface BacktestRun {
  result: BacktestResult;
  days: number;
  commissionPerLot: number;
  ranAt: string;
}

interface BacktestDialogProps {
  open: boolean;
  onClose: () => void;
  strategyId: string;
  onCompleted: (run: BacktestRun) => void;
}

export default function BacktestDialog({
  open,
  onClose,
  strategyId,
  onCompleted,
}: BacktestDialogProps) {
  const [days, setDays] = useState<number>(90);
  const [commission, setCommission] = useState('0');
  const [running, setRunning] = useState(false);

  const run = async () => {
    const commissionPerLot = Number(commission);
    if (!Number.isFinite(commissionPerLot) || commissionPerLot < 0) {
      toast.error('Commission must be a non-negative number');
      return;
    }
    setRunning(true);
    try {
      const result = await aiApi.backtest(strategyId, {
        days,
        commission_per_lot: commissionPerLot,
      });
      toast.success('Backtest complete');
      onCompleted({ result, days, commissionPerLot, ranAt: new Date().toISOString() });
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Backtest failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!running) onClose();
      }}
      title="Run backtest"
      width="sm"
    >
      <div className="space-y-4">
        <p className="text-xs text-text-secondary">
          Replays the strategy against historical prices. No orders are placed and no money
          moves.
        </p>

        <div>
          <p className="block text-xs text-text-secondary mb-1.5">Period</p>
          <div className="inline-flex items-center gap-1 rounded-lg border border-border-primary bg-bg-secondary p-0.5">
            {BACKTEST_DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={clsx(
                  'px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors',
                  days === d ? 'bg-[#E94E1B] text-white' : 'text-text-secondary hover:text-text-primary',
                )}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="bt-commission" className="block text-xs text-text-secondary mb-1.5">
            Commission per lot (USD)
          </label>
          <input
            id="bt-commission"
            type="number"
            min="0"
            step="0.5"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            className="flex-1 py-2.5 rounded-lg border border-border-primary text-xs text-text-secondary hover:text-text-primary hover:border-border-secondary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void run()}
            disabled={running}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[#E94E1B] text-white text-xs font-bold hover:bg-[#C73E11] disabled:opacity-50 transition-colors"
          >
            <Play size={12} /> {running ? 'Running…' : 'Run backtest'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
