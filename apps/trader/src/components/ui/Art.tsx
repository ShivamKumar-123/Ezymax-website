import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Ezymex' own artwork, graded to the ember look by scripts/grade-art.mjs (sources in public/images/home and
 * public/images). These are the site's primary images; stock photos only fill the few optional slots.
 */
export const ART = {
  'desk-streaks': { w: 1556, h: 1011, alt: 'A trader at a laptop as streams of market data flow across the desk' },
  analyst: { w: 1447, h: 1087, alt: 'A trader thinking at a laptop, with a rising chart glowing behind him' },
  commodities: { w: 1447, h: 1087, alt: 'Glowing tokens for forex, indices, oil, gold and agriculture among dark rocks' },
  'watchlist-eye': { w: 1447, h: 1087, alt: 'Close-up of an eye reflecting a list of metals and energy markets' },
  'phone-light': { w: 1566, h: 1004, alt: 'A person looking at a phone as light streams out of the screen' },
  burst: { w: 1566, h: 1005, alt: 'A trader at a laptop in a burst of ember light' },
  'chart-wall': { w: 1518, h: 1036, alt: 'A silhouette facing a giant glowing chart on the horizon' },
  study: { w: 1288, h: 1221, alt: 'A person studying at a laptop with books, surrounded by sparks of light' },
} as const;

export type ArtName = keyof typeof ART;

export function Art({
  name,
  alt,
  className,
  imgClassName,
  sizes = '100vw',
  priority = false,
  position = 'center',
  fill = true,
  children,
  style,
}: {
  name: ArtName;
  alt?: string;
  className?: string;
  imgClassName?: string;
  sizes?: string;
  priority?: boolean;
  position?: string;
  fill?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  const a = ART[name];
  const src = `/images/art/${name}.webp`;
  if (!fill) {
    return (
      <Image
        src={src}
        alt={alt ?? a.alt}
        width={a.w}
        height={a.h}
        sizes={sizes}
        priority={priority}
        className={cn('block h-auto w-full', className)}
        style={style}
      />
    );
  }
  return (
    <div className={cn('relative overflow-hidden bg-ink', className)} style={style}>
      <Image
        src={src}
        alt={alt ?? a.alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn('object-cover', imgClassName)}
        style={{ objectPosition: position }}
      />
      {children}
    </div>
  );
}
