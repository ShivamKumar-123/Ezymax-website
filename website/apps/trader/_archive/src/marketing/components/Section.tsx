import { clsx } from 'clsx';

/**
 * Page section wrapper — owns the vertical rhythm and the container width
 * so individual pages never hand-roll padding. `raised` lifts the band off
 * the page canvas to separate adjacent sections without needing a border.
 */
export function Section({
  children, className, raised = false, id,
}: {
  children: React.ReactNode;
  className?: string;
  raised?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={clsx('mk-section', raised && 'mk-section--raised', className)}>
      <div className="mk-container">{children}</div>
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
