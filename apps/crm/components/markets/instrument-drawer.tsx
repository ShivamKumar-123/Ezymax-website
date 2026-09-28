"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Bell, CandlestickChart, Star } from "lucide-react";
import { Button, Chip, Delta, Dialog, EquityChart, IconButton, PriceText, Segmented, SymbolAvatar, cn, formatNumber, useFeedMode, useQuote } from "@kalks/ui";
import { ASSET_CLASS_LABEL, IS_DEMO, candles, fetchCandles, getInstrument, isMarketOpen, priceFeed, serverOffset, type Candle, type Instrument } from "@kalks/mock";
import { CONTRACT_SPECS } from "@kalks/mock/markets-extra";

const RANGES = { "1M": 30, "3M": 90, "6M": 180 } as const;

/** Live spread, same units as the Markets table: pips for FX, price units for everything else. */
function liveSpread(i: Instrument, bid: number, ask: number) {
  if (i.assetClass !== "forex") return formatNumber(ask - bid, i.digits);
  const pip = i.digits === 5 || i.digits === 3 ? Math.pow(10, -(i.digits - 1)) : Math.pow(10, -i.digits);
  return `${((ask - bid) / pip).toFixed(1)} pips`;
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

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <SymbolAvatar symbol={symbol} size={40} />
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold">
              {symbol}
              <Chip size="sm">{ASSET_CLASS_LABEL[inst.assetClass]}</Chip>
              <Chip size="sm" tone={open ? "up" : "neutral"} dot>
                {open ? "Market open" : "Market closed"}
              </Chip>
            </div>
            <div className="text-[13px] text-fg-3">{inst.name}</div>
          </div>
        </div>
        <div className="flex gap-2">
          {IS_DEMO && (
            <IconButton size="sm" aria-label="Price alert" onClick={() => toast.success(`Price alert set for ${symbol}`, { description: `Notify when bid crosses ${formatNumber(q.bid * 1.005, inst.digits)}` })}>
              <Bell />
            </IconButton>
          )}
          <IconButton size="sm" active={fav} aria-label="Favourite" onClick={onFav}>
            <Star className={cn(fav && "fill-current")} />
          </IconButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link target="_blank" rel="noopener" href={`/trade?symbol=${symbol}&side=sell`} className="k-row group px-4 py-3 transition-colors hover:border-down/40">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-down">Sell · bid</div>
          <PriceText symbol={symbol} value={q.bid} dir={q.dir} size="lg" className="mt-1 text-[22px]" />
        </Link>
        <Link target="_blank" rel="noopener" href={`/trade?symbol=${symbol}&side=buy`} className="k-row group px-4 py-3 text-right transition-colors hover:border-up/40">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-up">Buy · ask</div>
          <PriceText symbol={symbol} value={q.ask} dir={q.dir} size="lg" className="mt-1 text-[22px]" />
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-fg-3">
        <span>
          Change <Delta value={q.change} className="ml-1" />
        </span>
        <span className="k-num">
          Day range <span className="font-mono text-fg-2">{formatNumber(lo, inst.digits)} – {formatNumber(hi, inst.digits)}</span>
        </span>
        <span className="k-num">
          Spread <span className="font-mono text-fg-2">{liveSpread(inst, q.bid, q.ask)}</span>
        </span>
      </div>

      <div className="k-row p-3">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="k-label">Daily close</span>
          <Segmented size="xs" value={range} onChange={setRange} options={Object.keys(RANGES) as (keyof typeof RANGES)[]} />
        </div>
        {data.length > 1 ? <EquityChart data={data} height={190} color={q.change >= 0 ? "gold" : "down"} /> : <div style={{ height: 190 }} />}
      </div>

      <div>
        <div className="k-label mb-2">Contract specification</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["Digits", spec.digits],
            ["Contract size", `${formatNumber(spec.contractSize, 0)} ${spec.contractUnit}`],
            ["Min / max lot", `${spec.minLot} / ${spec.maxLot}`],
            ["Lot step", spec.lotStep],
            ["Max leverage", `1:${spec.leverage}`],
            ["Margin currency", spec.marginCurrency],
            // swap rates come from the trading engine, which isn't live yet: shown in demo builds only
            ...(!IS_DEMO ? [] : [["Swap long", <span key="sl" className={spec.swapLong < 0 ? "text-down" : "text-up"}>{spec.swapLong.toFixed(2)}</span>],
            ["Swap short", <span key="ss" className={spec.swapShort < 0 ? "text-down" : "text-up"}>{spec.swapShort.toFixed(2)}</span>],
            ["Swap type", spec.swapType],
            ["Triple swap", spec.tripleSwap]] as [string, React.ReactNode][]),
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
          Trading hours <span className="font-normal normal-case tracking-normal text-fg-3">server time GMT+3</span>
        </div>
        <div className="divide-y divide-line rounded-[14px] border border-line bg-surface-2">
          {dayOrder.map((d, i) => {
            const h = spec.hours[i]!;
            const today = d === todayIdx;
            const closed = h.sessions === "Closed";
            return (
              <div key={h.day} className={cn("flex items-center justify-between px-4 py-2 text-[12.5px]", today && "bg-ember-soft/60")}>
                <span className={cn("flex items-center gap-2", today ? "font-medium text-fg" : "text-fg-2")}>
                  {h.day}
                  {today && (
                    <Chip size="sm" tone="ember">
                      Today
                    </Chip>
                  )}
                </span>
                <span className={cn("k-num font-mono", closed ? "text-fg-3" : "text-fg")}>{h.sessions}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function InstrumentDrawer({ symbol, onClose, fav, onFav }: { symbol: string | null; onClose: () => void; fav: boolean; onFav: () => void }) {
  return (
    <Dialog
      open={!!symbol}
      onOpenChange={(o) => !o && onClose()}
      side="right"
      title="Instrument details"
      description={symbol ? `${symbol} · live quote and contract specification` : undefined}
      footer={
        symbol ? (
          <>
            <Link target="_blank" rel="noopener" href={`/trade?symbol=${symbol}&side=sell`}>
              <Button variant="down-outline">Sell</Button>
            </Link>
            <Link target="_blank" rel="noopener" href={`/trade?symbol=${symbol}&side=buy`}>
              <Button variant="up-outline">Buy</Button>
            </Link>
            <Link target="_blank" rel="noopener" href={`/trade?symbol=${symbol}`}>
              <Button variant="ember">
                <CandlestickChart /> Trade {symbol}
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
