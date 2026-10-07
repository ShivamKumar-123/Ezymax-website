import { clsx } from 'clsx';
import { SectionDecor, CornerMarks, type DecorVariant } from '@/home/components/SectionDecor';

/**
 * Page section wrapper — owns the vertical rhythm and the container width
 * so individual pages never hand-roll padding. `raised` lifts the band off
 * the page canvas to separate adjacent sections without needing a border.
 */
export function Section({
  children, className, raised = false, id, decor, corners, ruled = false, wide = false,
}: {
  children: React.ReactNode;
  className?: string;
  raised?: boolean;
  id?: string;
  /** Background motif for this band — see components/SectionDecor.tsx.
   *  Each section on a page should pick a different one; that is the
   *  whole point of the prop. */
  decor?: DecorVariant;
  /** Which corner crop marks to draw, and in what tone. */
  corners?: { at?: Array<'tl' | 'tr' | 'bl' | 'br'>; tone?: 'accent' | 'navy' | 'ink' };
  /** Gradient hairline across the top edge, as a deliberate band divider. */
  ruled?: boolean;
  /** Widen the measure from 1200 to 1320 for grid-heavy sections. */
  wide?: boolean;
}) {
  const decorated = Boolean(decor || corners || ruled);
  return (
    <section
      id={id}
      className={clsx(
        'mk-section',
        raised && 'mk-section--raised',
        decorated && 'ez-section',
        ruled && 'ez-section--ruled',
        className,
      )}
    >
      {decor && <SectionDecor variant={decor} />}
      {corners && <CornerMarks corners={corners.at} tone={corners.tone} />}
      <div className={clsx('mk-container', wide && 'mk-container--wide')}>{children}</div>
    </section>
  );
}

/**
 * Kicker + title + optional standfirst. Every section heading on the
 * marketing site goes through this so the type scale stays consistent.
 */
export function SectionHeading({
  kicker, title, lead, align = 'center', className,
}: {
  kicker?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: 'center' | 'left';
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'flex flex-col gap-4',
        align === 'center'
          ? 'items-center text-center mx-auto max-w-3xl'
          : 'items-start text-left max-w-2xl',
        className,
      )}
    >
      {kicker && <span className="mk-kicker">{kicker}</span>}
      <h2 className="mk-h2">{title}</h2>
      {lead && <p className="mk-lead">{lead}</p>}
    </div>
  );
}
