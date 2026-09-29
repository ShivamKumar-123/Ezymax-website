// /calendar — the economic calendar (MT5-dense): the week grouped by day under sticky headings, in the phone's time
// zone by default with the server time noted (or in server time), impact and currency filters, actual / forecast /
// previous on every row, and a reminder bell (the service notifies before the release). A fixed day strip jumps
// between days and follows the scroll; the next high-impact release counts down above the list. Opens at "now" for
// this week. /calendar?currency=USD starts filtered (links from stories); /calendar?event=ID opens that event.
//
// Performance: rows are fixed-height and memoised on event objects that stay identical between polls; the list data
// is rebuilt once a minute (the "past" dimming and the now line), the countdown and the bells are leaves.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { FlashList, type FlashListRef, type ViewToken } from "@shopify/flash-list";
import { Bell } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { kv } from "@/lib/kv";
import { getQueryData, useQuery } from "@/lib/query";
import { onSignOut, useSession } from "@/session";
import { Display, EmptyState, IconButton, Mono, Screen, Text, useBottomInset, type SheetRef } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { serverOffset as serverOffsetSec } from "../../chart/data";
import { cleanCurrency, fetchCalendar, fetchEvent, fetchMy, fetchNext, keys, prefetchEvent, type CalDetail, type CalendarWeek, type CalEvent, type Impact } from "../api";
import { useMinute } from "../clock";
import { AlertsSheet, calFilterCount, CalendarFiltersSheet, DEFAULT_CAL_FILTERS, type CalFilters } from "../components/CalendarSheets";
import { DayHeader, EVENT_ROW_HEIGHT, EventRow, NowRow, type CalRow } from "../components/CalendarRows";
import { FilterButton, TopBar } from "../components/chrome";
import { DayStrip, visibleDayStore, type StripDay } from "../components/DayStrip";
import { EventSheet } from "../components/EventSheet";
import { NextHigh } from "../components/NextHigh";
import { EventRowsSkeleton, LoadError } from "../components/states";
import { dayMonth, dayMonthYear, eventDay, gmt, localDay, localHm, localOffsetMin, serverDay, serverHm, type Zone } from "../format";
import { syncReminders } from "../reminders";

const FILTERS_KEY = "kalks.calendar.filters";
onSignOut(() => kv.remove(FILTERS_KEY));

function savedFilters(): CalFilters {
  const s = kv.getJSON<Partial<CalFilters>>(FILTERS_KEY);
  if (!s) return DEFAULT_CAL_FILTERS;
  const impacts = (Array.isArray(s.impacts) ? s.impacts : []).filter((i): i is Impact => i === 0 || i === 1 || i === 2 || i === 3);
  const currencies = (Array.isArray(s.currencies) ? s.currencies : []).map(cleanCurrency).filter((c): c is string => !!c);
  return { impacts: impacts.length ? impacts : DEFAULT_CAL_FILTERS.impacts, currencies, zone: s.zone === "server" ? "server" : "local" };
}

const addDays = (iso: string, d: number) => new Date(Date.parse(iso) + d * 86_400_000).toISOString();

