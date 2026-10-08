import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { solutions } from "@/content/solutions";
import { solutionsOverview, finalCta } from "@/content/home";
import { PageHero } from "@/components/sections/shared/PageHero";
import { CTABand } from "@/components/sections/shared/CTABand";
import { ImageCard } from "@/components/ui/ImageCard";
import { solutionImage } from "@/content/images";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = pageMetadata({
  title: "Solutions",
  description:
    "CFD white label, prop firm technology, forex and options platform, crypto brokerage and custom development. One partner for every brokerage model.",
  path: "/solutions",
});

export default function SolutionsPage() {
  return (
    <>
      <PageHero eyebrow={solutionsOverview.eyebrow} headline={solutionsOverview.heading} highlight={solutionsOverview.highlight} sub={solutionsOverview.intro} compact />
      <section className="relative pb-10">
        <div className="container-x grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {solutions.map((s, i) => (
            <Reveal key={s.slug} delay={Math.min(i * 0.07, 0.4)}>
              <ImageCard title={s.nav.label} body={s.summary} href={`/solutions/${s.slug}`} image={solutionImage(s.slug)} index={i} />
            </Reveal>
          ))}
        </div>
      </section>
      <CTABand block={finalCta} />
    </>
  );
}
