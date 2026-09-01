'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';
import { useWarmTheme } from '@/stores/warmThemeStore';

export interface AvailableAccountGroup {
  id: string;
  name: string;
  description: string;
  leverage_default: number;
  /** Hard cap from migration 0020 — falls back to leverage_default for legacy rows. */
  max_leverage?: number;
  /** Per-user effective ceiling: the smaller of group cap and KYC gate
   *  (1:50 until verified). */
  effective_max_leverage?: number;
  /** UI hints for why the dropdown is locked below the group's hard cap. */
  kyc_unlock_required?: boolean;
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

/**
 * AccountTypePickerModal — right-side slide-in drawer.
 *
 * Previously a centred modal that capped at max-w-5xl, the picker now
 * matches the Vantage / OctaFX-style "Open Account" drawer that anchors
 * to the right edge of the viewport: full-height panel, content sections
 * stacked vertically, sticky Submit at the bottom. The data model and
 * create flow are unchanged.
 */
export default function AccountTypePickerModal({ open, onClose, onCreated }: Props) {
  const user = useAuthStore((s) => s.user);
  const userIsDemo = !!user?.is_demo;
  // This drawer is portaled straight to document.body (below), so it is a
  // DOM SIBLING of DashboardShell, not a descendant — it does not inherit
  // DashboardShell's `.theme-warm` / `.theme-warm-dark` CSS variables just
  // by being opened from a warm-themed page. It has to read the same warm
  // dark/light toggle (AppNavbar's sun/moon) and apply the classes itself.
  const warmDark = useWarmTheme((s) => s.dark);

  const [mounted, setMounted] = useState(false);
  const [groups, setGroups] = useState<AvailableAccountGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leverage, setLeverage] = useState<number | null>(null);
  // Real users can open either a real or a demo (practice) account.
  // Demo users are locked to demo. Default tracks the user's own status.
  const [requestedType, setRequestedType] = useState<'real' | 'demo'>(
    userIsDemo ? 'demo' : 'real',
  );

  useEffect(() => { setMounted(true); }, []);

  // Body scroll lock + Escape-to-close while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setLeverage(null);
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const url = `/accounts/available-groups?type=${requestedType}`;
        const res = await api.get<{ items: AvailableAccountGroup[] }>(url);
        if (cancelled) return;
        const list = Array.isArray(res.items) ? res.items : [];
        setGroups(list);
        if (list.length > 0) {
          setSelectedId(list[0]!.id);
          setLeverage(list[0]!.leverage_default);
        }
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Could not load account types');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, requestedType]);

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
        is_demo: requestedType === 'demo',
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

  if (!mounted) return null;

