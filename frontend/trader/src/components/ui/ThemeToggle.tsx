'use client';

import { Sun, Moon } from 'lucide-react';
import { clsx } from 'clsx';
import { useUIStore } from '@/stores/uiStore';

export function ThemeToggle({
  compact = false,
  className,
}: {
  compact?: boolean;
  /** Extra classes — lets a caller add the bordered-circle treatment without
   *  changing the plain button every other surface uses. */
  className?: string;
}) {
  const { theme, toggleTheme } = useUIStore();
  const isDark = theme === 'dark';
  // Show the mode you'll switch TO: a Sun in dark mode (tap to go light),
  // a Moon in light mode (tap to go dark).
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={clsx(
        // Plain lucide icon button — no border ring, just a hover surface.
        'flex shrink-0 items-center justify-center rounded-full',
        'text-text-secondary transition-colors hover:bg-bg-hover/70 hover:text-text-primary active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-buy/35',
        compact ? 'h-8 w-8' : 'h-9 w-9',
        className,
      )}
    >
      <Icon
        className={clsx('h-[18px] w-[18px]', isDark ? 'text-warning' : 'text-buy')}
        strokeWidth={2}
        aria-hidden
      />
    </button>
  );
}
