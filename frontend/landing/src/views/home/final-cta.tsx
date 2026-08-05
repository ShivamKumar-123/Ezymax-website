"use client";

import { AccessCta } from "@/components/common/access-cta";
import { Inview } from "@/components/animation/springs/in-view";
import { SectionHeading } from "@/components/ui/section-heading";
import type { finalCta } from "@/data/mocks/home";

export interface FinalCtaProps {
  content: typeof finalCta;
}

export const FinalCta = ({ content }: FinalCtaProps) => {
  return (
    <section id="get-started" className="relative z-10">
      <div className="shell px-5 pb-20 sm:px-8 lg:pb-28">
        <Inview
          tag="div"
          mode="once"
          from={{ opacity: 0, y: 40, scale: 0.99 }}
          to={{ opacity: 1, y: 0, scale: 1 }}
          config={{ tension: 180, friction: 26 }}
          className="rounded-card bg-surface/70 px-6 py-16 backdrop-blur-sm sm:px-12 sm:py-20"
        >
            <div className="flex flex-col items-center text-center">
            <SectionHeading
              eyebrow={content.eyebrow}
              heading={content.heading}
              intro={content.intro}
              align="center"
            />

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {/* Invite-only gate: Join Waitlist / pending / Log in. */}
              <AccessCta />
            </div>

            <p className="mt-8 max-w-2xl text-sm leading-relaxed text-foreground/60">
              {content.disclaimer}
            </p>
          </div>
        </Inview>
      </div>
    </section>
  );
};
