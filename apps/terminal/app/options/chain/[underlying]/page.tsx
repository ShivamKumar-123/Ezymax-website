import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { INSTRUMENT_MAP, IS_LIVE } from "@ezymex/mock";
import { OPTION_SPEC, OPTION_UNDERLYINGS, mockChain, mockExpiries, type OptionChain } from "@ezymex/mock/options";
import { publicChain } from "@/lib/options/server";
import { modulesOn } from "@/lib/modules";
import { tenantFeatures } from "@/lib/tenant-brand";
import { PublicChainView } from "@/components/options/public-chain";

// Public option chain (guest view, plan O29): trade.<domain>/options/chain/EURUSD. Server-rendered for search
// engines from the options service's public chain (`/v1/public/options/chain/{u}`, 1 s cache), then live in the
// browser (public stream / polling). Read-only: trading needs a signed-in account. While the public chain is
// switched off for Ezymex the page explains that options are launching soon. A broker that switched FX Options off in
// the Back Office (module `options`) has no chain page: 404.

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ underlying: string }>; searchParams: Promise<{ expiry?: string }> };

const NAMES: Record<string, string> = { EURUSD: "EUR/USD", GBPUSD: "GBP/USD", USDJPY: "USD/JPY", AUDUSD: "AUD/USD", USDCAD: "USD/CAD", USDCHF: "USD/CHF", NZDUSD: "NZD/USD", EURJPY: "EUR/JPY", GBPJPY: "GBP/JPY", XAUUSD: "Gold (XAU/USD)", XAGUSD: "Silver (XAG/USD)", USOIL: "WTI crude oil", UKOIL: "Brent crude oil" };

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3002";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

function symbolOf(raw: string): string | null {
  const u = decodeURIComponent(raw).toUpperCase();
  return OPTION_SPEC[u] ? u : null;
}

const optionsOn = async () => modulesOn((await tenantFeatures())?.modules, "options");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const u = symbolOf((await params).underlying);
  if (!u || !(await optionsOn())) return { title: "Option chain not found", robots: { index: false, follow: false } };
  const name = NAMES[u] ?? u;
  const title = `${name} options chain: calls, puts, IV and Greeks`;
  const description = `Live ${name} option chain on Ezymex FX Options: calls and puts for daily, weekly and monthly expiries with bid and ask in USD per contract, implied volatility, delta, probability in the money and breakeven. European, cash-settled in USD.`;
  return {
    title,
    description,
    metadataBase: new URL(await origin()),
    alternates: { canonical: `/options/chain/${u}` },
    robots: { index: true, follow: true },
    openGraph: { type: "website", siteName: "Ezymex Trader", title, description, url: `/options/chain/${u}` },
    twitter: { card: "summary", title, description },
  };
}

export default async function PublicChainPage({ params, searchParams }: Props) {
  const u = symbolOf((await params).underlying);
  if (!u || !(await optionsOn())) notFound();
  const sp = await searchParams;
  const expiry = sp.expiry && /^\d{4}-\d{2}-\d{2}$/.test(sp.expiry) ? sp.expiry : null;
  let initial: (OptionChain & { expiries?: { date: string; kinds: OptionChain["kinds"]; cutAt: string }[] }) | null = null;
  let status: "ok" | "soon" | "unavailable" = "ok";
  if (IS_LIVE) {
    const r = await publicChain(u, expiry);
    if (r.status === 200) initial = r.data as unknown as typeof initial;
    else status = r.status === 404 ? "soon" : "unavailable";
  } else if (OPTION_SPEC[u]!.enabled && INSTRUMENT_MAP[u]) {
    // demo builds: the in-browser pricer around the reference price (the page goes live once it hydrates)
    const now = Date.now();
    const list = mockExpiries(u, now);
    const e = list.find((x) => x.date === expiry) ?? list[0]!;
    const ref = INSTRUMENT_MAP[u]!;
    const c = mockChain({ symbol: u, expiry: e, spot: { bid: ref.price, ask: ref.price + ref.spread }, nowMs: now, usdPerQuote: OPTION_SPEC[u]!.quoteCcy === "USD" ? 1 : 1 / (OPTION_SPEC[u]!.quoteCcy === "JPY" ? 149.4 : OPTION_SPEC[u]!.quoteCcy === "CAD" ? 1.357 : 0.849) });
    initial = { ...c, expiries: list.map((x) => ({ date: x.date, kinds: x.kinds, cutAt: x.cutAt })) };
  } else status = "soon";
  const cta = process.env.NEXT_PUBLIC_CLIENT_AREA_URL ?? "http://localhost:3000";
  return <PublicChainView u={u} name={NAMES[u] ?? u} initial={initial} status={status} cta={cta} underlyings={OPTION_UNDERLYINGS.map((x) => ({ symbol: x.symbol, name: NAMES[x.symbol] ?? x.name, enabled: x.enabled }))} />;
}
