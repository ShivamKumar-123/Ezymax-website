'use client'

import { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'

export default function CtFaqList({ items, title = 'FAQ' }) {
  const [open, setOpen] = useState(null)

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, var(--fx-bg-elev) 0%, var(--fx-bg-elev-2) 100%)',
        border: '1px solid var(--fx-line-strong)',
      }}
    >
      <div
        className="flex items-center gap-2 px-5 md:px-6 py-3.5"
        style={{
          background: 'rgba(214,169,61,0.05)',
          borderBottom: '1px solid var(--fx-line)',
        }}
      >
        <HelpCircle size={14} style={{ color: 'var(--fx-gold-light)' }} />
        <span
          className="text-[11px] font-bold uppercase tracking-[0.22em]"
          style={{ color: 'var(--fx-gold-light)' }}
        >
          {title}
        </span>
      </div>
      <ul>
        {items.map((it, i) => {
          const isOpen = open === i
          return (
            <li
              key={it.q}
              style={{
                borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--fx-line)',
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 md:px-6 py-4 text-left transition-colors"
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
                  className="px-5 md:px-6 text-sm leading-relaxed"
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
