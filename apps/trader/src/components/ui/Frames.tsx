import Image from 'next/image';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Real product screenshots in a minimal browser / phone frame with an ember rim glow.
 * `tilt` adds a gentle perspective (desktop only; flat on small screens).
 */
export function BrowserFrame({
  src,
  alt,
  url = 'trade.ezymex.com',
  width = 1600,
  height = 950,
  priority = false,
  tilt = false,
  className,
  sizes = '(min-width: 1280px) 1100px, 92vw',
  caption,
}: {
  src: string;
  alt: string;
  url?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  tilt?: boolean;
  className?: string;
  sizes?: string;
  caption?: ReactNode;
}) {
  return (
    <figure className={cn('relative', tilt && 'frame-tilt', className)}>
      <div aria-hidden className="glow-ember -inset-x-[10%] -bottom-[18%] top-[30%] opacity-60" />
      <div className="relative overflow-hidden rounded-[18px] border border-white/10 bg-ink-3 rim sm:rounded-[22px]">
        <div className="flex h-8 items-center gap-2 border-b border-white/[0.07] bg-[#0d0d11] px-3.5 sm:h-9">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="mx-auto hidden rounded-full border border-white/[0.07] bg-white/[0.03] px-4 py-0.5 text-[11px] text-fg-3 sm:block">
            {url}
          </span>
        </div>
        <Image src={src} alt={alt} width={width} height={height} sizes={sizes} priority={priority} className="block h-auto w-full" />
      </div>
      {caption && <figcaption className="mt-3 text-center text-xs text-fg-3">{caption}</figcaption>}
    </figure>
  );
}

export function PhoneFrame({
  src,
  alt,
  className,
  priority = false,
  sizes = '(min-width: 1024px) 300px, 60vw',
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <figure className={cn('relative mx-auto w-full max-w-[300px]', className)}>
      <div aria-hidden className="glow-ember -inset-[12%] opacity-50" />
      <div className="relative rounded-[46px] border border-white/15 bg-[#0b0b0e] p-[9px] rim">
        <div className="relative overflow-hidden rounded-[38px] bg-[#0f0b0a] pt-8">
          <span aria-hidden className="absolute left-1/2 top-2 h-[20px] w-[84px] -translate-x-1/2 rounded-full bg-black" />
          <Image src={src} alt={alt} width={390} height={844} sizes={sizes} priority={priority} className="block h-auto w-full" />
        </div>
      </div>
    </figure>
  );
}
