import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { products } from "@/content/products";
import { productImage } from "@/content/images";
import { ImageCard } from "@/components/ui/ImageCard";
import { productsSection, finalCta } from "@/content/home";
import { PageHero } from "@/components/sections/shared/PageHero";
import { CTABand } from "@/components/sections/shared/CTABand";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = pageMetadata({
  title: "Products",
  description:
    "Trading platform, Forex CRM, Trader's Room, liquidity bridge, risk management, copy trading, IB module, payment integrations and mobile apps.",
  path: "/products",
});

export default function ProductsPage() {
  return (
    <>
      <PageHero
        eyebrow={productsSection.eyebrow}
        headline={productsSection.heading}
        highlight={productsSection.highlight}
        sub="Every module is available standalone and integrates with your existing systems, or take the full stack under one contract."
        compact
      />
      <section className="relative pb-10">
        <div className="container-x grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p, i) => (
            <Reveal key={p.slug} delay={Math.min(i * 0.05, 0.35)}>
              <ImageCard title={p.nav.label} body={p.summary} href={`/products/${p.slug}`} image={productImage(p.slug)} index={i} />
            </Reveal>
          ))}
        </div>
      </section>
      <CTABand block={finalCta} />
    </>
  );
}
