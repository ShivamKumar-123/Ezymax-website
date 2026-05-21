'use client'

import AbHero from '@/landing/pages/about/AbHero'
import AbVision from '@/landing/pages/about/AbVision'
import AbWhatMakes from '@/landing/pages/about/AbWhatMakes'
import AbHowItWorks from '@/landing/pages/about/AbHowItWorks'
import AbEcosystem from '@/landing/pages/about/AbEcosystem'
import AbPhilosophy from '@/landing/pages/about/AbPhilosophy'
import AbSecurity from '@/landing/pages/about/AbSecurity'
import AbAudience from '@/landing/pages/about/AbAudience'
import AbFutureVision from '@/landing/pages/about/AbFutureVision'
import AbCTA from '@/landing/pages/about/AbCTA'
import FxPageBanner from '@/landing/components/FxPageBanner'

export default function AboutUsPage() {
  return (
    <>
      <AbHero />
      <AbVision />
      <AbWhatMakes />
      <FxPageBanner label="Banner / Image" />
      <AbHowItWorks />
      <AbEcosystem />
      <AbPhilosophy />
      <FxPageBanner label="Banner / Image" tone="elev" />
      <AbSecurity />
      <AbAudience />
      <AbFutureVision />
      <FxPageBanner label="Banner / Image" />
      <AbCTA />
    </>
  )
}
