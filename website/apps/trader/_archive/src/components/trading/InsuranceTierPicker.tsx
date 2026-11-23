'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { insuranceApi, type InsuranceTier, type QuoteRequest, type TierQuote } from '@/lib/api/insurance';
import { fmtAccountMoney } from '@/lib/wallet/centDisplay';

interface Props {
  accountId: string | undefined;
  symbol: string;
  side: 'buy' | 'sell';
  lots: number;
  leverage?: number;
  stopLoss?: number;
  takeProfit?: number;
  onSelect: (selection: { tier: InsuranceTier; fee: number } | null) => void;
  /** Cent-account display flag — when true, fees and caps render as
   *  ¢ instead of $ (× 100), matching the rest of the trader UI. */
  isCent?: boolean;
}

/** Render a tier label sent by the backend. Legacy mode sends
 *  'basic'/'advanced'/'pro'/'elite' which we capitalise; simple mode
 *  sends '50%'/'70%' verbatim. We just respect whatever admin set. */
function formatTierLabel(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return 'Tier';
  // % already? show as-is.
  if (s.includes('%')) return s;
  // Capitalise legacy names so 'basic' → 'Basic'.
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function InsuranceTierPicker(props: Props) {
  const { accountId, symbol, side, lots, leverage, stopLoss, takeProfit, onSelect, isCent } = props;
  const [enabled, setEnabled] = useState(false);
  const [tier, setTier] = useState<InsuranceTier | null>(null);
  const [quotes, setQuotes] = useState<TierQuote[] | null>(null);
  // Once quotes arrive AND the picker is enabled, default-pick the
  // CHEAPEST tier so a user who flips the toggle on actually gets
  // insurance without having to click a card. Client report 2026-06-09:
  // traders kept turning the toggle on then placing the order and
  // wondering why no countdown appeared on the position.
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
  }, [enabled, accountId, symbol, side, lots, leverage, stopLoss, takeProfit]);

  /* Single effect: auto-pick the cheapest tier AND bubble the selection
   * up in the SAME render. Splitting these into two effects left a
   * window where `tier` was set but onSelect hadn't fired yet — if the
   * user clicked BUY in that window the order went out with no
   * insurance selection and the trade opened "Not insured". Doing both
   * here closes that race. */
  useEffect(() => {
    if (!enabled || !quotes || quotes.length === 0) {
      onSelect(null);
      return;
    }
    // Honour an explicit pick; otherwise default to the cheapest tier.
    const picked = tier
      ? quotes.find((x) => x.tier === tier)
      : [...quotes].sort((a, b) => a.fee - b.fee)[0];
    if (!picked) {
      onSelect(null);
      return;
    }
    if (!tier) setTier(picked.tier);
    onSelect({ tier: picked.tier, fee: picked.fee });
  }, [enabled, tier, quotes, onSelect]);

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
          className={`w-9 h-5 rounded-full relative transition-colors ${enabled ? 'bg-[#E12019]' : 'bg-bg-hover'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : ''}`}
          />
        </div>
        <ShieldCheck size={15} className="text-[#E12019]" />
        <span className="text-sm font-semibold text-text-primary">Insure this trade</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-text-tertiary">Optional</span>
      </button>

      {enabled && (
        <>
          {loading && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Loader2 size={12} className="animate-spin" /> Calculating quotes…
            </div>
          )}
          {error && !loading && (
            <p className="text-xs text-amber-400">
              {error === 'insurance_disabled' && 'Insurance is currently disabled.'}
              {error === 'insurance_disabled_for_account_type' && 'Insurance is not available for this account type.'}
              {error === 'news_blackout' && 'Insurance is paused during the active news window.'}
              {error === 'vol_too_low' && 'Volatility too low — insurance unavailable for this instrument.'}
              {error === 'vol_too_high' && 'Volatility too high — insurance unavailable right now.'}
              {error === 'hour_blackout' && 'Insurance is paused during this hour window.'}
              {error.startsWith('max_lots_exceeded')
                && `This trade is too large to insure. Max insurable size is ${error.split(':')[1] || 'lower'} lots — reduce volume to insure it.`}
              {![
                'insurance_disabled', 'insurance_disabled_for_account_type',
                'news_blackout', 'vol_too_low', 'vol_too_high', 'hour_blackout',
              ].includes(error) && !error.startsWith('max_lots_exceeded')
                && 'Could not get a quote — try again.'}
            </p>
          )}
          {quotes && !loading && (
            // Auto-fit by container width — the picker lives inside the
            // narrow Order Panel right-rail in the trading terminal, so
            // `sm:grid-cols-4` (viewport-based) would force 4 columns into
            // a 280–400px container on desktop, breaking the cards. With
            // `auto-fit minmax(110px,1fr)` the layout naturally produces
            // 1 / 2 / 3 / 4 columns based on the actual room available.
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}
            >
              {quotes.map((q) => {
                const active = tier === q.tier;
                return (
                  <button
                    key={q.tier}
                    type="button"
                    onClick={() => setTier(active ? null : q.tier)}
                    className="text-left rounded-lg p-2.5 transition-all"
                    style={{
                      background: active ? 'rgba(225, 32, 25,0.10)' : 'var(--bg-card)',
                      border: `1px solid ${active ? '#E12019' : 'var(--border-primary)'}`,
                      boxShadow: active ? '0 0 0 2px rgba(225, 32, 25,0.2)' : 'none',
                    }}
                  >
                    <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{formatTierLabel(q.tier)}</p>
                    <p className="mt-1 text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {fmtAccountMoney(q.fee, !!isCent)}
                    </p>
                    <p className="text-[10px] text-[#E12019] mt-0.5 font-semibold">
                      {q.coverage_pct.toFixed(0)}% covered
                    </p>
                    <p className="text-[10px] text-text-tertiary mt-0.5">
                      Max {fmtAccountMoney(q.max_cap, !!isCent, { decimals: 0 })}
                    </p>
                    {q.estimated_refund > 0 && (
                      <p className="text-[10px] text-text-secondary mt-0.5">
                        ~{fmtAccountMoney(q.estimated_refund, !!isCent)} if SL hits
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
            </p>
          )}
        </>
      )}
    </div>
  );
}
