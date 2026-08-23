'use client'

import Eyebrow from './ui/Eyebrow'
import ExploreLink from './ui/ExploreLink'
import Reveal from '@/landing/textura/Reveal'
import { HEADING_SECTION } from './ui/headings'
import { useLang } from '@/landing/i18n/LangProvider'

interface Coin {
  size: number
  top: string
  left?: string
  right?: string
}

const COINS: Coin[] = [
  { size: 56, top: '6%', left: '8%' },
  { size: 80, top: '20%', left: '14%' },
  { size: 44, top: '52%', left: '4%' },
  { size: 64, top: '70%', left: '18%' },
  { size: 72, top: '12%', right: '10%' },
  { size: 96, top: '40%', right: '6%' },
  { size: 56, top: '72%', right: '14%' },
]

export default function Crypto() {
  const { t } = useLang()
  return (
    <section className="bg-tx-bg">
      <div className="w-full mx-auto px-6 md:px-10 lg:px-16 py-12 md:py-16">
        <div className="relative bg-tx-surface rounded-3xl px-6 md:px-10 lg:px-16 py-20 md:py-28 overflow-hidden">
          {COINS.map((coin, i) => (
            <div
              key={i}
              className="hidden md:block absolute rounded-full bg-tx-strong/[0.04] border border-tx-line"
              style={{
                width: coin.size,
                height: coin.size,
                top: coin.top,
                left: coin.left,
                right: coin.right,
              }}
              aria-hidden="true"
            />
          ))}

          <div className="relative max-w-2xl mx-auto text-center">
            <Reveal>
              <div className="flex justify-center">
                <Eyebrow>{t('crypto.eyebrow')}</Eyebrow>
              </div>
              <h2 className={`mt-4 ${HEADING_SECTION}`}>
                {t('crypto.titleA')} <span className="text-tx-faint">{t('crypto.titleB')}</span>
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="mt-6 text-base md:text-lg text-tx-muted leading-relaxed">
                {t('crypto.lead')}
              </p>
              <p className="mt-4 text-xs italic text-tx-faint">{t('crypto.regulated')}</p>
              <div className="mt-6 flex justify-center">
                <ExploreLink>{t('crypto.explore')}</ExploreLink>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
