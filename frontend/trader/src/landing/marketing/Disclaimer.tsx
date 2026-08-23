'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useLang } from '@/landing/i18n/LangProvider'

interface DisclaimerProps {
  minimal?: boolean
}

const BOTTOM_LINKS: { id: 'privacy' | 'terms' | 'risk' | 'vuln'; href: string }[] = [
  { id: 'privacy', href: '/privacy' },
  { id: 'terms', href: '/terms' },
  { id: 'risk', href: '/risk' },
  { id: 'vuln', href: '/privacy#vulnerability' },
]

export default function Disclaimer({ minimal = false }: DisclaimerProps) {
  const { t } = useLang()
  return (
    <footer className="bg-tx-inverse text-tx-inverse-ink/70 text-[13px]">
      <div className="w-full mx-auto px-6 md:px-10 lg:px-16 py-12 md:py-16">
        <Link href="/" aria-label="SwissCresta home" className="inline-block mb-8">
          <span className="inline-flex items-center bg-white rounded-xl px-4 py-2">
            <Image
              src="/marketing/swisscresta-logo.png"
              alt="SwissCresta"
              width={1947}
              height={361}
              priority={false}
              className="h-8 md:h-9 w-auto"
            />
          </span>
        </Link>

        {!minimal && (
          <>
            <h3 className="text-tx-inverse-ink font-semibold text-sm uppercase tracking-[0.18em]">
              {t('disclaimer.title')}
            </h3>
            <p className="mt-4 leading-relaxed max-w-5xl">{t('disclaimer.p1')}</p>
            <p className="mt-4 leading-relaxed max-w-5xl">{t('disclaimer.p2')}</p>
            <p className="mt-4 leading-relaxed max-w-5xl">{t('disclaimer.p3')}</p>
            <p className="mt-4 leading-relaxed max-w-5xl text-tx-inverse-ink/80">{t('disclaimer.p4')}</p>
            <p className="mt-6 leading-relaxed max-w-5xl text-tx-inverse-ink/80">
              <span className="font-semibold text-tx-inverse-ink">{t('disclaimer.hq')}</span>{' '}
              {t('disclaimer.hqAddr')}
            </p>
          </>
        )}

        <div
          className={`${minimal ? '' : 'mt-10'} pt-6 ${minimal ? '' : 'border-t border-white/10'} flex flex-col md:flex-row md:items-center md:justify-between gap-3`}
        >
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {BOTTOM_LINKS.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                className="text-tx-inverse-ink/60 hover:text-tx-inverse-ink underline-offset-4 hover:underline transition-colors duration-fast ease-entrance"
              >
                {t(`disclaimer.links.${link.id}`)}
              </Link>
            ))}
          </div>
          <div className="text-right text-tx-inverse-ink/80">{t('disclaimer.copyright')}</div>
        </div>
      </div>
    </footer>
  )
}
