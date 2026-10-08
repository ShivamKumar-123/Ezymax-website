import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { partnersPage } from "@/content/partners";
import { PageHero } from "@/components/sections/shared/PageHero";
import { PhotoStrip } from "@/components/sections/shared/PhotoStrip";
import { images } from "@/content/images";
import { FeatureList } from "@/components/sections/shared/FeatureList";
import { PartnerForm } from "@/components/forms/PartnerForm";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionShell } from "@/components/layout/SectionShell";

export const metadata: Metadata = pageMetadata({
  title: "Partners",
  description: "Earn by referring brokers and prop firms to SetupZero, integrate your service with our platform, or resell our solutions in your region.",
  path: "/partners",
});

export default function PartnersPage() {
  const p = partnersPage;
  return (
    <>
      <PageHero eyebrow={p.eyebrow} headline={p.headline} highlight={p.highlight} sub={p.sub} ctas={[{ label: "Become a Partner", href: "#apply" }]} />
      <PhotoStrip image={images.partners} title="Grow together" body="Referral, technology and reseller partners earn with every brokerage they bring to SetupZero." />
      <FeatureList eyebrow="Programs" heading={p.typesHeading} highlight="programs" features={p.types} columns={3} numbered className="pt-6" />
      <SectionShell variant="panel" id="apply">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <SectionHeading eyebrow="Apply" heading={p.formHeading} highlight="Partner" sub={p.formSub} />
          </Reveal>
          <Reveal delay={0.1}>
            <PartnerForm />
          </Reveal>
        </div>
      </SectionShell>
    </>
  );
}
