import { BRAND_NAME, BRAND_LOGO_INK, BRAND_LOGO_REVERSED } from '@/lib/brand';

/**
 * The Bullza logo, in the tone the surface it sits on requires.
 *
 * `tone="auto"` (the default) renders BOTH marks and lets CSS in
 * globals.css hide the wrong one based on `<html data-theme>`. That looks
 * wasteful next to reading the theme from the store, but it is the only
 * flicker-free option here: the theme is stamped onto <html> by an inline
 * script in app/layout.tsx before React hydrates, so a store-driven
 * component would render the light mark first and swap it a frame later —
 * visible on every page load, and a hydration mismatch besides. Two 32KB
 * PNGs, one of them `display:none`, costs less than that.
 *
 * Use an explicit tone wherever the surface ignores the theme:
 *   - `ink` for permanently light surfaces (the auth card, the white
 *     marketing header, marketing pages — the whole (landing) group pins
 *     data-theme to light anyway, but being explicit documents it)
 *   - `reversed` for permanently dark ones (the splash screen, the black
 *     landing footer)
 */
type Props = {
  className?: string;
  /** Which mark to show. Default `auto` follows the active theme. */
  tone?: 'auto' | 'ink' | 'reversed';
  /** Decorative uses (watermarks, background auras) pass `decorative`. */
  decorative?: boolean;
  alt?: string;
  draggable?: boolean;
  style?: React.CSSProperties;
};

export function BrandLogo({
  className,
  tone = 'auto',
  decorative = false,
  alt,
  draggable,
  style,
}: Props) {
  const shared = {
    alt: decorative ? '' : (alt ?? BRAND_NAME),
    'aria-hidden': decorative || undefined,
    draggable,
    style,
  };

  if (tone !== 'auto') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={tone === 'ink' ? BRAND_LOGO_INK : BRAND_LOGO_REVERSED}
        className={className}
        {...shared}
      />
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BRAND_LOGO_INK} className={`brand-logo--ink ${className ?? ''}`} {...shared} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND_LOGO_REVERSED}
        className={`brand-logo--reversed ${className ?? ''}`}
        {...shared}
        alt=""
        aria-hidden
      />
    </>
  );
}

export default BrandLogo;
