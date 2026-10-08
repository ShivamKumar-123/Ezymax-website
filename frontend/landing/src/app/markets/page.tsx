import type { Metadata } from "next";

import { CTABand } from "@/components/sections/shared/CTABand";
import { PageHero } from "@/components/sections/shared/PageHero";
import { ImageCard } from "@/components/ui/ImageCard";
import { Reveal } from "@/components/ui/Reveal";
import { finalCta, marketsOverview } from "@/content/home";
import { marketImage } from "@/content/images";
import { markets } from "@/content/markets";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Markets",
  description:
    "Trade forex, indices, commodities and crypto as CFDs on Ezymax, with costs itemised on the ticket and published margin call and stop-out levels.",
  path: "/markets",
});

export default function MarketsPage() {
  return (
    <>
      <PageHero
        eyebrow={marketsOverview.eyebrow}
        headline={marketsOverview.heading}
        highlight={marketsOverview.highlight}
        sub={marketsOverview.intro}
        compact
      />
      <section className="relative pb-10">
        <div className="container-x grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((m, i) => (
            <Reveal key={m.slug} delay={Math.min(i * 0.07, 0.4)}>
              <ImageCard
                title={m.nav.label}
                body={m.summary}
                href={`/markets/${m.slug}`}
                image={marketImage(m.slug)}
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
