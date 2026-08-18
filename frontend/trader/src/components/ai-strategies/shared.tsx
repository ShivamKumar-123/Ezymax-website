'use client';

/**
 * Small shared building blocks for the AI Strategies pages — page header,
 * status pills, empty states, metric tiles, collapsible sections. Follows the
 * SwissCresta light-theme tokens (bg-card / border-border-primary / text-*).
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react';

export const inputCls =
  'w-full bg-bg-secondary border border-border-primary rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50';

/** Compact relative time — "just now", "5m ago", "2h ago", "3d ago", then a date. */
export function timeAgo(iso: string | undefined | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Shimmering placeholder block — reserve layout space while data loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={clsx('animate-pulse rounded-md bg-bg-active/70', className)}
    />
  );
}

export function Spinner({ size = 8 }: { size?: 6 | 8 }) {
  return (
    <div
      className={clsx(
        'animate-spin rounded-full border-2 border-[#E94E1B] border-t-transparent',
        size === 8 ? 'h-8 w-8' : 'h-6 w-6',
      )}
    />
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        {description && <p className="text-sm text-text-secondary mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Strategy / instance status pill: draft=gray, active/running=green, error=red. */
export function StatusPill({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  const cls =
    s === 'active' || s === 'running'
      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
      : s === 'error'
        ? 'bg-red-500/10 text-red-600 border-red-500/25'
        : 'bg-bg-secondary text-text-tertiary border-border-primary';
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide',
        cls,
      )}
    >
      {status || '—'}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border-primary px-6 py-16 text-center',
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-secondary border border-border-primary">
          <Icon size={22} className="text-text-tertiary" aria-hidden />
        </div>
      )}
      <p className="text-text-primary font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-text-tertiary leading-relaxed">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function MetricTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'profit' | 'loss';
}) {
  return (
    <div className="rounded-lg border border-border-primary bg-card p-3">
      <p className="text-[10px] uppercase tracking-wide font-semibold text-text-tertiary">{label}</p>
      <p
        className={clsx(
          'mt-1 text-lg font-bold font-mono tabular-nums',
          tone === 'profit' && 'text-emerald-600',
          tone === 'loss' && 'text-red-600',
          tone === 'default' && 'text-text-primary',
        )}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Secondary hub section with a toggle header. Content is only mounted while
 * open, so collapsed sections don't poll the API in the background.
 */
export function CollapsibleSection({
  title,
  subtitle,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-border-primary bg-card overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg-hover transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          {Icon && <Icon size={15} className="text-[#E94E1B] shrink-0" aria-hidden />}
          <span className="text-sm font-semibold text-text-primary">{title}</span>
          {subtitle && <span className="text-xs text-text-tertiary truncate">{subtitle}</span>}
        </span>
        {open ? (
          <ChevronUp size={15} className="text-text-tertiary shrink-0" aria-hidden />
        ) : (
          <ChevronDown size={15} className="text-text-tertiary shrink-0" aria-hidden />
        )}
      </button>
      {open && <div className="border-t border-border-primary p-4">{children}</div>}
    </section>
  );
}
