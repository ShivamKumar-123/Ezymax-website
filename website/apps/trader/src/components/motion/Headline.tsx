import type { ElementType, ReactNode, CSSProperties } from 'react';
import { cn } from '@/lib/cn';

/**
 * Display headline revealed line by line (a masked slide-up, staggered).
 * Lines are authored, not measured, so the server HTML is final, translation tools see whole phrases, and nothing
 * shifts. `now` plays on first paint (hero); otherwise it plays when scrolled into view (RevealRoot).
 */
export function Headline({
  as: Tag = 'h2',
  lines,
  className,
  lineClassName,
  now = false,
  delay = 0,
  style,
  id,
}: {
  as?: ElementType;
  lines: ReactNode[];
  className?: string;
  lineClassName?: string;
  now?: boolean;
  delay?: number;
  style?: CSSProperties;
  id?: string;
}) {
  return (
    <Tag id={id} className={cn('headline', className)} data-split={now ? 'now' : ''} style={style}>
      {lines.map((line, i) => (
        <span key={i} className={cn('hl-line', lineClassName)}>
          <span className="hl-in" style={{ '--i': i, '--d': `${delay}s` } as CSSProperties}>
            {line}
          </span>
          {i < lines.length - 1 ? ' ' : null}
        </span>
      ))}
    </Tag>
  );
}
