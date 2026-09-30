// Depth of market (/depth/[symbol]): the market-data ladder of the account group's prices, labelled Indicative when
// it is built from the live bid / ask, with one-tap trading the Kalks Trader way:
// - tap a bid level → buy limit at that price; tap an ask level → sell limit at that price;
// - Sell / Buy → market order; lots in between;
// - one-tap trading on = sent at once, off = reviewed in a sheet first (the phone's setting, off by default).
// Orders take the same path as the Trade tab (placeOrder → /api/mobile/trade/orders → engine), so every server rule
// applies (restrictions, read-only, market hours, margin). The ladder redraws on the UI thread from a shared value:
// a tick never re-renders this screen or any row.
import * as React from "react";
import { Pressable, ScrollView, View, type LayoutChangeEvent } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Bell, ChevronDown, Minus, Plus } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { fmtLots } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { useOnline } from "@/lib/net";
import { useStore } from "@/lib/store";
import { feed, feedStatus, type FeedStatus } from "@/market/feed";
import { instrument } from "@/market/instruments";
import { useSession } from "@/session";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Banner, Display, EmptyState, IconButton, Illustration, Mono, PressableScale, PriceCell, Skeleton, Text, toast, useBottomInset, type SheetRef } from "@/ui";
import { alpha } from "@/theme/alpha";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { placeOrder } from "../trading/actions";
import { useAccounts } from "../trading/accounts";
import { useTrade } from "../trading/live";
import { specOf, useSpec, useSpecs } from "../trading/specs";
import { LEVELS, useDepthBook } from "./book";
import { EDGE, LADDER_H, PRICE_W, ROW_H, ROWS } from "./layout";
import { LadderLazy } from "./LadderLazy";
import { Page, StackBar, Switch, Tag } from "./components/Chrome";
import { ConfirmSheet, limitWrongSide, type ConfirmSheetHandle, type ReviewOrder } from "./components/ConfirmSheet";
import { OneTapSheet } from "./components/OneTapSheet";
import { SymbolSheet } from "./components/SymbolSheet";
import { setOneTap, useOneTap } from "./oneTap";
import { useLadderVolume } from "./volume";

const SYMBOL_RE = /^[A-Z0-9._]{2,20}$/;
const PRESSED = alpha(colors.text, 0.08);
const feedLiveOf = (s: { status: FeedStatus }) => s.status === "live";

