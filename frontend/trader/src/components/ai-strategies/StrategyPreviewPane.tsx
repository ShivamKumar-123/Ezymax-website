'use client';

/**
 * Strategy Maker right pane — live, scannable preview of the config the
 * conversation has produced:
 *
 *   Meta         · symbol / timeframe / direction tiles
 *   Entry rules  · one readable row per condition (+ ALL/ANY badge)
 *   Exit rules   · same
 *   Risk         · SL / TP / sizing rows
 *
 * plus the 503-fallback notice, a "not tested yet" alert, and a sticky
 * [Save Strategy] action bar. The body cross-fades when the config updates.
 */

import { useMemo } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import {
  ArrowLeftRight,
  Clock,
  Globe,
  Info,
  LogIn,
  LogOut,
  RefreshCw,
  Save,
  Shield,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { describeDsl, type StrategyDsl, type DslRuleSection } from '@/lib/ai-strategies';

interface StrategyPreviewPaneProps {
  config: StrategyDsl | null;
  /** Backend 503 message — shows the example-strategy fallback notice. */
  aiUnavailable: string | null;
  showReset: boolean;
  onReset: () => void;
  onSave: () => void;
  /** Editable strategy name (rename before saving). */
  name?: string;
  onNameChange?: (v: string) => void;
  /** Save, then jump straight into a backtest / deploy on the saved strategy. */
  onSaveAndBacktest?: () => void;
  onSaveAndDeploy?: () => void;
  /** Present in the mobile sheet / collapsible rail — renders a close button. */
  onClose?: () => void;
}

function JoinBadge({ join }: { join: 'ALL' | 'ANY' }) {
  return (
    <span className="rounded bg-crx-yellow-soft px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#E94E1B]">
      {join === 'ALL' ? 'All must match' : 'Any can match'}
    </span>
  );
}

function RuleSection({
  title,
  icon: Icon,
  sections,
}: {
  title: string;
  icon: typeof LogIn;
  sections: DslRuleSection[];
}) {
  if (sections.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-text-tertiary">
        <Icon size={11} className="text-[#E94E1B]" aria-hidden />
        {title}
      </h3>
      <div className="space-y-2">
        {sections.map((s) => (
          <div key={s.title} className="rounded-xl border border-border-primary bg-bg-secondary/60 p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold text-text-secondary">{s.title}</p>
              <JoinBadge join={s.join} />
            </div>
            <ul className="space-y-1">
              {s.rules.map((r, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-lg bg-card px-2.5 py-1.5 text-[11.5px] leading-snug text-text-primary"
                >
                  <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-[#E94E1B]" aria-hidden />
                  <span className="min-w-0 break-words">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function StrategyPreviewPane({
  config,
  aiUnavailable,
  showReset,
  onReset,
  onSave,
  onClose,
  name,
  onNameChange,
  onSaveAndBacktest,
  onSaveAndDeploy,
}: StrategyPreviewPaneProps) {
  const desc = useMemo(() => (config ? describeDsl(config) : null), [config]);
  // Cross-fade the body whenever the config meaningfully changes.
  const configKey = useMemo(() => (config ? JSON.stringify(config) : 'empty'), [config]);

  const dirLabel =
    config?.direction === 'long'
      ? 'Long only'
      : config?.direction === 'short'
        ? 'Short only'
        : 'Long & Short';

  const entrySections = desc?.sections.filter((s) => s.title.startsWith('Entry')) ?? [];
  const exitSections = desc?.sections.filter((s) => s.title.startsWith('Exit')) ?? [];

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
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary active:bg-bg-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#E94E1B]"
            >
              <RefreshCw size={11} aria-hidden /> Start over
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary active:bg-bg-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#E94E1B]"
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
        {aiUnavailable && (
          <div className="mb-3.5 flex items-start gap-2.5 rounded-xl border border-[#E94E1B]/25 bg-crx-yellow-soft px-3 py-2.5 text-[12px] text-text-primary">
            <Info size={14} className="mt-0.5 shrink-0 text-[#E94E1B]" aria-hidden />
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

        {config && desc ? (
          <motion.div
            key={configKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="space-y-4"
          >
            {/* Meta — symbol · timeframe · direction */}
            <section>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-text-tertiary">
                <Globe size={11} className="text-[#E94E1B]" aria-hidden />
                Market
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Globe, label: 'Symbol', value: config.symbol || '—' },
                  { icon: Clock, label: 'Timeframe', value: config.timeframe || '—' },
                  { icon: ArrowLeftRight, label: 'Direction', value: dirLabel },
                ].map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-border-primary bg-bg-secondary/60 px-2 py-2 text-center"
                  >
                    <Icon size={12} className="mx-auto text-text-tertiary" aria-hidden />
                    <p className="mt-1 truncate font-mono text-[11px] font-bold text-text-primary">
                      {value}
                    </p>
                    <p className="text-[9px] uppercase tracking-wide text-text-tertiary">{label}</p>
                  </div>
                ))}
              </div>
            </section>

            <RuleSection title="Entry rules" icon={LogIn} sections={entrySections} />
            <RuleSection title="Exit rules" icon={LogOut} sections={exitSections} />

            {desc.sections.length === 0 && (
              <p className="rounded-xl border border-dashed border-border-primary px-3 py-4 text-center text-[11px] text-text-tertiary">
                No entry/exit rules defined yet.
              </p>
            )}

            {desc.risk.length > 0 && (
              <section>
                <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-text-tertiary">
                  <Shield size={11} className="text-[#E94E1B]" aria-hidden />
                  Risk
                </h3>
                <ul className="space-y-1">
                  {desc.risk.map((r) => (
                    <li
                      key={r}
                      className="flex items-center gap-2 rounded-lg border border-border-primary bg-bg-secondary/60 px-2.5 py-1.5 text-[11.5px] text-text-primary"
                    >
                      <Shield size={11} className="shrink-0 text-text-tertiary" aria-hidden />
                      {r}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex items-start gap-2.5 rounded-xl border border-border-primary bg-bg-secondary px-3 py-2.5 text-xs text-text-secondary">
              <TrendingUp size={14} className="mt-0.5 shrink-0 text-[#E94E1B]" aria-hidden />
              <p>
                <span className="font-semibold text-text-primary">Not tested yet.</span> These
                rules have not been run against historical data. Save the strategy, then
                backtest it before deploying it anywhere.
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-3 px-4">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border-primary bg-bg-secondary text-text-tertiary"
              aria-hidden
            >
              <Sparkles size={17} />
            </span>
            <p className="max-w-[16rem] text-center text-sm leading-relaxed text-text-tertiary">
              Your strategy rules will appear here as soon as the AI produces them.
            </p>
          </div>
        )}
      </div>

      {config && (
        <div className="shrink-0 space-y-2 border-t border-border-primary bg-card p-3">
          {onNameChange && (
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Strategy name</span>
              <input
                value={name ?? ''}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="e.g. EURUSD 1h trend rider"
                className="w-full rounded-xl border border-border-secondary bg-bg-card-nested px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-[#E94E1B]/50 focus:outline-none"
              />
            </label>
          )}
          <button
            type="button"
            onClick={onSave}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#E94E1B] py-2.5 text-xs font-bold text-white transition-[background-color,transform] hover:bg-[#C73E11] active:scale-[0.99]"
          >
            <Save size={13} aria-hidden /> Save to My Strategies
          </button>
          {(onSaveAndBacktest || onSaveAndDeploy) && (
            <div className="grid grid-cols-2 gap-2">
              {onSaveAndBacktest && (
                <button type="button" onClick={onSaveAndBacktest} className="rounded-full border border-border-primary bg-bg-card-nested py-2 text-xs font-semibold text-text-primary hover:bg-bg-hover transition-colors">
                  Save &amp; backtest
                </button>
              )}
              {onSaveAndDeploy && (
                <button type="button" onClick={onSaveAndDeploy} className="rounded-full border border-border-primary bg-bg-card-nested py-2 text-xs font-semibold text-text-primary hover:bg-bg-hover transition-colors">
                  Save &amp; deploy
                </button>
              )}
            </div>
          )}
          <p className="text-center text-[10px] text-text-tertiary">Want changes? Just describe them in the chat — the rules update here.</p>
        </div>
      )}
    </div>
  );
}
