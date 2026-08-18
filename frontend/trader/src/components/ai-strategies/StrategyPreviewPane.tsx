'use client';

/**
 * Strategy Maker right pane — live preview of the config the conversation
 * has produced. Header (Start over / optional close), scrollable body
 * (503-fallback notice, RuleCard, not-tested alert), and a "Save as draft"
 * footer pinned to the pane bottom whenever a config exists.
 */

import { Info, RefreshCw, Save, TrendingUp, X } from 'lucide-react';
import RuleCard from '@/components/ai-strategies/RuleCard';
import type { StrategyDsl } from '@/lib/ai-strategies';

interface StrategyPreviewPaneProps {
  config: StrategyDsl | null;
  /** Backend 503 message — shows the example-strategy fallback notice. */
  aiUnavailable: string | null;
  showReset: boolean;
  onReset: () => void;
  onSave: () => void;
  /** Present only in the below-xl slide-over — renders a close button. */
  onClose?: () => void;
}

export default function StrategyPreviewPane({
  config,
  aiUnavailable,
  showReset,
  onReset,
  onSave,
  onClose,
}: StrategyPreviewPaneProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border-primary px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
          Strategy preview
        </span>
        <div className="flex items-center gap-1">
          {showReset && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
            >
              <RefreshCw size={11} /> Start over
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5">
        {aiUnavailable && (
          <div className="mb-3.5 flex items-start gap-2.5 rounded-lg border border-[#E94E1B]/25 bg-[#FCE6DD] px-3 py-2.5 text-[12px] text-[#0A0A0A]">
            <Info size={14} className="mt-0.5 shrink-0 text-[#E94E1B]" />
            <div>
              <p className="font-semibold text-[#E94E1B]">AI generation unavailable</p>
              <p className="mt-0.5">{aiUnavailable}</p>
              <p className="mt-0.5 text-text-secondary">
                A ready-made example strategy has been loaded in the preview — you can save it
                and adjust its risk settings, or try the AI again later.
              </p>
            </div>
          </div>
        )}

        {config ? (
          <>
            <RuleCard dsl={config} />

            <div className="mt-3.5 flex items-start gap-2.5 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2.5 text-xs text-text-secondary">
              <TrendingUp size={14} className="mt-0.5 shrink-0 text-[#E94E1B]" />
              <p>
                <span className="font-semibold text-text-primary">Not tested yet.</span> These
                rules have not been run against historical data. Save the strategy, then
                backtest it before deploying it anywhere.
              </p>
            </div>
          </>
        ) : (
          <div className="flex h-full min-h-[10rem] items-center justify-center px-4">
            <p className="max-w-[16rem] text-center text-sm leading-relaxed text-text-tertiary">
              Your strategy rules will appear here as soon as the AI produces them.
            </p>
          </div>
        )}
      </div>

      {config && (
        <div className="shrink-0 border-t border-border-primary p-3">
          <button
            type="button"
            onClick={onSave}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#E94E1B] py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#C73E11]"
          >
            <Save size={13} /> Save as draft
          </button>
        </div>
      )}
    </div>
  );
}
