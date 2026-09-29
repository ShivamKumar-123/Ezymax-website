// One calendar event in a bottom sheet: currency and impact, the title, its time in both clocks and a countdown,
// actual / forecast / previous as big figures, the release history, instruments to watch (tap: chart), the
// currency's news, and the reminder (lead time 5–60 minutes). The history is warmed on the row's press-in.
import * as React from "react";
import { useWindowDimensions, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFormat, useT } from "@/i18n";
import { useQuery } from "@/lib/query";
import { Button, Display, Mono, Pill, Sheet, Skeleton, Text, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { fetchEvent, keys, REMIND_MINUTES, type CalDetail, type CalEvent } from "../api";
import { useMinute } from "../clock";
import { dayMonth, eventDay, figure, gmt, localHm, unitOf, weekdayLong, type Zone } from "../format";
import { setReminder, useReminded, useReminderBusy, useReminderMinutes } from "../reminders";
import { CurrencyPill, ImpactBars, impactColor, SymbolButton } from "./chips";
import { Countdown } from "./NextHigh";

type Props = { e: CalEvent | null; zone: Zone; offset: number; canRemind: boolean; onNewsFor: (currency: string) => void; onDismiss?: () => void };

export const EventSheet = React.forwardRef<SheetRef, Props>(function EventSheet({ e, zone, offset, canRemind, onNewsFor, onDismiss }, ref) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Sheet ref={ref} scroll maxDynamicContentSize={Math.round(height * 0.88)} onDismiss={onDismiss}>
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: Math.max(insets.bottom, space[4]) + space[4], gap: space[5] }} showsVerticalScrollIndicator={false}>
        {e ? <Body e={e} zone={zone} offset={offset} canRemind={canRemind} onNewsFor={onNewsFor} /> : null}
      </BottomSheetScrollView>
    </Sheet>
  );
});

function Body({ e, zone, offset, canRemind, onNewsFor }: { e: CalEvent; zone: Zone; offset: number; canRemind: boolean; onNewsFor: (currency: string) => void }) {
  const t = useT();
  const f = useFormat();
  // the minute clock is enough here: the countdown below is its own one-second leaf
  const now = useMinute();
  const future = Date.parse(e.startsAt) > now;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetcher = React.useMemo(() => fetchEvent(e.id), [e.id]);
  const detail = useQuery(keys.event(e.id), fetcher, { staleMs: 120_000 });
  const day = eventDay(e, zone);
  const dayText = `${weekdayLong(f, day)} ${dayMonth(f, day)}`;
  const timeLine = e.allDay
    ? t("mobileNews.cal.eventTime.allDay", { day: dayText })
    : t(zone === "server" ? "mobileNews.cal.eventTime.server" : "mobileNews.cal.eventTime.local", { day: dayText, local: localHm(e.startsAt), server: e.serverTime, tz: gmt(offset * 60) });
  const impactText = e.impact === 3 ? t("mobileNews.cal.impact.high") : e.impact === 2 ? t("mobileNews.cal.impact.medium") : e.impact === 1 ? t("mobileNews.cal.impact.low") : t("news.impact.holiday");
  return (
    <View style={{ gap: space[5] }} testID="event-sheet">
      <View style={{ gap: space[3] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <CurrencyPill currency={e.currency} />
          <View style={{ height: 34, paddingHorizontal: space[3], borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 6 }}>
            {e.impact > 0 ? <ImpactBars impact={e.impact} size={11} /> : null}
            <Text variant="caption" weight="700" color={impactColor(e.impact)}>
              {impactText}
            </Text>
          </View>
        </View>
        <Display size="md" accessibilityRole="header">
          {e.title}
        </Display>
        <Text variant="callout" tone="secondary">
          {timeLine}
        </Text>
        {future && !e.allDay ? (
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
            <Text variant="label" tone="tertiary">
              {t("mobileNews.cal.startsIn")}
            </Text>
            <Countdown iso={e.startsAt} color={colors.text} size={22} />
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: space[3] }}>
        <Big label={t("news.cal.col.actual")} value={e.actual || (future ? t("common.pending") : "—")} color={e.actual ? (e.surprise === 1 ? colors.up : e.surprise === -1 ? colors.down : colors.text) : colors.text3} small={!e.actual} />
        <Big label={t("news.cal.col.forecast")} value={e.forecast || "—"} color={e.forecast ? colors.text : colors.text3} />
        <Big label={t("news.cal.col.previous")} value={e.previous || "—"} color={e.previous ? colors.text2 : colors.text3} />
      </View>
      {e.lowerIsBetter && e.forecast ? (
        <Text variant="caption" tone="tertiary">
          {t("news.cal.lowerIsBetter")}
        </Text>
      ) : null}

      <View style={{ gap: space[2] }}>
        <Text variant="label" tone="tertiary">
          {t("news.cal.history")}
        </Text>
        {detail.loading ? <Skeleton h={120} r={radius.md} /> : <History e={e} detail={detail.data} />}
      </View>

      <View style={{ gap: space[2] }}>
        <Text variant="label" tone="tertiary">
          {t("news.cal.toWatch")}
        </Text>
        {e.symbols.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {e.symbols.map((s) => (
              <SymbolButton key={s} symbol={s} change />
            ))}
          </View>
        ) : (
          <Text variant="caption" tone="tertiary">
            {t("news.cal.noLinked")}
          </Text>
        )}
      </View>

      <Button testID="event-news" label={t("mobileNews.cal.newsFor", { currency: e.currency })} variant="secondary" size="md" onPress={() => onNewsFor(e.currency)} />

      {future && !e.allDay ? canRemind ? <Remind e={e} /> : (
        <Text variant="caption" tone="tertiary">
          {t("mobileNews.cal.viewOnlyRemind")}
        </Text>
      ) : null}
    </View>
  );
}

function Big({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 4, padding: space[3], borderRadius: radius.md, backgroundColor: colors.surface2 }}>
      <Text variant="label" tone="tertiary" numberOfLines={1} style={{ fontSize: 10 }}>
        {label}
      </Text>
      <Mono size={small ? 15 : 22} weight="bold" color={color} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Mono>
    </View>
  );
}