export function DepthScreen() {
  const t = useT();
  const router = useRouter();
  const { rtl } = useLocale();
  const params = useLocalSearchParams<{ symbol: string }>();
  const symbol = String(params.symbol ?? "").toUpperCase();
  const valid = SYMBOL_RE.test(symbol);
  const inst = instrument(symbol);
  const online = useOnline();
  // the quote stream itself (the phone can be online while market-data is being reconnected)
  const feedLive = useStore(feedStatus, feedLiveOf);
  const live = useDepthBook(valid ? symbol : "");

  // trading state (the server decides; these only shape the controls)
  const viewer = useSession((s) => !!s.viewer);
  const restricted = useSession((s) => s.restricted);
  const accounts = useAccounts();
  const noAccount = !!accounts.data && accounts.data.accounts.length === 0;
  const account = useTrade((s) => s.account);
  const readOnly = useTrade((s) => s.readOnly);
  const orders = useTrade((s) => s.orders);
  // polled every minute like the Trade tab, so the market-closed state follows the trading session
  useSpecs({ live: true });
  const spec = useSpec(symbol);
  const closed = !!spec && !spec.open;
  const blocked = readOnly || restricted.includes("trading") || restricted.includes("close_only") || !!account?.controls?.tradingDisabled || !!account?.controls?.closeOnly;
  const canTrade = !viewer && !noAccount && !blocked && !closed && !!spec;

  const oneTap = useOneTap();
  const [volume, setVolume] = useLadderVolume(symbol, spec);
  const [busy, setBusy] = React.useState(false);
  const busyRef = React.useRef(false);
  const confirm = React.useRef<ConfirmSheetHandle>(null);
  const oneTapSheet = React.useRef<SheetRef>(null);
  const symbolSheet = React.useRef<SheetRef>(null);

  // the client's own pending orders on this symbol, tagged on the ladder
  const mine = useSharedValue<number[]>([]);
  React.useEffect(() => {
    const out: number[] = [];
    for (const o of orders) {
      if (o.symbol !== symbol || o.type === "stop_limit") continue;
      out.push(o.price, o.type === "limit" ? (o.side === "buy" ? 0 : 1) : o.side === "buy" ? 2 : 3, o.volume);
    }
    mine.value = out;
  }, [orders, symbol, mine]);


  /** One-tap: send now (one order at a time). Otherwise: review first. */
  const send = React.useCallback(
    async (o: Omit<ReviewOrder, "volume">) => {
      if (!canTrade) return;
      if (!oneTap) {
        confirm.current?.open({ ...o, volume });
        return;
      }
      if (busyRef.current) return;
      if (o.type === "limit") {
        const q = feed.quote(symbol);
        if (q && o.price !== undefined && limitWrongSide(o.side, o.price, q.bid, q.ask, specOf(symbol))) {
          toast.show({ title: t(o.side === "buy" ? "mobileDepth.confirm.wrongSide.buy" : "mobileDepth.confirm.wrongSide.sell"), tone: "error" });
          return;
        }
      }
      busyRef.current = true;
      setBusy(true);
      const q = feed.quote(symbol);
      // every tap is a new order (its own idempotency key, placeOrder's default)
      const r = await placeOrder(
        o.type === "limit"
          ? { symbol, side: o.side, type: "limit", volume, price: o.price }
          : { symbol, side: o.side, type: "market", volume, requestedPrice: q ? (o.side === "buy" ? q.ask : q.bid) : undefined, deviationPoints: 50 },
      );
      busyRef.current = false;
      setBusy(false);
      // the engine's reason with its hint; no answer: say it may have gone through (check before tapping again)
      if (!r.ok) toast.show({ title: r.title, body: r.body || undefined, tone: "error" }, r.uncertain ? 7000 : 4000);
    },
    [canTrade, oneTap, volume, symbol, t],
  );
  // the ladder's tap targets get one stable handler: a new volume or setting doesn't re-render the ladder
  const sendRef = React.useRef(send);
  sendRef.current = send;

  const onRow = React.useCallback(
    (r: number) => {
      const d = live.latest.current;
      if (!d) return;
      const ask = r < LEVELS;
      const k = ask ? LEVELS - 1 - r : r - LEVELS - 1;
      const lvl = ask ? d.asks[k] : d.bids[k];
      if (!lvl) return;
      haptic.select();
      void sendRef.current({ side: ask ? "sell" : "buy", type: "limit", price: lvl[0] });
    },
    [live.latest],
  );

  const pickSymbol = React.useCallback((s: string) => router.setParams({ symbol: s }), [router]);
  const onSell = React.useCallback(() => void send({ side: "sell", type: "market" }), [send]);
  const onBuy = React.useCallback(() => void send({ side: "buy", type: "market" }), [send]);
  const onOneTap = React.useCallback(
    (v: boolean) => {
      if (v) oneTapSheet.current?.present();
      else {
        setOneTap(false);
        toast.show({ title: t("mobileDepth.oneTap.off") });
      }
    },
    [t],
  );
  const onOpenAccount = React.useCallback(() => router.push("/accounts/new"), [router]);
  const tradeState = React.useMemo(() => ({ viewer, noAccount, closed, blocked, readOnly }), [viewer, noAccount, closed, blocked, readOnly]);

  const bar = (
    <StackBar
      title={t("mobileDepth.title")}
      right={valid ? <IconButton accessibilityLabel={t("mobileDepth.a11y.alerts", { symbol })} icon={<Bell size={19} color={colors.text} />} onPress={() => router.push({ pathname: "/alerts", params: { symbol } })} /> : null}
    />
  );

  // no book for the symbol only when the quote stream is up and still sends nothing for it; a stream that is down
  // or reconnecting is a connection state, not "depth unavailable". Outside the symbol's trading session that is the
  // market being closed (the founder's market-closed art), not a missing book.
  if (!valid || (live.silent && online && feedLive && !live.src)) {
    return (
      <Page bar={bar}>
        {valid && closed ? (
          <EmptyState illustration="marketClosed" title={t("mobileTrade.state.marketClosed.title")} body={t("mobileTrade.state.marketClosed.body", { symbol })} action={t("mobileTrade.pickSymbol")} onAction={() => symbolSheet.current?.present()} style={{ flex: 1, justifyContent: "center" }} />
        ) : (
          <EmptyState illustration="market" title={t("order.dom.unavailable")} body={valid ? symbol : undefined} action={t("mobileTrade.pickSymbol")} onAction={() => symbolSheet.current?.present()} style={{ flex: 1, justifyContent: "center" }} />
        )}
        <SymbolSheet ref={symbolSheet} current={symbol} onPick={pickSymbol} />
      </Page>
    );
  }
  if (!live.src && (!online || (live.silent && !feedLive))) {
    return (
      <Page bar={bar}>
        <EmptyState
          illustration="connectionLost"
          title={online ? t("mobile.state.reconnecting") : t("mobile.state.offline.title")}
          body={online ? t("mobileDepth.reconnectingBody") : t("mobile.state.offline.body")}
          style={{ flex: 1, justifyContent: "center" }}
        />
      </Page>
    );
  }

  return (
    <Page bar={bar}>
      {/* symbol + source */}
      <View style={{ paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: space[3], flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <PressableScale onPress={() => symbolSheet.current?.present()} haptics="select" accessibilityLabel={t("mobileTrade.pickSymbol")} style={{ flexShrink: 1, minHeight: 44, justifyContent: "center", alignItems: "flex-start" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Display size="lg" numberOfLines={1}>
              {symbol}
            </Display>
            <ChevronDown size={20} color={colors.text3} />
          </View>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {inst.name}
          </Text>
        </PressableScale>
        <View style={{ flex: 1 }} />
        {/* a stale ladder says so while the quote stream reconnects (the phone-offline case has the app's banner) */}
        {live.src && online && !feedLive ? (
          <Tag label={t("mobile.state.reconnecting")} tone="warn" />
        ) : live.src ? (
          <Tag label={live.src === "feed" ? t("mobileDepth.title") : t("order.dom.indicative")} tone={live.src === "feed" ? "mint" : "outline"} />
        ) : null}
      </View>

      {/* column heads: aligned with flex (start / centre / end), which follows the layout direction on every
          platform; a physical textAlign is swapped by React Native under a native right-to-left layout */}
      <View style={{ flexDirection: "row", paddingHorizontal: GUTTER, height: 26, alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <View style={{ flex: 1, alignItems: "flex-start" }}>
          <Text variant="label" tone="tertiary" numberOfLines={1} style={{ fontSize: 10 }}>
            {t("order.dom.bidVol")}
          </Text>
        </View>
        <View style={{ width: PRICE_W, alignItems: "center" }}>
          <Text variant="label" tone="tertiary" numberOfLines={1} style={{ fontSize: 10 }}>
            {t("order.dom.price")}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text variant="label" tone="tertiary" numberOfLines={1} style={{ fontSize: 10 }}>
            {t("order.dom.askVol")}
          </Text>
        </View>
      </View>

      <LadderArea symbol={symbol} digits={inst.digits} rtl={rtl} live={live} mine={mine} canTrade={canTrade} onRow={onRow} />

      <TradeBar
        symbol={symbol}
        digits={inst.digits}
        volume={volume}
        setVolume={setVolume}
        lotStep={spec?.lotStep ?? 0.01}
        canTrade={canTrade}
        state={tradeState}
        src={live.src}
        oneTap={oneTap}
        busy={busy}
        onSell={onSell}
        onBuy={onBuy}
        onOneTap={onOneTap}
        onOpenAccount={onOpenAccount}
      />

      <ConfirmSheet ref={confirm} symbol={symbol} onVolume={setVolume} />
      <OneTapSheet ref={oneTapSheet} />
      <SymbolSheet ref={symbolSheet} current={symbol} onPick={pickSymbol} />
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Ladder area                                                         */
/* ------------------------------------------------------------------ */

const LadderArea = React.memo(function LadderArea({ symbol, digits, rtl, live, mine, canTrade, onRow }: { symbol: string; digits: number; rtl: boolean; live: ReturnType<typeof useDepthBook>; mine: SharedValue<number[]>; canTrade: boolean; onRow: (r: number) => void }) {
  const t = useT();
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const scroll = React.useRef<ScrollView>(null);
  const centred = React.useRef<string | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };
  // open centred on the spread row (once per symbol)
  React.useEffect(() => {
    if (!size.h || !live.src || centred.current === symbol) return;
    centred.current = symbol;
    const y = Math.max(0, LEVELS * ROW_H + ROW_H / 2 - size.h / 2);
    requestAnimationFrame(() => scroll.current?.scrollTo({ y, animated: false }));
  }, [size.h, live.src, symbol]);
  const fallback = <LadderSkeleton />;
  return (
    <View style={{ flex: 1 }} onLayout={onLayout} accessibilityLabel={t("mobileDepth.a11y.ladder", { symbol })}>
      {size.w > 0 && live.src ? (
        <ScrollView ref={scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ height: LADDER_H }} testID="depth-ladder">
          <LadderLazy width={size.w} book={live.book} mine={mine} digits={digits} rtl={rtl} fallback={fallback} />
          <SpreadWords width={size.w} />
          <LadderTouch onRow={onRow} disabled={!canTrade} />
        </ScrollView>
      ) : (
        fallback
      )}
    </View>
  );
});

/** The words of the spread row, over the canvas (its numbers are drawn in Skia beside them). Static. Laid out as a
 *  row [start column | price column | end column] so they land on the side the canvas mirrors to in right-to-left
 *  languages: a flex row flips with the layout direction on phones and on the web alike, whereas a physical left /
 *  right is swapped by React Native under a native right-to-left layout (I18nManager) and a logical start / end is
 *  not resolved by the web preview. "Spread" sits at the outer edge of the start column (its points are drawn at the
 *  inner edge), "Mid" next to the price column on the end side. */
const SpreadWords = React.memo(function SpreadWords({ width }: { width: number }) {
  const t = useT();
  const side = width / 2 - PRICE_W / 2;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: LEVELS * ROW_H, left: 0, right: 0, height: ROW_H, flexDirection: "row", alignItems: "center" }} importantForAccessibility="no-hide-descendants">
      <View style={{ width: side, flexDirection: "row", paddingHorizontal: EDGE }}>
        <Text variant="label" tone="tertiary" numberOfLines={1} style={{ maxWidth: side - 64, fontSize: 10 }}>
          {t("order.dom.spread")}
        </Text>
      </View>
      <View style={{ width: PRICE_W }} />
      <View style={{ width: side, flexDirection: "row", paddingHorizontal: 10 }}>
        <Text variant="label" tone="tertiary" numberOfLines={1} style={{ maxWidth: side - 20, fontSize: 10 }}>
          {t("mobileDepth.mid")}
        </Text>
      </View>
    </View>
  );
});

/** Static tap targets over the ladder rows (44 pt each); they never re-render on a tick. */
const LadderTouch = React.memo(function LadderTouch({ onRow, disabled }: { onRow: (r: number) => void; disabled: boolean }) {
  const t = useT();
  return (
    <View style={{ position: "absolute", top: 0, start: 0, end: 0, height: LADDER_H }}>
      {Array.from({ length: ROWS }, (_, r) =>
        r === LEVELS ? (
          <View key={r} style={{ height: ROW_H }} />
        ) : (
          <Pressable
            key={r}
            disabled={disabled}
            onPress={() => onRow(r)}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            accessibilityLabel={r < LEVELS ? t("mobileDepth.a11y.askLevel", { n: LEVELS - r }) : t("mobileDepth.a11y.bidLevel", { n: r - LEVELS })}
            testID={`depth-row-${r}`}
            style={({ pressed }) => ({ height: ROW_H, backgroundColor: pressed ? PRESSED : "transparent" })}
          />
        ),
      )}
    </View>
  );
});

/** Shaped like the ladder: bars on both sides of a price column (static). */
function LadderSkeleton() {
  const t = useT();
  return (
    <View style={{ flex: 1, overflow: "hidden" }} accessible accessibilityLabel={t("mobileDepth.loading")}>
      {Array.from({ length: 11 }, (_, i) => (
        <View key={i} style={{ height: ROW_H, flexDirection: "row", alignItems: "center", paddingHorizontal: GUTTER, gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <View style={{ flex: 1, alignItems: "flex-end" }}>{i > 5 ? <Skeleton w={`${30 + ((i * 17) % 50)}%`} h={20} r={4} /> : null}</View>
          <Skeleton w={86} h={16} r={4} />
          <View style={{ flex: 1 }}>{i < 5 ? <Skeleton w={`${30 + ((i * 23) % 50)}%`} h={20} r={4} /> : null}</View>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Sell / lots / Buy, one-tap                                          */
/* ------------------------------------------------------------------ */

type TradeState = { viewer: boolean; noAccount: boolean; closed: boolean; blocked: boolean; readOnly: boolean };

const TradeBar = React.memo(function TradeBar(p: {
  symbol: string;
  digits: number;
  volume: number;
  setVolume: (v: number) => void;
  lotStep: number;
  canTrade: boolean;
  state: TradeState;
  src: string | null;
  oneTap: boolean;
  busy: boolean;
  onSell: () => void;
  onBuy: () => void;
  onOneTap: (v: boolean) => void;
  onOpenAccount: () => void;
}) {
  const t = useT();
  // a stack screen without the tab bar: the bar clears the home indicator itself
  const bottom = useBottomInset(false);
  const { viewer, noAccount, closed, blocked, readOnly } = p.state;
  const notice = viewer ? (
    <Banner tone="info" title={t("mobile.viewOnly")} body={t("mobile.viewOnlyBody")} />
  ) : noAccount ? (
    <EmptyState title={t("mobileTrade.state.noAccount.title")} body={t("mobileTrade.state.noAccount.body")} action={t("mobileTrade.state.noAccount.action")} onAction={p.onOpenAccount} style={{ paddingVertical: space[2] }} />
  ) : readOnly ? (
    <Banner tone="info" title={t("order.ticket.readOnlyTitle")} body={t("mobileTrade.state.readOnly")} />
  ) : blocked ? (
    <RestrictionBanner kinds={["trading", "close_only"]} />
  ) : closed ? (
    // the founder's market-closed art as a small thumbnail: the ladder keeps the screen (MT5-dense), no hero here
    <Banner tone="info" icon={<Illustration name="marketClosed" width={56} height={42} />} title={t("mobileTrade.state.marketClosed.title")} body={t("mobileTrade.state.marketClosed.body", { symbol: p.symbol })} />
  ) : null;
  const trading = !viewer && !noAccount;
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[3], paddingBottom: bottom, gap: space[3], borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg }}>
      {p.src ? (
        <Text variant="caption" tone="tertiary" numberOfLines={2}>
          {t(p.src === "feed" ? "mobileDepth.src.feedBody" : "mobileDepth.src.indicativeBody")}
        </Text>
      ) : null}
      {notice}
      {trading ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "stretch", gap: space[2] }}>
            <MarketButton side="sell" symbol={p.symbol} digits={p.digits} disabled={!p.canTrade} onPress={p.onSell} />
            <View style={{ width: 96, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "space-between", paddingVertical: 6 }}>
              <Text variant="label" tone="tertiary" style={{ fontSize: 9.5 }}>
                {t("mobileTrade.bar.volume")}
              </Text>
              <Mono size={15} weight="bold" testID="depth-lots">
                {fmtLots(p.volume)}
              </Mono>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <PressableScale onPress={() => p.setVolume(p.volume - p.lotStep)} haptics="select" accessibilityLabel={`${t("mobileTrade.bar.volume")} −`} hitSlop={8} style={{ width: 38, height: 28, borderRadius: 8, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" }}>
                  <Minus size={14} color={colors.text} />
                </PressableScale>
                <PressableScale onPress={() => p.setVolume(p.volume + p.lotStep)} haptics="select" accessibilityLabel={`${t("mobileTrade.bar.volume")} +`} hitSlop={8} style={{ width: 38, height: 28, borderRadius: 8, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" }}>
                  <Plus size={14} color={colors.text} />
                </PressableScale>
              </View>
            </View>
            <MarketButton side="buy" symbol={p.symbol} digits={p.digits} disabled={!p.canTrade} onPress={p.onBuy} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="callout" weight="700">
                {t("mobileDepth.oneTap")}
              </Text>
              <Text variant="caption" tone={p.busy ? "ember" : "tertiary"} numberOfLines={2}>
                {p.busy ? t("mobileDepth.busy") : p.oneTap ? t("mobileDepth.oneTap.onHint") : t("mobileDepth.oneTap.offHint")}
              </Text>
            </View>
            <Switch value={p.oneTap} onChange={p.onOneTap} label={t("mobileDepth.oneTap")} disabled={viewer} />
          </View>
        </>
      ) : null}
    </View>
  );
});

const MarketButton = React.memo(function MarketButton({ side, symbol, digits, disabled, onPress }: { side: "buy" | "sell"; symbol: string; digits: number; disabled: boolean; onPress: () => void }) {
  const t = useT();
  const buy = side === "buy";
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={`${t(buy ? "common.buy" : "common.sell")} ${t("mobileDepth.market")}`}
      testID={buy ? "depth-buy" : "depth-sell"}
      style={{ flex: 1, height: 68, borderRadius: radius.lg, backgroundColor: buy ? colors.up : colors.down, paddingHorizontal: space[3], justifyContent: "center", alignItems: buy ? "flex-end" : "flex-start" }}
    >
      {/* ink on both fills (light text on the palette's red is under 4.5:1), and no tick flash: a green / red flash
          on a green / red button reads as a glitch (the Trade tab's Sell / Buy bar does the same) */}
      <Text variant="label" color={colors.ink}>
        {t(buy ? "common.buy" : "common.sell")}
      </Text>
      <PriceCell symbol={symbol} side={buy ? "ask" : "bid"} digits={digits} size={18} align={buy ? "right" : "left"} flash={false} color={colors.ink} style={{ paddingHorizontal: 0 }} />
    </PressableScale>
  );
});

