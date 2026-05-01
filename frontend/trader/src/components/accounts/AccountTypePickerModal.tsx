'use client';

import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';

export interface AvailableAccountGroup {
  id: string;
  name: string;
  description: string;
  leverage_default: number;
  /** Hard cap from migration 0020 — falls back to leverage_default for legacy rows. */
  max_leverage?: number;
  minimum_deposit: number;
  spread_markup: number;
  commission_per_lot: number;
  /** Percentage brokerage fee (e.g. 0.0006 = 0.06%) from migration 0020. May be null on legacy rows. */
  commission_pct?: number | null;
  swap_free: boolean;
}

const fmtMoney = (n: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 })
    .format(n);

/** Generic candidate leverages — filtered to <= each group's max. */
const LEVERAGE_OPTIONS = [1, 25, 50, 100, 200, 300, 500, 1000, 2000];

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (accountId: string) => void;
};

export default function AccountTypePickerModal({ open, onClose, onCreated }: Props) {
  const user = useAuthStore((s) => s.user);
  const userIsDemo = !!user?.is_demo;

  const [groups, setGroups] = useState<AvailableAccountGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leverage, setLeverage] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setLeverage(null);
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await api.get<{ items: AvailableAccountGroup[] }>('/accounts/available-groups');
        if (cancelled) return;
        const list = Array.isArray(res.items) ? res.items : [];
        setGroups(list);
        if (list.length > 0) {
          setSelectedId(list[0].id);
          setLeverage(list[0].leverage_default);
        }
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Could not load account types');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const selected = useMemo(
    () => groups.find((g) => g.id === selectedId) || null,
    [groups, selectedId],
  );

  // The hard cap is `max_leverage`; fall back to `leverage_default` so legacy
  // rows (pre-migration-0020) still work.
  const groupMaxLeverage = (g: AvailableAccountGroup) =>
    Number(g.max_leverage ?? g.leverage_default ?? 100);

  /** When the user picks a different group, clamp leverage to its max. */
  useEffect(() => {
    if (!selected) return;
    const maxLev = groupMaxLeverage(selected);
    if (leverage == null || leverage > maxLev) {
      setLeverage(maxLev);
    }
  }, [selected]);

  const leverageOptions = useMemo(() => {
    if (!selected) return [] as number[];
    const max = groupMaxLeverage(selected);
    const opts = LEVERAGE_OPTIONS.filter((l) => l <= max);
    if (!opts.includes(max)) opts.push(max);
    return Array.from(new Set(opts)).sort((a, b) => a - b);
  }, [selected]);

  const handleCreate = async () => {
    if (!selected) {
      toast.error('Select an account type');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post<{ id: string; account_number: string }>('/accounts/open', {
        account_group_id: selected.id,
        leverage: leverage ?? selected.leverage_default,
      });
      toast.success('Trading account created');
      onClose();
      if (res?.id) {
        try { sessionStorage.setItem('ptd-accounts-expand', res.id); } catch {}
        onCreated?.(res.id);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'KYC_REQUIRED') {
        toast.error('Please complete KYC verification before opening a live account.');
        onClose();
      } else {
        toast.error(msg || 'Could not open account');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Set up account details"
      width="2xl"
      className="border border-border-primary bg-bg-card max-h-[92vh] flex flex-col shadow-2xl"
      headerClassName="border-b border-border-primary bg-bg-card [&_h3]:text-text-primary"
      bodyClassName="bg-bg-card p-5 sm:p-6"
    >
      <div className="space-y-6">
        {/* Account-type segmented toggle */}
        <Section label="Account type">
          <div className="inline-flex p-1 rounded-lg" style={{ background: 'var(--bg-card-nested)', border: '1px solid var(--border-primary)' }}>
            <TypePill active={!userIsDemo} disabled={userIsDemo} label="Real" />
            <TypePill active={userIsDemo} disabled={!userIsDemo} label="Demo" />
          </div>
          {userIsDemo && (
            <p className="mt-2 text-xs text-text-tertiary">
              Demo users can only open demo accounts. Sign up for a real account to trade live.
            </p>
          )}
        </Section>

        {/* Platform / account-group cards */}
        <Section label="Platform">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-text-secondary text-sm gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading account types…
            </div>
          ) : groups.length === 0 ? (
            <div
              className="rounded-xl border p-8 text-center text-sm text-text-secondary"
              style={{ background: 'var(--bg-card-nested)', borderColor: 'var(--border-primary)' }}
            >
              No account types are available yet. Please contact support.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {groups.map((g, i) => {
                const sel = selectedId === g.id;
                const stocks = /stock/i.test(g.name + ' ' + g.description);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedId(g.id)}
                    className={clsx(
                      'relative text-left rounded-xl p-4 transition-all',
                      sel ? 'ring-2 ring-[#d6a93d]/60' : '',
                    )}
                    style={{
                      background: 'var(--bg-card-nested)',
                      border: `1px solid ${sel ? '#d6a93d' : 'var(--border-primary)'}`,
                    }}
                  >
                    {stocks && <Badge color="#f59e0b">Trading on stocks</Badge>}

                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm mb-3"
                      style={{
                        background: 'rgba(214,169,61,0.12)',
                        color: '#d6a93d',
                        border: '1px solid rgba(214,169,61,0.3)',
                      }}
                    >
                      {i + 1}
                    </div>

                    <CardRow label={`Spread from ${(g.spread_markup || 0.6).toFixed(1)} pips`}
                             sub="Floating spread, markup" />
                    <CardRow label={g.name || 'Standard account'}
                             sub={g.description || 'Currencies, indices, metals, energies, crypto'} />
                    <CardRow
                      label={`Min deposit ${fmtMoney(g.minimum_deposit || 0)}`}
                      sub={
                        g.swap_free
                          ? 'Swap-free, Islamic-friendly'
                          : g.commission_pct != null
                            ? `Brokerage ${(g.commission_pct * 100).toFixed(2)}% · Up to 1:${groupMaxLeverage(g)}`
                            : `Commission ${fmtMoney(g.commission_per_lot || 0)} / lot · Up to 1:${groupMaxLeverage(g)}`
                      }
                      last
                    />
                  </button>
                );
              })}
            </div>
          )}
        </Section>

        {/* Leverage */}
        <Section label="Leverage">
          <div className="relative inline-block w-full sm:w-72">
            <select
              value={leverage ?? ''}
              onChange={(e) => setLeverage(Number(e.target.value))}
              disabled={!selected || leverageOptions.length === 0}
              className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-lg text-sm font-semibold bg-bg-card-nested text-text-primary disabled:opacity-50"
              style={{ border: '1px solid var(--border-primary)' }}
            >
              {leverageOptions.map((l) => (
                <option key={l} value={l}>1:{l}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          </div>
          {selected && (
            <p className="mt-2 text-xs text-text-tertiary">
              Capped at this account type&apos;s maximum: 1:{groupMaxLeverage(selected)}
            </p>
          )}
        </Section>

        {/* Action */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !selected}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold disabled:opacity-50 transition-all"
            style={{ background: '#d6a93d', color: '#1a1408' }}
          >
            {creating && <Loader2 size={14} className="animate-spin" />}
            Create account
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────── Tiny UI atoms ───────────── */

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-text-primary mb-2">{label}</h3>
      {children}
    </div>
  );
}

function TypePill({ active, disabled, label }: { active: boolean; disabled: boolean; label: string }) {
  return (
    <span
      className="px-4 py-1.5 text-sm font-semibold rounded-md transition-colors select-none"
      style={{
        background: active ? '#d6a93d' : 'transparent',
        color: active ? '#1a1408' : 'var(--text-secondary)',
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'default',
      }}
    >
      {label}
    </span>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{
        background: `${color}26`,
        color,
        border: `1px solid ${color}55`,
      }}
    >
      {children}
    </span>
  );
}

function CardRow({ label, sub, last }: { label: string; sub: string; last?: boolean }) {
  return (
    <div
      className={clsx('py-2', !last && 'border-b')}
      style={{ borderColor: 'var(--border-primary)' }}
    >
      <p className="text-sm font-semibold text-text-primary leading-tight">{label}</p>
      <p className="text-xs text-text-tertiary mt-0.5 leading-snug">{sub}</p>
    </div>
  );
}
