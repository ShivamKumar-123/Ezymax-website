"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Bell, CandlestickChart, Star } from "lucide-react";
import { Button, Chip, Delta, Dialog, EquityChart, IconButton, PriceText, Segmented, SymbolAvatar, cn, formatNumber, useFeedMode, useQuote } from "@kalks/ui";
import { ASSET_CLASS_LABEL, IS_DEMO, candles, fetchCandles, getInstrument, isMarketOpen, priceFeed, serverOffset, type Candle, type Instrument } from "@kalks/mock";
import { CONTRACT_SPECS } from "@kalks/mock/markets-extra";
import { tr, useT } from "@kalks/i18n/react";
import { TERMINAL_URL } from "@/lib/live";

const RANGES = { "1M": 30, "3M": 90, "6M": 180 } as const;

/** Live spread, same units as the Markets table: pips for FX, price units for everything else. */
function liveSpread(i: Instrument, bid: number, ask: number) {
  if (i.assetClass !== "forex") return formatNumber(ask - bid, i.digits);
  const pip = i.digits === 5 || i.digits === 3 ? Math.pow(10, -(i.digits - 1)) : Math.pow(10, -i.digits);
  return tr("news.instrument.pips", { value: ((ask - bid) / pip).toFixed(1) });
}

function Body({ symbol, fav, onFav }: { symbol: string; fav: boolean; onFav: () => void }) {
  const inst = getInstrument(symbol);
  const spec = CONTRACT_SPECS[symbol]!;
  const q = useQuote(symbol);
  const [range, setRange] = React.useState<keyof typeof RANGES>("3M");
  // real daily bars from the market-data service; the seeded series only when the service is offline
  const mode = useFeedMode();
  const [real, setReal] = React.useState<{ symbol: string; bars: Candle[] } | null>(null);
  React.useEffect(() => {
    if (mode !== "live") return;
    let alive = true;
    void fetchCandles(symbol, "D1", 180).then((bars) => alive && bars && bars.length > 1 && setReal({ symbol, bars }));
    return () => {
      alive = false;
    };
  }, [symbol, mode]);
  const all = React.useMemo(() => (real && real.symbol === symbol ? real.bars : mode === "live" ? null : candles(symbol, 180)), [real, symbol, mode]);
  const data = React.useMemo(() => (all ?? []).slice(-RANGES[range]).map((c) => ({ time: c.time, value: +c.close.toFixed(inst.digits), volume: c.volume })), [all, range, inst.digits]);
  const day = priceFeed().day(symbol); // today's range, kept current by the stream
  const hi = day?.high ?? (all ? all[all.length - 1]!.high : q.ask);
  const lo = day?.low ?? (all ? all[all.length - 1]!.low : q.bid);
  const nowSec = Math.floor(Date.now() / 1000);
  const todayIdx = new Date((nowSec + serverOffset(nowSec)) * 1000).getUTCDay(); // server-time weekday, 0 Sun
  const open = isMarketOpen(symbol);
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  const t = useT();
  const dayName = (d: string) => t.dyn(`news.day.${d.toLowerCase()}`, d);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <SymbolAvatar symbol={symbol} size={40} />
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold">
              {symbol}
              <Chip size="sm">{t.dyn(`news.assetClass.${inst.assetClass}`, ASSET_CLASS_LABEL[inst.assetClass])}</Chip>
              <Chip size="sm" tone={open ? "up" : "neutral"} dot>
                {open ? t("news.markets.marketOpen") : t("news.markets.marketClosed")}
              </Chip>
            </div>
            <div className="text-[13px] text-fg-3">{inst.name}</div>
          </div>
        </div>
        <div className="flex gap-2">
          {IS_DEMO && (
            <IconButton size="sm" aria-label={t("news.instrument.priceAlert")} onClick={() => toast.success(t("news.instrument.alertSet", { symbol }), { description: t("news.instrument.alertSetDesc", { price: formatNumber(q.bid * 1.005, inst.digits) }) })}>
              <Bell />
            </IconButton>
          )}
          <IconButton size="sm" active={fav} aria-label={t("news.markets.favourite")} onClick={onFav}>
            <Star className={cn(fav && "fill-current")} />
          </IconButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link target="_blank" rel="noopener" href={`${TERMINAL_URL}/?symbol=${symbol}&side=sell`} className="k-row group px-4 py-3 transition-colors hover:border-down/40">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-down">{t("news.instrument.sellBid")}</div>
          <PriceText symbol={symbol} value={q.bid} dir={q.dir} size="lg" className="mt-1 text-[22px]" />
        </Link>
        <Link target="_blank" rel="noopener" href={`${TERMINAL_URL}/?symbol=${symbol}&side=buy`} className="k-row group px-4 py-3 text-end transition-colors hover:border-up/40">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-up">{t("news.instrument.buyAsk")}</div>
          <PriceText symbol={symbol} value={q.ask} dir={q.dir} size="lg" className="mt-1 text-[22px]" />
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-fg-3">
        <span>
          {t("news.instrument.change")} <Delta value={q.change} className="ms-1" />
        </span>
        <span className="k-num">
          {t("news.instrument.dayRange")} <span dir="ltr" className="font-mono text-fg-2">{formatNumber(lo, inst.digits)} – {formatNumber(hi, inst.digits)}</span>
        </span>
        <span className="k-num">
          {t("news.instrument.spread")} <span className="font-mono text-fg-2">{liveSpread(inst, q.bid, q.ask)}</span>
        </span>
      </div>

      <div className="k-row p-3">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="k-label">{t("news.instrument.dailyClose")}</span>
          <Segmented size="xs" value={range} onChange={setRange} options={Object.keys(RANGES) as (keyof typeof RANGES)[]} />
        </div>
        {data.length > 1 ? <EquityChart data={data} height={190} color={q.change >= 0 ? "gold" : "down"} /> : <div style={{ height: 190 }} />}
      </div>

      <div>
        <div className="k-label mb-2">{t("news.instrument.contractSpec")}</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            [t("news.instrument.spec.digits"), spec.digits],
            [t("news.instrument.spec.contractSize"), `${formatNumber(spec.contractSize, 0)} ${t.dyn(`news.instrument.unit.${inst.assetClass}`, spec.contractUnit)}`],
            [t("news.instrument.spec.minMaxLot"), `${spec.minLot} / ${spec.maxLot}`],
            [t("news.instrument.spec.lotStep"), spec.lotStep],
            [t("news.instrument.spec.maxLeverage"), `1:${spec.leverage}`],
            [t("news.instrument.spec.marginCurrency"), spec.marginCurrency],
            // swap rates come from the trading engine, which isn't live yet: shown in demo builds only
            ...(!IS_DEMO ? [] : [[t("news.instrument.spec.swapLong"), <span key="sl" className={spec.swapLong < 0 ? "text-down" : "text-up"}>{spec.swapLong.toFixed(2)}</span>],
            [t("news.instrument.spec.swapShort"), <span key="ss" className={spec.swapShort < 0 ? "text-down" : "text-up"}>{spec.swapShort.toFixed(2)}</span>],
            [t("news.instrument.spec.swapType"), spec.swapType === "Points" ? t("news.instrument.swapType.points") : t("news.instrument.swapType.percent")],
            [t("news.instrument.spec.tripleSwap"), dayName(spec.tripleSwap)]] as [string, React.ReactNode][]),
          ].map(([k, v], i) => (
            <div key={i} className="rounded-xl border border-line bg-surface-2 px-3 py-2">
              <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{k}</div>
              <div className="k-num mt-0.5 truncate text-[13px] font-medium">{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="k-label mb-2 flex items-center justify-between">
          {t("news.instrument.tradingHours")} <span className="font-normal normal-case tracking-normal text-fg-3">{t("news.instrument.serverTime")}</span>
        </div>
        <div className="divide-y divide-line rounded-[14px] border border-line bg-surface-2">
          {dayOrder.map((d, i) => {
            const h = spec.hours[i]!;
            const today = d === todayIdx;
            const closed = h.sessions === "Closed";
            return (
              <div key={h.day} className={cn("flex items-center justify-between px-4 py-2 text-[12.5px]", today && "bg-ember-soft/60")}>
                <span className={cn("flex items-center gap-2", today ? "font-medium text-fg" : "text-fg-2")}>
                  {dayName(h.day)}
                  {today && (
                    <Chip size="sm" tone="ember">
                      {t("common.today")}
                    </Chip>
                  )}
                </span>
                <span dir="ltr" className={cn("k-num font-mono", closed ? "text-fg-3" : "text-fg")}>{closed ? t("news.sessionClosed") : h.sessions}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function InstrumentDrawer({ symbol, onClose, fav, onFav }: { symbol: string | null; onClose: () => void; fav: boolean; onFav: () => void }) {
  const t = useT();
  return (
    <Dialog
      open={!!symbol}
      onOpenChange={(o) => !o && onClose()}
      side="right"
      title={t("news.instrument.title")}
      description={symbol ? t("news.instrument.description", { symbol }) : undefined}
      footer={
        symbol ? (
          <>
            <Link target="_blank" rel="noopener" href={`${TERMINAL_URL}/?symbol=${symbol}&side=sell`}>
              <Button variant="down-outline">{t("common.sell")}</Button>
            </Link>
            <Link target="_blank" rel="noopener" href={`${TERMINAL_URL}/?symbol=${symbol}&side=buy`}>
              <Button variant="up-outline">{t("common.buy")}</Button>
            </Link>
            <Link target="_blank" rel="noopener" href={`${TERMINAL_URL}/?symbol=${symbol}`}>
              <Button variant="ember">
                <CandlestickChart /> {t("news.instrument.trade", { symbol })}
              </Button>
            </Link>
          </>
        ) : null
      }
    >
      {symbol && <Body symbol={symbol} fav={fav} onFav={onFav} />}
    </Dialog>
  );
}
