'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { clsx } from 'clsx';
import {
  ArrowDownToLine, ArrowUpFromLine, ChevronDown, ExternalLink,
  Gauge, Moon, TrendingUp, Wallet, type LucideIcon,
} from 'lucide-react';
import { handleTerminalOpen } from '@/lib/tradingNav';
import { fmtAccountMoney, isCentAccount } from '@/lib/wallet/centDisplay';
import { MarginDonut } from './MarginDonut';

export interface AccountRow {
  id: string;
  account_number: string;
  balance: number;
  equity: number;
  free_margin: number;
  margin_used?: number;
  leverage: number;
  is_demo: boolean;
  swap_free?: boolean;
  account_group_name?: string | null;
  account_group?: { is_cent_account?: boolean | null } | null;
  is_cent_account?: boolean | null;
}

// Relative (same-origin) so the terminal stays inside the app / PWA.
const tradeUrl = (accountId: string) =>
  `/trading/terminal?account=${encodeURIComponent(accountId)}&view=chart`;

/**
 * Primary hero — the EXISTING account selector, balance stats and
 * Deposit / Trade / Withdraw / Details actions. Same content and the same
 * endpoints; only the surface changed.
 *
 * The panel is deliberately dark in BOTH themes, as in the design
 * reference, where the hero is the one near-black block anchoring a light
 * page. It carries `data-theme="dark"` rather than hard-coded colours so
 * every token-reading descendant — the margin donut, the account picker,
 * the dropdown — flips with it instead of needing an `onDark` prop each.
 */
