import type { Metadata } from "next";

import { Hero } from "@/components/sections/home/Hero";
import { HowItWorks } from "@/components/sections/home/HowItWorks";
import { MarketsOverview } from "@/components/sections/home/MarketsOverview";
import { PlatformGrid } from "@/components/sections/home/PlatformGrid";
import { TrustBar } from "@/components/sections/home/TrustBar";
import { WhyEzymex } from "@/components/sections/home/WhyEzymex";
import { CTABand } from "@/components/sections/shared/CTABand";
import { finalCta } from "@/content/home";
import { site } from "@/content/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    title: `${site.name} | ${site.tagline}`,
    description: site.positioning,
    url: "/",
    siteName: site.name,
    type: "website",
    locale: "en_US",
  },
};

/**
 * The testimonials section that used to sit between WhyEzymex and the closing
 * CTA is gone. All three quotes were marked `placeholder: true` and rendered a
 * visible "pending" badge; this is a pre-launch, invite-only platform with no
 * client to quote, so the honest version of that section is no section.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <MarketsOverview />
      <PlatformGrid />
      <HowItWorks />
      <WhyEzymex />
      <CTABand block={finalCta} />
    </>
  );
}
