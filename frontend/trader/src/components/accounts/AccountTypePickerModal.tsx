'use client';

import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Crown, Gauge, Loader2, Rocket, X, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';

/** Cool icon per account-type card, cycled by index. */
const GROUP_ICONS = [Gauge, Zap, Crown, Rocket];

export interface AvailableAccountGroup {
  id: string;
  name: string;
  description: string;
  leverage_default: number;
  /** Hard cap from migration 0020 — falls back to leverage_default for legacy rows. */
  max_leverage?: number;
  /** Per-user effective ceiling: the smaller of group cap, KYC gate (1:50 until verified),
   *  and XP gate (Starter 1:50 → Active 1:100 → Skilled 1:200 → Pro 1:300 → Elite 1:500). */
  effective_max_leverage?: number;
  /** UI hints for why the dropdown is locked below the group's hard cap. */
  kyc_unlock_required?: boolean;
  xp_unlock_required?: boolean;
  xp_for_next_unlock?: number | null;
  next_unlock_leverage?: number | null;
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

  // The user-effective cap is what actually limits the dropdown — it's the
  // smaller of the group's hard cap (max_leverage), the KYC gate, and the
  // XP gate. Falls back to leverage_default for legacy rows.
  const groupMaxLeverage = (g: AvailableAccountGroup) =>
    Number(g.effective_max_leverage ?? g.max_leverage ?? g.leverage_default ?? 100);

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

  /* Escape closes the panel. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[84] cursor-default"
            style={{ background: 'rgba(2, 6, 12, 0.4)', backdropFilter: 'blur(2px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.aside
            aria-label="Open a new account"
            className="fixed right-0 top-0 z-[85] flex h-full w-[440px] max-w-[94vw] flex-col"
            style={{
              background: 'var(--bg-glass)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              borderLeft: '1px solid var(--border-glass-bright)',
            }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          >
            <div className="flex items-center justify-between border-b border-border-primary px-5 py-4">
              <span className="text-sm font-bold text-text-primary">Open a new account</span>
              <motion.button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="rounded-lg p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                whileHover={{ rotate: 90 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              >
                <X size={16} />
              </motion.button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
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
            <div className="flex flex-col gap-3">
              {groups.map((g, i) => {
                const sel = selectedId === g.id;
                const stocks = /stock/i.test(g.name + ' ' + g.description);
                const Icon = GROUP_ICONS[i % GROUP_ICONS.length];
                return (
                  <motion.button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedId(g.id)}
                    initial={{ x: 40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.06 + i * 0.07, type: 'spring', stiffness: 260, damping: 24 }}
                    className={clsx(
                      'group relative text-left rounded-xl p-4 transition-all',
                      sel ? 'ring-2 ring-[#ccff00]/60' : '',
                    )}
                    style={{
                      background: 'var(--bg-card-nested)',
                      border: `1px solid ${sel ? '#ccff00' : 'var(--border-primary)'}`,
                    }}
                  >
                    {stocks && <Badge color="#f59e0b">Trading on stocks</Badge>}

                    <div className="mb-3 flex items-center gap-3">
                      <motion.div
                        className="flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{
                          background: 'rgba(204,255,0,0.12)',
                          color: '#ccff00',
                          border: '1px solid rgba(204,255,0,0.3)',
                        }}
                        whileHover={{ scale: 1.15, rotate: 8 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 15 }}
                      >
                        <Icon size={18} />
                      </motion.div>
                      <div>
                        <p className="text-sm font-bold text-text-primary leading-tight">
                          {g.name || 'Standard account'}
                        </p>
                        <p className="text-xs text-text-tertiary mt-0.5 leading-snug">
                          {g.description || 'Currencies, indices, metals, energies, crypto'}
                        </p>
                      </div>
                      {sel && (
                        <span
                          className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: 'rgba(204,255,0,0.16)', color: '#ccff00' }}
                        >
                          Selected
                        </span>
                      )}
                    </div>

                    <CardRow label={`Spread from ${(g.spread_markup || 0.6).toFixed(1)} pips`}
                             sub="Floating spread, markup" />
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
                  </motion.button>
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
            <div className="mt-2 space-y-1">
              <p className="text-xs text-text-tertiary">
                Capped at this account type&apos;s maximum: 1:{groupMaxLeverage(selected)}
              </p>
              {(selected.kyc_unlock_required || selected.xp_unlock_required) && (
                <p className="text-xs text-amber-400/85">
                  {selected.kyc_unlock_required && 'Complete KYC to unlock higher leverage. '}
                  {selected.xp_unlock_required && selected.xp_for_next_unlock && selected.next_unlock_leverage
                    ? `Reach ${selected.xp_for_next_unlock} XP to unlock 1:${selected.next_unlock_leverage}.`
                    : ''}
                </p>
              )}
            </div>
          )}
        </Section>

            </div>

            {/* Sticky action footer */}
            <div className="border-t border-border-primary p-4">
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !selected}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-bold transition-all disabled:opacity-50"
                style={{ background: '#ccff00', color: '#1a1408' }}
              >
                {creating && <Loader2 size={14} className="animate-spin" />}
                Create account
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
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
        background: active ? '#ccff00' : 'transparent',
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
