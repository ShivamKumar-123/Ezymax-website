import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { pageMetadata } from "@/lib/seo";
import { liquidityPage } from "@/content/liquidity";
import { PageHero } from "@/components/sections/shared/PageHero";
import { Timeline } from "@/components/sections/shared/Timeline";
import { FeatureList } from "@/components/sections/shared/FeatureList";
import { CTABand } from "@/components/sections/shared/CTABand";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = pageMetadata({
  title: "Liquidity Connectivity",
  description:
    "Connect your brokerage to regulated liquidity providers through SetupZero's bridge and FIX technology, with full control over routing and markups.",
  path: "/liquidity",
});

export default function LiquidityPage() {
  const l = liquidityPage;
  return (
    <>
      <PageHero
        eyebrow={l.eyebrow}
        headline={l.headline}
        highlight={l.highlight}
        sub={l.sub}
        ctas={l.cta.ctas}
        badges={l.assetClasses}
      />
      <Timeline eyebrow="Process" heading={l.howHeading} steps={l.steps} />
      <FeatureList eyebrow="Why it works" heading={l.benefitsHeading} features={l.benefits} columns={4} />
      <section className="relative py-6">
        <div className="container-x">
          <Reveal>
            <div className="flex items-start gap-4 rounded-card border-l-2 border-orange-500 glass px-6 py-5">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-orange-400" />
              <div>
                <p className="bracket">{l.disclaimerTitle}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{l.disclaimer}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
      <CTABand block={l.cta} />
    </>
  );
}
