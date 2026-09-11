'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import Eyebrow from './ui/Eyebrow'
import ExploreLink from './ui/ExploreLink'
import Reveal from '@/landing/textura/Reveal'
import { HEADING_SECTION, TEXT_STAT } from './ui/headings'
import { useLang } from '@/landing/i18n/LangProvider'

const CARD_IDS = ['c1', 'c2', 'c3'] as const

export default function Pricing() {
  const { t } = useLang()
  return (
    <section className="bg-tx-bg">
      <div className="w-full mx-auto px-6 md:px-10 lg:px-16 py-20 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <Reveal y={36}>
            <div className="bg-tx-surface rounded-3xl px-8 py-14 md:py-20 flex flex-col items-center justify-center text-center">
              <div className="text-2xl md:text-3xl font-semibold tracking-[-0.02em] text-tx-strong">
                {t('pricing.from')}
              </div>
              <div className={`${TEXT_STAT} mt-2`}>1.1</div>
              <div className="text-xl md:text-2xl font-semibold tracking-[-0.02em] text-tx-muted mt-2">
                {t('pricing.pips')}
              </div>
            </div>
          </Reveal>

          <div>
            <Reveal>
              <Eyebrow>{t('pricing.eyebrow')}</Eyebrow>
              <h2 className={`mt-4 ${HEADING_SECTION}`}>
                {t('pricing.titleA')}{' '}
                <span className="text-tx-muted">{t('pricing.titleB')}</span>
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="mt-6 text-base md:text-lg text-tx-muted leading-relaxed">
                {t('pricing.lead')}
              </p>
              <p className="mt-3 text-sm text-tx-muted">{t('pricing.sub')}</p>
            </Reveal>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {CARD_IDS.map((id, i) => (
                <Reveal key={id} delay={0.06 * i} className="h-full">
                  <div className="h-full bg-tx-bg border border-tx-line hover:border-tx-strong/40 transition-colors duration-fast ease-entrance rounded-2xl p-5 flex flex-col gap-3">
                    <h3 className="text-sm font-semibold text-tx-strong leading-snug">
                      {t(`pricing.cards.${id}.t`)}
                    </h3>
                    <p className="text-xs text-tx-muted leading-relaxed">
                      {t(`pricing.cards.${id}.b`)}
                    </p>
                    <ExploreLink className="mt-auto">{t('pricing.explore')}</ExploreLink>
                  </div>
                </Reveal>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                aria-label="Previous"
                className="w-9 h-9 rounded-full border border-tx-line flex items-center justify-center text-tx-strong hover:bg-tx-surface transition-colors duration-fast ease-entrance"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2} />
              </button>
              <button
                type="button"
                aria-label="Next"
                className="w-9 h-9 rounded-full bg-tx-strong text-tx-bg flex items-center justify-center hover:bg-tx-ink transition-colors duration-fast ease-entrance"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
