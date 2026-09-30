// Calendar list parts (MT5-dense): a sticky day heading, the "now" line, and the event row: time and impact bars,
// currency and title, actual / forecast / previous, and the reminder bell. Rows are fixed-height and memoised on the
// event object (kept identical between polls); the bell subscribes to its own event, so toggling a reminder
// re-renders that bell only.
import * as React from "react";
import { View } from "react-native";
import { Bell, BellRing } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { Display, Mono, PressableScale, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import type { CalEvent } from "../api";
import { dayMonth, eventTime, weekdayLong, type Zone } from "../format";
import { toggleReminder, useReminded, useReminderBusy } from "../reminders";
import { impactColor, ImpactBars } from "./chips";

/** Rows and day headings share one height: a row that opens under the sticky heading is covered whole, never cut. */
export const EVENT_ROW_HEIGHT = 64;
export const DAY_ROW_HEIGHT = EVENT_ROW_HEIGHT;
export const NOW_ROW_HEIGHT = 30;

export type CalRow =
  | { kind: "day"; key: string; day: string; count: number; high: number; today: boolean }
  | { kind: "now"; key: string; label: string }
  | { kind: "event"; key: string; e: CalEvent; past: boolean };

/** Sticky day heading: weekday in the display face and Today, then the date and which clock the times use. */
export const DayHeader = React.memo(function DayHeader({ day, count, today, zoneLabel }: { day: string; count: number; today: boolean; zoneLabel: string }) {
  const t = useT();
  const f = useFormat();
  return (
    <View
      accessibilityRole="header"
      accessibilityLabel={t("mobileNews.cal.dayAria", { day: `${weekdayLong(f, day)} ${dayMonth(f, day)}`, count })}
      style={{ height: DAY_ROW_HEIGHT, paddingHorizontal: GUTTER, justifyContent: "center", gap: 2, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Display size="sm" tone={today ? "ember" : "primary"} numberOfLines={1} style={{ flexShrink: 1 }}>
          {weekdayLong(f, day)}
        </Display>
        {today ? (
          <View style={{ height: 20, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: colors.ember, justifyContent: "center" }}>
            <Text variant="label" color={colors.ink} style={{ fontSize: 9.5 }}>
              {t("common.today")}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="caption" tone="tertiary" numberOfLines={1}>
        {`${dayMonth(f, day)} · ${zoneLabel}`}
      </Text>
    </View>
  );
});

/** The current time between the events already out and the next ones (today only). */
export const NowRow = React.memo(function NowRow({ label }: { label: string }) {
  const t = useT();
  return (
    <View style={{ height: NOW_ROW_HEIGHT, paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[2] }} accessibilityLabel={`${t("news.cal.now")} ${label}`}>
      <View style={{ height: 22, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: colors.ember, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text variant="label" color={colors.ink} style={{ fontSize: 10 }}>
          {t("news.cal.now")}
        </Text>
        <Mono size={11} weight="bold" color={colors.ink}>
          {label}
        </Mono>
      </View>
      <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: colors.ember }} />
    </View>
  );
});

/** Actual / forecast / previous in one line: A in the currency's direction (better / worse than forecast). */
function Figures({ e }: { e: CalEvent }) {
  const t = useT();
  if (!e.actual && !e.forecast && !e.previous) {
    return (
      <Text variant="caption" tone="tertiary" numberOfLines={1}>
        {e.impact === 0 ? t("news.impact.holiday") : "—"}
      </Text>
    );
  }
  const actualColor = e.surprise === 1 ? colors.up : e.surprise === -1 ? colors.down : colors.text;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], overflow: "hidden" }}>
      {e.actual ? <Fig k={t("news.abbr.actual")} v={e.actual} color={actualColor} bold /> : null}
      {e.forecast ? <Fig k={t("news.abbr.forecast")} v={e.forecast} color={colors.text2} /> : null}
      {e.previous ? <Fig k={t("news.abbr.previous")} v={e.previous} color={colors.text3} /> : null}
    </View>
  );
}

function Fig({ k, v, color, bold }: { k: string; v: string; color: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
      <Text variant="label" tone="tertiary" style={{ fontSize: 9.5, letterSpacing: 0.4 }}>
        {k}
      </Text>
      <Mono size={12.5} weight={bold ? "bold" : "medium"} color={color} numberOfLines={1}>
        {v}
      </Mono>
    </View>
  );
}

/** The reminder bell of a future event (44 pt), or nothing. */
const RowBell = React.memo(function RowBell({ e }: { e: CalEvent }) {
  const t = useT();
  const on = useReminded(e.id);
  const busy = useReminderBusy(e.id);
  return (
    <PressableScale
      testID={`bell-${e.id}`}
      onPress={() => void toggleReminder(e)}
      disabled={busy}
      haptics="select"
      scaleTo={0.9}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, busy }}
      accessibilityLabel={on ? t("news.cal.removeReminder") : t("mobileNews.cal.remind")}
      hitSlop={4}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.emberSoft : "transparent" }}
    >
      {on ? <BellRing size={19} color={colors.ember} strokeWidth={2.2} /> : <Bell size={19} color={colors.text3} strokeWidth={1.9} />}
    </PressableScale>
  );
});

