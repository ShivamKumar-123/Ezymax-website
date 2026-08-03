"use client";

import { animated, useTransition } from "@react-spring/web";
import Link from "next/link";

import { SectionCards } from "@/components/common/sections/section-cards";
import { SectionFaq } from "@/components/common/sections/section-faq";
import { SectionTable } from "@/components/common/sections/section-table";
import { SectionText } from "@/components/common/sections/section-text";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ArrowRight, ArrowUpRight, Close } from "@/components/ui/icons";
import type { navPages } from "@/data/mocks/nav-pages";
import type { navLabels } from "@/data/mocks/site";

export type NavPageKey = keyof typeof navPages;

export interface NavPageProps {
  /** Which page is open in the drawer; null = none. */
  active: NavPageKey | null;
  pages: typeof navPages;
  labels: typeof navLabels;
  onBack: () => void;
  onClose: () => void;
}

/**
 * The same sections the routed views compose, from the same data — ids are
 * `m-` prefixed so they never collide with a page rendered underneath.
 */
const PageBody = ({
  page,
  pages,
}: {
  page: NavPageKey;
  pages: typeof navPages;
}) => {
  switch (page) {
    case "Trade": {
      const c = pages.Trade;
      return (
        <>
          <SectionCards
            id="m-markets"
            eyebrow={c.markets.eyebrow}
            heading={c.markets.heading}
            intro={c.markets.intro}
            cards={c.markets.cards}
            columns={2}
          />
          <SectionCards
            id="m-modes"
            eyebrow={c.modes.eyebrow}
            heading={c.modes.heading}
            cards={c.modes.cards}
            columns={2}
            note={c.modes.note}
          />
          <SectionCards
            id="m-settlement"
            eyebrow={c.settlement.eyebrow}
            heading={c.settlement.heading}
            intro={c.settlement.intro}
            cards={c.settlement.cards}
            columns={4}
            note={c.settlement.note}
          />
          <SectionText
            id="m-margin"
            eyebrow={c.margin.eyebrow}
            heading={c.margin.heading}
            body={c.margin.body}
            points={c.margin.points}
            note={c.margin.note}
            cta={c.margin.cta}
            ctaTarget="trade"
          />
        </>
      );
    }
    case "Platform": {
      const c = pages.Platform;
      return (
        <>
          <SectionText
            id="m-web"
            eyebrow={c.web.eyebrow}
            heading={c.web.heading}
            body={c.web.body}
            points={c.web.points}
          />
          <SectionText
            id="m-mt5"
            eyebrow={c.mt5.eyebrow}
            heading={c.mt5.heading}
            body={c.mt5.body}
            points={c.mt5.points}
          />
          <SectionCards
            id="m-copy"
            eyebrow={c.copy.eyebrow}
            heading={c.copy.heading}
            intro={c.copy.intro}
            cards={c.copy.cards}
            columns={3}
            note={c.copy.note}
          />
          <SectionText
            id="m-prop"
            eyebrow={c.prop.eyebrow}
            heading={c.prop.heading}
            body={c.prop.body}
            points={c.prop.points}
            cta={c.prop.cta}
            ctaTarget="trade"
          />
        </>
      );
    }
    case "Earn": {
      const c = pages.Earn;
      return (
        <>
          <SectionText
            id="m-staking"
            eyebrow={c.staking.eyebrow}
            heading={c.staking.heading}
            body={c.staking.body}
            points={c.staking.points}
            note={c.staking.note}
          />
          <SectionCards
            id="m-rewards"
            eyebrow={c.rewards.eyebrow}
            heading={c.rewards.heading}
            intro={c.rewards.intro}
            cards={c.rewards.cards}
            columns={3}
          />
          <SectionTable
            id="m-ladder"
            eyebrow={c.ladder.eyebrow}
            heading={c.ladder.heading}
            columns={c.ladder.columns}
            rows={c.ladder.rows}
            footnote={c.ladder.footnote}
          />
          <SectionText
            id="m-activity"
            eyebrow={c.activity.eyebrow}
            heading={c.activity.heading}
            body={c.activity.body}
            note={c.activity.note}
          />
          <SectionText
            id="m-partners"
            eyebrow={c.partners.eyebrow}
            heading={c.partners.heading}
            body={c.partners.body}
            points={c.partners.points}
            cta={c.partners.cta}
            ctaTarget="trade"
            quote={c.partners.quote}
          />
        </>
      );
    }
    case "Protection": {
      const c = pages.Protection;
      return (
        <>
          <SectionTable
            id="m-insurance"
            eyebrow={c.insurance.eyebrow}
            heading={c.insurance.heading}
            intro={c.insurance.intro}
            columns={c.insurance.columns}
            rows={c.insurance.rows}
            footnote={c.insurance.footnote}
          />
          <SectionFaq
            id="m-faq"
            eyebrow={c.faq.eyebrow}
            heading={c.faq.heading}
            intro={c.faq.intro}
            items={c.faq.items}
          />
          <SectionCards
            id="m-tools"
            eyebrow={c.tools.eyebrow}
            heading={c.tools.heading}
            cards={c.tools.cards}
            columns={4}
            quote={c.tools.quote}
          />
          <SectionText
            id="m-protection-cta"
            eyebrow={c.cta.eyebrow}
            heading={c.cta.heading}
            body={c.cta.body}
            cta={c.cta.cta}
            ctaTarget="trade"
          />
        </>
      );
    }
    case "Company": {
      const c = pages.Company;
      return (
        <>
          <SectionCards
            id="m-about"
            eyebrow={c.about.eyebrow}
            heading={c.about.heading}
            cards={c.about.cards}
            columns={3}
          />
          <SectionCards
            id="m-protocol"
            eyebrow={c.protocol.eyebrow}
            heading={c.protocol.heading}
            intro={c.protocol.intro}
            cards={c.protocol.cards}
            columns={2}
            ordered
            quote={c.protocol.quote}
          />
          <SectionText
            id="m-legal"
            eyebrow={c.legal.eyebrow}
            heading={c.legal.heading}
            body={c.legal.body}
            note={c.legal.note}
          />
          <SectionText
            id="m-contact"
            eyebrow={c.contact.eyebrow}
            heading={c.contact.heading}
            body={c.contact.body}
            note={c.contact.note}
            cta={c.contact.cta}
          />
        </>
      );
    }
  }
};

