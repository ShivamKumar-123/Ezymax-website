'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { clsx } from 'clsx';

export interface FaqItem { q: string; a: React.ReactNode }

/**
 * Accessible FAQ accordion — native button headers, one panel open at a
 * time. Used on the homepage and the standalone /faq page.
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  /* Redesign 2026-09-01: filled, individually-bordered cards became a
     single ruled list. On a light canvas a stack of bordered boxes reads
     as noise, and the reference resolves FAQs as hairline-separated rows
     — which also lets a long question wrap without the row growing a
     visible outline. */
  return (
    <div className="flex flex-col" style={{ borderTop: '1px solid var(--mk-line)' }}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} style={{ borderBottom: '1px solid var(--mk-line)' }}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors"
            >
              <span
                className="text-[15px] font-semibold"
                style={{ color: isOpen ? 'var(--mk-accent)' : 'var(--mk-text)' }}
              >
                {item.q}
              </span>
              <Plus
                size={18}
                className={clsx('shrink-0 transition-transform duration-200', isOpen && 'rotate-45')}
                style={{ color: isOpen ? 'var(--mk-accent)' : 'var(--mk-text-faint)' }}
              />
            </button>
            {isOpen && (
              <div className="-mt-1 pb-6 pr-10">
                <div className="mk-body">{item.a}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
