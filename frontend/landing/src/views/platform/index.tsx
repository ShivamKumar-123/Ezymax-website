import { MarkReady } from "@/components/common/mark-ready";
import { SectionCards } from "@/components/common/sections/section-cards";
import { SectionText } from "@/components/common/sections/section-text";
import { PageHero } from "@/components/ui/page-hero";

import {
  platformCopy,
  platformHero,
  platformMt5,
  platformProp,
  platformWeb,
} from "@/data/mocks/platform";

/** Platform view — Server Component. Every section below is a client leaf. */
export const PlatformView = () => (
  <>
    <MarkReady />
    <main id="main">
      <PageHero
        eyebrow={platformHero.eyebrow}
        heading={platformHero.heading}
        intro={platformHero.intro}
        backHref="/"
        backLabel={platformHero.backLabel}
      />

      <SectionText
        id={platformWeb.id}
        eyebrow={platformWeb.eyebrow}
        heading={platformWeb.heading}
        body={platformWeb.body}
        points={platformWeb.points}
      />

      <SectionText
        id={platformMt5.id}
        eyebrow={platformMt5.eyebrow}
        heading={platformMt5.heading}
        body={platformMt5.body}
        points={platformMt5.points}
      />

      <SectionCards
        id={platformCopy.id}
        eyebrow={platformCopy.eyebrow}
        heading={platformCopy.heading}
        intro={platformCopy.intro}
        cards={platformCopy.cards}
        columns={3}
        note={platformCopy.note}
      />

      <SectionText
        id={platformProp.id}
        eyebrow={platformProp.eyebrow}
        heading={platformProp.heading}
        body={platformProp.body}
        points={platformProp.points}
        cta={platformProp.cta}
        ctaTarget="trade"
      />
    </main>
  </>
);
