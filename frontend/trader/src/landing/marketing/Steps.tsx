'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import Button from './ui/Button'
import Reveal from '@/landing/textura/Reveal'
import { HEADING_SECTION } from './ui/headings'
import { useLang } from '@/landing/i18n/LangProvider'

/* Reference-style cards: each card uses its own full-bleed artwork as
 * the background (no gradient/tint overlay). A translucent tag pill sits
 * bottom-left and a circular arrow action bottom-right. Textura theme:
 * the arrow chip is monochrome ink for every card. */
const STEPS = [
  { id: 's1', image: '/assets/hero_card1.png' },
  { id: 's2', image: '/assets/hero_card2.png' },
  { id: 's3', image: '/assets/hero_card3.png' },
] as const

export default function Steps() {
  const { t } = useLang()
  return (
    <section className="bg-tx-bg">
      <div className="w-full mx-auto px-6 md:px-10 lg:px-16 py-20 md:py-28">
        <div className="max-w-3xl mx-auto text-center">
          <Reveal>
            <h2 className={HEADING_SECTION}>
              {t('steps.titleA')} <span className="text-tx-muted">{t('steps.titleB')}</span>
            </h2>
          </Reveal>
        </div>

        <ol className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {STEPS.map(({ id, image }, i) => (
            <li key={id} className="list-none">
              <Reveal delay={0.07 * i} className="h-full">
                <Link
                  href="/auth/register"
                  className="group relative flex h-full min-h-[300px] flex-col overflow-hidden rounded-3xl bg-cover bg-center p-7 md:p-8 text-white shadow-[0_24px_60px_-22px_rgba(10,10,10,0.45)] transition-transform duration-normal ease-entrance hover:-translate-y-1"
                  style={{ backgroundImage: `url(${image})` }}
                >
                  {/* faint step-number watermark — kept clear of the top
                      edge and sized so it no longer collides with / gets
                      clipped by the heading and the rounded card corner. */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-5 top-5 text-5xl font-semibold leading-none text-white/40"
                  >
                    0{i + 1}
                  </span>

                  {/* heading + copy — right padding keeps the title from
                      running underneath the step-number watermark. */}
                  <h3 className="relative pr-12 text-xl font-semibold leading-snug">{t(`steps.${id}.t`)}</h3>
                  <p className="relative mt-3 max-w-[94%] text-sm leading-relaxed text-white/80">
                    {t(`steps.${id}.d`)}
                  </p>

                  {/* footer: tag pill + circular arrow */}
                  <div className="relative mt-auto flex items-center justify-between pt-6">
                    <span className="rounded-full bg-white/15 px-4 py-1.5 text-xs font-medium text-white ring-1 ring-white/25 backdrop-blur-sm">
                      {t(`steps.${id}.tag`)}
                    </span>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-tx-strong shadow-md transition-transform duration-fast ease-entrance group-hover:translate-x-0.5">
                      <ArrowRight className="h-4 w-4" strokeWidth={2} />
                    </span>
                  </div>
                </Link>
              </Reveal>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex justify-center">
          <Reveal delay={0.15}>
            <Button variant="primary" href="/auth/register">
              {t('steps.cta')}
            </Button>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
