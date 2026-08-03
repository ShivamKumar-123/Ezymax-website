"use client";

import { Inview } from "@/components/animation/springs/in-view";
import { PillButton } from "@/components/ui/pill-button";
import { PullQuote } from "@/components/ui/pull-quote";
import { SectionHeading } from "@/components/ui/section-heading";
import { tradeConfig } from "@/lib/site";
import type { referral } from "@/data/mocks/home";

export interface ReferralProps {
  content: typeof referral;
}

export const Referral = ({ content }: ReferralProps) => {
  return (
    <section id="partnership" className="relative z-10">
      <div className="shell px-5 py-20 sm:px-8 lg:py-28">
        <SectionHeading
          eyebrow={content.eyebrow}
          heading={content.heading}
          intro={content.intro}
        />

        <Inview
          tag="div"
          mode="once"
          from={{ opacity: 0, y: 24 }}
          to={{ opacity: 1, y: 0 }}
          config={{ tension: 180, friction: 26 }}
          className="mt-10 rounded-card bg-ink/85 p-8 text-white ring-1 ring-white/10 backdrop-blur-sm sm:p-12"
        >
          <p className="max-w-2xl text-lg leading-relaxed">{content.body}</p>

          <ul className="mt-8 flex flex-wrap gap-3">
            {content.points.map((point) => (
              <li
                key={point}
                className="inline-flex rounded-pill border border-white/20 px-4 py-2 text-sm text-white/70"
              >
                {point}
              </li>
            ))}
          </ul>

          <p className="mt-8 text-sm text-white/50">{content.note}</p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <PillButton
              variant="light"
              arrow="up-right"
              href={tradeConfig.register}
            >
              {content.cta}
            </PillButton>
            <p className="text-xs text-white/45">{content.footnote}</p>
          </div>
        </Inview>

        <PullQuote>{content.quote}</PullQuote>
      </div>
    </section>
  );
};
