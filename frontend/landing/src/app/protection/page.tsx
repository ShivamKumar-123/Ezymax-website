import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";

import { CTABand } from "@/components/sections/shared/CTABand";
import { FeatureList } from "@/components/sections/shared/FeatureList";
import { PageHero } from "@/components/sections/shared/PageHero";
import { PlanTable } from "@/components/sections/shared/PlanTable";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { protectionPage } from "@/content/protection";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Protection",
  description:
    "Ezymex Shield covers a share of your losses over a day, a week or a month, up to a stated cap, alongside cost previews, attachable exits and margin alerts.",
  path: "/protection",
});

export default function ProtectionPage() {
  const p = protectionPage;
  return (
    <>
      <PageHero
        eyebrow={p.eyebrow}
        headline={p.headline}
        highlight={p.highlight}
        sub={p.sub}
        ctas={p.cta.ctas}
        badges={p.badges}
      />

      <section className="relative py-16 md:py-24">
        <div className="container-x">
          <Reveal>
            <SectionHeading
              eyebrow="Shield"
              heading={p.planHeading}
              highlight="Shield plan"
              className="mb-4"
            />
            <p className="mb-10 max-w-2xl text-lg leading-relaxed text-muted">
              {p.planIntro}
            </p>
          </Reveal>
          <PlanTable data={p.plans} footnote={p.planFootnote} />
        </div>
      </section>

      <FeatureList
        eyebrow="Risk tools"
        heading={p.toolsHeading}
        features={p.tools}
        columns={4}
      />

      <section className="relative py-16">
        <div className="container-x max-w-3xl">
          <Reveal>
            <SectionHeading
              eyebrow="FAQ"
              heading={p.faqHeading}
              highlight="worth asking"
              className="mb-10"
            />
          </Reveal>
          <dl className="divide-y divide-line border-y border-line">
            {p.faq.map((item) => (
              <Reveal key={item.q}>
                <div className="py-6">
                  <dt className="font-display text-lg font-semibold text-ink">
                    {item.q}
                  </dt>
                  <dd className="mt-2 text-base leading-relaxed text-muted">
                    {item.a}
                  </dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      <section className="relative py-6">
        <div className="container-x">
          <Reveal>
            <div className="flex items-start gap-4 rounded-card border-l-2 border-orange-500 glass px-6 py-5">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-orange-400" />
              <div>
                <p className="bracket">{p.disclaimerTitle}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {p.disclaimer}
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <CTABand block={p.cta} />
    </>
  );
}
