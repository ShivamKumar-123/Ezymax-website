'use client'

import Image from 'next/image'
import ExploreLink from './ui/ExploreLink'
import Eyebrow from './ui/Eyebrow'
import Reveal from '@/landing/textura/Reveal'
import { HEADING_SECTION } from './ui/headings'
import { useLang } from '@/landing/i18n/LangProvider'

const CARD_KEYS = [
  { id: 'metals', href: '/platforms' },
  { id: 'currency', href: '/platforms' },
  { id: 'cfds', href: '/platforms' },
] as const

export default function DifferentBank() {
  const { t } = useLang()
  return (
    <section className="bg-tx-bg">
      <div className="w-full px-6 md:px-10 lg:px-16 py-16 md:py-24">
        <div className="bg-tx-surface rounded-3xl px-6 md:px-10 lg:px-16 py-14 md:py-20">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-16 items-center">
            <div className="md:col-span-5 order-2 md:order-1 flex justify-center md:justify-start">
              <Reveal y={36} className="relative w-full max-w-[680px] aspect-[5/4]">
                <div
                  aria-hidden="true"
                  className="absolute inset-6 rounded-3xl bg-tx-strong/[0.05] blur-3xl"
                />
                <Image
                  src="/assets/bull.png"
                  alt="SwissCresta — bullish on your future"
                  fill
                  sizes="(max-width: 768px) 100vw, 680px"
                  className="relative object-contain drop-shadow-[0_28px_48px_rgba(10,10,10,0.18)]"
                />
              </Reveal>
            </div>
            <div className="md:col-span-7 order-1 md:order-2">
              <Reveal>
                <h2 className={HEADING_SECTION}>
                  {t('bank.titleA')} <span className="text-tx-muted">{t('bank.titleB')}</span>
                </h2>
              </Reveal>
              <Reveal delay={0.08}>
                <p className="mt-6 text-base md:text-lg text-tx-muted leading-relaxed">
                  {t('bank.lead')}
                </p>
                <p className="mt-4 text-base text-tx-muted leading-relaxed">
                  {t('bank.sub')}
                </p>
              </Reveal>
            </div>
          </div>

          <div className="mt-14">
            <Reveal>
              <Eyebrow>{t('bank.eyebrow')}</Eyebrow>
            </Reveal>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {CARD_KEYS.map((card, i) => (
                <Reveal key={card.id} delay={0.06 * i} className="h-full">
                  <div className="h-full bg-tx-bg rounded-2xl p-7 md:p-8 flex flex-col gap-4 border border-tx-line hover:border-tx-strong/40 transition-colors duration-fast ease-entrance">
                    <h3 className="text-xl md:text-2xl font-semibold tracking-[-0.02em] text-tx-strong">
                      {t(`bank.cards.${card.id}.title`)}
                    </h3>
                    <p className="text-sm text-tx-muted leading-relaxed">
                      {t(`bank.cards.${card.id}.body`)}
                    </p>
                    <ExploreLink href={card.href} className="text-base mt-auto">
                      {t('bank.explore')}
                    </ExploreLink>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
