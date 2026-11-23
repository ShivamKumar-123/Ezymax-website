import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BRAND_NAME } from '@/lib/brand';
import { BrandLogo } from '@/components/BrandLogo';

type Props = {
  href?: string;
  className?: string;
  /** Applied to the wordmark text (e.g. responsive sizes). */
  textClassName?: string;
  /** Default: sidebar / header. Rail: tiny terminal left bar. */
  variant?: 'default' | 'rail';
};

/**
 * Brand mark for dashboard chrome — the linked wrapper around
 * <BrandLogo />, which picks the ink or reversed artwork from the active
 * theme. The text-wordmark fallback this used to carry is gone: it only
 * existed because BRAND_LOGO defaulted to empty, and the logo now always
 * resolves to one of the two marks.
 */
export function BrandWordmark({
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
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#E12019]',
          className,
        )}
      >
        <BrandLogo className="w-7 h-7 object-contain" />
      </Link>
    );
  }

  const mark = (
    <span className={cn('inline-flex items-center select-none', className)}>
      <BrandLogo className="h-9 sm:h-10 w-auto object-contain shrink-0" />
    </span>
  );

  return (
    <Link
      href={href}
      className={cn(
        'min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E12019]/60 focus-visible:rounded-md',
        className,
      )}
    >
      {mark}
    </Link>
  );
}
