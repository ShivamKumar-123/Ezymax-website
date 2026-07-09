'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function CtFaqList({ items, title = 'FAQ' }) {
  const [open, setOpen] = useState(null)

  return (
    <div className="fx-tile overflow-hidden">
      {/* ── Two-column intro header ────────────────────────── */}
      <div className="fx-split-intro px-5 md:px-8 pt-6 md:pt-8">
        <div>
          <span className="fx-eyebrow mb-4">{title}</span>
          <h2 className="fx-headline text-2xl md:text-3xl mt-4">
            Common <span className="gradient-text">Questions</span>
          </h2>
        </div>
      </div>

      <ul className="mt-6 md:mt-8">
        {items.map((it, i) => {
          const isOpen = open === i
          return (
            <li
              key={it.q}
              style={{
                borderTop: '1px solid var(--fx-line)',
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 md:px-8 py-4 text-left transition-colors"
                style={{
                  background: isOpen ? 'rgba(214,169,61,0.04)' : 'transparent',
                }}
              >
                <span className="text-sm md:text-[15px] font-semibold text-white">
                  {it.q}
                </span>
                <ChevronDown
                  size={16}
                  className="shrink-0 transition-transform duration-200"
                  style={{
                    color: 'var(--fx-gold-light)',
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                  }}
                />
              </button>
              <div
                className="overflow-hidden transition-[max-height,padding] duration-300 ease-in-out"
                style={{
                  maxHeight: isOpen ? '320px' : '0',
                  paddingTop: isOpen ? '0' : '0',
                  paddingBottom: isOpen ? '16px' : '0',
                }}
              >
                <div
                  className="px-5 md:px-8 text-sm leading-relaxed"
                  style={{ color: 'var(--fx-text-2)' }}
                >
                  {it.a}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
