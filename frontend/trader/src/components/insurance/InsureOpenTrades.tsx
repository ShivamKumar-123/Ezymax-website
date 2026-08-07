'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldCheck, X, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';
import {
  insuranceApi,
  type TierQuote,
  type InsuranceTier,
  type InsuranceDuration,
} from '@/lib/api/insurance';

interface OpenPos {
  id: string;
  account_id: string;
  account_number: string;
  symbol: string;
  side: 'buy' | 'sell';
  lots: number;
  leverage: number;
  stop_loss?: number;
  take_profit?: number;
}

const TIER_LABEL: Record<InsuranceTier, string> = {
  basic: 'Basic', advanced: 'Advanced', pro: 'Pro', elite: 'Elite',
};
const DURATIONS: { id: InsuranceDuration; label: string }[] = [
  { id: '1d', label: '1 day' },
  { id: '1w', label: '1 week' },
  { id: '1m', label: '1 month' },
];

export default function InsureOpenTrades({ onBought }: { onBought?: () => void }) {
  const [rows, setRows] = useState<OpenPos[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Buy modal state
  const [active, setActive] = useState<OpenPos | null>(null);
  const [duration, setDuration] = useState<InsuranceDuration>('1d');
  const [quotes, setQuotes] = useState<TierQuote[] | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [tier, setTier] = useState<InsuranceTier | null>(null);
  const [buying, setBuying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const accRes = await api.get<unknown>('/accounts').catch(() => ({ items: [] }));
      const accList = (Array.isArray(accRes) ? accRes : (accRes as { items?: unknown[] })?.items ?? []) as Record<string, unknown>[];
      const liveAccts = accList
        .map((a) => ({ id: String(a.id), number: String(a.account_number ?? ''), leverage: Number(a.leverage) || 100, is_demo: Boolean(a.is_demo) }))
        .filter((a) => !a.is_demo);

      const [posLists, activePolicies] = await Promise.all([
        Promise.all(
          liveAccts.map((a) =>
            api.get<unknown[]>('/positions/', { account_id: a.id, status: 'open' })
              .then((list) => ({ acct: a, list: Array.isArray(list) ? list : [] }))
              .catch(() => ({ acct: a, list: [] as unknown[] })),
          ),
        ),
        insuranceApi.active().catch(() => []),
      ]);

      const insured = new Set((activePolicies || []).map((p) => p.position_id).filter(Boolean) as string[]);

      const open: OpenPos[] = [];
      for (const { acct, list } of posLists) {
        for (const raw of list) {
          const p = raw as Record<string, unknown>;
          const id = String(p.id);
          if (insured.has(id)) continue;
          open.push({
            id,
            account_id: acct.id,
            account_number: acct.number,
            symbol: String(p.symbol || (p.instrument as { symbol?: string })?.symbol || ''),
            side: (p.side as 'buy' | 'sell'),
            lots: Number(p.lots) || 0,
            leverage: acct.leverage,
            stop_loss: p.stop_loss != null ? Number(p.stop_loss) : undefined,
            take_profit: p.take_profit != null ? Number(p.take_profit) : undefined,
          });
        }
      }
      setRows(open);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Fetch a quote whenever the modal position or duration changes.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setQuoting(true);
    setQuoteErr(null);
    setQuotes(null);
    setTier(null);
    insuranceApi
      .quote({
        account_id: active.account_id,
        symbol: active.symbol,
        side: active.side,
        lots: active.lots,
        leverage: active.leverage,
        stop_loss: active.stop_loss,
        take_profit: active.take_profit,
        duration,
      })
      .then((q) => { if (!cancelled) { setQuotes(q); setTier(q[0]?.tier ?? null); } })
      .catch((e) => {
        if (cancelled) return;
        const detail = (e as { message?: string })?.message || 'quote_failed';
        setQuoteErr(
          detail === 'insurance_disabled' ? 'Insurance is currently disabled.'
          : detail === 'news_blackout' ? 'Insurance paused during high-impact news.'
          : detail === 'vol_too_low' ? 'This market is too calm to insure right now.'
          : 'Could not get a quote — try again.',
        );
      })
      .finally(() => { if (!cancelled) setQuoting(false); });
    return () => { cancelled = true; };
  }, [active, duration]);

  const buy = async () => {
    if (!active || !tier) return;
    setBuying(true);
    try {
      const res = await insuranceApi.activate(active.id, tier, duration);
      toast.success(`Insured — $${Number(res.fee_charged).toFixed(2)} charged from your wallet`);
      setActive(null);
      await load();
      onBought?.();
    } catch (e) {
      const msg = (e as { message?: string })?.message;
      toast.error(msg === 'insufficient_balance' ? 'Not enough in your main wallet for the fee' : (msg || 'Could not buy insurance'));
    } finally {
      setBuying(false);
    }
  };

  const selected = quotes?.find((q) => q.tier === tier) || null;

  return (
    <div className="rounded-2xl p-4 md:p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-text-primary">Insure an open trade</h2>
        <span className="inline-flex items-center gap-1 text-[11px] text-text-tertiary">
          <Wallet size={12} /> Fee from main wallet
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
          <Loader2 size={14} className="animate-spin" /> Loading your trades…
        </div>
      ) : !rows || rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-secondary">
          No open uninsured trades. Open a position, then buy protection here (or from the order ticket).
        </p>
      ) : (
        <ul className="divide-y divide-border-primary">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <span
                className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: p.side === 'buy' ? '#ccff00' : '#ef4444', background: p.side === 'buy' ? 'rgba(204,255,0,0.12)' : 'rgba(239,68,68,0.12)' }}
              >
                {p.side}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-primary">{p.symbol}</p>
                <p className="text-[10px] text-text-tertiary">{p.lots.toFixed(2)} lots · #{p.account_number}</p>
              </div>
              <button
                type="button"
                onClick={() => { setActive(p); setDuration('1d'); }}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-transform active:scale-95"
                style={{ background: '#ccff00', color: '#0a0a0a' }}
              >
                <ShieldCheck size={13} /> Insure
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Buy modal */}
      {active && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !buying && setActive(null)}>
          <div className="w-full max-w-md rounded-2xl p-5 shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid rgba(204,255,0,0.18)' }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-text-primary">Insure {active.symbol}</h3>
                <p className="text-xs text-text-tertiary">{active.side} · {active.lots.toFixed(2)} lots · #{active.account_number}</p>
              </div>
              <button type="button" onClick={() => !buying && setActive(null)} className="grid size-8 place-items-center rounded-full text-text-tertiary hover:bg-bg-hover"><X size={16} /></button>
            </div>

            {/* Duration */}
            <div className="mb-3 flex gap-2">
              {DURATIONS.map((d) => (
                <button key={d.id} type="button" onClick={() => setDuration(d.id)}
                  className="flex-1 rounded-lg border py-1.5 text-xs font-bold transition-colors"
                  style={duration === d.id
                    ? { borderColor: '#ccff00', background: 'rgba(204,255,0,0.12)', color: '#ccff00' }
                    : { borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                  {d.label}
                </button>
              ))}
            </div>

            {/* Tiers */}
            {quoting ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary"><Loader2 size={14} className="animate-spin" /> Getting quote…</div>
            ) : quoteErr ? (
              <p className="py-6 text-center text-sm text-red-400">{quoteErr}</p>
            ) : quotes ? (
              <div className="space-y-2">
                {quotes.map((q) => (
                  <button key={q.tier} type="button" onClick={() => setTier(q.tier)}
                    className="flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors"
                    style={tier === q.tier
                      ? { borderColor: '#ccff00', background: 'rgba(204,255,0,0.06)' }
                      : { borderColor: 'var(--border-primary)' }}>
                    <div>
                      <p className="text-sm font-bold text-text-primary">{TIER_LABEL[q.tier]}</p>
                      <p className="text-[11px] text-text-tertiary">{q.coverage_pct}% covered · max ${q.max_cap.toFixed(0)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-bold" style={{ color: '#ccff00' }}>${q.fee.toFixed(2)}</p>
                      <p className="text-[10px] text-text-tertiary">fee</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {/* Buy */}
            <button
              type="button"
              onClick={buy}
              disabled={buying || quoting || !selected}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold transition-transform active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none"
              style={{ background: '#ccff00', color: '#0a0a0a' }}
            >
              {buying ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {selected ? `Buy — $${selected.fee.toFixed(2)} from wallet` : 'Select a plan'}
            </button>
            <p className="mt-2 text-center text-[10px] text-text-tertiary">The fee is deducted from your main wallet.</p>
          </div>
        </div>
      )}
    </div>
  );
}
