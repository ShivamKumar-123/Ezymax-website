import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { pageMetadata } from "@/lib/seo";
import { getIcon } from "@/lib/icons";
import { contactPage } from "@/content/contact";
import { site } from "@/content/site";
import { PageHero } from "@/components/sections/shared/PageHero";
import { PhotoStrip } from "@/components/sections/shared/PhotoStrip";
import { images } from "@/content/images";
import { ContactForm } from "@/components/forms/ContactForm";
import { GlassCard } from "@/components/ui/GlassCard";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description:
    "Contact Ezymax support about access, your account or the platform.",
  path: "/contact",
});

export default function ContactPage() {
  const c = contactPage;
  return (
    <>
      <PageHero eyebrow={c.eyebrow} headline={c.headline} highlight={c.highlight} sub={c.sub} />
      <PhotoStrip image={images.contact} title="Talk to people, not tickets" body="Sales, support and partnerships teams reply within 24 hours." />
      <section className="relative pb-24">
        <div className="container-x grid gap-10 lg:grid-cols-[0.9fr_1.3fr]">
          <div className="flex flex-col gap-4">
            {c.channels.map((ch, i) => {
              const Icon = getIcon(ch.icon);
              return (
                <Reveal key={ch.title} delay={i * 0.06}>
                  <GlassCard className="flex items-start gap-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-orange-400">
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <h2 className="font-display text-lg font-semibold text-ink">{ch.title}</h2>
                      <p className="mt-1 text-sm text-muted">{ch.body}</p>
                    </div>
                  </GlassCard>
                </Reveal>
              );
            })}
            {/* No address card. The company's registered entity and address
                are not confirmed, and the one inherited from the previous
                site paired a US phone number with a Glasgow serviced office.
                Email is the channel that actually exists. */}
            <Reveal delay={0.2}>
              <GlassCard tone="dark" className="mt-2">
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 size-4 shrink-0 text-orange-400" />
                  <div>
                    <p className="text-sm font-medium text-ink">
                      <a
                        href={`mailto:${site.email}`}
                        className="hover:text-orange-400"
                      >
                        {site.email}
                      </a>
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {site.name} operates at {site.domain}. Risk and legal
                      enquiries have their own addresses, listed in the legal
                      documents.
                    </p>
                  </div>
                </div>
              </GlassCard>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <div className="rounded-panel border border-line glass p-6 md:p-8">
              <ContactForm />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
