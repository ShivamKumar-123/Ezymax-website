import type { Metadata } from "next";

import { SectionShell } from "@/components/layout/SectionShell";
import { FeatureList } from "@/components/sections/shared/FeatureList";
import { PageHero } from "@/components/sections/shared/PageHero";
import { PhotoStrip } from "@/components/sections/shared/PhotoStrip";
import { PlanTable } from "@/components/sections/shared/PlanTable";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PartnerForm } from "@/components/forms/PartnerForm";
import { images } from "@/content/images";
import { partnersPage } from "@/content/partners";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Partners",
  description:
    "Earn rebates on the closed lots of traders you introduce to Ezymex, with partner reporting and an IB management dashboard.",
  path: "/partners",
});

export default function PartnersPage() {
  const p = partnersPage;
  return (
    <>
      <PageHero
        eyebrow={p.eyebrow}
        headline={p.headline}
        highlight={p.highlight}
        sub={p.sub}
        ctas={[{ label: "Apply", href: "#apply" }]}
      />
      <PhotoStrip
        image={images.partners}
        title="Paid on activity, not on sign-ups"
        body="A rebate accrues when an introduced trader closes a lot. Nothing accrues from registrations alone."
      />
      <FeatureList
        eyebrow="How it works"
        heading={p.howHeading}
        features={p.how}
        columns={4}
        numbered
        className="pt-6"
      />
      <section className="relative py-16 md:py-24">
        <div className="container-x">
          <Reveal>
            <SectionHeading
              eyebrow="Rebates"
              heading={p.rebateHeading}
              highlight="programme pays"
              className="mb-10"
            />
          </Reveal>
          <PlanTable data={p.rebates} footnote={p.rebateFootnote} />
        </div>
      </section>
      <SectionShell variant="panel" id="apply">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <SectionHeading
              eyebrow="Apply"
              heading={p.formHeading}
              highlight="programme"
              sub={p.formSub}
            />
          </Reveal>
          <Reveal delay={0.1}>
            <PartnerForm />
          </Reveal>
        </div>
      </SectionShell>
    </>
  );
}
