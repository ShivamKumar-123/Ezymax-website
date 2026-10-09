// Brand promotions for demo builds: the dashboard's hero carousel and Events & updates (Client Area and app).
// Shapes follow the growth service's BannerView (services/growth/README.md); dates are relative to page load.

export type PromoKind = "banner" | "event" | "post";
export type PromoLayout = "card" | "hero";

export type PromoItem = {
  id: number;
  kind: PromoKind;
  layout: PromoLayout;
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  imageUrl: string | null;
  imageMediaId: string | null;
  tone: "ember" | "gold" | "neutral" | "up";
  placement: "dashboard";
  dismissible: boolean;
  eventStartsAt: string | null;
  eventEndsAt: string | null;
  eventState: "upcoming" | "live" | "ended" | null;
  location: string | null;
  publishedAt: string;
  /** Markdown body of the event / post page. */
  content?: string;
};

const DAY = 86_400_000;
/** Server time (GMT+3) wall clock `hh:mm`, `days` from today, as an ISO instant. */
function at(days: number, hh: number, mm = 0) {
  const d = new Date(Date.now() + days * DAY);
  d.setUTCHours(hh - 3, mm, 0, 0);
  return d.toISOString();
}

export const PROMO_ITEMS: PromoItem[] = [
  {
    id: 9101,
    kind: "banner",
    layout: "hero",
    title: "Zero spreads on gold, all week",
    body: "Trade XAUUSD from 0.0 pips on Raw accounts until Friday's close. Commission only.",
    ctaLabel: "Trade gold",
    ctaUrl: "/accounts",
    imageUrl: "/assets/photos/gold.jpg",
    imageMediaId: null,
    tone: "gold",
    placement: "dashboard",
    dismissible: true,
    eventStartsAt: null,
    eventEndsAt: null,
    eventState: null,
    location: null,
    publishedAt: at(-2, 9),
  },
  {
    id: 9102,
    kind: "event",
    layout: "hero",
    title: "Ezymex Traders Summit · Dubai",
    body: "An evening with our dealing desk and market strategists at DIFC. Seats are limited.",
    ctaLabel: "Reserve a seat",
    ctaUrl: null,
    imageUrl: "/assets/photos/dubai.jpg",
    imageMediaId: null,
    tone: "ember",
    placement: "dashboard",
    dismissible: true,
    eventStartsAt: at(5, 18, 30),
    eventEndsAt: at(5, 21, 30),
    eventState: "upcoming",
    location: "Gate Village 3, DIFC, Dubai",
    publishedAt: at(-1, 10),
    content: [
      "Join the Ezymex team for an evening on the markets that moved this quarter, and the ones to watch next.",
      "",
      "## Agenda",
      "",
      "1. **18:30** Welcome and registration",
      "2. **19:00** Gold, oil and the dollar: the quarter ahead",
      "3. **19:45** Live Q&A with the dealing desk",
      "4. **20:30** Networking",
      "",
      "> **Note:** Entry is free for verified clients. Bring the confirmation email and an ID.",
      "",
      "Questions before the day? Write to us from [Support](/support).",
    ].join("\n"),
  },
  {
    id: 9103,
    kind: "event",
    layout: "card",
    title: "Webinar: Trading the NFP release",
    body: "A live walk-through of the US jobs report: what moves, how fast, and how to size risk around it.",
    ctaLabel: null,
    ctaUrl: null,
    imageUrl: "/assets/photos/trading-screen.jpg",
    imageMediaId: null,
    tone: "ember",
    placement: "dashboard",
    dismissible: true,
    eventStartsAt: at(12, 15, 0),
    eventEndsAt: at(12, 16, 0),
    eventState: "upcoming",
    location: "https://meet.ezymex.com/nfp-live",
    publishedAt: at(-3, 12),
    content: [
      "Non-farm payrolls is the most watched number of the month. In 60 minutes we cover:",
      "",
      "- How EURUSD, gold and US indices reacted over the last 12 releases",
      "- Spreads and slippage in the first minute, and why limit orders help",
      "- A simple plan: size, stop and what to do if the number surprises",
      "",
      "The session is recorded; registered clients get the replay in their inbox.",
    ].join("\n"),
  },
  {
    id: 9104,
    kind: "post",
    layout: "card",
    title: "New: Ezymex Trader for Android",
    body: "The full trading terminal now runs natively on Android, with one-tap trading from the chart and price alerts.",
    ctaLabel: null,
    ctaUrl: null,
    imageUrl: "/assets/photos/charts.jpg",
    imageMediaId: null,
    tone: "neutral",
    placement: "dashboard",
    dismissible: true,
    eventStartsAt: null,
    eventEndsAt: null,
    eventState: null,
    location: null,
    publishedAt: at(-1, 8),
    content: [
      "Ezymex Trader is now a native Android app. Sign in with your Client Area account and everything is there.",
      "",
      "## What's in it",
      "",
      "- **One-tap trading** from the chart, with stop loss and take profit you drag into place",
      "- **Price alerts** that reach you even when the app is closed",
      "- **Biometric unlock** and the same two-step verification as the web",
      "",
      "| Requirement | Minimum |",
      "| --- | --- |",
      "| Android | 7.0 |",
      "| Storage | 60 MB |",
    ].join("\n"),
  },
  {
    id: 9105,
    kind: "post",
    layout: "card",
    title: "Holiday trading hours for US Thanksgiving",
    body: "US indices and stocks close early on Friday. Forex and crypto trade as usual.",
    ctaLabel: null,
    ctaUrl: null,
    imageUrl: "/assets/photos/nyc.jpg",
    imageMediaId: null,
    tone: "neutral",
    placement: "dashboard",
    dismissible: true,
    eventStartsAt: null,
    eventEndsAt: null,
    eventState: null,
    location: null,
    publishedAt: at(-4, 14),
    content: [
      "Trading hours change around the US holiday (server time, GMT+3):",
      "",
      "| Market | Thursday | Friday |",
      "| --- | --- | --- |",
      "| US30, US500, NAS100 | Closed | Closes 20:15 |",
      "| US stocks | Closed | Closes 20:00 |",
      "| Forex, metals, crypto | Normal | Normal |",
      "",
      "Open positions stay open. Pending orders on closed markets wait for the next session.",
    ].join("\n"),
  },
];

/** The dashboard's hero carousel (layout hero, highest priority first). */
export const PROMO_HERO = PROMO_ITEMS.filter((p) => p.layout === "hero");
/** Events & updates: upcoming events first (soonest first), then announcements (newest first). */
export const PROMO_UPDATES = PROMO_ITEMS.filter((p) => p.kind !== "banner").sort((a, b) => {
  const ua = a.eventState === "upcoming" || a.eventState === "live";
  const ub = b.eventState === "upcoming" || b.eventState === "live";
  if (ua !== ub) return ua ? -1 : 1;
  if (ua && ub) return Date.parse(a.eventStartsAt!) - Date.parse(b.eventStartsAt!);
  return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
});
export const promoById = (id: number | string) => PROMO_ITEMS.find((p) => String(p.id) === String(id)) ?? null;
