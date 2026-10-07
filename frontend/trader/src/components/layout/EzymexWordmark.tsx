import Link from 'next/link';
import { cn } from '@/lib/utils';

type Props = {
  href?: string;
  className?: string;
  /** Applied to the wordmark text (e.g. responsive sizes). */
  textClassName?: string;
  /** Default: sidebar / header. Rail: tiny terminal left bar. */
  variant?: 'default' | 'rail';
};

/**
 * Text wordmark for dashboard chrome (replaces raster logo).
 */
export function EzymexWordmark({
  href = '/dashboard',
  className,
  textClassName,
  variant = 'default',
}: Props) {
  if (variant === 'rail') {
    return (
      <Link
        href={href}
        title="Trading home"
        className={cn(
          'flex items-center justify-center rounded-lg hover:bg-bg-hover w-10 h-10 transition-colors',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#1E88FF]',
          className,
        )}
      >
        {/* Square icon-only mark (not the wide wordmark, which crushed to an
            unreadable sliver inside the narrow rail). Bigger + a soft glow so
            it reads clearly against the dark rail. */}
        <img
          src="/images/ezymex_icon.png"
          alt="Ezymex"
          className="w-9 h-9 object-contain drop-shadow-[0_0_7px_rgba(214,169,61,0.45)]"
        />
      </Link>
    );
  }

  // Logo image only — no "Ezymex" text (the logo asset already carries the
  // branding). Shown larger, height-based so the horizontal logo keeps its
  // aspect ratio. `textClassName` is accepted but unused now, kept so
  // existing callers don't need to change.
  void textClassName;
  const mark = (
    <span className={cn('inline-flex items-center select-none', className)}>
      <img
        src="/images/ezymex-logo.png"
        alt="Ezymex"
        className="h-9 w-auto object-contain drop-shadow-[0_0_20px_rgba(30,136,255,0.12)]"
      />
    </span>
  );

  return (
    <Link
      href={href}
      className={cn(
        'min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E88FF]/60 focus-visible:rounded-md',
        className,
      )}
    >
      {mark}
    </Link>
  );
}