export const EventRow = React.memo(function EventRow({ e, past, zone, canRemind, onOpen, onPressIn }: { e: CalEvent; past: boolean; zone: Zone; canRemind: boolean; onOpen: (e: CalEvent) => void; onPressIn: (e: CalEvent) => void }) {
  const t = useT();
  const time = eventTime(t, e, zone);
  const impactText = e.impact === 3 ? t("mobileNews.cal.impact.high") : e.impact === 2 ? t("mobileNews.cal.impact.medium") : e.impact === 1 ? t("mobileNews.cal.impact.low") : t("news.impact.holiday");
  return (
    <View style={{ height: EVENT_ROW_HEIGHT, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <PressableScale
        testID="calendar-row"
        onPress={() => onOpen(e)}
        onPressIn={() => onPressIn(e)}
        scaleTo={0.985}
        accessibilityRole="button"
        accessibilityLabel={t("mobileNews.cal.row.a11y", { time, currency: e.currency, title: e.title, impact: impactText })}
        style={{ flex: 1, height: EVENT_ROW_HEIGHT }}
      >
        {/* past releases are dimmed on this inner view: PressableScale animates its own opacity (press / disabled), which
            would override an opacity given in its style */}
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", opacity: past ? 0.62 : 1 }}>
          {/* the impact stripe on the start edge; spacing by fixed spacers (not start / end margins) so the row reads the
              same in both directions on every renderer */}
          <View style={{ width: 3, height: EVENT_ROW_HEIGHT - 24, borderRadius: 2, backgroundColor: impactColor(e.impact) }} />
          <View style={{ width: GUTTER - 3 }} />
          <View style={{ width: 50, gap: 5 }}>
            {e.allDay ? (
              <Text variant="caption" tone="secondary" weight="700" numberOfLines={1}>
                {time}
              </Text>
            ) : (
              <Mono size={14} weight="medium" tone="secondary">
                {time}
              </Mono>
            )}
            {e.impact > 0 ? <ImpactBars impact={e.impact} size={10} /> : null}
          </View>
          <View style={{ width: space[3] }} />
          <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
              <Mono size={13} weight="bold">
                {e.currency}
              </Mono>
              <Text variant="callout" weight="600" numberOfLines={1} style={{ flex: 1 }}>
                {e.title}
              </Text>
            </View>
            <Figures e={e} />
          </View>
          {canRemind ? null : <View style={{ width: GUTTER }} />}
        </View>
      </PressableScale>
      {canRemind ? <View style={{ width: 56, alignItems: "center" }}>{!past && !e.allDay ? <RowBell e={e} /> : null}</View> : null}
    </View>
  );
});
