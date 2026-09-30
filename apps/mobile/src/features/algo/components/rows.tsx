// The list rows of the Algo screens. Fixed heights (the lists are told), memoised, primitive / stable props only,
// press feedback at once and a prefetch on press-in so the next screen opens on data.
import * as React from "react";
import { View } from "react-native";
import { useFormat, useT } from "@/i18n";
import { fmtPrice } from "@/lib/format";
import { instrument } from "@/market/instruments";
import { Mono, PressableScale, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import type { BacktestRow as Bt, Deployment, DeploymentLog, DeploymentPosition, Listing, MarketSubscription, StrategyItem, Trade } from "../api";
import { BT_TONE, DEP_TONE, btLabel, depLabel, exitLabel, held, kindLabel, moneyTone, pct, range, rangeShort, realizedOf, tradesOf, usd, verifiedLine, type Tone } from "../format";
import { HouseBadge, ProgressBar, Stars, SymbolTile, Tag } from "./bits";
import { ForwardIcon } from "./chrome";

export const ROW = { deployment: 84, strategy: 84, backtest: 84, listing: 206, subscription: 84, trade: 72, position: 72 } as const;

const rowStyle = (height: number) =>
  ({ height, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER, borderBottomWidth: 1, borderBottomColor: colors.line }) as const;

/* ------------------------------------------------------------------ */
/* Deployments                                                         */
/* ------------------------------------------------------------------ */

export const DeploymentRow = React.memo(function DeploymentRow({ d, onOpen, onPressIn }: { d: Deployment; onOpen: (id: number) => void; onPressIn: (id: number) => void }) {
  const t = useT();
  const pnl = realizedOf(d);
  const status = depLabel(t, d.status);
  return (
    <PressableScale
      testID={`dep-row-${d.id}`}
      onPress={() => onOpen(d.id)}
      onPressIn={() => onPressIn(d.id)}
      scaleTo={0.985}
      accessibilityLabel={[d.strategyName, status, `${d.symbol} ${d.timeframe}`, `${kindLabel(t, d.accountType)} ${d.login}`, `${t("mobileAlgo.dep.realized")} ${usd(pnl, true)}`, t("mobileAlgo.nTrades", { count: tradesOf(d) })].join(", ")}
      style={rowStyle(ROW.deployment)}
    >
      <SymbolTile symbol={d.symbol} />
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Text variant="headline" weight="700" numberOfLines={1}>
          {d.strategyName}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {`${d.symbol} ${d.timeframe} · ${kindLabel(t, d.accountType)} ${d.login}`}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 5 }}>
        <Mono size={16} weight="bold" tone={moneyTone(pnl)}>
          {usd(pnl, true)}
        </Mono>
        <Tag compact label={status} tone={DEP_TONE[d.status] ?? "neutral"} dot={d.status === "running"} />
      </View>
    </PressableScale>
  );
});

/* ------------------------------------------------------------------ */
/* Strategies                                                          */
/* ------------------------------------------------------------------ */

export const StrategyRow = React.memo(function StrategyRow({ s, onOpen, onPressIn }: { s: StrategyItem; onOpen: (id: number) => void; onPressIn: (id: number) => void }) {
  const t = useT();
  const bt = s.lastBacktest;
  return (
    <PressableScale
      testID={`strategy-row-${s.id}`}
      onPress={() => onOpen(s.id)}
      onPressIn={() => onPressIn(s.id)}
      scaleTo={0.985}
      accessibilityLabel={[s.name, `${s.symbol} ${s.timeframe}`, `v${s.version}`, s.running ? t("mobileAlgo.strat.runningN", { count: s.running }) : "", !s.valid ? t("mobileAlgo.strat.draft") : "", bt ? `${t("mobileAlgo.strat.lastBacktest")} ${pct(bt.returnPct)}` : ""]
        .filter(Boolean)
        .join(", ")}
      style={rowStyle(ROW.strategy)}
    >
      <SymbolTile symbol={s.symbol} />
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Text variant="headline" weight="700" numberOfLines={1}>
          {s.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], minWidth: 0 }}>
          {s.running > 0 ? <Tag compact tone="ember" dot label={t("mobileAlgo.strat.runningN", { count: s.running })} /> : !s.valid ? <Tag compact tone="warn" label={t("mobileAlgo.strat.draft")} /> : null}
          <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {`${s.symbol} ${s.timeframe} · v${s.version}${s.kind === "code" ? ` · ${t("mobileAlgo.kind.code")}` : ""}`}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        {bt ? (
          <>
            <Mono size={16} weight="bold" tone={moneyTone(bt.returnPct)}>
              {pct(bt.returnPct, 1)}
            </Mono>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {t("mobileAlgo.strat.backtested")}
            </Text>
          </>
        ) : (
          <ForwardIcon />
        )}
      </View>
    </PressableScale>
  );
});

