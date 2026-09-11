'use client'

import Image from 'next/image'
import Button from './ui/Button'
import Eyebrow from './ui/Eyebrow'
import Reveal from '@/landing/textura/Reveal'
import TextReveal from '@/landing/textura/TextReveal'
import { useLang } from '@/landing/i18n/LangProvider'

export default function Hero() {
  const { t } = useLang()
  return (
    <section className="relative bg-tx-bg overflow-x-clip">
      <div className="grid grid-cols-1 md:grid-cols-2 min-h-[640px] md:min-h-[720px] lg:min-h-[760px]">
        <div className="relative flex items-center bg-tx-bg px-6 md:px-10 lg:px-16 py-16 md:py-20 lg:py-24">
          <div className="w-full max-w-2xl">
            <Reveal>
              <Eyebrow>{t('hero.eyebrow')}</Eyebrow>
            </Reveal>
            <h1 className="mt-6 font-semibold tracking-[-0.04em] leading-[1.08] text-tx-strong text-[clamp(2.8rem,5.8vw,5.75rem)]">
              <TextReveal delay={0.05}>{t('hero.headlineA')}</TextReveal>
              <TextReveal delay={0.12}>
                <span className="text-tx-muted">{t('hero.headlineB')}</span>
              </TextReveal>
              <TextReveal delay={0.19}>{t('hero.headlineC')}</TextReveal>
            </h1>
            <Reveal delay={0.25}>
              <p className="mt-7 text-base md:text-lg text-tx-muted leading-relaxed max-w-xl">
                {t('hero.sub')}
              </p>
            </Reveal>
            <Reveal delay={0.32}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button variant="primary" href="/contact">{t('hero.ctaOpen')}</Button>
                <Button variant="outline" href="/platforms">{t('hero.ctaDemo')}</Button>
              </div>
            </Reveal>
          </div>
        </div>

        <div className="relative bg-tx-bg min-h-[420px] md:min-h-0 flex items-center justify-center p-8 md:p-10 lg:p-14">
          <Reveal delay={0.2} y={36} className="relative w-full h-full max-w-[680px]">
            <div
              aria-hidden="true"
              className="absolute inset-6 md:inset-8 rounded-full bg-tx-strong/[0.05] blur-3xl"
            />
            <Image
              src="/assets/hero page.png"
              alt="SwissCresta trading platform"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="relative object-contain drop-shadow-[0_30px_50px_rgba(10,10,10,0.18)]"
            />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
