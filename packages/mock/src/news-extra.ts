import { NEWS, type NewsItem } from "./client";
import type { AssetClass } from "./symbols";

export interface NewsStory extends NewsItem {
  assetClass: AssetClass;
  summary: string;
  readMin: number;
}

const META: Record<string, { assetClass: AssetClass; summary: string; readMin: number }> = {
  n1: { assetClass: "metals", readMin: 4, summary: "Spot gold trades a whisker below its all-time high after softer US jobless data pushed futures to price 72bp of Fed easing by year-end. Central-bank buying and ETF inflows remain supportive; resistance is seen near 2,670." },
  n2: { assetClass: "forex", readMin: 3, summary: "Euro-area headline inflation slowed to 2.2% in August. ECB policymakers say a further cut in October is 'on the table' if growth keeps weakening, weighing on the single currency." },
  n3: { assetClass: "crypto", readMin: 3, summary: "US spot bitcoin ETFs took in $365M on Tuesday, the most since early September. Ether also gained as open interest on CME futures climbed to a two-month high." },
  n4: { assetClass: "energies", readMin: 4, summary: "Brent fell toward $75 as weak Chinese refinery runs offset tension in the Middle East. OPEC+ is still expected to add 180,000 bpd from December." },
  n5: { assetClass: "forex", readMin: 2, summary: "The BoJ held its policy rate at 0.25% as expected. Governor Ueda said the bank can 'afford to take time' before the next hike, sending USDJPY back above 149." },
  n6: { assetClass: "indices", readMin: 3, summary: "Nasdaq 100 futures rose 1.2% led by semiconductors after NVIDIA's supplier reported record AI server orders. The index is now within 2% of its July record." },
  n7: { assetClass: "forex", readMin: 2, summary: "UK retail sales rose 1.0% in August versus 0.4% expected, lifting GBPUSD to 1.2790 as traders pared bets on a November BoE cut." },
  n8: { assetClass: "forex", readMin: 2, summary: "The Reserve Bank of India kept the repo rate at 6.50% for a tenth straight meeting, changing its stance to 'neutral'. The rupee held near 83.5." },
  n9: { assetClass: "forex", readMin: 2, summary: "The Monetary Authority of Singapore left the slope of its currency band unchanged, citing sticky core inflation." },
  n10: { assetClass: "forex", readMin: 3, summary: "Brazil's central bank raised the Selic to 10.75% and signalled more hikes, lifting the real 0.9% against the dollar." },
};

const EXTRA: NewsStory[] = [
  { id: "n11", title: "Tesla slides 3% as delivery estimates are trimmed ahead of Q3 print", source: "Bloomberg", minutesAgo: 290, symbols: ["TSLA", "NAS100"], country: "us", image: "/assets/photos/stock-market.jpg", sentiment: "bearish", assetClass: "stocks", readMin: 3, summary: "Analysts at two major banks cut Q3 delivery forecasts to about 455,000 vehicles, citing softer demand in China and Europe." },
  { id: "n12", title: "Silver jumps 1.5% to 12-year high on industrial demand outlook", source: "Reuters", minutesAgo: 318, symbols: ["XAGUSD", "XAUUSD"], country: "cn", image: "/assets/photos/crypto-coins.jpg", sentiment: "bullish", assetClass: "metals", readMin: 2, summary: "Solar-panel demand from China and a weaker dollar pushed silver above $31. The gold/silver ratio fell to 85, its lowest since June." },
  { id: "n13", title: "Solana rallies 4.6% as network activity hits record", source: "The Block", minutesAgo: 355, symbols: ["SOLUSD", "BTCUSD"], country: "us", image: "/assets/photos/crypto.jpg", sentiment: "bullish", assetClass: "crypto", readMin: 2, summary: "Daily active addresses on Solana topped 5M for the first time, and DEX volumes overtook Ethereum for the third straight week." },
  { id: "n14", title: "DAX slips as German business sentiment falls for a fourth month", source: "Handelsblatt", minutesAgo: 402, symbols: ["GER40", "EURUSD"], country: "de", image: "/assets/photos/skyscrapers.jpg", sentiment: "bearish", assetClass: "indices", readMin: 3, summary: "The Ifo index fell to 85.4, below forecasts, adding to signs Europe's biggest economy may be sliding into a technical recession." },
  { id: "n15", title: "Dollar index slips to 100.4 as Treasury yields ease after GDP revision", source: "MarketWatch", minutesAgo: 431, symbols: ["EURUSD", "USDJPY", "XAUUSD"], country: "us", image: "/assets/photos/trading-screen.jpg", sentiment: "bearish", assetClass: "forex", readMin: 2, summary: "The 10-year yield fell 4bp to 3.74% after final Q2 GDP held at 3.0%, trimming the dollar's gains for the week." },
  { id: "n16", title: "Nikkei 225 gains 0.9% as exporters benefit from softer yen", source: "Nikkei Asia", minutesAgo: 468, symbols: ["JP225", "USDJPY"], country: "jp", image: "/assets/photos/analytics.jpg", sentiment: "bullish", assetClass: "indices", readMin: 2, summary: "Toyota and Sony led gains in Tokyo as USDJPY held above 149, with foreign investors net buyers for a second week." },
];

export const NEWS_STORIES: NewsStory[] = [...NEWS.map((n) => ({ ...n, ...META[n.id]! })), ...EXTRA];

export const AI_BRIEF = {
  updated: "18:05 GMT+3",
  mood: "Risk-on",
  points: [
    { tone: "up" as const, text: "Gold holds near record (2,654) as markets price 72bp of Fed cuts; the weaker dollar supports XAUUSD and silver." },
    { tone: "up" as const, text: "Tech leads equities: NAS100 +1.2% on chipmaker strength; BTC reclaims $63K on ETF inflows." },
    { tone: "down" as const, text: "Oil under pressure (-1.4%) on China demand worries despite Middle East risk." },
    { tone: "neutral" as const, text: "Tomorrow: US Core PCE at 15:30. Expect volatility in EURUSD, XAUUSD and NAS100." },
  ],
  watch: ["XAUUSD", "NAS100", "USOIL", "EURUSD"],
};
