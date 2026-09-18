import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';

export interface FeatureItem {
  /** Any lucide-react icon (they are forwardRef components, so use the
   *  library's own type rather than a hand-rolled ComponentType — the
   *  narrower shape rejected every real icon). */
  icon?: LucideIcon;
  title: string;
  body: React.ReactNode;
  /** Caption for this card's image placeholder. Only rendered when the
   *  grid is in `media` mode; ignored otherwise. */
  mediaLabel?: string;
}

/**
 * Icon + title + copy cards. The workhorse block for benefit and
 * "what you get" sections across the marketing site.
 *
 * `media` switches the card to the reference's product-tile layout: a
 * reserved image area on top, then the title and copy. It is opt-in
 * because most call sites are benefit lists, where an empty image box
 * would be noise rather than structure.
 */
export function FeatureGrid({
  items, columns = 3, className, media = false, mediaRatio = '4x3',
}: {
  items: FeatureItem[];
  columns?: 2 | 3 | 4;
  className?: string;
  media?: boolean;
  mediaRatio?: '16x9' | '4x3' | '1x1' | '3x2';
}) {
  const cols = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }[columns];

  return (
    <div className={clsx('grid grid-cols-1 gap-5', cols, className)}>
      {items.map(({ icon: Icon, title, body, mediaLabel }) => (
        <article key={title} className="mk-card mk-card--hover flex flex-col gap-4">
          {media ? (
            <div className={clsx('mk-media', `mk-media--ratio-${mediaRatio}`)}>
              {mediaLabel ?? title}
            </div>
          ) : (
            Icon && (
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <Icon size={20} />
              </span>
            )
          )}
          <div className="flex flex-col gap-2">
            <h3 className="mk-h3">{title}</h3>
            <p className="mk-body">{body}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
