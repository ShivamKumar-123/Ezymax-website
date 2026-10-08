import type { Metadata } from "next";

import { CTABand } from "@/components/sections/shared/CTABand";
import { PageHero } from "@/components/sections/shared/PageHero";
import { ImageCard } from "@/components/ui/ImageCard";
import { Reveal } from "@/components/ui/Reveal";
import { finalCta, platformSection } from "@/content/home";
import { platformImage } from "@/content/images";
import { platformProducts } from "@/content/platform";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Platform",
  description:
    "Web platform, MetaTrader 5, copy trading, funded accounts, Shield cover, risk tools, staking, XP rewards and the partner programme.",
  path: "/platform",
});

export default function PlatformPage() {
  return (
    <>
      <PageHero
        eyebrow={platformSection.eyebrow}
        headline={platformSection.heading}
        highlight={platformSection.highlight}
        sub={platformSection.intro}
        compact
      />
      <section className="relative pb-10">
        <div className="container-x grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {platformProducts.map((p, i) => (
            <Reveal key={p.slug} delay={Math.min(i * 0.07, 0.4)}>
              <ImageCard
                title={p.nav.label}
                body={p.summary}
                href={`/platform/${p.slug}`}
                image={platformImage(p.slug)}
                index={i}
              />
            </Reveal>
          ))}
        </div>
      </section>
      <CTABand block={finalCta} />
    </>
  );
}
