import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowUpRight, ImageOff } from "lucide-react";
import { Logo } from "@kalks/ui";
import { publicShare, type PublicShare } from "@/lib/growth";

// Public share card (D136): /s/<code>. No sign-in (proxy.ts lets /s/** through) and outside the (app) group, so
// no Client Area shell or LiveGate. The card is read server-side with the internal token; the page render counts
// a view, metadata and the image don't. The call to action is the sharer's referral link (/r/CODE, see proxy.ts).

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function day(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function pct(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function headline(s: PublicShare) {
  const d = s.data;
  if (s.kind === "trade") return `${d.name} · ${d.symbol ?? "Trade"} ${d.side ? d.side.toUpperCase() : ""} ${pct(d.movePct)}`.replace(/\s+/g, " ").trim();
  return `${d.name} · ${pct(d.returnPct)} trading return`;
}

function summary(s: PublicShare) {
  const d = s.data;
  if (s.kind === "trade") return `${d.symbol ?? "Trade"} closed ${day(d.closeTime)} with a ${pct(d.movePct)} price move. Trade with Kalks.`;
  const parts = [d.trades !== null ? `${d.trades} trades` : "", d.winRate !== null ? `${d.winRate.toFixed(1)}% win rate` : ""].filter(Boolean).join(" · ");
  return `${pct(d.returnPct)} return${day(d.from) ? ` from ${day(d.from)} to ${day(d.to)}` : ""}${parts ? ` · ${parts}` : ""}. Trade with Kalks.`;
}

async function origin() {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const s = await publicShare(code);
  if (!s || s === "unavailable") return { title: "Kalks", robots: { index: false } };
  const base = await origin();
  const image = `${base}/s/${s.code}/image`;
  const title = headline(s);
  const description = summary(s);
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, url: `${base}/s/${s.code}`, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SharePage({ params }: Props) {
  const { code } = await params;
  const s = await publicShare(code, true);
  const share = s && s !== "unavailable" ? s : null;
  const d = share?.data;
  const cta = d?.referralCode ? `/r/${encodeURIComponent(d.referralCode)}` : "/register";

  return (
    <main className="min-h-dvh bg-bg px-4 py-10 text-fg sm:py-16">
      <div className="mx-auto max-w-[880px]">
        <div className="mb-8 flex items-center justify-between">
          <Logo height={22} />
          <Link href={cta} className="text-[12.5px] text-fg-2 underline-offset-2 hover:text-fg hover:underline">
            Open an account
          </Link>
        </div>

        {share && d ? (
          <>
            <div className="k-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between" data-testid="share-page">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ember">{share.kind === "trade" ? "Shared trade" : "Shared trading results"}</div>
                <h1 className="mt-1 text-[24px] font-medium leading-tight tracking-tight">
                  {share.kind === "trade" ? `${d.name} closed ${d.symbol ?? "a trade"}` : `${d.name}'s results`}
                </h1>
                <p className="mt-1 text-[14px] text-fg-2">{summary(share).replace(" Trade with Kalks.", "")}</p>
              </div>
              <Link href={cta} className="shrink-0" data-testid="share-cta">
                <span className="k-ember-btn inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-medium">
                  Open an account <ArrowUpRight className="size-4" />
                </span>
              </Link>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/s/${share.code}/image`} alt={headline(share)} width={1200} height={630} className="mt-6 block h-auto w-full rounded-[16px] border border-line" data-testid="share-image" />
          </>
        ) : (
          <div className="k-card p-8 text-center" data-testid="share-page">
            <ImageOff className="mx-auto size-8 text-fg-3" />
            <h1 className="mt-3 text-[20px] font-medium">{s === "unavailable" ? "This card is unavailable right now" : "Share card not found"}</h1>
            <p className="mx-auto mt-1 max-w-md text-[13.5px] text-fg-3">{s === "unavailable" ? "Please try again in a moment." : "The link may be mistyped or the card was removed."}</p>
            <Link href="/register" className="mt-5 inline-block">
              <span className="k-ember-btn inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium">
                Open an account <ArrowUpRight className="size-4" />
              </span>
            </Link>
          </div>
        )}

        <p className="mx-auto mt-8 max-w-2xl text-center text-[11.5px] leading-relaxed text-fg-3">
          Trading CFDs and forex carries a high level of risk and may not be suitable for all investors. Past performance is not a reliable indicator of future results. Shared by a Kalks client; not investment advice.
        </p>
      </div>
    </main>
  );
}
