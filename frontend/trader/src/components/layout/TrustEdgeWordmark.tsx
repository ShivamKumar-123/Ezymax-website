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
export function TrustEdgeWordmark({
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
          'flex flex-col items-center justify-center gap-0 rounded-md hover:bg-white/[0.06] w-9 h-9 transition-colors',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#00e676]',
          className,
        )}
      >
        <span className="text-[8px] font-extrabold text-white leading-none tracking-tight">Trust</span>
        <span className="text-[8px] font-extrabold text-[#00e676] leading-none tracking-tight">Edge</span>
      </Link>
    );
  }

  const mark = (
    <span
      className={cn(
        'inline-flex items-baseline font-bold italic tracking-tight select-none',
        'text-xl sm:text-2xl drop-shadow-[0_0_20px_rgba(0,230,118,0.12)]',
        textClassName,
      )}
    >
      <span className="text-white">Trust</span>
      <span className="text-[#00e676]">Edge</span>
    </span>
  );

  return (
    <Link
      href={href}
      className={cn(
        'min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e676]/60 focus-visible:rounded-md',
        className,
      )}
    >
      {mark}
    </Link>
  );
}
