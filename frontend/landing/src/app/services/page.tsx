import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { servicesPage } from "@/content/services";
import { PageHero } from "@/components/sections/shared/PageHero";
import { PhotoStrip } from "@/components/sections/shared/PhotoStrip";
import { images } from "@/content/images";
import { FeatureList } from "@/components/sections/shared/FeatureList";
import { SupportChannels } from "@/components/sections/shared/SupportChannels";
import { CTABand } from "@/components/sections/shared/CTABand";

export const metadata: Metadata = pageMetadata({
  title: "Support & Services",
  description:
    "24/7 technical support, platform administration, dealing desk support, hosting, integrations, migration, website and branding, and consulting for brokers.",
  path: "/services",
});

export default function ServicesPage() {
  const s = servicesPage;
  return (
    <>
      <PageHero eyebrow={s.eyebrow} headline={s.headline} highlight={s.highlight} sub={s.sub} ctas={s.cta.ctas} />
      <PhotoStrip image={images.services} title="A real team on every shift" body="Engineers and support specialists monitor your platform around the clock, in your clients' languages." />
      <FeatureList eyebrow={s.servicesHeading} heading="Everything around the platform" highlight="around the platform" features={s.services} columns={4} numbered className="pt-6" />
      <SupportChannels heading={s.channelsHeading} channels={s.channels} />
      <FeatureList eyebrow="Promise" heading={s.promiseHeading} highlight="promise" features={s.promise} columns={3} />
      <CTABand block={s.cta} />
    </>
  );
}
