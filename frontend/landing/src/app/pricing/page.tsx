import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { pricingPage, pricingRows, pricingTiers } from "@/content/pricing";
import { finalCta } from "@/content/home";
import { PageHero } from "@/components/sections/shared/PageHero";
import { PricingTable } from "@/components/sections/shared/PricingTable";
import { CTABand } from "@/components/sections/shared/CTABand";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = pageMetadata({
  title: "Pricing",
  description: "Starter, Growth and Enterprise packages for brokers, prop firms and fintechs. All packages include hosting, updates and onboarding.",
  path: "/pricing",
});

export default function PricingPage() {
  return (
    <>
      <PageHero eyebrow={pricingPage.eyebrow} headline={pricingPage.headline} highlight={pricingPage.highlight} sub={pricingPage.sub} compact />
      <section className="relative pb-10">
        <div className="container-x">
          <PricingTable tiers={pricingTiers} rows={pricingRows} />
          <Reveal>
            <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-muted">{pricingPage.note}</p>
          </Reveal>
        </div>
      </section>
      <CTABand block={{ ...finalCta, heading: "Need a custom quote?", sub: "Tell us your stage and modules and we will send a tailored package within 24 hours." }} />
    </>
  );
}
