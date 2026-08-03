"use client";

import { Inview } from "@/components/animation/springs/in-view";
import { PillButton } from "@/components/ui/pill-button";
import { PullQuote } from "@/components/ui/pull-quote";
import { SectionHeading } from "@/components/ui/section-heading";
import type { tradeInsurance } from "@/data/mocks/home";

export interface TradeInsuranceProps {
  content: typeof tradeInsurance;
}

export const TradeInsurance = ({ content }: TradeInsuranceProps) => {
  return (
    <section id="insurance" className="relative z-10">
      <div className="shell px-5 py-20 sm:px-8 lg:py-28">
        <SectionHeading
          eyebrow={content.eyebrow}
          heading={content.heading}
          intro={content.intro}
        />

        <ul className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {content.tiers.map((tier, index) => (
            <Inview
              key={tier.tier}
              tag="li"
              mode="once"
              delayIn={index * 80}
              from={{ opacity: 0, y: 28 }}
              to={{ opacity: 1, y: 0 }}
              config={{ tension: 200, friction: 24 }}
              className="group relative overflow-hidden rounded-card-sm bg-glass p-6 text-white ring-1 ring-white/10 backdrop-blur-glass transition-all duration-[var(--duration-normal)] ease-entrance hover:-translate-y-2 hover:ring-accent/50"
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent,var(--accent),transparent)] opacity-0 transition-opacity duration-[var(--duration-normal)] ease-entrance group-hover:opacity-100"
              />
              <span className="text-xs font-mono tracking-label text-white/40 uppercase">
                Tier
              </span>
              <p className="mt-1 text-xl font-medium">{tier.tier}</p>

              <dl className="mt-6 flex flex-col gap-3 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-white/45">Loss Cover</dt>
                  <dd className="text-lg font-medium text-accent-from tabular-nums">
                    {tier.cover}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-white/45">Max Cap</dt>
                  <dd className="font-medium tabular-nums">{tier.cap}</dd>
                </div>
              </dl>
            </Inview>
          ))}
        </ul>

        <Inview
          tag="div"
          mode="once"
          from={{ opacity: 0, y: 24 }}
          to={{ opacity: 1, y: 0 }}
          config={{ tension: 180, friction: 26 }}
          className="mt-8 rounded-card border border-line bg-glass p-8 backdrop-blur-glass"
        >
          <h3 className="text-xl font-medium">{content.activateTitle}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/60">
            {content.activateBody}
          </p>

          <ul className="mt-6 flex flex-wrap gap-3">
            {content.points.map((point) => (
              <li
                key={point}
                className="inline-flex rounded-pill border border-line bg-background px-4 py-2 text-sm text-foreground/70"
              >
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <PillButton variant="dark" arrow="up-right" href={content.ctaHref}>
              {content.cta}
            </PillButton>
            <p className="text-xs text-foreground/45">{content.footnote}</p>
          </div>
        </Inview>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {content.faq.map((item, index) => (
            <Inview
              key={item.question}
              tag="article"
              mode="once"
              delayIn={index * 80}
              from={{ opacity: 0, y: 24 }}
              to={{ opacity: 1, y: 0 }}
              config={{ tension: 200, friction: 24 }}
              className="rounded-card-sm border border-line bg-glass p-6 backdrop-blur-glass"
            >
              <h3 className="text-base font-medium">{item.question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/60">
                {item.answer}
              </p>
            </Inview>
          ))}
        </div>

        <PullQuote>{content.quote}</PullQuote>
      </div>
    </section>
  );
};
