import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Headline } from '@/components/motion/Headline';
import { GridLines } from '@/components/ui/Section';
import { Art, type ArtName } from '@/components/ui/Art';

/**
 * Inner-page hero: kicker, giant split headline, lead, actions, and either a visual (product shot) on the right
 * or a full-bleed atmosphere photo behind.
 */
export function PageHero({
  kicker,
  lines,
  lead,
  actions,
  visual,
  art,
  artPosition,
  footer,
  className,
  compact = false,
}: {
  kicker: string;
  lines: ReactNode[];
  lead?: ReactNode;
  actions?: ReactNode;
  visual?: ReactNode;
  /** Own artwork behind the hero (graded ember). */
  art?: ArtName;
  artPosition?: string;
  footer?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <header className={cn('relative isolate overflow-hidden', className)}>
      {art && (
        <div className="absolute inset-0 -z-10">
          <Art name={art} priority sizes="100vw" position={artPosition} className="h-full w-full" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,10,0.96)_0%,rgba(7,7,10,0.8)_40%,rgba(7,7,10,0.25)_100%)] max-lg:bg-[linear-gradient(180deg,rgba(7,7,10,0.55)_0%,rgba(7,7,10,0.85)_55%,rgba(7,7,10,0.98)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink to-transparent" />
        </div>
      )}
      {!art && (
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="glow-ember right-[-12%] top-[-30%] h-[80vh] w-[70vw] opacity-50 animate-glow-pulse" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
        </div>
      )}
      <GridLines at={[0, 25, 75, 100]} className="-z-10 opacity-60" />
      <div
        className={cn(
          'container-site relative grid items-center gap-12 pb-16 pt-32 sm:pt-36 lg:gap-10',
          visual ? 'lg:grid-cols-[1.02fr_1fr]' : '',
          compact ? 'min-h-[56svh] lg:pb-20' : 'min-h-[78svh] lg:pb-24',
        )}
      >
        <div className="flex flex-col gap-7">
          <span className="kicker fade-up-now" style={{ ['--d' as string]: '0.05s' }}>
            {kicker}
          </span>
          <Headline as="h1" now lines={lines} delay={0.1} className="t-h1 max-w-[16ch] text-balance" />
          {lead && (
            <p className="t-lead fade-up-now max-w-xl" style={{ ['--d' as string]: '0.45s' }}>
              {lead}
            </p>
          )}
          {actions && (
            <div className="fade-up-now flex flex-wrap items-center gap-3" style={{ ['--d' as string]: '0.6s' }}>
              {actions}
            </div>
          )}
          {footer && (
            <div className="fade-up-now" style={{ ['--d' as string]: '0.75s' }}>
              {footer}
            </div>
          )}
        </div>
        {visual && (
          <div className="fade-up-now relative" style={{ ['--d' as string]: '0.35s' }}>
            {visual}
          </div>
        )}
      </div>
    </header>
  );
}
