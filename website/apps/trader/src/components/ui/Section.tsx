import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Headline } from '@/components/motion/Headline';

/** Kicker + split headline + lead, the opening of most sections. */
export function SectionHead({
  kicker,
  lines,
  lead,
  align = 'left',
  className,
  as = 'h2',
  size = 'h2',
  id,
}: {
  kicker?: string;
  lines: ReactNode[];
  lead?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
  size?: 'h1' | 'h2' | 'display';
  id?: string;
}) {
  const sizeCls = size === 'display' ? 't-display' : size === 'h1' ? 't-h1' : 't-h2';
  return (
    <div className={cn('flex flex-col gap-6', align === 'center' && 'items-center text-center', className)}>
      {kicker && (
        <span className="kicker" data-reveal>
          {kicker}
        </span>
      )}
      <Headline as={as} id={id} lines={lines} className={cn(sizeCls, 'text-balance')} />
      {lead && (
        <p
          className={cn('t-lead max-w-2xl', align === 'center' && 'mx-auto')}
          data-reveal
          style={{ ['--reveal-delay' as string]: '0.15s' }}
        >
          {lead}
        </p>
      )}
    </div>
  );
}

/** Thin dashed vertical guides, as in the references. Positions are percentages of the container width. */
export function GridLines({ at = [0, 33.333, 66.666, 100], className }: { at?: number[]; className?: string }) {
  return (
    <div aria-hidden className={cn('gridlines container-site !absolute inset-x-0 mx-auto', className)}>
      {at.map((p) => (
        <div key={p} style={{ left: `calc(var(--gutter) + (100% - 2 * var(--gutter)) * ${p / 100})` }} />
      ))}
    </div>
  );
}

export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'li' | 'section' | 'article' | 'p' | 'span';
}) {
  return (
    <Tag data-reveal className={className} style={{ ['--reveal-delay' as string]: `${delay}s` }}>
      {children}
    </Tag>
  );
}

/** A labelled list of facts (dt/dd), used in cards and tables. */
export function FactList({ items, className }: { items: [string, ReactNode][]; className?: string }) {
  return (
    <dl className={cn('divide-y divide-white/[0.07]', className)}>
      {items.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-6 py-3">
          <dt className="text-sm text-fg-3">{k}</dt>
          <dd className="text-right text-sm font-medium text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
