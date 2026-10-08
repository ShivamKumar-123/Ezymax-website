import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { pageMetadata } from "@/lib/seo";
import { careersPage } from "@/content/careers";
import { PageHero } from "@/components/sections/shared/PageHero";
import { PhotoStrip } from "@/components/sections/shared/PhotoStrip";
import { images } from "@/content/images";
import { FeatureList } from "@/components/sections/shared/FeatureList";
import { CvForm } from "@/components/forms/CvForm";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionShell } from "@/components/layout/SectionShell";

export const metadata: Metadata = pageMetadata({
  title: "Careers",
  description: "Join SetupZero's team of engineers, product specialists and support experts building the future of trading technology.",
  path: "/careers",
});

export default function CareersPage() {
  const c = careersPage;
  return (
    <>
      <PageHero eyebrow={c.eyebrow} headline={c.headline} highlight={c.highlight} sub={c.sub} ctas={[{ label: "Send Your CV", href: "#apply" }]} />
      <PhotoStrip image={images.careers} title="Build products brokers use every day" body="Join engineers, product specialists and support experts shipping trading technology worldwide." />
      <FeatureList eyebrow="Why join" heading={c.whyHeading} highlight="join SetupZero" features={c.why} columns={4} className="pt-6" />
      <section className="relative py-10 md:py-16">
        <div className="container-x">
          <Reveal>
            <SectionHeading eyebrow="Roles" heading={c.rolesHeading} highlight="roles" sub={c.rolesNote} className="mb-10" />
          </Reveal>
          <ul className="divide-y divide-line border-y border-line">
            {c.roles.map((r, i) => (
              <Reveal key={r.title} delay={i * 0.05}>
                <li className="flex flex-col gap-2 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-orange-400">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-display text-xl font-medium text-ink">{r.title}</span>
                  </div>
                  <div className="flex items-center gap-5 text-sm text-muted">
                    <span>{r.team}</span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-orange-400" /> {r.location}
                    </span>
                  </div>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
      <SectionShell variant="panel" id="apply">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <SectionHeading eyebrow="Apply" heading={c.formHeading} highlight="CV" sub={c.formSub} />
          </Reveal>
          <Reveal delay={0.1}>
            <CvForm roles={c.roles.map((r) => r.title)} />
          </Reveal>
        </div>
      </SectionShell>
    </>
  );
}
