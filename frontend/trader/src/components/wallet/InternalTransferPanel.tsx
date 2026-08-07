'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Wallet, Landmark, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';

interface LiveAccount {
  id: string;
  account_number: string;
  group_name: string;
  free_margin: number;
  balance: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s: string) => UUID_RE.test(s);
const fmt = (n: number) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Self-contained Internal Transfer panel — move funds between the main wallet,
 * the (non-withdrawable) bonus wallet, and live trading accounts. Bonus is a
 * source only and lands in a trading account as credit.
 */
export default function InternalTransferPanel() {
  const [accounts, setAccounts] = useState<LiveAccount[]>([]);
  const [mainWalletBalance, setMainWalletBalance] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const [uniFrom, setUniFrom] = useState('wallet');
  const [uniTo, setUniTo] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [accRes, sum] = await Promise.all([
        api.get<unknown>('/accounts').catch(() => ({ items: [] })),
        api.get<{ main_wallet_balance?: number; bonus_balance?: number }>('/wallet/summary')
          .catch(() => ({} as { main_wallet_balance?: number; bonus_balance?: number })),
      ]);
      const raw = (Array.isArray(accRes) ? accRes : (accRes as { items?: unknown[] })?.items ?? []) as Record<string, unknown>[];
      const live = raw
        .map((a) => ({
          id: String(a.id),
          account_number: String(a.account_number ?? ''),
          group_name: String((a.account_group as { name?: string })?.name ?? 'Live'),
          free_margin: Number(a.free_margin ?? a.balance ?? 0),
          balance: Number(a.balance ?? 0),
          is_demo: Boolean(a.is_demo),
        }))
        .filter((a) => !a.is_demo);
      setAccounts(live);
      setMainWalletBalance(Number(sum.main_wallet_balance) || 0);
      setBonusBalance(Number(sum.bonus_balance) || 0);
      // Default destination = first live account.
      setUniTo((prev) => prev || live[0]?.id || '');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const options = useMemo(() => {
    const opts: Array<{ id: string; label: string; sublabel: string; balance: number }> = [
      { id: 'wallet', label: 'Main Wallet', sublabel: 'Wallet', balance: mainWalletBalance },
      { id: 'bonus', label: 'Bonus Wallet', sublabel: 'Credit only · not withdrawable', balance: bonusBalance },
    ];
    for (const a of accounts) {
      opts.push({ id: a.id, label: `#${a.account_number}`, sublabel: a.group_name, balance: a.free_margin });
    }
    return opts;
  }, [accounts, mainWalletBalance, bonusBalance]);

  const fromBalance = useMemo(() => {
    if (uniFrom === 'wallet') return mainWalletBalance;
    if (uniFrom === 'bonus') return bonusBalance;
    return accounts.find((a) => a.id === uniFrom)?.free_margin ?? 0;
  }, [uniFrom, mainWalletBalance, bonusBalance, accounts]);

  const swap = () => { setUniFrom(uniTo); setUniTo(uniFrom); };

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    const from = uniFrom || 'wallet';
    const to = uniTo || options.find((o) => o.id !== from && o.id !== 'bonus')?.id || '';
    if (from === to) { toast.error('Select different source and destination'); return; }
    if (from === 'bonus' && (to === 'wallet' || to === 'bonus' || !isUuid(to))) {
      toast.error('Bonus can only be moved into a trading account'); return;
    }
    if (from !== 'wallet' && from !== 'bonus' && !isUuid(from)) { toast.error('Select a valid source'); return; }
    if (to !== 'wallet' && !isUuid(to)) { toast.error('Select a valid destination'); return; }
    if (amt > fromBalance + 1e-9) { toast.error('Insufficient balance'); return; }

    setSubmitting(true);
    try {
      if (from === 'bonus') {
        await api.post('/wallet/transfer-bonus-to-trading', { to_account_id: to, amount: amt });
        toast.success(`Moved ${fmt(amt)} bonus as credit`);
      } else if (from === 'wallet') {
        await api.post('/wallet/transfer-main-to-trading', { to_account_id: to, amount: amt });
        toast.success(`Sent ${fmt(amt)} to account`);
      } else if (to === 'wallet') {
        await api.post('/wallet/transfer-trading-to-main', { from_account_id: from, amount: amt });
        toast.success(`Moved ${fmt(amt)} to your wallet`);
      } else {
        await api.post('/wallet/transfer-internal', { from_account_id: from, to_account_id: to, amount: amt });
        toast.success(`Moved ${fmt(amt)}`);
      }
      setAmount('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  const toOptions = options.filter((o) => o.id !== uniFrom && o.id !== 'bonus' && !(uniFrom === 'bonus' && o.id === 'wallet'));
  const fromOpt = options.find((o) => o.id === uniFrom);
  const toOpt = options.find((o) => o.id === uniTo);

  const setFrom = (v: string) => {
    setUniFrom(v);
    if (v === 'bonus') {
      if (uniTo === 'wallet' || uniTo === 'bonus' || !uniTo) { const a = accounts[0]; if (a) setUniTo(a.id); }
    } else if (uniTo === v) {
      const alt = options.find((o) => o.id !== v && o.id !== 'bonus');
      if (alt) setUniTo(alt.id);
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-accent/25 p-5 sm:p-6"
      style={{ background: 'radial-gradient(120% 90% at 85% -10%, rgba(204,255,0,0.10), transparent 55%), var(--bg-card)' }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" aria-hidden />
      <div className="relative flex items-start gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #eaff8a, #ccff00 60%, #a6d600)', color: '#0a0a0a', boxShadow: '0 8px 22px rgba(204,255,0,0.35)' }}>
          <ArrowLeftRight size={22} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-text-primary tracking-tight sm:text-2xl">Internal Transfer</h1>
          <p className="text-sm text-text-secondary mt-1">Move funds instantly between your wallets and live trading accounts.</p>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-text-secondary">Loading…</div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-secondary bg-bg-base px-5 py-10 text-center text-sm text-text-secondary">
          No live trading accounts yet. Open one to deposit and transfer.
        </div>
      ) : (
        <div className="space-y-4">
          {/* FROM */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/50">From</p>
            <select value={uniFrom} onChange={(e) => setFrom(e.target.value)} className="accounts-native-select w-full px-4 py-3 rounded-xl text-sm font-semibold">
              {options.map((o) => (
                <option key={o.id} value={o.id} disabled={o.id === uniTo}>{o.label} — {o.sublabel} — {fmt(o.balance)}</option>
              ))}
            </select>
            {fromOpt && (
              <div className="rounded-xl border border-accent/35 bg-bg-base p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ccff00]/12 flex items-center justify-center text-[#ccff00] shrink-0">
                  {uniFrom === 'wallet' ? <Wallet size={20} /> : uniFrom === 'bonus' ? <Gift size={20} /> : <Landmark size={20} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-text-primary">{fromOpt.label}</div>
                  <div className="text-[10px] uppercase tracking-wide text-text-tertiary font-semibold mt-0.5">{fromOpt.sublabel}</div>
                </div>
                <div className="text-xl font-bold text-accent tabular-nums font-mono shrink-0">{fmt(fromOpt.balance)}</div>
              </div>
            )}
          </div>

          {/* SWAP */}
          <div className="flex justify-center">
            <button type="button" onClick={swap} title="Swap direction"
              className="group w-10 h-10 rounded-full border border-accent/30 bg-bg-base flex items-center justify-center text-accent/80 hover:bg-accent/10 hover:border-accent/60 transition-all active:scale-95">
              <ArrowLeftRight size={16} className="rotate-90 group-hover:scale-110 transition-transform" />
            </button>
          </div>

          {/* TO */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-text-tertiary">To</p>
            <select value={uniTo} onChange={(e) => setUniTo(e.target.value)} className="accounts-native-select w-full px-4 py-3 rounded-xl text-sm font-semibold">
              {toOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label} — {o.sublabel} — {fmt(o.balance)}</option>
              ))}
            </select>
            {toOpt && (
              <div className="rounded-xl border border-border-primary bg-bg-base p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ccff00]/12 flex items-center justify-center text-[#ccff00] shrink-0">
                  {uniTo === 'wallet' ? <Wallet size={20} /> : <Landmark size={20} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-text-primary">{toOpt.label}</div>
                  <div className="text-[10px] uppercase tracking-wide text-text-tertiary font-semibold mt-0.5">{toOpt.sublabel}</div>
                </div>
                <div className="text-lg font-bold text-text-primary tabular-nums font-mono shrink-0">{fmt(toOpt.balance)}</div>
              </div>
            )}
          </div>

          {/* AMOUNT */}
          <div className="pt-3 space-y-2 border-t border-border-primary">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-medium text-text-primary">Amount</label>
              <button type="button" onClick={() => setAmount(fromBalance > 0 ? fromBalance.toFixed(2) : '')} disabled={fromBalance <= 0}
                className="text-sm font-bold text-[#ccff00] hover:underline disabled:opacity-40 disabled:pointer-events-none">
                Max: {fmt(fromBalance)}
              </button>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-text-tertiary">$</span>
              <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                className="w-full pl-9 pr-4 py-4 rounded-xl border border-border-primary bg-bg-base font-mono font-bold text-text-primary text-xl placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/50" />
            </div>
            <div className="flex gap-2 pt-1">
              {[0.25, 0.5, 0.75, 1].map((f) => (
                <button key={f} type="button" disabled={fromBalance <= 0} onClick={() => setAmount((fromBalance * f).toFixed(2))}
                  className="flex-1 rounded-lg border border-accent/25 bg-accent/[0.06] py-2 text-xs font-bold text-accent transition-colors hover:bg-accent/15 disabled:opacity-40 disabled:pointer-events-none">
                  {f === 1 ? 'Max' : `${f * 100}%`}
                </button>
              ))}
            </div>
          </div>

          {amount.trim() && Number(amount) > 0 && uniFrom !== uniTo && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-accent/20 bg-accent/[0.05] px-4 py-3 text-center text-xs text-text-secondary">
              <span>Transferring</span>
              <span className="font-bold text-accent tabular-nums">{fmt(Number(amount) || 0)}</span>
              <span>— arrives instantly</span>
            </div>
          )}

          <button type="button" onClick={submit}
            disabled={submitting || !amount.trim() || fromBalance <= 0 || uniFrom === uniTo}
            className="w-full py-4 rounded-xl text-base font-extrabold disabled:opacity-45 disabled:pointer-events-none transition-transform hover:brightness-105 active:scale-[0.99] flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(90deg, #eaff8a, #ccff00)', color: '#0a0a0a', boxShadow: '0 10px 28px rgba(204,255,0,0.30)' }}>
            <ArrowLeftRight size={20} />
            {submitting ? 'Transferring…' : 'Transfer'}
          </button>
        </div>
      )}
    </div>
  );
}
