import Link from 'next/link';

/**
 * Closing conversion band. Sits above the footer on every marketing page
 * so each one ends with the same next step.
 *
 * 2026-09-01 redesign: rendered as a full-bleed black band rather than a
 * bordered card with an accent bloom. The reference uses one dark band per
 * page as its strongest emphasis, and putting it here means every
 * marketing page resolves to the same closing beat before the footer —
 * which is also black, so the two now meet without a seam.
 */
export function CtaBanner({
  title, lead, primary, secondary,
}: {
  title: React.ReactNode;
  lead?: React.ReactNode;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <section className="mk-section mk-section--ink">
      <div className="mk-container">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <h2 className="mk-h2">{title}</h2>
          {lead && <p className="mk-lead">{lead}</p>}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <Link href={primary.href} className="mk-btn mk-btn--primary mk-btn--lg">
              {primary.label}
            </Link>
            {secondary && (
              <Link href={secondary.href} className="mk-btn mk-btn--ghost mk-btn--lg">
                {secondary.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
