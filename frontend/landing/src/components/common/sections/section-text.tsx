"use client";

import { Inview } from "@/components/animation/springs/in-view";
import { PillButton } from "@/components/ui/pill-button";
import { PullQuote } from "@/components/ui/pull-quote";
import { SectionHeading } from "@/components/ui/section-heading";
import { tradeConfig } from "@/lib/site";
import { useUi } from "@/lib/ui-store";

export interface SectionTextProps {
  id: string;
  eyebrow: string;
  heading: string;
  intro?: string;
  body?: readonly string[];
  points?: readonly string[];
  note?: string;
  /** CTA label. */
  cta?: string;
  /** Where the CTA goes: the trader-platform register page, or the modal. */
  ctaTarget?: "trade" | "modal";
  quote?: string;
}

/** Prose section: heading block + paragraphs + pill points + optional CTA. */
export const SectionText = ({
  id,
  eyebrow,
  heading,
  intro,
  body,
  points,
  note,
  cta,
  ctaTarget = "modal",
  quote,
}: SectionTextProps) => {
  const setModalOpen = useUi((state) => state.setModalOpen);

  return (
    <section id={id} aria-label={eyebrow} className="relative z-10">
      <div className="shell px-5 py-20 sm:px-8 lg:py-28">
        <SectionHeading eyebrow={eyebrow} heading={heading} intro={intro} />

        {body?.length || points?.length || note || cta ? (
          <Inview
            tag="div"
            mode="once"
            delayIn={160}
            from={{ opacity: 0, y: 24 }}
            to={{ opacity: 1, y: 0 }}
            config={{ tension: 180, friction: 26 }}
            className="mt-10 max-w-3xl"
          >
            {body?.map((paragraph) => (
              <p
                key={paragraph}
                className="mt-4 text-base leading-relaxed text-foreground/65 first:mt-0"
              >
                {paragraph}
              </p>
            ))}

            {points?.length ? (
              <ul className="mt-6 flex flex-wrap gap-3">
                {points.map((point) => (
                  <li
                    key={point}
                    className="inline-flex rounded-pill border border-line bg-glass px-4 py-2 text-sm text-foreground/70 backdrop-blur-glass"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            ) : null}

            {note ? (
              <p className="mt-6 text-xs leading-relaxed text-foreground/45">
                {note}
              </p>
            ) : null}

            {cta ? (
              ctaTarget === "trade" ? (
                <PillButton
                  variant="dark"
                  arrow="up-right"
                  href={tradeConfig.register}
                  className="mt-8"
                >
                  {cta}
                </PillButton>
              ) : (
                <PillButton
                  variant="dark"
                  arrow="up-right"
                  onClick={() => setModalOpen(true)}
                  className="mt-8"
                >
                  {cta}
                </PillButton>
              )
            ) : null}
          </Inview>
        ) : null}

        {quote ? <PullQuote>{quote}</PullQuote> : null}
      </div>
    </section>
  );
};