/* ------------------------------------------------------------------ */
/* Backtests                                                           */
/* ------------------------------------------------------------------ */

export const BacktestRow = React.memo(function BacktestRow({ b, onOpen, onPressIn, name, version }: { b: Bt; onOpen: (id: number) => void; onPressIn: (id: number) => void; name?: string; version?: number }) {
  const t = useT();
  const f = useFormat();
  const active = b.status === "queued" || b.status === "running";
  const s = b.summary;
  const title = name ?? b.strategyName ?? `#${b.id}`;
  return (
    <PressableScale
      testID={`bt-row-${b.id}`}
      onPress={() => onOpen(b.id)}
      onPressIn={() => onPressIn(b.id)}
      scaleTo={0.985}
      accessibilityLabel={[title, btLabel(t, b.status), `${b.params.symbol} ${b.params.timeframe}`, range(f, b.params.from, b.params.to), s ? pct(s.returnPct) : ""].filter(Boolean).join(", ")}
      style={rowStyle(ROW.backtest)}
    >
      <SymbolTile symbol={b.params.symbol} />
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Text variant="headline" weight="700" numberOfLines={1}>
          {(version ?? b.version) ? `${title} · v${version ?? b.version}` : title}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {`${b.params.symbol} ${b.params.timeframe} · ${rangeShort(f, b.params.from, b.params.to)}`}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 5, minWidth: 72 }}>
        {active ? (
          <>
            <Mono size={13} weight="bold" tone="ember">
              {b.status === "queued" ? btLabel(t, b.status) : `${Math.round(b.progress * 100)}%`}
            </Mono>
            <View style={{ width: 72 }}>
              <ProgressBar value={b.status === "queued" ? 0.02 : b.progress} height={4} />
            </View>
          </>
        ) : b.status === "done" && s ? (
          <>
            <Mono size={16} weight="bold" tone={moneyTone(s.returnPct)}>
              {pct(s.returnPct, 1)}
            </Mono>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {t("mobileAlgo.nTrades", { count: s.trades })}
            </Text>
          </>
        ) : (
          <Tag compact label={btLabel(t, b.status)} tone={BT_TONE[b.status] ?? "neutral"} />
        )}
      </View>
    </PressableScale>
  );
});

/* ------------------------------------------------------------------ */
/* Marketplace                                                         */
/* ------------------------------------------------------------------ */

