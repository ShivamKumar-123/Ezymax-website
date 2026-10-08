import type { Metadata } from "next";
import { headers } from "next/headers";
import { clientIp, fetchPublicShare } from "@/lib/gateway";
import { dateLabel, shareTotals, signed } from "@/lib/share-stats";
import type { PublicShare } from "@/lib/share";
import { ShareView, Unavailable } from "./share-view";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3002";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const base = new URL(await origin());
  const r = await fetchPublicShare(code);
  const robots = { index: false, follow: false };
  if (!r.data) return { title: "Link unavailable", metadataBase: base, robots };
  const s = r.data as unknown as PublicShare;
  const t = shareTotals(s.trades, {}, s.show_amounts);
  const parts = [`${s.trades.length} trade${s.trades.length === 1 ? "" : "s"}`];
  if (t.open) parts.push(`${t.open} live`);
  if (t.winRate !== null) parts.push(`${t.winRate.toFixed(0)}% win rate`);
  if (t.closed) parts.push(`${signed(t.pips)} pips`);
  const description = `${parts.join(" · ")} · shared by ${s.alias} on Ezymex Trader, ${dateLabel(s.created_at)}`;
  return {
    title: `${s.title} · ${s.alias}`,
    description,
    metadataBase: base,
    robots,
    openGraph: { type: "website", siteName: "Ezymex Trader", title: `${s.title} · shared trades`, description, url: `/share/${code}` },
    twitter: { card: "summary_large_image", title: `${s.title} · shared trades`, description },
  };
}

export default async function SharePage({ params }: Props) {
  const { code } = await params;
  const h = await headers();
  const r = await fetchPublicShare(code, { view: true, ip: clientIp(h), userAgent: h.get("user-agent") });
  const cta = process.env.NEXT_PUBLIC_CLIENT_AREA_URL ?? "http://localhost:3000";
  if (!r.data) return <Unavailable cta={cta} busy={r.status === 503 || r.status === 429} />;
  return <ShareView initial={r.data as unknown as PublicShare} cta={cta} />;
}
