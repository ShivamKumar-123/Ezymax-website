'use client'

import Image from 'next/image'
import Eyebrow from './ui/Eyebrow'
import Reveal from '@/landing/textura/Reveal'
import { HEADING_SECTION } from './ui/headings'
import { useLang } from '@/landing/i18n/LangProvider'

export default function Platforms() {
  const { t } = useLang()
  return (
    <section className="bg-tx-bg">
      <div className="w-full mx-auto px-6 md:px-10 lg:px-16 py-20 md:py-28">
        <div className="text-center max-w-3xl mx-auto">
          <Reveal>
            <div className="flex justify-center">
              <Eyebrow>{t('platforms.eyebrow')}</Eyebrow>
            </div>
            <h2 className={`mt-4 ${HEADING_SECTION}`}>
              {t('platforms.titleA')} <span className="text-tx-muted">{t('platforms.titleB')}</span>
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-6 text-base md:text-lg text-tx-muted leading-relaxed">
              {t('platforms.lead1')}{' '}
              <span className="font-semibold text-tx-strong">{t('platforms.lead2')}</span>.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.12} y={40} className="relative mt-14 md:mt-20 max-w-6xl mx-auto">
          <div
            aria-hidden="true"
            className="absolute -inset-6 md:-inset-10 rounded-[2.5rem] bg-tx-strong/[0.04] blur-3xl"
          />
          <Image
            src="/assets/trading platform.png"
            alt="SwissCresta trading platform"
            width={1920}
            height={1080}
            priority={false}
            className="relative w-full h-auto object-contain rounded-2xl"
            sizes="(max-width: 768px) 100vw, 1200px"
          />
        </Reveal>
      </div>
    </section>
  )
}
