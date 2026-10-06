import type { MetadataRoute } from 'next'

/**
 * Crawler directives. Allow the marketing surface (home + 8 light pages
 * + dark marketing trading/platforms/protocol routes), block
 * everything authenticated. Search engines have no business indexing
 * /dashboard or /wallet — those require login anyway, but disallowing
 * them keeps the crawl budget on the marketing pages.
 */
export default function robots(): MetadataRoute.Robots {
  const host = process.env.NEXT_PUBLIC_MARKETING_HOST
    ? `https://${process.env.NEXT_PUBLIC_MARKETING_HOST}`
    : 'https://ezymex.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: [
          '/api/',
          '/auth/',
          '/dashboard',
          '/kyc',
          '/wallet',
          '/portfolio',
          '/transactions',
          '/profile',
          '/trading/terminal',
          '/trading/open-account',
          '/social',
          '/news',
          '/business',
          '/pamm',
          '/accounts',
          '/support',
          '/more',
          '/risk-calculator',
          '/s/',
        ],
      },
    ],
    sitemap: `${host}/sitemap.xml`,
    host,
  }
}
