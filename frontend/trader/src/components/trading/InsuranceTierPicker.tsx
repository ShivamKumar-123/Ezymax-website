'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import {
  insuranceApi,
  type InsuranceDuration, type InsuranceTier, type QuoteRequest, type TierQuote,
} from '@/lib/api/insurance';

interface Props {
  accountId: string | undefined;
  symbol: string;
  side: 'buy' | 'sell';
  lots: number;
  leverage?: number;
  stopLoss?: number;
  takeProfit?: number;
  onSelect: (selection: { tier: InsuranceTier; duration: InsuranceDuration; fee: number } | null) => void;
}

const TIER_LABELS: Record<InsuranceTier, string> = {
  basic: 'Basic',
  advanced: 'Advanced',
  pro: 'Pro',
  elite: 'Elite',
};

const DURATION_OPTIONS: { value: InsuranceDuration; label: string }[] = [
  { value: '1d', label: '1 Day' },
  { value: '1w', label: '1 Week' },
  { value: '1m', label: '1 Month' },
];

export default function InsuranceTierPicker(props: Props) {
  const { accountId, symbol, side, lots, leverage, stopLoss, takeProfit, onSelect } = props;
  const [enabled, setEnabled] = useState(false);
  const [tier, setTier] = useState<InsuranceTier | null>(null);
  const [duration, setDuration] = useState<InsuranceDuration>('1d');
  const [quotes, setQuotes] = useState<TierQuote[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Re-fetch the quote whenever inputs change. */
  useEffect(() => {
    if (!enabled || !accountId || !symbol || !lots || lots <= 0) {
      setQuotes(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const body: QuoteRequest = {
          account_id: accountId,
          symbol,
          side,
          lots,
          leverage: leverage || 100,
          stop_loss: stopLoss,
          take_profit: takeProfit,
          duration,
        };
        const q = await insuranceApi.quote(body);
        setQuotes(q);
      } catch (e: any) {
        const detail = e?.response?.data?.detail || e?.message || 'quote_failed';
        setError(typeof detail === 'string' ? detail : 'quote_failed');
        setQuotes(null);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled, accountId, symbol, side, lots, leverage, stopLoss, takeProfit, duration]);

  /* Bubble selection up. Reset on disable. */
  useEffect(() => {
    if (!enabled || !tier || !quotes) {
      onSelect(null);
      return;
    }
    const q = quotes.find((x) => x.tier === tier);
    if (q) onSelect({ tier, duration, fee: q.fee });
  }, [enabled, tier, duration, quotes, onSelect]);

  return (
    <div className="rounded-xl border border-border-primary bg-card-nested p-3 space-y-3">
      <button
        type="button"
        onClick={() => {
          const next = !enabled;
          setEnabled(next);
          if (!next) setTier(null);
        }}
        className="flex w-full items-center gap-2.5 text-left"
      >
        <div
          className={`w-9 h-5 rounded-full relative transition-colors ${enabled ? 'bg-[#d6a93d]' : 'bg-bg-hover'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : ''}`}
          />
        </div>
        <ShieldCheck size={15} className="text-[#d6a93d]" />
        <span className="text-sm font-semibold text-text-primary">Insure this trade</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-text-tertiary">Optional</span>
      </button>

      {enabled && (
        <>
          {/* Coverage window — how long the policy stays claimable */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary mr-1">Cover for</span>
            {DURATION_OPTIONS.map((opt) => {
              const active = duration === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDuration(opt.value)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                  style={{
                    background: active ? 'rgba(214,169,61,0.14)' : 'var(--bg-card)',
                    border: `1px solid ${active ? '#d6a93d' : 'var(--border-primary)'}`,
                    color: active ? '#d6a93d' : 'var(--text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Loader2 size={12} className="animate-spin" /> Calculating quotes…
            </div>
          )}
          {error && !loading && (
            <p className="text-xs text-red-400">
              {error === 'insurance_disabled' && 'Insurance is currently disabled.'}
              {error === 'news_blackout' && 'Insurance is paused during the active news window.'}
              {error === 'vol_too_low' && 'Volatility too low — insurance unavailable for this instrument.'}
              {!['insurance_disabled', 'news_blackout', 'vol_too_low'].includes(error) && 'Could not get a quote — try again.'}
            </p>
          )}
          {quotes && !loading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {quotes.map((q) => {
                const active = tier === q.tier;
                return (
                  <button
                    key={q.tier}
                    type="button"
                    onClick={() => setTier(active ? null : q.tier)}
                    className="text-left rounded-lg p-2.5 transition-all"
                    style={{
                      background: active ? 'rgba(214,169,61,0.10)' : 'var(--bg-card)',
                      border: `1px solid ${active ? '#d6a93d' : 'var(--border-primary)'}`,
                      boxShadow: active ? '0 0 0 2px rgba(214,169,61,0.2)' : 'none',
                    }}
                  >
                    <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{TIER_LABELS[q.tier]}</p>
                    <p className="mt-1 text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      ${q.fee.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-[#d6a93d] mt-0.5 font-semibold">
                      {q.coverage_pct.toFixed(0)}% covered
                    </p>
                    <p className="text-[10px] text-text-tertiary mt-0.5">
                      Max ${q.max_cap.toFixed(0)}
                    </p>
                    {q.estimated_refund > 0 && (
                      <p className="text-[10px] text-text-secondary mt-0.5">
                        ~${q.estimated_refund.toFixed(2)} if SL hits
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {tier && quotes && (
            <p className="text-[11px] text-text-tertiary">
              The fee will be charged from your main wallet after the order opens.
              Coverage lasts {DURATION_OPTIONS.find((o) => o.value === duration)?.label.toLowerCase()} from activation —
              a loss only pays out if the trade closes within that window.
            </p>
          )}
        </>
      )}
    </div>
  );
}
