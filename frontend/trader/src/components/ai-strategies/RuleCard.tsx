'use client';

import { clsx } from 'clsx';
import { Shield } from 'lucide-react';
import { describeDsl, type StrategyDsl } from '@/lib/ai-strategies';

/**
 * Human-readable rendering of a strategy DSL — symbol/timeframe header,
 * entry/exit rule groups ("EMA(20) crosses above EMA(50)"), risk settings.
 */
export default function RuleCard({ dsl, className }: { dsl: StrategyDsl; className?: string }) {
  const desc = describeDsl(dsl);

  return (
    <div className={clsx('rounded-xl border border-border-primary bg-bg-secondary/50 p-4', className)}>
      <p className="text-xs font-bold text-text-primary font-mono tracking-tight">{desc.header}</p>

      {desc.sections.length === 0 && (
        <p className="text-[11px] text-text-tertiary mt-2">No entry/exit rules defined yet.</p>
      )}

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {desc.sections.map((s) => (
          <div key={s.title} className="rounded-lg border border-border-primary bg-card px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-tertiary">{s.title}</p>
              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-crx-yellow-soft text-[#E94E1B]">
                {s.join === 'ALL' ? 'All must match' : 'Any can match'}
              </span>
            </div>
            <ul className="space-y-1">
              {s.rules.map((r, i) => (
                <li key={i} className="text-[11.5px] text-text-primary leading-snug flex gap-1.5">
                  <span className="text-[#E94E1B] shrink-0">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {desc.risk.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-border-primary bg-card px-3 py-2.5">
          <Shield size={13} className="text-text-tertiary shrink-0 mt-0.5" />
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {desc.risk.map((r) => (
              <span key={r} className="text-[11px] text-text-secondary">{r}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
