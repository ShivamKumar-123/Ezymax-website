'use client'

import { Info } from 'lucide-react'
import { useLang } from '@/landing/i18n/LangProvider'

/**
 * Sits under any section that lists platform capabilities.
 *
 * Those sections name things like liquidity routing, MAM/PAMM, copy trading
 * and algorithmic execution. Read quickly, a list like that is exactly what a
 * brokerage's own site would show, and a visitor could reasonably conclude we
 * run these services ourselves. We do not — we build them into a platform the
 * client operates under their own licence.
 *
 * This states that in one line, next to the features rather than buried in the
 * footer disclaimer, so the distinction is made where the confusion would
 * otherwise start.
 */
export default function CapabilityNote() {
  const { t } = useLang()
  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 pb-14 -mt-2">
      <div className="flex items-start gap-3 rounded-xl border border-tx-line bg-tx-bg/60 px-5 py-4">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-tx-faint" aria-hidden />
        <p className="text-sm leading-relaxed text-tx-muted">
          <span className="font-semibold text-tx-strong">{t('capabilityNote.lead')}</span>{' '}
          {t('capabilityNote.body')}
        </p>
      </div>
    </div>
  )
}
