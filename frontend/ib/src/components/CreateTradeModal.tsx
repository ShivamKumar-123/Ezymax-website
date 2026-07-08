'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { X, Search, Loader2, AlertTriangle, ChevronDown } from 'lucide-react';
import { ibGet, ibPost, fmt, UnauthorizedError } from '@/lib/api';
import type { TradingAccount } from '@/lib/types';

export interface OverviewUser {
  user: { id: string; name: string; email: string };
  accounts: TradingAccount[];
}

interface Instrument { symbol: string; display_name?: string; segment?: string; }

/**
 * Create-Trade modal — mirrors the admin dealing-desk "Create Trade" form, but
 * scoped to the IB's referred users. User + Symbol are comboboxes (click to see
 * the full list, or type to filter). Opens a trade on the chosen follower's
 * account via POST /ib/trade/order; the trade shows up as the user's own so it
 * appears in their portfolio the next time they log in.
 */
export default function CreateTradeModal({
  users,
  presetUser,
  presetAccountId,
  onClose,
  onCreated,
}: {
  users: OverviewUser[];
  presetUser?: OverviewUser | null;
  presetAccountId?: string | null;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [selected, setSelected] = useState<OverviewUser | null>(presetUser || null);
  const [userSearch, setUserSearch] = useState('');
  const [userOpen, setUserOpen] = useState(false);
  const [accountId, setAccountId] = useState(presetAccountId || presetUser?.accounts?.[0]?.id || '');

  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [symbol, setSymbol] = useState('');
  const [symbolOpen, setSymbolOpen] = useState(false);

  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [lots, setLots] = useState('0.01');
  const [price, setPrice] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const userBlur = useRef<any>(null);
  const symBlur = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await ibGet<Instrument[]>('/instruments/');
        if (Array.isArray(list)) setInstruments(list);
      } catch { /* symbol still free-typeable */ }
    })();
  }, []);

  const userResults = useMemo(() => {
    const s = userSearch.trim().toLowerCase();
    const base = s ? users.filter((u) => u.user.name.toLowerCase().includes(s) || u.user.email.toLowerCase().includes(s)) : users;
    return base.slice(0, 50);
  }, [users, userSearch]);

  const symbolResults = useMemo(() => {
    const s = symbol.trim().toLowerCase();
    const base = s
      ? instruments.filter((i) => i.symbol.toLowerCase().includes(s) || (i.display_name || '').toLowerCase().includes(s))
      : instruments;
    return base.slice(0, 60);
  }, [instruments, symbol]);

  const pickUser = (u: OverviewUser) => {
    setSelected(u);
    setUserSearch('');
    setUserOpen(false);
    setAccountId(u.accounts?.[0]?.id || '');
  };

  const submit = async () => {
    if (!selected) return toast.error('Select a user');
    if (!accountId) return toast.error('Select an account');
    if (!symbol.trim()) return toast.error('Enter a symbol');
    if (!lots || parseFloat(lots) <= 0) return toast.error('Enter valid lots');
    if (orderType !== 'market' && (!price || parseFloat(price) <= 0)) return toast.error('Price required for non-market orders');
    if (!reason.trim()) return toast.error('Reason is required');

    setSubmitting(true);
    try {
      await ibPost(`/business/ib/trade/order?reason=${encodeURIComponent(reason.trim())}`, {
        account_id: accountId,
        symbol: symbol.toUpperCase().trim(),
        side,
        order_type: orderType,
        lots: parseFloat(lots),
        price: orderType !== 'market' && price ? parseFloat(price) : null,
        stop_loss: sl ? parseFloat(sl) : null,
        take_profit: tp ? parseFloat(tp) : null,
      });
      toast.success(`${side.toUpperCase()} ${lots} ${symbol.toUpperCase()} created for ${selected.user.name}`);
      onCreated?.();
      onClose();
    } catch (e: any) {
      if (e instanceof UnauthorizedError) return toast.error('Session expired — please sign in again.');
      toast.error(e?.message || 'Failed to create trade');
    } finally {
      setSubmitting(false);
    }
  };

  const field = 'w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2.5 text-xs text-text-primary outline-none focus:border-accent/50 placeholder:text-text-tertiary';
  const lbl = 'mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-text-tertiary';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border-primary bg-card noise-texture shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-primary px-5 py-3.5">
          <h3 className="text-base font-bold text-text-primary">Create Trade</h3>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary"><X size={18} /></button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-5">
          {/* Warning */}
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-warning/25 bg-warning/10 px-3.5 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-xs text-warning">This trade will appear as the user&apos;s own trade — it shows in their portfolio when they log in.</p>
          </div>

          {/* User combobox */}
          <div className="mb-4">
            <label className={lbl}>User <span className="text-danger">*</span></label>
            {selected && presetUser ? (
              <div className="flex items-center justify-between rounded-lg border border-border-primary bg-bg-secondary px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-text-primary">{selected.user.name}</p>
                  <p className="truncate text-[11px] text-text-tertiary">{selected.user.email}</p>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  value={userOpen ? userSearch : selected ? `${selected.user.name} · ${selected.user.email}` : userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setUserOpen(true); }}
                  onFocus={() => { clearTimeout(userBlur.current); setUserSearch(''); setUserOpen(true); }}
                  onBlur={() => { userBlur.current = setTimeout(() => setUserOpen(false), 150); }}
                  placeholder="Click to pick or type email / name…"
                  className={clsx(field, 'pl-9 pr-8')}
                />
                <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                {userOpen && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-lg border border-border-primary bg-card shadow-xl">
                    {userResults.length === 0 ? (
                      <p className="px-3 py-3 text-[11px] text-text-tertiary">No matching followers.</p>
                    ) : userResults.map((u) => (
                      <button
                        key={u.user.id}
                        onMouseDown={(e) => { e.preventDefault(); pickUser(u); }}
                        className="block w-full border-b border-border-primary/50 px-3 py-2.5 text-left last:border-0 hover:bg-bg-hover/40"
                      >
                        <p className="text-xs font-medium text-text-primary">{u.user.name}</p>
                        <p className="text-[11px] text-text-tertiary">{u.user.email} · {u.accounts.length} account(s)</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Account */}
          {selected && (
            <div className="mb-4">
              <label className={lbl}>Trading account <span className="text-danger">*</span></label>
              <div className="relative">
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={clsx(field, 'appearance-none pr-8')}>
                  <option value="">Select account</option>
                  {selected.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_number} — ${fmt(a.balance)} {a.currency}{a.is_demo ? ' · Demo' : ' · Live'}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              </div>
            </div>
          )}

          {/* Symbol combobox + Lots */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Symbol <span className="text-danger">*</span></label>
              <div className="relative">
                <input
                  value={symbol}
                  onChange={(e) => { setSymbol(e.target.value.toUpperCase()); setSymbolOpen(true); }}
                  onFocus={() => { clearTimeout(symBlur.current); setSymbolOpen(true); }}
                  onBlur={() => { symBlur.current = setTimeout(() => setSymbolOpen(false), 150); }}
                  placeholder="Pick or type — EURUSD"
                  className={clsx(field, 'pr-8 font-medium uppercase')}
                />
                <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                {symbolOpen && symbolResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-lg border border-border-primary bg-card shadow-xl">
                    {symbolResults.map((i) => (
                      <button
                        key={i.symbol}
                        onMouseDown={(e) => { e.preventDefault(); setSymbol(i.symbol); setSymbolOpen(false); }}
                        className="flex w-full items-center justify-between gap-2 border-b border-border-primary/50 px-3 py-2 text-left last:border-0 hover:bg-bg-hover/40"
                      >
                        <span className="text-xs font-medium text-text-primary">{i.symbol}</span>
                        <span className="truncate text-[10px] text-text-tertiary">{i.display_name || i.segment}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className={lbl}>Lots <span className="text-danger">*</span></label>
              <input type="number" step="0.01" min="0.01" value={lots} onChange={(e) => setLots(e.target.value)} className={clsx(field, 'font-mono')} />
            </div>
          </div>

          {/* Side */}
          <div className="mb-4">
            <label className={lbl}>Side <span className="text-danger">*</span></label>
            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => setSide('buy')} className={clsx('rounded-lg border-2 py-2.5 text-sm font-bold transition-colors', side === 'buy' ? 'border-success bg-success/15 text-success' : 'border-border-primary text-text-secondary hover:border-border-secondary')}>BUY</button>
              <button onClick={() => setSide('sell')} className={clsx('rounded-lg border-2 py-2.5 text-sm font-bold transition-colors', side === 'sell' ? 'border-danger bg-danger/15 text-danger' : 'border-border-primary text-text-secondary hover:border-border-secondary')}>SELL</button>
            </div>
          </div>

          {/* Order type */}
          <div className="mb-4">
            <label className={lbl}>Order type <span className="text-danger">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {(['market', 'limit', 'stop'] as const).map((t) => (
                <button key={t} onClick={() => setOrderType(t)} className={clsx('rounded-lg border py-2.5 text-xs font-medium capitalize transition-colors', orderType === t ? 'border-accent/40 bg-accent/15 text-accent' : 'border-border-primary text-text-secondary hover:border-border-secondary')}>{t}</button>
              ))}
            </div>
          </div>

          {/* Price */}
          {orderType !== 'market' && (
            <div className="mb-4">
              <label className={lbl}>Price <span className="text-danger">*</span></label>
              <input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00000" className={clsx(field, 'font-mono')} />
            </div>
          )}

          {/* SL / TP */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Stop loss</label>
              <input type="number" step="any" value={sl} onChange={(e) => setSl(e.target.value)} placeholder="Optional" className={clsx(field, 'font-mono')} />
            </div>
            <div>
              <label className={lbl}>Take profit</label>
              <input type="number" step="any" value={tp} onChange={(e) => setTp(e.target.value)} placeholder="Optional" className={clsx(field, 'font-mono')} />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className={lbl}>Reason <span className="text-danger">*</span></label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Required — why this trade is being created" className={clsx(field, 'resize-none')} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border-primary px-5 py-3.5">
          <button onClick={onClose} className="rounded-lg border border-border-primary px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-bg-hover">Cancel</button>
          <button onClick={submit} disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-success px-5 py-2 text-xs font-bold text-black hover:brightness-110 disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null} Create Trade
          </button>
        </div>
      </div>
    </div>
  );
}
