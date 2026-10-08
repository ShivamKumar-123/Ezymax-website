import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { aboutPage } from "@/content/about";
import { PageHero } from "@/components/sections/shared/PageHero";
import { TextBlock } from "@/components/sections/shared/TextBlock";
import { FeatureList } from "@/components/sections/shared/FeatureList";
import { PartnersCluster } from "@/components/sections/shared/PartnersCluster";
import { CTABand } from "@/components/sections/shared/CTABand";
import { SectionShell } from "@/components/layout/SectionShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatTile } from "@/components/ui/StatTile";
import { Picture } from "@/components/ui/Picture";
import { images } from "@/content/images";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "SetupZero is a Dubai-headquartered technology partner for brokers, prop firms and fintechs. We build the technology, you build the brokerage.",
  path: "/about",
});

export default function AboutPage() {
  const a = aboutPage;
  return (
    <>
      <PageHero
        eyebrow={a.eyebrow}
        headline={a.headline}
        highlight={a.highlight}
        sub={a.sub}
        ctas={a.cta.ctas}
      />
      <TextBlock eyebrow="Our story" heading="Who We Are?" paragraphs={a.story} aside={<div className="group"><Picture image={images.aboutStory} className="aspect-[4/5]" /></div>} />
      <SectionShell variant="panel">
        <div className="grid gap-8 md:grid-cols-2">
          {[a.mission, a.vision].map((m, i) => (
            <Reveal key={m.heading} delay={i * 0.1}>
              <GlassCard className="h-full">
                <span className="bracket">{m.heading}</span>
                <p className="mt-5 font-display text-2xl font-medium leading-snug text-ink md:text-3xl">{m.body}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </SectionShell>
      <FeatureList eyebrow="Values" heading={a.valuesHeading} highlight="values" features={a.values} columns={3} numbered />
      <section className="relative py-16 md:py-24">
        <div className="container-x">
          <Reveal>
            <SectionHeading eyebrow={a.numbersHeading} heading="SetupZero in numbers" highlight="in numbers" className="mb-12" />
          </Reveal>
          <div className="grid grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-4">
            {a.numbers.map((n, i) => (
              <Reveal key={n.label} delay={i * 0.08}>
                <StatTile value={n.value} label={n.label} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <PartnersCluster years="5" />
      <section className="relative py-16 md:py-24">
        <div className="container-x">
          <Reveal>
            <SectionHeading eyebrow="Team" heading={a.teamHeading} highlight="Behind SetupZero" sub={a.teamNote} className="mb-12" />
          </Reveal>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Reveal className="group">
              <Picture image={images.aboutTeam} className="aspect-[16/10] lg:h-full" rounded="rounded-panel" />
            </Reveal>
            <div className="grid grid-cols-2 gap-4">
              {a.team.map((m, i) => (
                <Reveal key={m.role} delay={i * 0.06}>
                  <GlassCard className="flex h-full flex-col justify-end gap-1">
                    <span className="font-mono text-xs text-orange-400">{String(i + 1).padStart(2, "0")}</span>
                    <p className="mt-6 font-display text-lg font-semibold text-ink">{m.name}</p>
                    <p className="text-sm text-muted">{m.role}</p>
                  </GlassCard>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>
      <CTABand block={a.cta} />
    </>
  );
}
