/**
 * Photography used across the site, keyed by the slug of the page it belongs
 * to. Served from Unsplash's CDN under the Unsplash License (free for
 * commercial use, no attribution required).
 *
 * `tone: "warm"` applies the brand orange-red grade so every photo sits in the
 * palette.
 *
 * The keys here MUST match the slugs in markets.ts and platform.ts. The
 * lookups below fall back silently to a single default, so a slug renamed in
 * one file and not the other does not error — every card just quietly shows
 * the same photo. `npm run build` will not catch it; only looking will.
 *
 * TODO: these are stock photos on a third-party CDN. Replace them with real
 * product screenshots, and vendor whatever remains into public/photos/ — the
 * apex CSP is `img-src 'self' data: blob:`, so this works today only because
 * next/image re-serves them same-origin.
 */
export type SiteImage = { src: string; alt: string; tone?: "warm" | "none" };

const u = (id: string, w = 1600): string =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

const photo = (id: string, alt: string, w?: number): SiteImage => ({
  src: u(id, w),
  alt,
  tone: "warm",
});

export const images = {
  cta: photo(
    "1636793734646-97bc9264f72b",
    "A glowing ring of light in the dark",
    2000,
  ),
  platformFeature: photo(
    "1611974789855-9c2a0a7236a3",
    "Candlestick chart on a dark trading screen",
  ),
  why: photo(
    "1744782211816-c5224434614f",
    "Trading desk with multiple chart screens and a tablet",
  ),
  about: photo(
    "1589560989620-61bf48e97abb",
    "Digital candlestick trading chart",
  ),
  partners: photo(
    "1672380135241-c024f7fbfa13",
    "Two people shaking hands in front of a laptop",
  ),
  contact: photo("1626863905121-3b0c0ed7b94c", "Support team wearing headsets"),

  markets: {
    forex: photo(
      "1649003515353-c58a239cf662",
      "Candlestick chart with currency prices",
    ),
    indices: photo(
      "1648275913341-7973ae7bc9b3",
      "Digital stock ticker display",
    ),
    commodities: photo(
      "1638481826540-7710b13f7d53",
      "Screen showing a moving price line",
    ),
    crypto: photo(
      "1634704784915-aacf363b021f",
      "Person holding a bitcoin coin in front of a chart",
    ),
  } as Record<string, SiteImage>,

  platform: {
    "web-platform": photo(
      "1691643158804-d3f02eb456a3",
      "Multi-asset trading terminal with charts and quotes",
    ),
    mt5: photo("1623281185000-6940e5347d2e", "Desk with two monitors"),
    "copy-trading": photo(
      "1761587941453-bd1790225d52",
      "Hands holding a phone showing a stock chart",
    ),
    "funded-accounts": photo(
      "1735469157670-1212e570eadc",
      "Trader at a desk with two monitors",
    ),
    "shield-cover": photo(
      "1651341050677-24dba59ce0fd",
      "Trading app showing prices and an order book",
    ),
    "risk-tools": photo(
      "1686061593213-98dad7c599b9",
      "Dashboard screen full of data",
    ),
    staking: photo(
      "1559526324-593bc073d938",
      "Person using a phone and laptop to manage an account",
    ),
    rewards: photo("1745270917233-65e776a47547", "Stock chart showing growth"),
    partners: photo("1521791136064-7986c2920216", "Two people shaking hands"),
  } as Record<string, SiteImage>,
};

const fallback = images.platformFeature;

export function marketImage(slug: string): SiteImage {
  return images.markets[slug] ?? fallback;
}
export function platformImage(slug: string): SiteImage {
  return images.platform[slug] ?? fallback;
}