/** Calendar days (YYYY-MM-DD) the week [from, to) covers in the chosen clock. */
function weekDays(from: string, to: string, zone: Zone, offsetH: number): string[] {
  const a = Date.parse(from);
  const b = Date.parse(to) - 1;
  const out: string[] = [];
  const key = (ms: number) => (zone === "server" ? serverDay(ms, offsetH) : localDay(ms));
  for (let ms = a; ; ms += 86_400_000) {
    const k = key(Math.min(ms, b));
    if (out[out.length - 1] !== k) out.push(k);
    if (ms >= b) break;
  }
  const last = key(b);
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
/** Noon of a day in the chosen clock, as a time (a day whose noon lies outside the week is only an edge of it). */
function noonOf(day: string, zone: Zone, offsetH: number): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return zone === "server" ? Date.UTC(y, m - 1, d, 12) - offsetH * 3_600_000 : new Date(y, m - 1, d, 12).getTime();
}
const isWeekday = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`).getUTCDay();
  return d >= 1 && d <= 5;
};
/** All-day entries (holidays) lead their day, then by time. */
const byTime = (a: CalEvent, b: CalEvent) => Number(b.allDay) - Number(a.allDay) || Date.parse(a.startsAt) - Date.parse(b.startsAt) || b.impact - a.impact || a.id - b.id;

type Built = { rows: CalRow[]; sticky: number[]; rowOfDay: Map<string, number>; strip: StripDay[]; nowIndex: number; total: number; high: number; medium: number; shown: number };

function build(data: CalendarWeek | undefined, f: CalFilters, now: number, offsetH: number): Built {
  const empty: Built = { rows: [], sticky: [], rowOfDay: new Map(), strip: [], nowIndex: -1, total: 0, high: 0, medium: 0, shown: 0 };
  if (!data) return empty;
  const zone = f.zone;
  const today = zone === "server" ? serverDay(now, offsetH) : localDay(now);
  const byDayAll = new Map<string, CalEvent[]>();
  for (const e of data.events) {
    const d = eventDay(e, zone);
    const l = byDayAll.get(d);
    if (l) l.push(e);
    else byDayAll.set(d, [e]);
  }
  const keep = (e: CalEvent) => f.impacts.includes(e.impact) && (!f.currencies.length || f.currencies.includes(e.currency));
  const days = weekDays(data.from, data.to, zone, offsetH);
  for (const d of byDayAll.keys()) if (!days.includes(d)) days.push(d);
  days.sort();
  const rows: CalRow[] = [];
  const sticky: number[] = [];
  const rowOfDay = new Map<string, number>();
  const strip: StripDay[] = [];
  let nowIndex = -1;
  let shown = 0;
  const nowLabel = zone === "server" ? serverHm(now, offsetH) : localHm(now);
  const from = Date.parse(data.from);
  const to = Date.parse(data.to);
  for (const day of days) {
    const all = (byDayAll.get(day) ?? []).sort(byTime);
    const evs = all.filter(keep);
    const noon = noonOf(day, zone, offsetH);
    if (all.length || (isWeekday(day) && noon >= from && noon < to)) strip.push({ day, count: evs.length, high: evs.filter((e) => e.impact === 3).length, today: day === today });
    if (!evs.length) continue;
    rowOfDay.set(day, rows.length);
    sticky.push(rows.length);
    rows.push({ kind: "day", key: `d:${day}`, day, count: evs.length, high: evs.filter((e) => e.impact === 3).length, today: day === today });
    let placed = day !== today;
    for (const e of evs) {
      // all-day entries lead their day and never move the now line; they dim once their day is over
      const past = e.allDay ? day < today : Date.parse(e.startsAt) <= now;
      if (!placed && !past && !e.allDay) {
        nowIndex = rows.length;
        rows.push({ kind: "now", key: "now", label: nowLabel });
        placed = true;
      }
      rows.push({ kind: "event", key: `e:${e.id}`, e, past });
      shown++;
    }
    if (!placed) {
      nowIndex = rows.length;
      rows.push({ kind: "now", key: "now", label: nowLabel });
    }
  }
  return { rows, sticky, rowOfDay, strip, nowIndex, total: data.events.length, high: data.events.filter((e) => e.impact === 3).length, medium: data.events.filter((e) => e.impact === 2).length, shown };
}

const typeOf = (r: CalRow) => r.kind;
const keyOf = (r: CalRow) => r.key;
const VIEWABILITY = { itemVisiblePercentThreshold: 10, minimumViewTime: 60 };

export function CalendarScreen() {
  const t = useT();
  const f = useFormat();
  const router = useRouter();
  const focused = useIsFocused();
  const bottom = useBottomInset(false);
  const viewer = useSession((s) => !!s.viewer);
  const canRemind = !viewer;
  const params = useLocalSearchParams<{ currency?: string; event?: string }>();
  const linkedCcy = cleanCurrency(params.currency);

  const [filters, setFilters] = React.useState<CalFilters>(() => (linkedCcy ? { ...savedFilters(), impacts: DEFAULT_CAL_FILTERS.impacts, currencies: [linkedCcy] } : savedFilters()));
  React.useEffect(() => {
    if (!linkedCcy) kv.setJSON(FILTERS_KEY, filters);
  }, [filters, linkedCcy]);

  // the week: null = this week (server Monday 00:00), else its start
  const [week, setWeek] = React.useState<string | null>(null);
  const calKey = keys.calendar(week);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const calFetcher = React.useMemo(() => fetchCalendar(week), [week]);
  const cal = useQuery(calKey, calFetcher, { persist: true, staleMs: 60_000, intervalMs: focused ? 5 * 60_000 : undefined });
  const shownRef = React.useRef<CalendarWeek | undefined>(undefined);
  if (cal.data) shownRef.current = cal.data;
  const data = cal.data ?? shownRef.current;
  const stale = !cal.data && !!data;

  const next = useQuery(keys.next, fetchNext, { persist: true, staleMs: 60_000, intervalMs: focused ? 5 * 60_000 : undefined });
  const my = useQuery(canRemind ? keys.my : null, fetchMy, { persist: true, staleMs: 60_000 });
  React.useEffect(() => syncReminders(my.data), [my.data]);

  const now = useMinute();
  const offsetH = data?.serverOffset ?? serverOffsetSec(now / 1000) / 3600;
  const zone = filters.zone;
  const built = React.useMemo(() => build(data, filters, now, offsetH), [data, filters, now, offsetH]);
  const isThisWeek = !!data && Date.parse(data.from) <= now && now < Date.parse(data.to);
  const zoneLabel = zone === "server" ? t("mobileNews.cal.zone.server", { tz: gmt(offsetH * 60) }) : t("mobileNews.cal.zone.local", { tz: gmt(localOffsetMin()) });

  // the event sheet
  const sheet = React.useRef<SheetRef>(null);
  const [sel, setSel] = React.useState<CalEvent | null>(null);
  const openEvent = React.useCallback((e: CalEvent) => {
    setSel(e);
    sheet.current?.present();
  }, []);
  const warmEvent = React.useCallback((e: CalEvent) => prefetchEvent(e.id), []);
  const selFresh = sel ? (data?.events.find((x) => x.id === sel.id) ?? sel) : null;
  const newsFor = React.useCallback(
    (currency: string) => {
      sheet.current?.dismiss();
      router.push(`/news?currency=${currency}`);
    },
    [router],
  );

  // /calendar?event=ID (links from notifications and other screens)
  const opened = React.useRef(false);
  React.useEffect(() => {
    const id = Number(params.event);
    if (opened.current || !Number.isInteger(id) || id <= 0) return;
    opened.current = true;
    const inWeek = getQueryData<CalendarWeek>(keys.calendar(null))?.events.find((e) => e.id === id);
    if (inWeek) return openEvent(inWeek);
    void fetchEvent(id)().then((r) => r.ok && openEvent((r.data as CalDetail).event));
  }, [params.event, openEvent]);

  // open at "now" on this week (a few rows of the day above it), at the top on another week: the list remounts per
  // week (keyed on the week's start) and starts at that row. The sticky day heading covers the first row exactly
  // (same height), so the now line shows with two past releases above it.
  const list = React.useRef<FlashListRef<CalRow>>(null);
  const todayRow = built.rowOfDay.get(zone === "server" ? serverDay(now, offsetH) : localDay(now));
  const target = isThisWeek && todayRow !== undefined ? Math.max(todayRow, built.nowIndex - 3) : 0;

  const pickDay = React.useCallback(
    (day: string) => {
      let index = built.rowOfDay.get(day);
      if (index === undefined) {
        // a day without (filtered) events: the next day that has some, else the last one
        const later = [...built.rowOfDay.entries()].filter(([d]) => d > day).sort()[0];
        const earlier = [...built.rowOfDay.entries()].filter(([d]) => d < day).sort().pop();
        index = (later ?? earlier)?.[1];
      }
      if (index !== undefined) void list.current?.scrollToIndex({ index, animated: true });
    },
    [built.rowOfDay],
  );
  const shiftWeek = React.useCallback(
    (dir: -1 | 0 | 1) => {
      if (dir === 0 || !data) return setWeek(null);
      const from = addDays(data.from, 7 * dir);
      const thisWeek = getQueryData<CalendarWeek>(keys.calendar(null))?.from;
      setWeek(from === thisWeek ? null : from);
    },
    [data],
  );

  // the day on screen (drives the strip's highlight; the strip re-renders, the list doesn't)
  const zoneRef = React.useRef(zone);
  zoneRef.current = zone;
  const onViewable = React.useRef(({ viewableItems }: { viewableItems: ViewToken<CalRow>[] }) => {
    const first = viewableItems.find((v) => v.isViewable && v.item);
    const r = first?.item;
    if (!r) return;
    const day = r.kind === "day" ? r.day : r.kind === "event" ? eventDay(r.e, zoneRef.current) : null;
    if (day && visibleDayStore.get() !== day) visibleDayStore.set(day);
  }).current;
  React.useEffect(() => () => visibleDayStore.set(null), []);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    try {
      await Promise.all([cal.refresh(), next.refresh(), canRemind ? my.refresh() : null]);
    } finally {
      setRefreshing(false);
    }
  }, [cal, next, my, canRemind]);

  const filterSheet = React.useRef<SheetRef>(null);
  const alertsSheet = React.useRef<SheetRef>(null);
  const nFilters = calFilterCount(filters);

  const renderItem = React.useCallback(
    ({ item }: { item: CalRow }) => {
      if (item.kind === "day") return <DayHeader day={item.day} count={item.count} today={item.today} zoneLabel={zoneLabel} />;
      if (item.kind === "now") return <NowRow label={item.label} />;
      return <EventRow e={item.e} past={item.past} zone={zone} canRemind={canRemind} onOpen={openEvent} onPressIn={warmEvent} />;
    },
    [zoneLabel, zone, canRemind, openEvent, warmEvent],
  );

  // the week is a server-time week (Monday 00:00 to Sunday 24:00, New York close)
  const weekLabel = data ? `${dayMonth(f, serverDay(Date.parse(data.from), offsetH))} – ${dayMonthYear(f, serverDay(Date.parse(data.to) - 1, offsetH))}` : "";

  const header = data ? (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[5], paddingBottom: space[5], gap: space[4] }}>
      <View style={{ gap: space[1] }}>
        <Text variant="label" tone="ember">
          {t("mobileNews.cal.eyebrow")}
        </Text>
        <Display size="lg" accessibilityRole="header">
          {weekLabel}
        </Display>
      </View>
      <View style={{ flexDirection: "row", gap: space[6] }}>
        <Stat value={built.total} label={t("mobileNews.cal.summary.events")} />
        <Stat value={built.high} label={t("news.impact.high")} color={colors.ember} />
        <Stat value={built.medium} label={t("news.impact.medium")} color={colors.gold} />
      </View>
      <Text variant="caption" tone="secondary">
        {zone === "server" ? t("mobileNews.cal.zoneNote.server", { server: gmt(offsetH * 60), local: gmt(localOffsetMin()) }) : t("mobileNews.cal.zoneNote.local", { local: gmt(localOffsetMin()), server: gmt(offsetH * 60) })}
      </Text>
      {data.updatedAt ? (
        <Text variant="caption" tone="tertiary">
          {t("news.cal.updated", { time: localHm(data.updatedAt), source: data.source.name })}
        </Text>
      ) : null}
    </View>
  ) : null;

  const empty = !data ? (
    cal.error ? (
      <LoadError error={cal.error} onRetry={() => void cal.refresh()} />
    ) : (
      <EventRowsSkeleton rows={8} height={EVENT_ROW_HEIGHT} />
    )
  ) : nFilters ? (
    <EmptyState illustration="emptyHistory" title={t("mobileNews.cal.empty.filteredTitle")} body={t("news.cal.empty")} action={t("mobileNews.cal.filters.reset")} onAction={() => setFilters({ ...DEFAULT_CAL_FILTERS, zone })} />
  ) : (
    <EmptyState illustration="emptyHistory" title={t("mobileNews.cal.empty.title")} body={t("mobileNews.cal.empty.body")} />
  );

  const footer = built.rows.length ? (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[6], gap: space[1] }}>
      <Text variant="caption" tone="tertiary">
        {`${t("news.cal.legend.green")}: ${t("news.cal.legend.greenText")} · ${t("news.cal.legend.red")}: ${t("news.cal.legend.redText")}`}
      </Text>
      <Text variant="caption" tone="tertiary">
        {t("news.cal.source", { source: data?.source.name ?? "Forex Factory" })}
      </Text>
    </View>
  ) : null;

  return (
    <Screen scroll={false} tabBar={false}>
      <TopBar
        fallback="/"
        title={t("mobileNews.cal.title")}
        right={
          <>
            {canRemind ? <IconButton accessibilityLabel={t("mobileNews.cal.alertsAria")} icon={<Bell size={19} color={my.data?.alerts?.highImpact ? colors.ember : colors.text} />} onPress={() => alertsSheet.current?.present()} /> : null}
            <FilterButton testID="calendar-filters" count={nFilters} label={t("mobileNews.cal.filtersAria")} onPress={() => filterSheet.current?.present()} />
          </>
        }
      />
      {data ? <DayStrip days={built.strip} onPick={pickDay} onWeek={shiftWeek} current={week === null} /> : null}
      {next.data?.event && Date.parse(next.data.event.startsAt) > now - 60_000 ? <NextHigh e={next.data.event} zone={zone} onOpen={openEvent} /> : null}
      <FlashList
        ref={list}
        data={built.rows}
        keyExtractor={keyOf}
        getItemType={typeOf}
        renderItem={renderItem}
        stickyHeaderIndices={built.sticky}
        key={data?.from ?? "empty"}
        initialScrollIndex={target > 0 ? target : undefined}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={VIEWABILITY}
        contentContainerStyle={{ paddingBottom: bottom + space[4] }}
        style={stale ? { opacity: 0.55 } : undefined}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
      />
      <EventSheet ref={sheet} e={selFresh} zone={zone} offset={offsetH} canRemind={canRemind} onNewsFor={newsFor} />
      <CalendarFiltersSheet ref={filterSheet} value={filters} onChange={setFilters} serverOffset={offsetH} />
      {canRemind ? <AlertsSheet ref={alertsSheet} my={my.data} canEdit={canRemind} /> : null}
    </Screen>
  );
}

/** A huge number with a small label (editorial stats). */
function Stat({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Mono size={30} weight="bold" color={color ?? colors.text} style={{ lineHeight: 34 }}>
        {String(value)}
      </Mono>
      <Text variant="label" tone="tertiary" style={{ fontSize: 10 }}>
        {label}
      </Text>
    </View>
  );
}
