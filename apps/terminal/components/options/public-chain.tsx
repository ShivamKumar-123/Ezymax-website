"use client";

// The public option chain page (guests, search engines): the server-rendered chain, then live prices in the browser
// through the options store (public stream, else polling). Read-only, with a sign-in CTA to trade the chain inside
// Kalks Trader (/?mode=options&u=…).
import * as React from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Hourglass, LogIn, ShieldAlert, UserPlus } from "lucide-react";
import { Logo, cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { atmIndex } from "@/lib/options/math";
import { opt, useOpt } from "@/lib/options-store";
import type { OptionChain } from "@/lib/options/types";
import { Countdown, KindBadges, OptAvatar, Seg } from "./bits";
import { OptionChainTable } from "./chain";
import { expiryLabel, pct, px, usd } from "./format";
import { ExpiryStrip } from "./header";

type Initial = (OptionChain & { expiries?: { date: string; kinds: OptionChain["kinds"]; cutAt: string }[] }) | null;

interface Props {
  u: string;
  name: string;
  initial: Initial;
  status: "ok" | "soon" | "unavailable";
  cta: string;
  underlyings: { symbol: string; name: string; enabled: boolean }[];
}

export function PublicChainView({ u, name, initial, status, cta, underlyings }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const [live, setLive] = React.useState(false);
  const register = `${cta.replace(/\/$/, "")}/register`;
  const tradeHref = `/?mode=options&u=${u}`;

  // hydrate the store from the server's chain, then keep it live (public stream / polling)
  React.useEffect(() => {
    if (status !== "ok") return;
    if (initial) opt.seed(initial);
    setLive(true);
    return opt.attach({ login: "guest", guest: true, engine: false, readOnly: true, publicPage: true });
  }, [status, initial]);

  const chain = useOpt((s) => (live && s.chain?.underlying === u ? s.chain : null)) ?? initial;
  const expiry = useOpt((s) => s.expiry);
  const view = useOpt((s) => s.prefs.view);
  React.useEffect(() => {
    if (!live || !expiry) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("expiry") === expiry) return;
    url.searchParams.set("expiry", expiry);
    window.history.replaceState(null, "", url);
  }, [live, expiry]);

  const atm = chain?.rows.length ? chain.rows[atmIndex(chain)] : undefined;
  return (
    <div className="h-dvh overflow-y-auto bg-page text-fg">
      <header className="sticky top-0 z-20 border-b border-line bg-panel/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Kalks Trader">
            <Logo height={18} />
            <span className="hidden border-s border-line ps-2.5 text-[12px] font-medium text-fg-3 sm:inline">{t("trader.opt.public.brand")}</span>
          </Link>
          <nav className="ms-auto flex items-center gap-1.5">
            <a href="/login" className="hidden h-8 items-center gap-1.5 rounded-[8px] px-3 text-[12.5px] font-medium text-fg-2 hover:bg-surface-3 hover:text-fg sm:inline-flex">
              <LogIn className="size-3.5" /> {t("trader.guest.logIn")}
            </a>
            <a href={register} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-ember px-3 text-[12.5px] font-semibold text-white hover:brightness-110">
              <UserPlus className="size-3.5" /> {t("trader.guest.openAccount")}
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] space-y-4 px-4 pb-12 pt-5 sm:px-6 sm:pt-7">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ember">
              <span className="size-1.5 rounded-full bg-ember" /> {t("trader.opt.public.kicker")}
            </div>
            <h1 className="flex items-center gap-3 text-[24px] font-semibold tracking-tight sm:text-[28px]">
              <OptAvatar symbol={u} size={24} />
              {t("trader.opt.public.title", { name })}
            </h1>
            <p className="mt-1.5 max-w-[640px] text-[13px] leading-relaxed text-fg-3">{t("trader.opt.public.subtitle")}</p>
          </div>
          <a href={tradeHref} className="inline-flex h-10 items-center gap-2 rounded-[9px] bg-ember px-4 text-[13px] font-semibold text-white shadow-[0_10px_28px_-12px_rgba(255,90,31,0.9)] hover:brightness-110">
            {t("trader.opt.public.trade", { u })} <ArrowRight className="size-4" />
          </a>
        </section>

        <nav aria-label={t("trader.opt.col.underlying")} className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {underlyings.map((x) => (
            <Link key={x.symbol} href={`/options/chain/${x.symbol}`} aria-current={x.symbol === u ? "page" : undefined} className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border px-2.5 text-[12px] font-medium transition-colors", x.symbol === u ? "border-ember/50 bg-ember-soft text-fg" : "border-line bg-panel text-fg-2 hover:border-fg-3/40 hover:text-fg", !x.enabled && "opacity-55")}>
              <OptAvatar symbol={x.symbol} size={13} />
              {x.symbol}
            </Link>
          ))}
        </nav>

        {status !== "ok" || !chain ? (
          <section className="grid place-items-center rounded-[12px] border border-line bg-panel px-6 py-14 text-center">
            <div className="max-w-[460px]">
              <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
                <Hourglass className="size-5" />
              </div>
              <h2 className="text-[16px] font-semibold">{status === "unavailable" ? t("trader.opt.error.title") : t("trader.opt.soon.title")}</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-fg-3">{status === "unavailable" ? t("trader.opt.error.text") : t("trader.opt.public.soonText")}</p>
              <a href={register} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-ember px-4 text-[13px] font-semibold text-white hover:brightness-110">
                {t("trader.guest.openAccount")} <ArrowRight className="size-4" />
              </a>
            </div>
          </section>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                [t("trader.opt.spot"), px(chain.spot?.mid, chain.digits)],
                [t("trader.opt.atmIv"), pct(atm?.call?.iv ?? null)],
                [t("trader.opt.public.atmStraddle"), atm?.call && atm.put ? `${usd(atm.call.askUsd + atm.put.askUsd)} USD` : "—"],
                [t("trader.opt.contract"), `${chain.contractSize.toLocaleString("en-US")} ${chain.contractUnit}`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-[10px] border border-line bg-panel px-3.5 py-2.5">
                  <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-3">{k}</div>
                  <div className="k-num mt-1 font-mono text-[17px] font-semibold">{v}</div>
                </div>
              ))}
            </section>

            <section className="overflow-hidden rounded-[12px] border border-line bg-panel">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
                <div className="min-w-0 flex-1">{live ? <ExpiryStrip className="h-9 border-0 bg-transparent px-0" /> : <StaticExpiries initial={initial} locale={locale} />}</div>
                <span className="flex items-center gap-3 text-[11.5px] text-fg-3">
                  <Countdown to={Date.parse(chain.cutAt)} prefix={<span className="font-sans">{t("trader.opt.cutIn")} </span>} />
                  <Seg
                    size="sm"
                    className="w-[168px]"
                    value={view}
                    onChange={(v) => opt.setPrefs({ view: v })}
                    options={[
                      { value: "calls", label: t("trader.opt.calls") },
                      { value: "both", label: t("trader.opt.both") },
                      { value: "puts", label: t("trader.opt.puts") },
                    ]}
                  />
                </span>
              </div>
              <div className="h-[min(680px,72dvh)]">{live ? <OptionChainTable /> : <StaticChain chain={chain} />}</div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-ember/25 bg-ember-soft/40 px-4 py-3">
              <div className="text-[13px]">
                <span className="font-semibold text-fg">{t("trader.opt.public.ctaTitle")}</span> <span className="text-fg-3">{t("trader.opt.public.ctaText")}</span>
              </div>
              <div className="flex gap-2">
                <a href="/login" className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line px-3 text-[12.5px] font-medium text-fg-2 hover:text-fg">
                  <LogIn className="size-3.5" /> {t("trader.guest.logIn")}
                </a>
                <a href={tradeHref} className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-ember px-3 text-[12.5px] font-semibold text-white hover:brightness-110">
                  {t("trader.opt.public.trade", { u })} <ArrowRight className="size-3.5" />
                </a>
              </div>
            </div>
          </>
        )}

        <section className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[12px] border border-line bg-panel p-4">
            <h2 className="mb-2 flex items-center gap-2 text-[14px] font-semibold">
              <BookOpen className="size-4 text-gold" /> {t("trader.opt.public.howTitle")}
            </h2>
            <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-fg-3">
              {(["trader.opt.public.how1", "trader.opt.public.how2", "trader.opt.public.how3", "trader.opt.public.how4", "trader.opt.public.how5"] as const).map((k) => (
                <li key={k} className="flex gap-2">
                  <span className="mt-[7px] size-1 shrink-0 rounded-full bg-fg-3" />
                  {t(k)}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[12px] border border-line bg-panel p-4">
            <h2 className="mb-2 flex items-center gap-2 text-[14px] font-semibold">
              <ShieldAlert className="size-4 text-warn" /> {t("trader.opt.public.riskTitle")}
            </h2>
            <p className="text-[12.5px] leading-relaxed text-fg-3">{t("trader.opt.public.riskText")}</p>
          </div>
        </section>
      </main>
    </div>
  );
}

function StaticExpiries({ initial, locale }: { initial: Initial; locale: string }) {
  return (
    <div className="flex h-9 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
      {(initial?.expiries ?? []).map((e) => (
        <span key={e.date} className={cn("flex h-[30px] shrink-0 items-center gap-1.5 rounded-[6px] border px-2 text-[11.5px]", e.date === initial?.expiry ? "border-ember/50 bg-ember-soft text-fg" : "border-line bg-surface-2/60 text-fg-2")}>
          {expiryLabel(e.date, locale)} <KindBadges kinds={e.kinds} />
        </span>
      ))}
    </div>
  );
}

/** Server-rendered chain (before the page hydrates): calls | strike | puts around ATM. */
function StaticChain({ chain }: { chain: OptionChain }) {
  const t = useT();
  const i0 = atmIndex(chain);
  const rows = chain.rows.slice(Math.max(0, i0 - 10), i0 + 11);
  const cell = "h-[30px] whitespace-nowrap border-b border-line/50 px-2 text-end font-mono text-[11.5px]";
  return (
    <div className="t-scroll h-full overflow-auto">
      <table className="w-full min-w-max border-separate border-spacing-0">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.04em] text-fg-3">
            {[t("trader.opt.col.delta"), t("trader.opt.col.iv"), t("trader.opt.col.bid"), t("trader.opt.col.ask")].map((h) => (
              <th key={`c${h}`} className="sticky top-0 border-b border-line bg-panel-2 px-2 py-1.5 text-end font-medium">
                {h}
              </th>
            ))}
            <th className="sticky top-0 border-x border-b border-line bg-panel-2 px-2 py-1.5 text-center font-semibold text-fg-2">{t("trader.opt.col.strike")}</th>
            {[t("trader.opt.col.bid"), t("trader.opt.col.ask"), t("trader.opt.col.iv"), t("trader.opt.col.delta")].map((h) => (
              <th key={`p${h}`} className="sticky top-0 border-b border-line bg-panel-2 px-2 py-1.5 text-end font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.strikeLabel}>
              <td className={cn(cell, "text-fg-2")}>{r.call ? r.call.delta.toFixed(3) : "—"}</td>
              <td className={cn(cell, "text-fg-2")}>{r.call ? pct(r.call.iv) : "—"}</td>
              <td className={cn(cell, "text-down")}>{r.call ? usd(r.call.bidUsd) : "—"}</td>
              <td className={cn(cell, "text-up")}>{r.call ? usd(r.call.askUsd) : "—"}</td>
              <td className={cn(cell, "border-x bg-panel-2 text-center font-semibold", r === chain.rows[i0] ? "text-ember" : "text-fg")}>{r.strikeLabel}</td>
              <td className={cn(cell, "text-down")}>{r.put ? usd(r.put.bidUsd) : "—"}</td>
              <td className={cn(cell, "text-up")}>{r.put ? usd(r.put.askUsd) : "—"}</td>
              <td className={cn(cell, "text-fg-2")}>{r.put ? pct(r.put.iv) : "—"}</td>
              <td className={cn(cell, "text-fg-2")}>{r.put ? r.put.delta.toFixed(3) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