export const ListingRow = React.memo(function ListingRow({ l, subscribed, onOpen, onPressIn }: { l: Listing; subscribed: boolean; onOpen: (id: number) => void; onPressIn: (id: number) => void }) {
  const t = useT();
  const r = l.track.returnPct;
  const price = l.priceMonthly > 0 ? t("mobileAlgo.market.perMonth", { price: l.priceMonthly }) : t("mobileAlgo.market.free");
  return (
    <View style={{ height: ROW.listing, paddingHorizontal: GUTTER, paddingBottom: space[3] }}>
      <PressableScale
        testID={`listing-row-${l.id}`}
        onPress={() => onOpen(l.id)}
        onPressIn={() => onPressIn(l.id)}
        scaleTo={0.985}
        accessibilityLabel={[
          l.title,
          t("mobileAlgo.market.by", { author: l.author }),
          l.house ? t("mobileAlgo.house.badge") : "",
          `${l.symbol} ${l.timeframe}`,
          price,
          `${t("mobileAlgo.market.return")} ${pct(r)}`,
          subscribed ? t("mobileAlgo.market.subscribed") : "",
        ]
          .filter(Boolean)
          .join(", ")}
        style={{ flex: 1, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: space[4], gap: space[3] }}
      >
        <View style={{ flexDirection: "row", gap: space[3], alignItems: "center" }}>
          <SymbolTile symbol={l.symbol} size={40} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text variant="headline" weight="700" numberOfLines={1}>
              {l.title}
            </Text>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {`${t("mobileAlgo.market.by", { author: l.author })} · ${l.symbol} ${l.timeframe}`}
            </Text>
          </View>
          <Tag compact label={price} tone={l.priceMonthly > 0 ? "gold" : "cream"} />
        </View>
        <View style={{ height: 24, flexDirection: "row", alignItems: "center", gap: space[2], overflow: "hidden" }}>
          {l.house ? <HouseBadge compact /> : <Tag compact tone="neutral" label={t("mobileAlgo.market.verified", { type: kindLabel(t, l.track.accountType) })} />}
          {subscribed ? <Tag compact tone="ember" dot label={t("mobileAlgo.market.subscribed")} /> : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[4] }}>
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <Mono size={26} weight="bold" tone={moneyTone(r)} numberOfLines={1}>
              {pct(r, 2)}
            </Mono>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {verifiedLine(t, l.track.accountType, l.track.days)}
            </Text>
          </View>
          <View style={{ gap: 2 }}>
            <Mini label={t("mobileAlgo.market.winRate")} value={pct(l.track.winRate, 1, false)} />
            <Mini label={t("mobileAlgo.market.maxDd")} value={pct(l.track.maxDrawdownPct, 1, false)} />
            <Mini label={t("mobileAlgo.market.trades")} value={String(l.track.trades)} />
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Stars value={l.rating} />
          <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>
            {`${t("mobileAlgo.market.ratings", { count: l.ratings })} · ${t("mobileAlgo.market.subscribers", { count: l.subscribers })}`}
          </Text>
        </View>
      </PressableScale>
    </View>
  );
});

// one line of the track's small statistics: label at the start, value at the end (a dense three-line table)
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3] }}>
      <Text variant="label" tone="tertiary" style={{ fontSize: 9.5, letterSpacing: 0.6 }} numberOfLines={1}>
        {label}
      </Text>
      <Mono size={12.5} weight="bold" style={{ minWidth: 44, textAlign: "right" }}>
        {value}
      </Mono>
    </View>
  );
}

const SUB_TONE: Record<string, Tone> = { active: "ember", past_due: "warn", cancelled: "neutral", expired: "neutral" };

export const SubscriptionRow = React.memo(function SubscriptionRow({ s, onOpen, onPressIn }: { s: MarketSubscription; onOpen: (listingId: number) => void; onPressIn: (listingId: number) => void }) {
  const t = useT();
  const f = useFormat();
  const mode = s.mode === "copy" ? t("mobileAlgo.sub.copyOn", { login: s.login ?? "—" }) : t("mobileAlgo.sub.cloned");
  const price = s.price > 0 ? t("mobileAlgo.market.perMonth", { price: s.price }) : t("mobileAlgo.market.free");
  const renew = s.periodEnd ? (s.autoRenew ? t("mobileAlgo.sub.renews", { date: f.date(s.periodEnd) }) : t("mobileAlgo.sub.ends", { date: f.date(s.periodEnd) })) : null;
  return (
    <PressableScale
      testID={`sub-row-${s.id}`}
      onPress={() => onOpen(s.listingId)}
      onPressIn={() => onPressIn(s.listingId)}
      scaleTo={0.985}
      accessibilityLabel={[s.title, mode, t.dyn(`mobileAlgo.sub.status.${s.status}`, s.status), price, renew ?? ""].filter(Boolean).join(", ")}
      style={rowStyle(ROW.subscription)}
    >
      <SymbolTile symbol={s.symbol} />
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Text variant="headline" weight="700" numberOfLines={1}>
          {s.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], minWidth: 0 }}>
          <Tag compact label={t.dyn(`mobileAlgo.sub.status.${s.status}`, s.status)} tone={SUB_TONE[s.status] ?? "neutral"} dot={s.status === "active"} />
          <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {`${mode} · ${s.symbol} ${s.timeframe}`}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4, maxWidth: 120 }}>
        <Mono size={13} weight="bold" numberOfLines={1}>
          {price}
        </Mono>
        {renew ? (
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {renew}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
});

/* ------------------------------------------------------------------ */
/* Trades (backtest) and positions (deployment)                        */
/* ------------------------------------------------------------------ */

