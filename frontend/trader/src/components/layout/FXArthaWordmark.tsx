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
export function FXArthaWordmark({
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
          'flex items-center justify-center rounded-md hover:bg-bg-hover w-9 h-9 transition-colors',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#d6a93d]',
          className,
        )}
      >
        <img src="/images/fxartha-logo.png" alt="FXArtha" className="w-7 h-7 object-contain" />
      </Link>
    );
  }

  // Logo image only — no "FXArtha" text (the logo asset already carries the
  // branding). Shown larger, height-based so the horizontal logo keeps its
  // aspect ratio. `textClassName` is accepted but unused now, kept so
  // existing callers don't need to change.
  void textClassName;
  const mark = (
    <span className={cn('inline-flex items-center select-none', className)}>
      <img
        src="/images/fxartha-logo.png"
        alt="FXArtha"
        className="h-9 w-auto object-contain drop-shadow-[0_0_20px_rgba(214,169,61,0.12)]"
      />
    </span>
  );

  return (
    <Link
      href={href}
      className={cn(
        'min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d6a93d]/60 focus-visible:rounded-md',
        className,
      )}
    >
      {mark}
    </Link>
  );
}
