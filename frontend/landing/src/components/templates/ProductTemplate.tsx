import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ProductPage } from "@/content/schema";
import { products } from "@/content/products";
import { getIcon } from "@/lib/icons";
import { PageHero } from "@/components/sections/shared/PageHero";
import { BulletList } from "@/components/sections/shared/BulletList";
import { CTABand } from "@/components/sections/shared/CTABand";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function ProductTemplate({ page }: { page: ProductPage }) {
  const related = products.filter((p) => p.slug !== page.slug).slice(0, 4);
  return (
    <>
      <PageHero
        eyebrow={page.hero.eyebrow}
        headline={page.hero.headline}
        highlight={page.hero.highlight}
        sub={page.hero.sub}
        ctas={page.hero.ctas}
        badges={page.hero.badges}
      />
      <BulletList eyebrow="Features" heading="What's included" highlight="included" sub={page.summary} bullets={page.bullets} />
      <section className="relative py-16 md:py-24">
        <div className="container-x">
          <Reveal>
            <SectionHeading eyebrow="Works with" heading="Part of one connected stack" highlight="connected stack" className="mb-10" />
          </Reveal>
          <Reveal>
          <div className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => {
              const Icon = getIcon(p.nav.icon);
              return (
                <div key={p.slug} className="bg-bg">
                  <Link href={`/products/${p.slug}`} className="group flex h-full flex-col justify-between gap-6 bg-bg p-6 transition-colors hover:bg-bg-2">
                    <div className="flex items-center justify-between">
                      <Icon className="size-5 text-orange-400" />
                      <ArrowUpRight className="size-4 text-dim transition-colors group-hover:text-orange-400" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-ink">{p.nav.label}</h3>
                      <p className="mt-1.5 text-sm text-muted">{p.nav.blurb}</p>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
          </Reveal>
        </div>
      </section>
      <CTABand block={page.cta} />
    </>
  );
}
