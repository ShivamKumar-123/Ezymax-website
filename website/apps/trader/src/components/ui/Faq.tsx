import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';

export type FaqItem = { q: string; a: ReactNode };

/** Accessible accordion on native <details>; no JavaScript. Emits FAQPage structured data when `schema` is set. */
export function Faq({ items, schema = false }: { items: FaqItem[]; schema?: boolean }) {
  const ld = schema
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items
          .filter((i) => typeof i.a === 'string')
          .map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
      }
    : null;
  return (
    <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
      {items.map((item) => (
        <details key={item.q} className="group/faq py-1" data-reveal>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-[1.05rem] font-medium text-fg transition-colors hover:text-white [&::-webkit-details-marker]:hidden">
            {item.q}
            <span className="grid h-9 w-9 flex-none place-items-center rounded-full border border-white/15 transition-transform duration-500 group-open/faq:rotate-45 group-open/faq:border-ember group-open/faq:bg-ember group-open/faq:text-[#120804]">
              <Plus size={16} aria-hidden />
            </span>
          </summary>
          <div className="t-body max-w-3xl pb-6 pr-12">{item.a}</div>
        </details>
      ))}
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />}
    </div>
  );
}