export function AccountHero({
  accounts, active, onChangeAccount, loading,
}: {
  accounts: AccountRow[];
  active: AccountRow | null;
  onChangeAccount: (id: string) => void;
  loading: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const a = active;
  const cent = isCentAccount(a);

  return (
    <div
      data-theme="dark"
      className="relative overflow-hidden rounded-[28px] p-5 md:p-7"
      style={{
        background: '#0b0c0e',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 18px 48px rgba(11,11,12,0.16)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Backdrop at full strength — the darkening scrim that used to sit
          over it was removed on request. Purely decorative, so it is
          aria-hidden and the panel keeps its solid #0b0c0e ground
          underneath: if the file ever goes missing the hero stays a
          readable dark card rather than white. */}
      <Image
        src="/images/dashboard/bg banner1.png"
        alt=""
        aria-hidden
        fill
        priority
        sizes="(max-width: 1240px) 100vw, 1240px"
        className="object-cover"
      />
      <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
        {/* Left: account picker + dominant balance */}
        <div className="flex-1 min-w-0">
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors hover:bg-bg-hover"
              style={{ background: 'var(--bg-card-nested)', border: '1px solid var(--border-secondary)' }}
            >
              <span
                className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-full"
                style={a?.is_demo
                  ? { color: '#f59e0b', background: 'rgba(245,158,11,0.12)' }
                  : { color: '#E12019', background: 'rgba(225, 32, 25,0.12)' }}
              >
                {a?.is_demo ? 'Demo' : 'Real'}
              </span>
              <span className="text-xs font-bold tabular-nums text-text-primary">
                {a?.account_number ? `#${a.account_number}` : (loading ? '…' : 'No accounts')}
              </span>
              <ChevronDown size={13} className="text-text-tertiary" />
            </button>
            {pickerOpen && accounts.length > 0 && (
              <div
                className="absolute top-full left-0 mt-2 z-30 rounded-2xl p-1.5 min-w-[264px]"
                style={{
                  background: 'var(--bg-glass-heavy)',
                  border: '1px solid var(--border-primary)',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => { onChangeAccount(acc.id); setPickerOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm hover:bg-bg-hover"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <span
                      className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-full"
                      style={acc.is_demo
                        ? { color: '#f59e0b', background: 'rgba(245,158,11,0.12)' }
                        : { color: '#E12019', background: 'rgba(225, 32, 25,0.12)' }}
                    >
                      {acc.is_demo ? 'Demo' : 'Real'}
                    </span>
                    <span className="font-semibold tabular-nums">#{acc.account_number}</span>
                    <span className="ml-auto text-xs text-text-tertiary tabular-nums">
                      {fmtAccountMoney(acc.balance, isCentAccount(acc))}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="mt-4 text-[10px] uppercase tracking-[0.16em] font-semibold text-text-tertiary">
            Trading balance
          </p>
          <p className="mt-1 text-3xl md:text-4xl font-extrabold tabular-nums text-text-primary leading-none">
            {fmtAccountMoney(a?.balance ?? 0, cent)}
          </p>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <HeroStat icon={Wallet}     label="Equity"      value={fmtAccountMoney(a?.equity ?? 0, cent)} />
            <HeroStat icon={Gauge}      label="Free margin" value={fmtAccountMoney(a?.free_margin ?? 0, cent)} />
            <HeroStat icon={TrendingUp} label="Leverage"    value={a ? `1:${a.leverage}` : '—'} />
            <HeroStat icon={Moon}       label="Swap-free"   value={a?.swap_free ? 'Yes' : 'No'} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/wallet"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold transition-transform hover:scale-[1.02]"
              style={{ background: '#E12019', color: '#ffffff' }}
            >
              <ArrowDownToLine size={13} /> Deposit
            </Link>
            <a
              href={a ? tradeUrl(a.id) : '#'}
              target={a ? '_blank' : undefined}
              rel="noopener noreferrer"
              onClick={(e) => { if (a) handleTerminalOpen(e, tradeUrl(a.id)); }}
              aria-disabled={!a}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors hover:bg-white/10',
                !a && 'pointer-events-none opacity-50',
              )}
              style={{ border: '1px solid rgba(255, 255, 255, 0.85)', color: '#ffffff' }}
            >
              Trade <ExternalLink size={12} />
            </a>
            <Link
              href="/wallet"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors hover:bg-white/10"
              style={{ border: '1px solid rgba(255, 255, 255, 0.85)', color: '#ffffff' }}
            >
              <ArrowUpFromLine size={13} /> Withdraw
            </Link>
            <Link
              href="/accounts"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors hover:bg-white/10"
              style={{ border: '1px solid rgba(255, 255, 255, 0.85)', color: '#ffffff' }}
            >
              Details
            </Link>
          </div>
        </div>

        {/* Right: margin-usage ring (existing margin_used / equity fields) */}
        <div className="hidden lg:block shrink-0 pl-6">
          <MarginDonut marginUsed={a?.margin_used ?? 0} equity={a?.equity ?? 0} />
        </div>
      </div>
    </div>
  );
}

/**
 * One stat as a filled tile — the reference puts its three headline
 * figures in solid cards.
 *
 * The fill is DARK glass, not white. The backdrop behind these tiles runs
 * from near-black in the corners to near-white where the streak crosses,
 * and a white-tinted translucent tile simply dissolves into that bright
 * band — which is exactly what it did at 6% white. A mostly-opaque dark
 * fill gives the white figures a constant ground whatever is behind them.
 *
 * Borderless by request: the dark fill alone does the separating, so the
 * tiles read as shapes cut out of the gradient rather than outlined cards.
 * Over the dark corners that makes their edges soft — intended.
 */
function HeroStat({
  icon: Icon, label, value,
}: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div
      className="min-w-0 rounded-2xl px-3.5 py-3 backdrop-blur-md"
      /* Glossy glass tile. Three layers, top to bottom:
           1. a diagonal specular sheen — a soft white streak across the
              upper-left, the "light catching the glass" read;
           2. a vertical gradient lighter at the top, so the tile reads as
              a curved surface rather than a flat plate;
           3. the dark translucent body that keeps the red hero legible
              behind it.
         The box-shadow stacks an inset 1px white rim (the glass edge), a
         brighter inset hairline along the very top, and an outer drop so
         the tile lifts off the hero. */
      style={{
        background: [
          'linear-gradient(115deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 28%, rgba(255,255,255,0) 52%)',
          'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 45%)',
          'rgba(8, 9, 11, 0.58)',
        ].join(', '),
        boxShadow: [
          'inset 0 0 0 1px rgba(255,255,255,0.14)',
          'inset 0 1px 0 rgba(255,255,255,0.32)',
          '0 8px 24px rgba(0,0,0,0.28)',
        ].join(', '),
      }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="flex size-5 shrink-0 items-center justify-center rounded-md"
          style={{ background: 'rgba(225, 32, 25, 0.30)' }}
        >
          <Icon size={11} style={{ color: '#ff8880' }} />
        </span>
        <p
          className="text-[9px] uppercase tracking-[0.14em] font-semibold truncate"
          style={{ color: 'rgba(255,255,255,0.72)' }}
        >
          {label}
        </p>
      </div>
      <p
        className="mt-2 text-base font-extrabold tabular-nums text-text-primary truncate"
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
