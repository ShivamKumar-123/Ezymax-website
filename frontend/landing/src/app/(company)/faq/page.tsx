import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { faqPage, faqs } from "@/content/faq";
import { finalCta } from "@/content/home";
import { PageHero } from "@/components/sections/shared/PageHero";
import { CTABand } from "@/components/sections/shared/CTABand";
import { Accordion } from "@/components/ui/Accordion";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = pageMetadata({
  title: "FAQ",
  description: "Answers about what SetupZero does, launch timelines, licensing, branding, migration, liquidity, payments, security and support.",
  path: "/faq",
});

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function FaqPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <PageHero eyebrow={faqPage.eyebrow} headline={faqPage.headline} highlight={faqPage.highlight} sub={faqPage.sub} compact />
      <section className="relative pb-10">
        <div className="container-x max-w-4xl">
          <Reveal>
            <Accordion items={faqs} />
          </Reveal>
        </div>
      </section>
      <CTABand block={{ ...finalCta, heading: "Still have questions?", sub: "Talk to our team. We reply within 24 hours." }} />
    </>
  );
}
