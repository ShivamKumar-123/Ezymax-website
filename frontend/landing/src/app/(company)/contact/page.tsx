import type { Metadata } from "next";
import { MapPin } from "lucide-react";
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
import { SocialIcon } from "@/components/ui/SocialIcons";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description: "Talk to SetupZero's sales, support or partnerships team. Get a tailored setup plan and quote within 24 hours.",
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
            <Reveal delay={0.2}>
              <GlassCard tone="dark" className="mt-2">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-orange-400" />
                  <div>
                    <p className="text-sm font-medium text-ink">{c.headquarters}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{c.regions}</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-2">
                  {site.socials.map((s) => (
                    <a key={s.name} href={s.href} target="_blank" rel="noreferrer" aria-label={s.name} className="flex size-9 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-orange-500 hover:text-orange-400">
                      <SocialIcon name={s.icon} width={14} height={14} />
                    </a>
                  ))}
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
