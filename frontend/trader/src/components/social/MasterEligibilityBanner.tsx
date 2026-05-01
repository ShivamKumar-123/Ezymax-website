'use client';

import { useEffect, useState } from 'react';
import { Check, Clock, X, Trophy, Loader2 } from 'lucide-react';
import api from '@/lib/api/client';

type Eligibility = {
  active_days: number;
  active_days_required: number;
  active_days_ok: boolean;
  profitable: boolean;
  profitable_ok: boolean;
  total_pnl_usd: number;
  trade_volume_usd: number;
  trade_volume_required: number;
  trade_volume_ok: boolean;
  trade_count: number;
  trade_count_required: number;
  trade_count_ok: boolean;
  all_passed: boolean;
};

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

/** Banner shown above the Become-Master form. Live-fetches the user's stats
 * vs. the four eligibility criteria from COPY_TRADING_PAGE.docx so they can
 * see exactly what's missing before they apply. */
export default function MasterEligibilityBanner() {
  const [data, setData] = useState<Eligibility | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get<Eligibility>('/social/masters/eligibility');
        if (!cancelled) setData(r);
      } catch { /* silent — admin path remains via external_pnl_url */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-4 flex items-center gap-2 text-xs text-text-secondary">
        <Loader2 size={14} className="animate-spin" /> Checking your eligibility…
      </div>
    );
  }
  if (!data) return null;

  const allPassed = data.all_passed;
  return (
    <div
      className={
        'rounded-xl p-4 border ' +
        (allPassed
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-[#d6a93d]/35 bg-[#d6a93d]/5')
      }
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Trophy size={16} className={allPassed ? 'text-emerald-400' : 'text-[#d6a93d]'} />
          <h3 className="text-sm font-semibold text-text-primary">
            {allPassed ? 'You qualify as a Master Trader' : 'Master Trader eligibility'}
          </h3>
        </div>
        <span
          className={
            'inline-flex items-center gap-1 text-[10.5px] uppercase tracking-wider px-2 py-0.5 rounded-full ' +
            (allPassed
              ? 'text-emerald-400 border border-emerald-400/40 bg-emerald-400/10'
              : 'text-[#d6a93d] border border-[#d6a93d]/40 bg-[#d6a93d]/10')
          }
        >
          {allPassed ? <Check size={10} /> : <Clock size={10} />}
          {allPassed ? 'Ready to apply' : 'Not yet'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <Criterion
          label="Active for 30+ days"
          ok={data.active_days_ok}
          progress={`${data.active_days} / ${data.active_days_required} days`}
        />
        <Criterion
          label="Profitable lifetime P&L"
          ok={data.profitable_ok}
          progress={fmtUsd(data.total_pnl_usd)}
        />
        <Criterion
          label="$100k trading volume"
          ok={data.trade_volume_ok}
          progress={`${fmtUsd(data.trade_volume_usd)} / ${fmtUsd(data.trade_volume_required)}`}
        />
        <Criterion
          label="100+ closed trades"
          ok={data.trade_count_ok}
          progress={`${data.trade_count} / ${data.trade_count_required}`}
        />
      </div>

      {!allPassed && (
        <p className="text-[11px] text-text-tertiary mt-3 leading-relaxed">
          Don&apos;t meet the criteria yet? You can still apply with a verified external track record (e.g.
          MyFxBook URL, audited statement). Admin will review.
        </p>
      )}
    </div>
  );
}

function Criterion({ label, ok, progress }: { label: string; ok: boolean; progress: string }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span
        className={
          'mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ' +
          (ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-bg-base text-text-tertiary border border-border-primary')
        }
      >
        {ok ? <Check size={10} /> : <X size={10} />}
      </span>
      <div className="min-w-0">
        <p className={'font-medium ' + (ok ? 'text-text-primary' : 'text-text-secondary')}>{label}</p>
        <p className="text-[10.5px] text-text-tertiary tabular-nums">{progress}</p>
      </div>
    </div>
  );
}
