"use client";

import { Inview } from "@/components/animation/springs/in-view";
import { SectionHeading } from "@/components/ui/section-heading";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface SectionFaqProps {
  id: string;
  eyebrow: string;
  heading: string;
  intro?: string;
  items: readonly FaqItem[];
  footnote?: string;
}

/** FAQ section — question/answer cards, open by default for scanability. */
export const SectionFaq = ({
  id,
  eyebrow,
  heading,
  intro,
  items,
  footnote,
}: SectionFaqProps) => (
  <section id={id} aria-label={eyebrow} className="relative z-10">
    <div className="shell px-5 py-20 sm:px-8 lg:py-28">
      <SectionHeading eyebrow={eyebrow} heading={heading} intro={intro} />

      <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items.map((item, index) => (
          <Inview
            key={item.question}
            tag="article"
            mode="once"
            delayIn={index * 80}
            from={{ opacity: 0, y: 24 }}
            to={{ opacity: 1, y: 0 }}
            config={{ tension: 200, friction: 24 }}
            className="rounded-card-sm border border-line bg-glass p-7 backdrop-blur-glass"
          >
            <h3 className="text-base font-medium">{item.question}</h3>
            <p className="mt-3 text-sm leading-relaxed text-foreground/60">
              {item.answer}
            </p>
          </Inview>
        ))}
      </div>

      {footnote ? (
        <Inview
          tag="p"
          mode="once"
          from={{ opacity: 0, y: 12 }}
          to={{ opacity: 1, y: 0 }}
          config={{ tension: 200, friction: 24 }}
          className="mt-6 text-xs leading-relaxed text-foreground/45"
        >
          {footnote}
        </Inview>
      ) : null}
    </div>
  </section>
);
