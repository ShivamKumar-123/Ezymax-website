"use client";

import { Inview } from "@/components/animation/springs/in-view";
import { PullQuote } from "@/components/ui/pull-quote";
import { SectionHeading } from "@/components/ui/section-heading";

export interface SectionStep {
  title: string;
  body: string;
}

export interface SectionStepsProps {
  id: string;
  eyebrow: string;
  heading: string;
  intro?: string;
  steps: readonly SectionStep[];
  columns?: 3 | 4 | 5;
  note?: string;
  quote?: string;
}

const columnsClass: Record<3 | 4 | 5, string> = {
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
};

/** Numbered-sequence section — onboarding flows, settlement mechanics. */
export const SectionSteps = ({
  id,
  eyebrow,
  heading,
  intro,
  steps,
  columns = 5,
  note,
  quote,
}: SectionStepsProps) => (
  <section id={id} aria-label={eyebrow} className="relative z-10">
    <div className="shell px-5 py-20 sm:px-8 lg:py-28">
      <SectionHeading eyebrow={eyebrow} heading={heading} intro={intro} />

      <ol
        className={`mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 ${columnsClass[columns]}`}
      >
        {steps.map((step, index) => (
          <Inview
            key={step.title}
            tag="li"
            mode="once"
            delayIn={index * 80}
            from={{ opacity: 0, y: 28 }}
            to={{ opacity: 1, y: 0 }}
            config={{ tension: 200, friction: 24 }}
            className="rounded-card-sm border border-line bg-glass p-6 backdrop-blur-glass"
          >
            <span className="text-xs font-medium text-accent-from tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-3 text-base font-medium">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/60">
              {step.body}
            </p>
          </Inview>
        ))}
      </ol>

      {note ? (
        <Inview
          tag="p"
          mode="once"
          from={{ opacity: 0, y: 12 }}
          to={{ opacity: 1, y: 0 }}
          config={{ tension: 200, friction: 24 }}
          className="mt-8 text-xs leading-relaxed text-foreground/45"
        >
          {note}
        </Inview>
      ) : null}

      {quote ? <PullQuote>{quote}</PullQuote> : null}
    </div>
  </section>
);
