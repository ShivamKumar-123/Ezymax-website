import Image from 'next/image';
import Link from 'next/link';
import { clsx } from 'clsx';

/**
 * Standard hero for inner marketing pages (markets, products, services,
 * company, legal). The homepage keeps its own bespoke hero; every other
 * page uses this so inner pages open consistently.
 *
 * 2026-09-01 redesign: the accent bloom behind the headline is gone —
 * it existed to lift a black canvas and read as a print artefact on
 * white. The hero now opens on a light band that resolves into the page,
 * matching the reference's inner-page treatment, and can reserve a
 * product-shot area beneath the CTAs via `media`.
 */
export function PageHero({
  kicker, title, lead, primary, secondary, children, className, media, mediaRatio = '21x9', image,
}: {
  kicker?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
  children?: React.ReactNode;
  className?: string;
  /** Caption for a reserved image area under the hero. Omit for no image. */
  media?: string;
  mediaRatio?: '16x9' | '21x9' | '3x2';
  /** Real artwork for that area. Takes precedence over `media`, and is
   *  rendered at its own ratio so the source is never cropped. */
  image?: {
    src: string;
    alt: string;
    width: number;
    height: number;
    /** Set on above-the-fold heroes so the LCP image preloads. */
    priority?: boolean;
  };
}) {
  const hasMedia = Boolean(image || media);

  return (
    <header className={clsx('relative overflow-hidden', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        /* Flat #FEFEFE rather than the old raised-to-white gradient. The
           hero artwork is exported on a near-white ground, and the gradient
           left a visible rectangle edge where the two met. */
        style={{ background: '#FEFEFE' }}
      />
      <div
        className="mk-container relative"
        /* paddingTop clears the fixed 64px header; trimmed by 2.25rem when
           the 36px black utility strip above the nav was removed. */
        style={{
          paddingTop: 'clamp(5.75rem, 3.75rem + 7vw, 8.75rem)',
          /* With a shot below, this padding is only the gap above it — the
             shot itself carries the band's bottom spacing. */
          paddingBottom: hasMedia ? 'var(--mk-space-8)' : 'var(--mk-section-y)',
        }}
      >
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          {kicker && <span className="mk-kicker">{kicker}</span>}
          <h1 className="mk-h1">{title}</h1>
          {lead && <p className="mk-lead">{lead}</p>}
          {(primary || secondary) && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {primary && (
                <Link href={primary.href} className="mk-btn mk-btn--primary mk-btn--lg">
                  {primary.label}
                </Link>
              )}
              {secondary && (
                <Link href={secondary.href} className="mk-btn mk-btn--ghost mk-btn--lg">
                  {secondary.label}
                </Link>
              )}
            </div>
          )}
          {children}
        </div>
      </div>

      {/* Product shot, edge to edge. It sits outside .mk-container rather
          than breaking out of it with a 100vw trick — as a direct child of
          the header it is simply 100% of the page width, so it stays
          centred instead of drifting by the scrollbar width. No corner
          radius: the block meets both page edges, so rounding them would
          cut the artwork away from the sides it is flush with. */}
      {hasMedia && (
        <div className="relative" style={{ paddingBottom: 'var(--mk-section-y)' }}>
          {image ? (
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              priority={image.priority}
              sizes="100vw"
              className="block h-auto w-full"
            />
          ) : (
            <div
              className={clsx('mk-media', `mk-media--ratio-${mediaRatio}`)}
              style={{ borderRadius: 0, borderLeft: 0, borderRight: 0 }}
            >
              {media}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
