'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function CtFaqList({ items, title = 'FAQ', showHeader = true }) {
  // first question open by default, like the reference
  const [open, setOpen] = useState(0)

  return (
    <div>
      {/* ── Header (hidden when the parent section already provides one) ── */}
      {showHeader && (
        <div className="text-center mb-7 md:mb-9">
          <div className="flex justify-center">
            <span className="fx-eyebrow">{title}</span>
          </div>
          <h2 className="fx-headline text-2xl md:text-3xl lg:text-4xl mt-5">
            Frequently asked <span className="fx-gold-text">questions</span>
          </h2>
        </div>
      )}

      {/* ── Card accordion ── */}
      <div className="space-y-3 md:space-y-4">
        {items.map((it, i) => {
          const isOpen = open === i
          return (
            <div
              key={it.q}
              className="rounded-2xl transition-colors duration-200"
              style={{
                background: isOpen ? 'rgba(214,169,61,0.06)' : 'var(--fx-bg-elev-2)',
                border: isOpen
                  ? '1px solid rgba(214,169,61,0.38)'
                  : '1px solid var(--fx-line)',
                boxShadow: isOpen ? '0 24px 60px -40px rgba(214,169,61,0.4)' : 'none',
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? -1 : i)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 px-5 md:px-6 py-4 md:py-[18px] text-left"
              >
                <span className="text-sm md:text-[15px] font-semibold text-white">{it.q}</span>
                <span
                  className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200"
                  style={
                    isOpen
                      ? { background: 'linear-gradient(180deg, var(--fx-gold-light), var(--fx-gold))' }
                      : { background: 'var(--fx-bg-elev)', border: '1px solid var(--fx-line-strong)' }
                  }
                >
                  <ChevronDown
                    size={16}
                    className="transition-transform duration-300"
                    style={{
                      color: isOpen ? '#1a1408' : 'var(--fx-gold-light)',
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                    }}
                  />
                </span>
              </button>

              {/* smooth height reveal via grid-rows trick */}
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <p
                    className="px-5 md:px-6 pb-5 text-sm leading-relaxed"
                    style={{ color: 'var(--fx-text-2)' }}
                  >
                    {it.a}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
