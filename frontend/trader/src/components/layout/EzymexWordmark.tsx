'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useBrandDisplay } from '@/components/providers/BrandingProvider';

/* The lockup is red + deep navy, so it needs both tonal cuts: the navy half
 * disappears on the terminal's near-black surface, and the reversed cut's
 * bright steel blue is washed out on the light dashboard. Both are rendered
 * and the inactive one is hidden by the theme — `darkMode` in
 * tailwind.config.ts is ['class', '[data-theme="dark"]'], the same switch
 * ThemeProvider sets, so this follows the user's theme with no JS. */
const LOGO_SRC_LIGHT_BG = '/marketing/ezymex-logo.png';       // dark ink
const LOGO_SRC_DARK_BG = '/marketing/ezymex-logo-dark.png';   // reversed

type Props = {
  href?: string;
  className?: string;
  /** Applied to the wordmark text (e.g. responsive sizes). */
  textClassName?: string;
  /** Default: sidebar / header. Rail: tiny terminal left bar. */
  variant?: 'default' | 'rail';
  /** Hide the emblem and render the EX monogram instead. Useful in
   *  contexts where the mark would clash (small badge embeds). */
  hideFlag?: boolean;
};


/**
 * Brand wordmark for dashboard chrome. On platform hosts this is the
 * Ezymex lockup; on a white-label tenant domain it renders the
 * broker's logo (if uploaded) and/or brand name instead — this ONE
 * component is what re-brands most of the app chrome, so never
 * hard-code the platform logo at a call-site.
 */
export function EzymexWordmark({
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
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#CC0000]',
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
            <span className="text-[#CC0000]">E</span>
            <span className="text-text-primary">X</span>
          </span>
        ) : (
          <Image
            src="/marketing/ezymex_fevicon.png"
            alt="Ezymex"
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
        'inline-flex items-center min-w-0 gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CC0000]/60 focus-visible:rounded-md',
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
        <>
          <Image
            src={LOGO_SRC_LIGHT_BG}
            alt="Ezymex"
            width={220}
            height={48}
            priority
            className="h-9 sm:h-10 w-auto dark:hidden"
          />
          <Image
            src={LOGO_SRC_DARK_BG}
            alt=""
            aria-hidden
            width={220}
            height={48}
            priority
            className="h-9 sm:h-10 w-auto hidden dark:block"
          />
        </>
      )}
    </Link>
  );
}
