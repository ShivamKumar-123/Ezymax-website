'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useBrandDisplay } from '@/components/providers/BrandingProvider';

const LOGO_SRC = '/marketing/swisscresta-logo.png';

type Props = {
  href?: string;
  className?: string;
  /** Applied to the wordmark text (e.g. responsive sizes). */
  textClassName?: string;
  /** Default: sidebar / header. Rail: tiny terminal left bar. */
  variant?: 'default' | 'rail';
  /** Hide the Swiss-flag mark and render the wordmark only. Useful in
   *  contexts where the mark would clash (small badge embeds). */
  hideFlag?: boolean;
};


/**
 * Brand wordmark for dashboard chrome. On platform hosts this is the
 * SwissCresta lockup; on a white-label tenant domain it renders the
 * broker's logo (if uploaded) and/or brand name instead — this ONE
 * component is what re-brands most of the app chrome, so never
 * hard-code the platform logo at a call-site.
 */
export function SwissCrestaWordmark({
  href = '/dashboard',
  className,
  textClassName,
  variant = 'default',
  hideFlag = false,
}: Props) {
  const brand = useBrandDisplay();

  if (variant === 'rail') {
    // Terminal-left-rail variant — only ~36px wide. Platform: favicon
    // PNG. Tenant: their logo, or a monogram of their brand name.
    return (
      <Link
        href={href}
        title="Trading home"
        className={cn(
          'flex items-center justify-center rounded-md hover:bg-bg-hover w-9 h-9 transition-colors',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#E94E1B]',
          className,
        )}
      >
        {brand.isWhiteLabel ? (
          brand.logoUrl ? (
            // Tenant logos come from the same-origin /api/v1 proxy —
            // plain <img>, next/image would need remotePatterns config.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt={brand.name}
              className="w-7 h-7 object-contain rounded-md"
            />
          ) : (
            <span className="inline-flex items-baseline font-bold tracking-tight text-base select-none text-text-primary">
              {brand.name.slice(0, 2).toUpperCase()}
            </span>
          )
        ) : hideFlag ? (
          <span className="inline-flex items-baseline font-bold tracking-tight text-base select-none">
            <span className="text-text-primary">S</span>
            <span className="text-[#E94E1B]">C</span>
          </span>
        ) : (
          <Image
            src="/marketing/swisscresta_fevicon.png"
            alt="SwissCresta"
            width={28}
            height={28}
            priority
            className="w-7 h-7 object-contain rounded-md"
          />
        )}
      </Link>
    );
  }

  // textClassName preserved for backward compatibility with callers
  // that previously controlled the inner text sizing.
  void textClassName;

  return (
    <Link
      href={href}
      aria-label={`${brand.name} home`}
      className={cn(
        'inline-flex items-center min-w-0 gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E94E1B]/60 focus-visible:rounded-md',
        className,
      )}
    >
      {brand.isWhiteLabel ? (
        <>
          {brand.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt={brand.name}
              className="h-9 sm:h-10 w-auto max-w-[160px] object-contain"
            />
          )}
          {/* Show the name when there's no logo, or alongside a square mark. */}
          {!brand.logoUrl && (
            <span className="font-bold tracking-tight text-lg text-text-primary select-none truncate">
              {brand.name}
            </span>
          )}
        </>
      ) : (
        <Image
          src={LOGO_SRC}
          alt="SwissCresta"
          width={220}
          height={48}
          priority
          className="h-9 sm:h-10 w-auto"
        />
      )}
    </Link>
  );
}
