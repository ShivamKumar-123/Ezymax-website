"use client";

import Image from "next/image";

import { Inview } from "@/components/animation/springs/in-view";
import { PullQuote } from "@/components/ui/pull-quote";
import { SectionHeading } from "@/components/ui/section-heading";

export interface SectionCard {
  /** Anchor id when the card is a nav/footer deep-link target. */
  id?: string;
  kicker?: string;
  title: string;
  body?: string;
  points?: readonly string[];
  footnote?: string;
}

export interface SectionCardsProps {
  id: string;
  eyebrow: string;
  heading: string;
  intro?: string;
  cards: readonly SectionCard[];
  /** Render card points as a numbered sequence instead of bullets. */
  ordered?: boolean;
  columns?: 2 | 3 | 4;
  note?: string;
  quote?: string;
  /** Decorative side backdrop fading into the page background. */
  background?: { src: string; side?: "left" | "right" };
}

const columnsClass: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/** Card-grid section — feature grids, comparisons, market overviews. */
export const SectionCards = ({
  id,
  eyebrow,
  heading,
  intro,
  cards,
  ordered = false,
  columns = 2,
  note,
  quote,
  background,
}: SectionCardsProps) => {
  const PointsList = ordered ? "ol" : "ul";
  const backgroundSide = background?.side ?? "right";

  return (
    <section
      id={id}
      aria-label={eyebrow}
      className="relative z-10 overflow-hidden"
    >
      {background ? (
        <span
          aria-hidden
          className={`absolute inset-y-0 hidden bg-background sm:block sm:w-3/5 ${
            backgroundSide === "right" ? "right-0" : "left-0"
          }`}
        >
          {/* Screen blend over the obsidian span: the art's black background
              dissolves into the page, leaving only the lit subject. */}
          <Image
            src={background.src}
            alt=""
            fill
            sizes="60vw"
            className="object-cover object-center opacity-75 mix-blend-screen"
          />
          <span
            className={`absolute inset-0 ${
              backgroundSide === "right"
                ? "bg-[linear-gradient(to_right,var(--background),transparent_45%)]"
                : "bg-[linear-gradient(to_left,var(--background),transparent_45%)]"
            }`}
          />
          <span className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--background),transparent_15%,transparent_85%,var(--background))]" />
        </span>
      ) : null}

      <div className="shell relative px-5 py-20 sm:px-8 lg:py-28">
        {/* With a side backdrop, the heading block sits on the clear side so
            the copy never fights the art; the glass cards then write over it. */}
        <div
          className={
            background
              ? `lg:max-w-2xl ${backgroundSide === "left" ? "lg:ml-auto" : ""}`
              : undefined
          }
        >
          <SectionHeading eyebrow={eyebrow} heading={heading} intro={intro} />
        </div>

        <ul className={`mt-12 grid grid-cols-1 gap-4 ${columnsClass[columns]}`}>
          {cards.map((card, index) => (
            <Inview
              key={card.title}
              tag="li"
              mode="once"
              delayIn={index * 80}
              from={{ opacity: 0, y: 28 }}
              to={{ opacity: 1, y: 0 }}
              config={{ tension: 200, friction: 24 }}
              className="group relative overflow-hidden rounded-card-sm bg-glass p-7 text-white ring-1 ring-white/10 backdrop-blur-glass transition-all duration-[var(--duration-normal)] ease-entrance hover:-translate-y-2 hover:ring-accent/50"
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent,var(--accent),transparent)] opacity-0 transition-opacity duration-[var(--duration-normal)] ease-entrance group-hover:opacity-100"
              />
              <div id={card.id} className="scroll-mt-28">
                {card.kicker ? (
                  <span className="text-xs font-mono tracking-label text-accent-from uppercase">
                    {card.kicker}
                  </span>
                ) : null}
                <h3 className="mt-1 text-xl font-medium">{card.title}</h3>
                {card.body ? (
                  <p className="mt-3 text-sm leading-relaxed text-white/55">
                    {card.body}
                  </p>
                ) : null}
                {card.points?.length ? (
                  <PointsList className="mt-5 flex flex-col gap-2.5 text-sm text-white/70">
                    {card.points.map((point, pointIndex) => (
                      <li key={point} className="flex items-baseline gap-3">
                        <span className="text-xs text-accent-from tabular-nums">
                          {ordered
                            ? String(pointIndex + 1).padStart(2, "0")
                            : "·"}
                        </span>
                        {point}
                      </li>
                    ))}
                  </PointsList>
                ) : null}
                {card.footnote ? (
                  <p className="mt-5 text-xs font-medium text-accent-from">
                    {card.footnote}
                  </p>
                ) : null}
              </div>
            </Inview>
          ))}
        </ul>

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
};
