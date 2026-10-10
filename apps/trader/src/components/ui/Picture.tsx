import type { CSSProperties } from 'react';

/**
 * Pre-encoded AVIF/WebP image (scripts/brand-models.mjs) with a small and a native size. Used for the founder's
 * low-resolution model images, where re-encoding through the image optimiser would cost quality.
 */
export function Picture({
  name,
  widths,
  height,
  alt,
  sizes,
  className,
  imgClassName,
  priority = false,
  style,
}: {
  /** Base path without extension, e.g. /images/brand/hero-portal */
  name: string;
  /** [native, small] widths; the small file is `${name}-${small}.ext`. */
  widths: [number, number];
  /** Native height (for the intrinsic aspect ratio). */
  height: number;
  alt: string;
  sizes: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  style?: CSSProperties;
}) {
  const [big, small] = widths;
  const set = (ext: string) => `${name}-${small}.${ext} ${small}w, ${name}.${ext} ${big}w`;
  return (
    <picture className={className} style={style}>
      <source type="image/avif" srcSet={set('avif')} sizes={sizes} />
      <source type="image/webp" srcSet={set('webp')} sizes={sizes} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${name}.webp`}
        alt={alt}
        width={big}
        height={height}
        sizes={sizes}
        srcSet={set('webp')}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className={imgClassName ?? 'block h-auto w-full'}
      />
    </picture>
  );
}
