import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'ember' | 'outline' | 'light';

/**
 * Pill button as a link. `arrow` adds the round ↗ chip.
 * External links (Client Area, Ezymex Trader) open in the same tab: they are part of one journey.
 */
export function Button({
  href,
  children,
  variant = 'ember',
  size = 'md',
  arrow = true,
  className,
  ariaLabel,
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: 'sm' | 'md';
  arrow?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const cls = cn('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className);
  const inner = (
    <>
      <span>{children}</span>
      {arrow && (
        <span className="arrow" aria-hidden>
          <ArrowUpRight size={size === 'sm' ? 14 : 16} strokeWidth={2.2} />
        </span>
      )}
    </>
  );
  const common = {
    className: cls,
    'aria-label': ariaLabel,
  };
  if (/^https?:/.test(href)) {
    return (
      <a href={href} {...common}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} {...common}>
      {inner}
    </Link>
  );
}

export function ArrowCircle({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <span className={cn('arrow-circle', className)} aria-hidden>
      <ArrowUpRight size={size} strokeWidth={1.8} />
    </span>
  );
}
