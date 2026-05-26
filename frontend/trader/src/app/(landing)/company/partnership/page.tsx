'use client'

import IbHero from '@/landing/pages/partnership/IbHero'
import IbWhat from '@/landing/pages/partnership/IbWhat'
import IbHow from '@/landing/pages/partnership/IbHow'
import IbBenefits from '@/landing/pages/partnership/IbBenefits'
import IbDashboard from '@/landing/pages/partnership/IbDashboard'
import IbAudience from '@/landing/pages/partnership/IbAudience'
import IbTrust from '@/landing/pages/partnership/IbTrust'
import IbFaq from '@/landing/pages/partnership/IbFaq'
import IbCTA from '@/landing/pages/partnership/IbCTA'
import FxPageBanner from '@/landing/components/FxPageBanner'

export default function PartnershipPage() {
  return (
    <>
      <IbHero />
      <IbWhat />
      <IbHow />
      <FxPageBanner
        image="/images/partner_banner1.png"
        alt="FX Artha Partnership"
        tagline="Grow with FX Artha."
        taglineSub="Turn your trading network into recurring, performance-based income."
      />
      <IbBenefits />
      <IbDashboard />
      <IbAudience />
      <FxPageBanner
        image="/images/partner_banner2.png"
        alt="FX Artha Partnership"
        tone="elev"
        tagline="Built for partners."
        taglineSub="Transparent rewards tied to real activity — no opaque tiers."
      />
      <IbTrust />
      <IbFaq />
      <IbCTA />
    </>
  )
}
