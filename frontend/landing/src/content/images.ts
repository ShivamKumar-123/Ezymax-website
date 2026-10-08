/**
 * Photography used across the site, chosen to match each card's subject.
 * All images are served from Unsplash's CDN under the Unsplash License
 * (free for commercial use, no attribution required). Swap any entry for your
 * own screenshots or renders by changing `src`.
 *
 * `tone: "warm"` applies the brand orange-red grade so every photo sits in the palette.
 */
export type SiteImage = { src: string; alt: string; tone?: "warm" | "none" };

const u = (id: string, w = 1600): string =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

const photo = (id: string, alt: string, w?: number): SiteImage => ({ src: u(id, w), alt, tone: "warm" });

export const images = {
  cta: photo("1636793734646-97bc9264f72b", "A glowing ring of light in the dark", 2000),
  productsFeature: photo("1611974789855-9c2a0a7236a3", "Candlestick chart on a dark trading screen"),
  why: photo("1744782211816-c5224434614f", "Trading desk with multiple chart screens and a tablet"),
  aboutStory: photo("1651467606797-e1c660cf3fda", "Dubai skyline with the Burj Khalifa"),
  aboutTeam: photo("1669158196704-6b7c955c5176", "Team gathered in a large modern room"),
  services: photo("1766066014237-00645c74e9c6", "Support specialist wearing a headset at a computer"),
  careers: photo("1758520145147-c30bc656f314", "Engineer working late at a desk"),
  partners: photo("1672380135241-c024f7fbfa13", "Two people shaking hands in front of a laptop"),
  contact: photo("1626863905121-3b0c0ed7b94c", "Support team wearing headsets"),
  solutions: {
    "cfd-white-label": photo("1691643158804-d3f02eb456a3", "Multi-asset trading terminal with charts and quotes"),
    "prop-firm-solution": photo("1735469157670-1212e570eadc", "Trader at a desk with two monitors"),
    "forex-options-platform": photo("1649003515353-c58a239cf662", "Candlestick chart with index prices"),
    "crypto-brokerage": photo("1634704784915-aacf363b021f", "Person holding a bitcoin coin in front of a chart"),
    "custom-platform-development": photo("1628763228263-d9ebb07bd0d9", "Source code on a dark screen"),
  } as Record<string, SiteImage>,
  products: {
    "trading-platform": photo("1589560989620-61bf48e97abb", "Digital candlestick trading chart"),
    "forex-crm": photo("1526628953301-3e589a6a8b74", "Monitoring dashboard with charts and metrics"),
    "traders-room": photo("1559526324-593bc073d938", "Person using a phone and laptop to manage an account"),
    "liquidity-bridge": photo("1651341050677-24dba59ce0fd", "Trading app showing prices and order book"),
    "risk-management": photo("1638481826540-7710b13f7d53", "Screen showing a falling red price line"),
    "copy-trading-pamm-mam": photo("1761587941453-bd1790225d52", "Hands holding a phone showing a stock chart"),
    "ib-affiliate-module": photo("1521791136064-7986c2920216", "Two people shaking hands"),
    "payment-integrations": photo("1563013544-824ae1b704d3", "Person paying online with a card and laptop"),
    "mobile-apps": photo("1642052502780-8ee67e3bf930", "Phone showing an investing app"),
  } as Record<string, SiteImage>,
  blog: {
    "how-to-start-a-forex-brokerage-2026": photo("1708361089093-beef4c4584e7", "Dubai skyscrapers at dusk"),
    "white-label-vs-own-platform": photo("1623281185000-6940e5347d2e", "Desk with two monitors"),
    "how-to-launch-a-prop-firm": photo("1745270917233-65e776a47547", "Stock chart showing growth"),
    "a-book-vs-b-book-vs-hybrid": photo("1648275913341-7973ae7bc9b3", "Digital stock ticker display"),
    "what-to-look-for-in-a-forex-crm": photo("1686061593213-98dad7c599b9", "Dashboard screen full of data"),
    "how-much-does-it-cost-to-start-a-brokerage": photo("1758519292252-03dfd0cb8658", "Businessman holding a phone and a card"),
  } as Record<string, SiteImage>,
};

const fallback = images.productsFeature;

export function solutionImage(slug: string): SiteImage {
  return images.solutions[slug] ?? fallback;
}
export function productImage(slug: string): SiteImage {
  return images.products[slug] ?? fallback;
}
export function blogImage(slug: string): SiteImage {
  return images.blog[slug] ?? fallback;
}
