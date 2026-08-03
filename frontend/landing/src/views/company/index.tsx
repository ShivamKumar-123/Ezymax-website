import { MarkReady } from "@/components/common/mark-ready";
import { SectionCards } from "@/components/common/sections/section-cards";
import { SectionText } from "@/components/common/sections/section-text";
import { PageHero } from "@/components/ui/page-hero";

import {
  companyAbout,
  companyContact,
  companyHero,
  companyLegal,
  companyProtocol,
} from "@/data/mocks/company";

/** Company view — Server Component. Every section below is a client leaf. */
export const CompanyView = () => (
  <>
    <MarkReady />
    <main id="main">
      <PageHero
        eyebrow={companyHero.eyebrow}
        heading={companyHero.heading}
        intro={companyHero.intro}
        backHref="/"
        backLabel={companyHero.backLabel}
      />

      <SectionCards
        id={companyAbout.id}
        eyebrow={companyAbout.eyebrow}
        heading={companyAbout.heading}
        cards={companyAbout.cards}
        columns={3}
      />

      <SectionCards
        id={companyProtocol.id}
        eyebrow={companyProtocol.eyebrow}
        heading={companyProtocol.heading}
        intro={companyProtocol.intro}
        cards={companyProtocol.cards}
        columns={2}
        ordered
        quote={companyProtocol.quote}
      />

      <SectionText
        id={companyLegal.id}
        eyebrow={companyLegal.eyebrow}
        heading={companyLegal.heading}
        body={companyLegal.body}
        note={companyLegal.note}
      />

      <SectionText
        id={companyContact.id}
        eyebrow={companyContact.eyebrow}
        heading={companyContact.heading}
        body={companyContact.body}
        note={companyContact.note}
        cta={companyContact.cta}
      />
    </main>
  </>
);