/** Past releases' actual figures as bars around zero, this release (when out) in gold. */
function History({ e, detail }: { e: CalEvent; detail: CalDetail | undefined }) {
  const t = useT();
  const f = useFormat();
  const bars = React.useMemo(() => {
    const out = (detail?.history ?? []).map((h) => ({ at: h.startsAt, v: figure(h.actual || ""), now: false })).filter((b): b is { at: string; v: number; now: boolean } => b.v !== null);
    const cur = figure(e.actual);
    if (cur !== null) out.push({ at: e.startsAt, v: cur, now: true });
    return out.slice(-10);
  }, [detail, e.actual, e.startsAt]);
  if (bars.length < 2) {
    return (
      <View style={{ height: 72, borderRadius: radius.md, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", paddingHorizontal: space[4] }}>
        <Text variant="caption" tone="tertiary" align="center">
          {e.forecast || e.previous ? t("news.cal.historyBuilding") : t("news.cal.noFigures")}
        </Text>
      </View>
    );
  }
  const unit = unitOf(e.previous || e.forecast || e.actual);
  const max = Math.max(0, ...bars.map((b) => b.v));
  const min = Math.min(0, ...bars.map((b) => b.v));
  const span = max - min || 1;
  const H = 96;
  const zero = (max / span) * H;
  return (
    <View style={{ padding: space[3], borderRadius: radius.md, backgroundColor: colors.surface2, gap: space[2] }} accessibilityLabel={bars.map((b) => `${f.date(b.at, { month: "short", year: "2-digit", timeZone: undefined })} ${b.v}${unit}`).join(", ")}>
      <View style={{ height: H, flexDirection: "row", alignItems: "stretch", gap: 6 }}>
        {bars.map((b, i) => {
          const h = Math.max(2, (Math.abs(b.v) / span) * H);
          return (
            <View key={i} style={{ flex: 1 }}>
              <View style={{ position: "absolute", start: 0, end: 0, borderRadius: 3, backgroundColor: b.now ? colors.gold : colors.surface3, top: b.v >= 0 ? zero - h : zero, height: h }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {bars.map((b, i) => (
          <Text key={i} variant="caption" tone={b.now ? "gold" : "tertiary"} align="center" numberOfLines={1} style={{ flex: 1, fontSize: 9.5 }}>
            {f.date(b.at, { month: "short", timeZone: undefined })}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Mono size={11} tone="tertiary">{`${bars[0]!.v}${unit}`}</Mono>
        <Mono size={11} weight="bold" color={bars[bars.length - 1]!.now ? colors.gold : colors.text2}>{`${bars[bars.length - 1]!.v}${unit}`}</Mono>
      </View>
    </View>
  );
}

/** Reminder controls: the lead time, then on / off. Moving the lead time of a set reminder applies at once. */
function Remind({ e }: { e: CalEvent }) {
  const t = useT();
  const on = useReminded(e.id);
  const busy = useReminderBusy(e.id);
  const saved = useReminderMinutes(e.id);
  const [minutes, setMinutes] = React.useState<number>(saved ?? 15);
  React.useEffect(() => {
    if (saved) setMinutes(saved);
  }, [saved]);
  const pick = (m: number) => {
    setMinutes(m);
    if (on && m !== saved) void setReminder(e, m);
  };
  return (
    <View style={{ gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface2 }}>
      <Text variant="label" tone={on ? "ember" : "tertiary"}>
        {on ? t("mobileNews.cal.reminderOn") : t("mobileNews.cal.remindBefore")}
      </Text>
      <View style={{ flexDirection: "row", gap: space[2] }} accessibilityRole="radiogroup">
        {REMIND_MINUTES.map((m) => (
          <Pill key={m} compact label={t("news.alerts.minutes", { m })} selected={minutes === m} onPress={() => pick(m)} style={{ flex: 1, alignItems: "center" }} />
        ))}
      </View>
      {on ? (
        <Button testID="reminder-remove" label={t("news.cal.removeReminder")} variant="ghost" size="md" loading={busy} onPress={() => void setReminder(e, null)} />
      ) : (
        <Button testID="reminder-set" label={t("mobileNews.cal.remind")} size="md" loading={busy} onPress={() => void setReminder(e, minutes)} />
      )}
    </View>
  );
}