  return createPortal(
    // The outer fixed wrapper stays mounted across open/close so the
    // slide animation has something to animate against. `pointer-events-
    // none` while closed lets clicks pass through to the underlying
    // page — without it, the invisible overlay swallowed every click
    // including the "Open Account" trigger that's supposed to reopen
    // this drawer.
    <div
      // Re-declares the warm theme scope on the portal's own root, mirroring
      // DashboardShell exactly (`data-theme="warm"` constant + `.theme-warm`
      // always, `.theme-warm-dark` only when toggled dark) — NOT "light"/
      // "dark" as the attribute value, which would instead match globals.css's
      // unrelated BASE `[data-theme="light"]` / `[data-theme="dark"]` rules.
      // Without this the drawer's `bg-bg-card` / `text-text-primary` / …
      // utilities silently fell back to <body>'s base-site theme (pinned to
      // `.theme-light` forever — dark mode was removed from that separate,
      // unrelated toggle) instead of the warm dark/light the page is on.
      data-theme="warm"
      className={clsx(
        'theme-warm font-crextio',
        warmDark && 'theme-warm-dark',
        // Bumped above the AppNavbar (sticky z-50) and the support FAB
        // (z-75). Without this the navbar's backdrop-blur stacking
        // context bled through the top of the drawer.
        'fixed inset-0 z-[9999]',
        !open && 'pointer-events-none',
      )}
      aria-hidden={!open}
    >
      {/* Backdrop. Fades in/out so the drawer slide doesn't feel detached. */}
      <div
        className={clsx(
          'absolute inset-0 bg-black/45 backdrop-blur-[2px]',
          'transition-opacity duration-300 ease-out',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      {/* Panel — slides in from the right. transform-translate keeps the
          panel mounted across open/close so React state survives a close-
          and-reopen, while the body-scroll-lock effect only runs while
          `open` is true. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Open account"
        // NOT --bg-card: the warm theme defines that as translucent glass
        // (4.5% white in dark mode), which let the whole page bleed through
        // the drawer. --bg-secondary is fully opaque in both warm themes —
        // the fallback keeps the panel solid even if the token is missing.
        style={{ background: 'var(--bg-secondary, #111111)' }}
        className={clsx(
          'absolute top-0 right-0 h-full w-full sm:max-w-[640px] border-l border-border-primary shadow-2xl',
          'flex flex-col transform transition-transform duration-[420ms]',
          '[transition-timing-function:cubic-bezier(0.22,1,0.36,1)]',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Sticky header with title + close. */}
        <header className="relative flex items-center justify-between px-6 sm:px-8 py-5 border-b border-border-primary shrink-0">
          {/* Brand hairline across the top edge of the panel. */}
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-[3px]"
            style={{ background: 'linear-gradient(90deg, #E94E1B 0%, #F59E0B 55%, rgba(233,78,27,0) 100%)' }}
          />
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Open Account</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 -m-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-hover
                       transition-all duration-200 hover:rotate-90 active:scale-90"
          >
            <X size={20} />
          </button>
        </header>

        {/* Scrollable content area. */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-7">
          {/* Live / Demo toggle — large pill row, occupies the full width
              like the Vantage drawer rather than a small inline segmented
              control. */}
          <div
            className="relative grid grid-cols-2 p-1 rounded-full motion-safe:animate-drawer-section"
            style={{ background: 'var(--bg-card-nested)', border: '1px solid var(--border-primary)' }}
          >
            {/* The active pill is one element that slides, so the change
                reads as movement rather than two backgrounds blinking. */}
            <span
              aria-hidden
              className="absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-full
                         transition-transform duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
              style={{
                background: 'var(--bg-card)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
                transform: requestedType === 'demo' ? 'translateX(100%)' : 'translateX(0)',
              }}
            />
            <TypePill
              active={requestedType === 'real'}
              disabled={userIsDemo}
              label="Live Account"
              onClick={() => setRequestedType('real')}
            />
            <TypePill
              active={requestedType === 'demo'}
              disabled={false}
              label="Demo Account"
              onClick={() => setRequestedType('demo')}
            />
          </div>
          {userIsDemo && (
            <p className="-mt-3 text-xs text-text-tertiary">
              Demo users can only open demo accounts. Sign up for a real account to trade live.
            </p>
          )}

          {/* Account type picker — 2-column grid of group cards. */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary mb-3">
              <span aria-hidden className="h-3.5 w-[3px] rounded-full" style={{ background: '#E94E1B' }} />
              Choose An Account Type
            </h3>
            {loading ? (
              <div className="flex items-center justify-center py-16 text-text-secondary text-sm gap-2">
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
              // Keyed on `open` so the stagger replays every time the
              // drawer is reopened, not just on first mount.
              <div key={String(open)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {groups.map((g, i) => {
                  const sel = selectedId === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedId(g.id)}
                      aria-pressed={sel}
                      className={clsx(
                        'group relative isolate overflow-hidden text-left rounded-xl p-4',
                        'transition-[transform,box-shadow,border-color] duration-200 ease-out',
                        'motion-safe:animate-drawer-card',
                        'hover:-translate-y-[3px] hover:shadow-[0_10px_24px_rgba(0,0,0,0.10)]',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E94E1B]/50',
                        sel
                          ? 'ring-2 ring-[#E94E1B]/55 shadow-[0_8px_22px_rgba(233,78,27,0.18)]'
                          : 'hover:border-[#E94E1B]/45',
                      )}
                      style={{
                        background: 'var(--bg-card-nested)',
                        border: `1px solid ${sel ? '#E94E1B' : 'var(--border-primary)'}`,
                        // Cards arrive one after another rather than all at once.
                        animationDelay: `${Math.min(i, 8) * 45}ms`,
                      }}
                    >
                      {/* Warm wash that fades up on hover and stays on the
                          selected card. -z-10 keeps it under the text. */}
                      <span
                        aria-hidden
                        className={clsx(
                          'pointer-events-none absolute inset-0 -z-10 transition-opacity duration-300',
                          sel ? 'opacity-100' : 'opacity-0 group-hover:opacity-60',
                        )}
                        style={{
                          background:
                            'linear-gradient(135deg, rgba(233,78,27,0.10) 0%, rgba(245,158,11,0.05) 45%, transparent 75%)',
                        }}
                      />
                      {sel && (
                        <span
                          aria-hidden
                          className="absolute top-3 right-3 grid h-5 w-5 place-items-center rounded-full
                                     text-white shadow-[0_2px_6px_rgba(233,78,27,0.45)]
                                     motion-safe:animate-check-pop"
                          style={{ background: '#E94E1B' }}
                        >
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                      <div className="flex items-center gap-2 mb-2 pr-6">
                        <span className="text-sm font-bold text-text-primary tracking-wide uppercase">
                          {g.name || 'Standard'}
                        </span>
                        {g.swap_free && (
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.35)' }}
                          >
                            Swap-free
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-tertiary mb-3 leading-snug line-clamp-2">
                        {g.description || 'Currencies, indices, metals, energies, crypto'}
                      </p>
                      <div className="space-y-1 text-[11px] text-text-secondary">
                        <Row k="Spread from" v={`${(g.spread_markup || 0.6).toFixed(1)} pips`} />
                        <Row k="Min deposit" v={fmtMoney(g.minimum_deposit || 0)} />
                        <Row
                          k="Max leverage"
                          v={`1:${groupMaxLeverage(g)}`}
                        />
                        <Row
                          k={g.commission_pct != null ? 'Brokerage' : 'Commission'}
                          v={
                            g.commission_pct != null
                              ? `${(g.commission_pct * 100).toFixed(2)}%`
                              : `${fmtMoney(g.commission_per_lot || 0)} / lot`
                          }
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Leverage */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary mb-3">
              <span aria-hidden className="h-3.5 w-[3px] rounded-full" style={{ background: '#E94E1B' }} />
              Leverage
            </h3>
            <div className="relative">
              <select
                value={leverage ?? ''}
                onChange={(e) => setLeverage(Number(e.target.value))}
                disabled={!selected || leverageOptions.length === 0}
                className="w-full appearance-none pl-4 pr-10 py-3 rounded-xl text-sm font-semibold bg-bg-card-nested text-text-primary disabled:opacity-50"
                style={{ border: '1px solid var(--border-primary)' }}
              >
                {leverageOptions.map((l) => (
                  <option key={l} value={l}>1:{l}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
            </div>
            {selected && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-text-tertiary">
                  Capped at this account type&apos;s maximum: 1:{groupMaxLeverage(selected)}
                </p>
                {selected.kyc_unlock_required && (
                  <p className="text-xs text-amber-400/85">
                    Complete KYC to unlock higher leverage.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Sticky footer with Submit. */}
        <footer className="px-6 sm:px-8 py-4 border-t border-border-primary shrink-0 bg-bg-card">
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !selected}
            className="group/sbm relative w-full overflow-hidden inline-flex items-center justify-center gap-2
                       px-6 py-3 rounded-xl text-sm font-bold text-white
                       shadow-[0_4px_14px_rgba(233,78,27,0.30)]
                       transition-[transform,box-shadow,filter] duration-200 ease-out
                       hover:-translate-y-[2px] hover:shadow-[0_8px_22px_rgba(233,78,27,0.42)]
                       active:translate-y-0 active:scale-[0.99]
                       disabled:opacity-50 disabled:cursor-not-allowed
                       disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_14px_rgba(233,78,27,0.30)]"
            style={{ background: 'linear-gradient(135deg, #F2622A 0%, #E94E1B 55%, #C73E11 100%)' }}
          >
            {/* Shine sweep — purely decorative, skipped under reduced motion. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-full w-1/2 skew-x-[-20deg]
                         bg-white/25 transition-none
                         motion-safe:group-hover/sbm:left-[150%] motion-safe:group-hover/sbm:transition-all
                         motion-safe:group-hover/sbm:duration-700"
            />
            {creating && <Loader2 size={14} className="animate-spin" />}
            {creating ? 'Creating…' : 'Submit'}
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

/* ───────────── Tiny UI atoms ───────────── */

function TypePill({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      // `relative` lifts the label above the sliding thumb behind it; the
      // thumb owns the active background now, so this only animates colour.
      className="relative z-10 py-2.5 text-sm font-semibold rounded-full select-none
                 transition-colors duration-200 focus:outline-none
                 focus-visible:ring-2 focus-visible:ring-[#E94E1B]/40"
      style={{
        background: 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: 'none',
      }}
    >
      {label}
    </button>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-text-tertiary">{k}</span>
      <span className="font-medium text-text-primary tabular-nums">{v}</span>
    </div>
  );
}