export const TradeRow = React.memo(function TradeRow({ x, digits }: { x: Trade; digits: number }) {
  const t = useT();
  const f = useFormat();
  const buy = x.side === "buy";
  const open = f.dateTime(x.openTime * 1000, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const dur = held(t, x.closeTime - x.openTime);
  return (
    <View
      accessible
      accessibilityLabel={[`#${x.id}`, buy ? t("common.buy") : t("common.sell"), `${x.volume} ${t("mobileAlgo.lot")}`, open, dur, exitLabel(t, x.reason), usd(x.net, true)].join(", ")}
      style={rowStyle(ROW.trade)}
    >
      <View style={{ width: 56, gap: 4, alignItems: "flex-start" }}>
        <Tag compact label={(buy ? t("common.buy") : t("common.sell")).toUpperCase()} tone={buy ? "up" : "down"} />
        <Mono size={11} tone="tertiary">
          {x.volume.toFixed(2)}
        </Mono>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Mono size={13} weight="medium" numberOfLines={1}>
          {`${fmtPrice(x.openPrice, digits)} → ${fmtPrice(x.closePrice, digits)}`}
        </Mono>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {`${open} · ${dur}`}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Mono size={15} weight="bold" tone={moneyTone(x.net)}>
          {usd(x.net, true)}
        </Mono>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {exitLabel(t, x.reason)}
        </Text>
      </View>
    </View>
  );
});

export const PositionRow = React.memo(function PositionRow({ p }: { p: DeploymentPosition }) {
  const t = useT();
  const f = useFormat();
  const digits = instrument(p.symbol).digits;
  const buy = p.side === "buy";
  const open = !p.closedAt;
  const when = f.dateTime(p.closedAt ?? p.openedAt);
  return (
    <View
      accessible
      accessibilityLabel={[`#${p.ticket}`, buy ? t("common.buy") : t("common.sell"), `${p.volume}`, open ? t("mobileAlgo.dep.openNow") : exitLabel(t, p.reason), p.profit !== null ? usd(p.profit, true) : ""].join(", ")}
      style={rowStyle(ROW.position)}
    >
      <View style={{ width: 56, gap: 4, alignItems: "flex-start" }}>
        <Tag compact label={(buy ? t("common.buy") : t("common.sell")).toUpperCase()} tone={buy ? "up" : "down"} />
        <Mono size={11} tone="tertiary">
          {p.volume.toFixed(2)}
        </Mono>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Mono size={13} weight="medium" numberOfLines={1}>
          {p.closePrice !== null && !open ? `${fmtPrice(p.openPrice, digits)} → ${fmtPrice(p.closePrice, digits)}` : fmtPrice(p.openPrice, digits)}
        </Mono>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {`#${p.ticket} · ${when}`}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        {open ? (
          <Tag compact tone="ember" dot label={t("mobileAlgo.dep.openNow")} />
        ) : (
          <>
            <Mono size={15} weight="bold" tone={moneyTone(p.profit)}>
              {p.profit === null ? "—" : usd(p.profit, true)}
            </Mono>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {exitLabel(t, p.reason)}
            </Text>
          </>
        )}
      </View>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* Runtime log                                                         */
/* ------------------------------------------------------------------ */

const KIND_TONE: Record<string, Tone> = { order: "ember", close: "gold", signal: "sand", eval: "neutral", manage: "info", error: "warn", info: "neutral" };

export const LogRow = React.memo(function LogRow({ l }: { l: DeploymentLog }) {
  const t = useT();
  const f = useFormat();
  const error = l.level === "error" || l.kind === "error";
  const warn = l.level === "warn";
  return (
    <View accessible accessibilityLabel={`${f.time(l.at, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}, ${t.dyn(`mobileAlgo.log.${l.kind}`, l.kind)}, ${l.message}`} style={{ flexDirection: "row", gap: space[3], paddingHorizontal: GUTTER, paddingVertical: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <View style={{ width: 70, gap: 5 }}>
        <Mono size={12} tone="tertiary">
          {f.time(l.at, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
        </Mono>
        <Tag compact tone={error ? "warn" : KIND_TONE[l.kind] ?? "neutral"} label={t.dyn(`mobileAlgo.log.${l.kind}`, l.kind)} style={{ alignSelf: "flex-start" }} />
      </View>
      <Text variant="caption" color={error || warn ? colors.warn : colors.text2} style={{ flex: 1, lineHeight: 18 }} selectable>
        {l.message}
      </Text>
    </View>
  );
});
