// The calendar's fixed day strip: one pill per day of the week (weekday, date, high-impact marks), the day on screen
// highlighted as the list scrolls (its own small store, so scrolling re-renders the strip only), a tap jumps to the
// day. "Earlier" / "Later" at the ends switch the week; "This week" returns.
import * as React from "react";
import { ScrollView, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useFormat, useLocale, useT } from "@/i18n";
import { createStore, useStore } from "@/lib/store";
import { Display, PressableScale, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { dayNum, weekdayShort } from "../format";

/** The day whose events are at the top of the list (set from the list's viewability callback). */
export const visibleDayStore = createStore<string | null>(null);

export type StripDay = { day: string; count: number; high: number; today: boolean };

export const DayStrip = React.memo(function DayStrip({ days, onPick, onWeek, current }: { days: StripDay[]; onPick: (day: string) => void; onWeek: (dir: -1 | 0 | 1) => void; current: boolean }) {
  const t = useT();
  const f = useFormat();
  const { rtl } = useLocale();
  const active = useStore(visibleDayStore);
  const Prev = rtl ? ChevronRight : ChevronLeft;
  const Next = rtl ? ChevronLeft : ChevronRight;

  // keep the day on screen visible in the strip as the list scrolls (left-to-right layouts; RTL scroll offsets differ
  // per platform, so the strip stays where the reader left it there)
  const scroller = React.useRef<ScrollView>(null);
  const spots = React.useRef(new Map<string, { x: number; w: number }>()).current;
  const view = React.useRef({ x: 0, w: 0 });
  React.useEffect(() => {
    const p = active ? spots.get(active) : undefined;
    if (!p || rtl || !view.current.w) return;
    const { x, w } = view.current;
    if (p.x < x + space[2] || p.x + p.w > x + w - space[2]) scroller.current?.scrollTo({ x: Math.max(0, p.x - GUTTER - 60), animated: true });
  }, [active, rtl, spots]);

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.bg }}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => (view.current.w = e.nativeEvent.layout.width)}
        onScroll={(e) => (view.current.x = e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={64}
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingVertical: space[2], gap: space[2], alignItems: "center" }}
        accessibilityRole="tablist"
      >
        <WeekButton testID="week-prev" label={t("mobileNews.cal.prevWeekShort")} a11y={t("news.cal.prevWeek")} icon={<Prev size={16} color={colors.text2} strokeWidth={2.2} />} onPress={() => onWeek(-1)} />
        {!current ? <WeekButton testID="week-this" label={t("news.cal.thisWeek")} a11y={t("news.cal.thisWeek")} onPress={() => onWeek(0)} strong /> : null}
        {days.map((d) => {
          const on = d.day === active;
          return (
            <PressableScale
              key={d.day}
              testID={`strip-${d.day}`}
              onLayout={(e) => spots.set(d.day, { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width })}
              onPress={() => onPick(d.day)}
              haptics="select"
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t("mobileNews.cal.dayAria", { day: `${weekdayShort(f, d.day)} ${dayNum(d.day)}`, count: d.count })}
              style={{ width: 54, height: 60, borderRadius: radius.md, alignItems: "center", justifyContent: "center", gap: 1, backgroundColor: on ? colors.cream : colors.surface, borderWidth: 1, borderColor: on ? colors.cream : d.today ? colors.ember : colors.line, opacity: d.count ? 1 : 0.5 }}
            >
              <Text variant="label" color={on ? colors.ink2 : d.today ? colors.ember : colors.text3} style={{ fontSize: 10 }}>
                {weekdayShort(f, d.day)}
              </Text>
              <Display size="xs" color={on ? colors.ink : colors.text}>
                {dayNum(d.day)}
              </Display>
              <View style={{ flexDirection: "row", gap: 2, height: 4 }}>
                {Array.from({ length: Math.min(4, d.high) }, (_, i) => (
                  <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: on ? colors.ink : colors.ember }} />
                ))}
              </View>
            </PressableScale>
          );
        })}
        <WeekButton testID="week-next" label={t("mobileNews.cal.nextWeekShort")} a11y={t("news.cal.nextWeek")} trailing={<Next size={16} color={colors.text2} strokeWidth={2.2} />} onPress={() => onWeek(1)} />
      </ScrollView>
    </View>
  );
});

function WeekButton({ label, a11y, icon, trailing, onPress, strong, testID }: { label: string; a11y: string; icon?: React.ReactNode; trailing?: React.ReactNode; onPress: () => void; strong?: boolean; testID?: string }) {
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      haptics="select"
      accessibilityLabel={a11y}
      style={{ height: 60, paddingHorizontal: space[3], borderRadius: radius.md, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: strong ? colors.ember : "transparent", borderWidth: 1, borderColor: strong ? colors.ember : colors.line }}
    >
      {icon}
      <Text variant="caption" weight="700" color={strong ? colors.ink : colors.text2}>
        {label}
      </Text>
      {trailing}
    </PressableScale>
  );
}
