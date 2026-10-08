import type { Metadata } from "next";
import { finalCta } from "@/content/home";
import { site } from "@/content/site";
import { Hero } from "@/components/sections/home/Hero";
import { TrustBar } from "@/components/sections/home/TrustBar";
import { SolutionsOverview } from "@/components/sections/home/SolutionsOverview";
import { ProductsGrid } from "@/components/sections/home/ProductsGrid";
import { HowItWorks } from "@/components/sections/home/HowItWorks";
import { WhySetupZero } from "@/components/sections/home/WhySetupZero";
import { Testimonials } from "@/components/sections/home/Testimonials";
import { CTABand } from "@/components/sections/shared/CTABand";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    title: `${site.name} | Brokerage Technology Partner`,
    description: site.positioning,
    url: "/",
    siteName: site.name,
    type: "website",
    locale: "en_US",
  },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <SolutionsOverview />
      <ProductsGrid />
      <HowItWorks />
      <WhySetupZero />
      <Testimonials />
      <CTABand block={finalCta} />
    </>
  );
}
