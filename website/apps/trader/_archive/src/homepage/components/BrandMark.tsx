import Link from 'next/link';
import { BRAND_LOGO_INK } from '@/lib/brand';
import { BRAND } from '../data';

/** Four-point star used as the marquee separator. */
export function Star({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 0c.6 6.4 5.6 11.4 12 12-6.4.6-11.4 5.6-12 12-.6-6.4-5.6-11.4-12-12C6.4 11.4 11.4 6.4 12 0z" />
    </svg>
  );
}

/**
 * Logo link for the navbar, mobile menu and footer. Every surface it sits
 * on is the light cream page background, so it always takes the ink mark.
 */
export function BrandMark({ href = '/', className = 'h-8' }: { href?: string; className?: string }) {
  return (
    <Link href={href} className="inline-flex items-center" aria-label={`${BRAND} home`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BRAND_LOGO_INK} alt={BRAND} className={`w-auto object-contain ${className}`} />
    </Link>
  );
}
