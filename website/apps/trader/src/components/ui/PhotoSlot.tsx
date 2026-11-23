import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Art, type ArtName } from '@/components/ui/Art';
import photos from '@/content/photos.json';

/**
 * An optional stock-photo slot (apps/trader/IMAGES-MANIFEST.md). Ezymex' own artwork comes first; stock photos are
 * only used in these few places, and only once `node scripts/fetch-photos.mjs` has downloaded and graded them
 * (it records each one in src/content/photos.json). Until then the slot shows the own-art fallback below.
 */
export type PhotoKey = 'city-night' | 'team-desk' | 'globe-network';

const FALLBACK: Record<PhotoKey, ArtName> = {
  'city-night': 'chart-wall',
  'team-desk': 'desk-streaks',
  'globe-network': 'commodities',
};

type Entry = { src: string; width: number; height: number; blur?: string; credit?: string; page?: string };
const REGISTRY = photos as Partial<Record<PhotoKey, Entry>>;

export function photoCredits(): { slot: string; credit: string; page?: string }[] {
  return Object.entries(REGISTRY)
    .filter(([, e]) => e?.credit)
    .map(([slot, e]) => ({ slot, credit: e!.credit!, page: e!.page }));
}

export function PhotoSlot({
  slot,
  alt,
  className,
  sizes = '100vw',
  priority = false,
  position = 'center',
  children,
  style,
}: {
  slot: PhotoKey;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  position?: string;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  const entry = REGISTRY[slot];
  if (!entry) {
    return (
      <Art name={FALLBACK[slot]} className={className} sizes={sizes} priority={priority} position={position} style={style}>
        {children}
      </Art>
    );
  }
  return (
    <div className={cn('relative overflow-hidden bg-ink', className)} style={style}>
      <Image
        src={entry.src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        placeholder={entry.blur ? 'blur' : 'empty'}
        blurDataURL={entry.blur}
        className="object-cover"
        style={{ objectPosition: position }}
      />
      {children}
    </div>
  );
}
