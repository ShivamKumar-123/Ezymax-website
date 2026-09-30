// Analytics › P&L calendar: one month per page (a native paging list, so a swipe follows the finger), each day tinted
// by its net result of closed trades (money colours, stronger with the size of the day). Tap a day for its figures.
// Days come from the service's byDay (server days); an older service without it falls back to the daily balance
// change with deposits and withdrawals removed.
import * as React from "react";
import { FlatList, Pressable, useWindowDimensions, View, type ListRenderItem, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useFormat, useLocale, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { Card, Mono, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { addMonths, cmpYm, monthUtc, monthWeeks, ymKey, ymOf, type Ym } from "../../calendar";
import { compactUsd, DAY_KEYS, usd } from "../../format";
import { tint as alpha } from "../../tint";
import type { Analytics } from "../../types";
import { Flip, SectionTitle } from "../Chrome";
import { StepButton } from "../DateSheet";

type Day = { net: number; trades: number; wins: number };

const PAD = space[3];
const CELL_H = 50;
const GAP = 4;

function dailyNet(d: Analytics): { map: Map<string, Day>; estimated: boolean } {
  if (d.byDay) return { map: new Map(d.byDay.map((g) => [g.key, { net: g.net, trades: g.trades, wins: g.wins }])), estimated: false };
  const map = new Map<string, Day>();
  const pts = d.curve.points;
  for (let i = 1; i < pts.length; i++) {
    const v = Math.round((pts[i]!.balance - pts[i]!.flow - pts[i - 1]!.balance) * 100) / 100;
    if (Math.abs(v) >= 0.01) map.set(pts[i]!.day, { net: v, trades: 0, wins: 0 });
  }
  return { map, estimated: true };
}

/** Money colours, stronger with the size of the day against the month's largest. */
const tint = (net: number, max: number) => alpha(net > 0 ? colors.up : colors.down, 0.16 + 0.56 * Math.min(1, Math.abs(net) / Math.max(max, 0.01)));

export const PnlCalendar = React.memo(function PnlCalendar({ d, from, today }: { d: Analytics; from: string; today: string }) {
  const t = useT();
  const fmt = useFormat();
  const { rtl } = useLocale();
  const { width } = useWindowDimensions();
  const pageW = width - GUTTER * 2 - PAD * 2;
  const { map, estimated } = React.useMemo(() => dailyNet(d), [d]);

  // months from the first activity in the period (or the period start) to this month
  const months = React.useMemo(() => {
    const keys = [...map.keys()].sort();
    const firstPoint = d.curve.points[0]?.day;
    const startDay = [keys[0], firstPoint].filter((x): x is string => !!x).sort()[0] ?? today;
    let a = ymOf(startDay < from ? from : startDay);
    const b = ymOf(today);
    if (cmpYm(a, b) > 0) a = b;
    const out: Ym[] = [];
    for (let m = a; cmpYm(m, b) <= 0 && out.length < 132; m = addMonths(m, 1)) out.push(m);
    return out;
  }, [map, d.curve.points, from, today]);

  // as tall as the longest month on offer (4 to 6 weeks), so paging never changes the card's height
  const gridH = React.useMemo(() => months.reduce((m, ym) => Math.max(m, monthWeeks(ym).length), 4) * (CELL_H + GAP), [months]);

  const lastActive = React.useMemo(() => {
    const keys = [...map.keys()].sort();
    const k = keys[keys.length - 1];
    if (!k) return months.length - 1;
    const i = months.findIndex((m) => ymKey(m) === k.slice(0, 7));
    return i < 0 ? months.length - 1 : i;
  }, [map, months]);

  const [index, setIndex] = React.useState(lastActive);
  const [sel, setSel] = React.useState<string | null>(null);
  const list = React.useRef<FlatList<Ym>>(null);
  // a new answer (period / account) opens on its latest trading month
  React.useEffect(() => {
    setIndex(lastActive);
    setSel(null);
    const id = requestAnimationFrame(() => {
      if (lastActive >= 0 && lastActive < months.length) list.current?.scrollToIndex({ index: lastActive, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [lastActive, months.length]);

  const cur = months[Math.min(index, months.length - 1)] ?? ymOf(today);
  const summary = React.useMemo(() => {
    const key = ymKey(cur);
    let net = 0;
    let days = 0;
    let green = 0;
    let red = 0;
    for (const [k, v] of map) {
      if (!k.startsWith(key)) continue;
      net += v.net;
      days += 1;
      if (v.net > 0) green += 1;
      else if (v.net < 0) red += 1;
    }
    return { net, days, green, red };
  }, [map, cur]);

  const go = (i: number) => {
    const n = Math.max(0, Math.min(months.length - 1, i));
    if (n === index) return;
    setIndex(n);
    list.current?.scrollToIndex({ index: n, animated: true });
  };
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / pageW);
    if (i !== index && i >= 0 && i < months.length) {
      haptic.select();
      setIndex(i);
    }
  };
  const onDay = React.useCallback((day: string) => {
    haptic.select();
    setSel((s) => (s === day ? null : day));
  }, []);

  const renderItem = React.useCallback<ListRenderItem<Ym>>(({ item }) => <MonthGrid ym={item} map={map} from={from} today={today} width={pageW} selected={sel} onDay={onDay} rtl={rtl} />, [map, from, today, pageW, sel, onDay, rtl]);
  const selDay = sel ? map.get(sel) : undefined;
  const dateLabel = (day: string) => fmt.date(`${day}T00:00:00Z`, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <SectionTitle title={t("mobileReports.an.cal.title")} subtitle={estimated ? t("mobileReports.an.cal.subtitleEstimated") : t("mobileReports.an.cal.subtitle")} />
      <Card padded={false} style={{ padding: PAD }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[1], marginBottom: space[3] }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="headline" accessibilityRole="header" accessibilityLiveRegion="polite">
              {fmt.date(monthUtc(cur), { month: "long", year: "numeric", timeZone: "UTC" })}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2], flexWrap: "wrap" }}>
              <Mono size={15} weight="bold" tone={summary.net > 0 ? "up" : summary.net < 0 ? "down" : "tertiary"}>
                {usd(summary.net, true)}
              </Mono>
              <Text variant="caption" tone="tertiary">
                {[t("mobileReports.an.cal.days", { count: summary.days }), summary.green ? t("mobileReports.an.cal.green", { count: summary.green }) : null, summary.red ? t("mobileReports.an.cal.red", { count: summary.red }) : null].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </View>
          <StepButton
            label={t("mobileReports.st.prevMonth")}
            disabled={index <= 0}
            onPress={() => go(index - 1)}
            icon={
              <Flip>
                <ChevronLeft size={20} color={colors.text} />
              </Flip>
            }
          />
          <StepButton
            label={t("mobileReports.st.nextMonth")}
            disabled={index >= months.length - 1}
            onPress={() => go(index + 1)}
            icon={
              <Flip>
                <ChevronRight size={20} color={colors.text} />
              </Flip>
            }
          />
        </View>
        <View style={{ flexDirection: "row", marginBottom: space[2] }}>
          {DAY_KEYS.map((k) => (
            <Text key={k} variant="label" tone="tertiary" align="center" style={{ flex: 1, fontSize: 9.5 }}>
              {t(k)}
            </Text>
          ))}
        </View>
        <FlatList
          ref={list}
          data={months}
          horizontal
          pagingEnabled
          renderItem={renderItem}
          keyExtractor={ymKey}
          extraData={sel}
          initialScrollIndex={lastActive}
          getItemLayout={(_, i) => ({ length: pageW, offset: pageW * i, index: i })}
          onMomentumScrollEnd={onEnd}
          showsHorizontalScrollIndicator={false}
          initialNumToRender={1}
          windowSize={3}
          maxToRenderPerBatch={2}
          style={{ width: pageW, height: gridH, direction: "ltr" }}
        />
        <View style={{ minHeight: 40, justifyContent: "center", paddingHorizontal: space[1], borderTopWidth: 1, borderTopColor: colors.line, marginTop: space[1] }} accessibilityLiveRegion="polite">
          {sel ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
              <Text variant="callout" style={{ flex: 1 }} numberOfLines={1}>
                {dateLabel(sel)}
                {selDay && !estimated ? <Text variant="callout" tone="tertiary">{` · ${t("portfolio.trades", { count: selDay.trades })}`}</Text> : null}
              </Text>
              <Mono size={15} weight="bold" tone={!selDay ? "tertiary" : selDay.net > 0 ? "up" : selDay.net < 0 ? "down" : "tertiary"}>
                {selDay ? usd(selDay.net, true) : t("mobileReports.an.cal.noTrades")}
              </Mono>
            </View>
          ) : (
            <Text variant="caption" tone="tertiary">
              {t("mobileReports.an.cal.select")}
            </Text>
          )}
        </View>
      </Card>
    </View>
  );
});

type GridProps = { ym: Ym; map: Map<string, Day>; from: string; today: string; width: number; selected: string | null; onDay: (d: string) => void; rtl: boolean };

const MonthGrid = React.memo(function MonthGrid({ ym, map, from, today, width, selected, onDay, rtl }: GridProps) {
  const t = useT();
  const fmt = useFormat();
  const weeks = React.useMemo(() => monthWeeks(ym), [ym]);
  const max = React.useMemo(() => {
    let m = 0;
    const key = ymKey(ym);
    for (const [k, v] of map) if (k.startsWith(key)) m = Math.max(m, Math.abs(v.net));
    return m;
  }, [map, ym]);
  const cellW = (width - GAP * 6) / 7;
  return (
    <View style={{ width, gap: GAP, direction: rtl ? "rtl" : "ltr" }}>
      {weeks.map((row, w) => (
        <View key={w} style={{ flexDirection: "row", gap: GAP }}>
          {row.map((day, c) => {
            if (!day) return <View key={c} style={{ width: cellW, height: CELL_H }} />;
            const v = map.get(day);
            const out = day > today || day < from;
            const on = selected === day;
            const date = fmt.date(`${day}T00:00:00Z`, { day: "numeric", month: "long", timeZone: "UTC" });
            const label = v ? t("mobileReports.an.cal.a11yDay", { date, net: usd(v.net, true), trades: t("portfolio.trades", { count: v.trades }) }) : `${date}: ${t("mobileReports.an.cal.noTrades")}`;
            return (
              <Pressable
                key={day}
                disabled={out}
                onPress={() => onDay(day)}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: out }}
                accessibilityLabel={label}
                style={({ pressed }) => ({
                  width: cellW,
                  height: CELL_H,
                  borderRadius: radius.xs + 2,
                  padding: 5,
                  justifyContent: "space-between",
                  backgroundColor: v && v.net !== 0 ? tint(v.net, max) : out ? "transparent" : colors.surface2,
                  borderWidth: on ? 1.5 : 0,
                  borderColor: colors.cream,
                  opacity: out ? 0.35 : pressed ? 0.7 : 1,
                })}
              >
                <Text variant="caption" weight={day === today ? "800" : "500"} color={v ? colors.text : colors.text3} style={{ fontSize: 11, lineHeight: 13 }}>
                  {String(Number(day.slice(8)))}
                </Text>
                {v ? (
                  <Mono size={9} weight="medium" color={colors.text} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {compactUsd(v.net)}
                  </Mono>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});
