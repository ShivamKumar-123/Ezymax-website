import type { MetadataRoute } from 'next'

/**
 * Sitemap for crawlable marketing routes. Keep in sync with the
 * `allow` set in robots.ts — anything disallowed from crawling should
 * NOT appear here. Excludes route groups (those vanish from URLs) and
 * authenticated trader-app pages.
 *
 * Priority hint: home > product overviews > legal pages.
 * changeFrequency is advisory; Google mostly ignores it nowadays.
 */
const MARKETING_ROUTES = [
  '/',
  // Static marketing
  '/about', '/contact', '/platforms', '/white-label',
  '/privacy', '/terms', '/risk', '/account-deletion',
  // Asset-class landings
  '/trading/overview', '/trading/forex', '/trading/crypto',
  '/trading/indices', '/trading/commodities',
  // Product pages
  '/protocol', '/how-it-works',
  '/platforms/copy-trading', '/platforms/web', '/platforms/prop-trading',
  '/platforms/ib-management', '/platforms/super-admin',
  // Account tiers
  '/accounts/standard', '/accounts/pro', '/accounts/demo',
  // Company
  '/company/why-ezymex',
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const host = process.env.NEXT_PUBLIC_MARKETING_HOST
    ? `https://${process.env.NEXT_PUBLIC_MARKETING_HOST}`
    : 'https://ezymex.com'
  const lastModified = new Date()

  return MARKETING_ROUTES.map((path) => ({
    url: `${host}${path}`,
    lastModified,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1.0 : path.startsWith('/trading') ? 0.8 : 0.6,
  }))
}
