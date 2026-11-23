'use client';

import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';

/**
 * Dashboard panel — the shared card shell for the home screen.
 *
 * Follows the design reference's card language: a generous 24px radius, a
 * hairline border doing the separating instead of a drop shadow, and a
 * header that pairs a small tinted icon chip with the title. Colours come
 * from theme tokens, so one shell serves both themes.
 */
export function PanelCard({
  title,
  icon: Icon,
  action,
  children,
  className,
  padding = 'md',
}: {
  title?: string;
  /** Small accent chip beside the title, as in the reference's headers. */
  icon?: LucideIcon;
  /** Optional right-aligned header element (link, select, etc.). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}) {
  const pad = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' }[padding];
  return (
    <div
      className={clsx('rounded-3xl', pad, className)}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-glass-bright)',
        boxShadow: '0 1px 2px rgba(11,11,12,0.04)',
      }}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          {title && (
            <div className="flex items-center gap-2 min-w-0">
              {Icon && (
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(225, 32, 25, 0.10)' }}
                >
                  <Icon size={13} style={{ color: '#E12019' }} />
                </span>
              )}
              <h2 className="text-sm font-bold tracking-tight text-text-primary truncate">
                {title}
              </h2>
            </div>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/** Small pill link used in card headers ("View all →" pattern). */
export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  // Plain anchor styling wrapper — callers pass a Next <Link> as parent
  // where routing matters; this stays a styled span for flexibility.
  //
  // Rendered as the reference's pill affordance rather than bare text, so
  // card headers read as header/control instead of header/footnote.
  return (
    <a
      href={href}
      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
      style={{ border: '1px solid var(--border-glass-bright)' }}
    >
      {children}
    </a>
  );
}
