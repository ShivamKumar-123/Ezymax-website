"use client";

import Image from "next/image";

import { Inview } from "@/components/animation/springs/in-view";
import { PullQuote } from "@/components/ui/pull-quote";
import { SectionHeading } from "@/components/ui/section-heading";
import type { rewards } from "@/data/mocks/home";

export interface RewardsProps {
  content: typeof rewards;
}

export const Rewards = ({ content }: RewardsProps) => (
  <section
    id="rewards"
    className="relative z-10 bg-surface/70 text-foreground backdrop-blur-sm"
    aria-label={content.label}
  >
    <div className="shell px-5 pt-20 sm:px-8 lg:pt-28">
      {/* Static, aligned opener: big bold art cards left and right of the
          centred heading — no scroll pin, no slide. */}
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_2fr_1fr]">
        <Inview
          tag="figure"
          aria-hidden
          mode="once"
          from={{ opacity: 0, y: 32 }}
          to={{ opacity: 1, y: 0 }}
          config={{ tension: 180, friction: 26 }}
          className="hidden overflow-hidden rounded-card-sm ring-2 ring-white/20 lg:block lg:rotate-[-4deg]"
        >
          <Image
            src={content.art[0].src}
            alt=""
            width={640}
            height={852}
            className="aspect-[3/4] h-auto w-full object-cover"
          />
        </Inview>

        <div className="mx-auto max-w-3xl">
          <SectionHeading
            eyebrow={content.eyebrow}
            heading={content.heading}
            intro={content.intro}
            tone="light"
            align="center"
          />
        </div>

        <Inview
          tag="figure"
          aria-hidden
          mode="once"
          delayIn={120}
          from={{ opacity: 0, y: 32 }}
          to={{ opacity: 1, y: 0 }}
          config={{ tension: 180, friction: 26 }}
          className="hidden overflow-hidden rounded-card-sm ring-2 ring-accent/50 lg:block lg:rotate-[4deg]"
        >
          <Image
            src={content.art[1].src}
            alt=""
            width={640}
            height={852}
            className="aspect-[3/4] h-auto w-full object-cover"
          />
        </Inview>
      </div>
    </div>

    <div className="shell px-5 pb-20 sm:px-8 lg:pb-28">
      <ul className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        {content.cards.map((card, index) => (
          <Inview
            key={card.badge}
            tag="li"
            mode="once"
            delayIn={index * 90}
            from={{ opacity: 0, y: 32 }}
            to={{ opacity: 1, y: 0 }}
            config={{ tension: 180, friction: 26 }}
            className="rounded-card bg-glass p-8 ring-1 ring-white/10 backdrop-blur-glass transition-all duration-[var(--duration-normal)] ease-entrance hover:-translate-y-2 hover:bg-white/[0.07] hover:ring-accent/40"
          >
            <span className="inline-flex rounded-pill border border-white/20 px-3 py-1 text-xs font-mono tracking-label text-white/60 uppercase">
              {card.kicker}
            </span>
            <h3 className="mt-4 text-xl font-medium">{card.badge}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              {card.body}
            </p>
          </Inview>
        ))}
      </ul>

      <Inview
        tag="div"
        mode="once"
        delayIn={120}
        from={{ opacity: 0, y: 24 }}
        to={{ opacity: 1, y: 0 }}
        config={{ tension: 180, friction: 26 }}
        className="mt-8 overflow-x-auto rounded-card bg-glass ring-1 ring-white/10 backdrop-blur-glass"
      >
        <table className="w-full min-w-md text-left text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th
                scope="col"
                className="px-6 py-4 text-xs font-medium font-mono tracking-label text-white/45 uppercase"
              >
                {content.ladderTitle}
              </th>
              <th
                scope="col"
                className="px-6 py-4 text-xs font-medium font-mono tracking-label text-white/45 uppercase"
              >
                What changes
              </th>
            </tr>
          </thead>
          <tbody>
            {content.ladder.map((row) => (
              <tr
                key={row.area}
                className="border-b border-white/5 transition-colors duration-[var(--duration-fast)] ease-entrance last:border-b-0 hover:bg-white/[0.03]"
              >
                <th scope="row" className="px-6 py-3.5 font-medium">
                  {row.area}
                </th>
                <td className="px-6 py-3.5 text-white/60">{row.change}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Inview>

      <Inview
        tag="div"
        mode="once"
        delayIn={160}
        from={{ opacity: 0, y: 24 }}
        to={{ opacity: 1, y: 0 }}
        config={{ tension: 180, friction: 26 }}
        className="mt-8 rounded-card bg-glass p-8 ring-1 ring-white/10 backdrop-blur-glass"
      >
        <h3 className="text-xl font-medium">{content.activityTitle}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
          {content.activityBody}
        </p>
        <p className="mt-4 text-xs font-medium text-accent-from">
          {content.activityNote}
        </p>
      </Inview>

      <PullQuote tone="light">{content.quote}</PullQuote>
    </div>
  </section>
);