export const NavPage = ({
  active,
  pages,
  labels,
  onBack,
  onClose,
}: NavPageProps) => {
  const transitions = useTransition(active, {
    from: { y: -100 },
    enter: { y: 0 },
    leave: { y: -100 },
    config: { tension: 200, friction: 30 },
  });

  return transitions((style, page) =>
    page ? (
      <animated.section
        aria-label={page}
        style={{ transform: style.y.to((y) => `translateY(${y}%)`) }}
        className="absolute inset-0 z-10 flex flex-col bg-ink/98 backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-8">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 font-mono text-xs tracking-label text-foreground/70 uppercase transition-colors duration-[var(--duration-fast)] ease-entrance hover:text-accent"
          >
            <span className="inline-flex rotate-180">
              <ArrowRight />
            </span>
            {labels.backToMenu}
          </button>

          <span className="font-mono text-xs tracking-label text-foreground/40 uppercase">
            {page}
          </span>

          <div className="flex items-center gap-5">
            <Link
              href={pages[page].href}
              onClick={onClose}
              className="inline-flex items-center gap-2 font-mono text-xs tracking-label text-accent uppercase transition-colors duration-[var(--duration-fast)] ease-entrance hover:text-accent-from"
            >
              {labels.openPage}
              <ArrowUpRight />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 font-mono text-xs tracking-label text-foreground/70 uppercase transition-colors duration-[var(--duration-fast)] ease-entrance hover:text-accent"
            >
              <Close className="text-sm" />
              {labels.close}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <header className="shell px-5 pt-14 sm:px-8">
            <Eyebrow>{pages[page].hero.eyebrow}</Eyebrow>
            <h2 className="mt-4 max-w-[18ch] text-4xl leading-display font-bold tracking-display sm:text-5xl">
              {pages[page].hero.heading}
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground/60">
              {pages[page].hero.intro}
            </p>
          </header>

          <PageBody page={page} pages={pages} />
        </div>
      </animated.section>
    ) : null,
  );
};
