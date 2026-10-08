/**
 * @fileoverview JSON-LD structured data helpers.
 *
 * Structured data lets search engines understand the site as entities
 * (Organization, WebSite) rather than just text — improving rich results.
 * Render the output inside a `<script type="application/ld+json">` tag.
 */

import { site } from "@/content/site";

/**
 * Organization + WebSite schema for the site root. Emit once, in the root
 * layout. The two nodes are linked by `@id` so crawlers treat them as related.
 *
 * Three things are deliberately absent. `legalName` and `address`, because the
 * company entity behind Ezymex has not been confirmed and a wrong one in
 * structured data is a wrong one republished everywhere. And `sameAs`, because
 * the only social links available were bare domains — `sameAs: ["https://x.com/"]`
 * asserts that this organisation *is* x.com. Add each back when it is real.
 */
export function getSiteStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${site.url}/#organization`,
        name: site.name,
        url: site.url,
        logo: `${site.url}/android-icon-192x192.png`,
        description: site.description,
        slogan: site.tagline,
        email: site.email,
      },
      {
        "@type": "WebSite",
        "@id": `${site.url}/#website`,
        name: site.name,
        description: site.description,
        url: site.url,
        publisher: { "@id": `${site.url}/#organization` },
      },
    ],
  };
}
