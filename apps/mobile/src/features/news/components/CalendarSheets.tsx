// Calendar sheets: filters (impact, currencies, which clock the times use) and the high-impact alerts
// subscription (a notification before every high-impact release, the web Client Area's setting). Filter chips apply at
// once; the alert switch flips at once and rolls back when the server refuses.
import * as React from "react";
import { Switch, useWindowDimensions, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT, type MessageKey } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { getQueryData, setQueryData } from "@/lib/query";
import { Button, Display, Pill, PressableScale, Sheet, Text, toast, type SheetRef } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { clearAlerts, CURRENCIES, keys, REMIND_MINUTES, saveAlerts, type Alerts, type Impact, type MyCalendar } from "../api";
import { gmt, type Zone } from "../format";
import { useReminderCount } from "../reminders";

export type CalFilters = { impacts: Impact[]; currencies: string[]; zone: Zone };
export const DEFAULT_CAL_FILTERS: CalFilters = { impacts: [3, 2, 1, 0], currencies: [], zone: "local" };
/** Filters that narrow the list (for the button's count and the empty state); the clock choice isn't one. */
export const calFilterCount = (f: CalFilters) => (f.impacts.length < 4 ? 1 : 0) + (f.currencies.length ? 1 : 0);

const IMPACTS: [Impact, MessageKey][] = [
  [3, "news.impact.high"],
  [2, "news.impact.medium"],
  [1, "news.impact.low"],
  [0, "news.impact.holidays"],
];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="label" tone="tertiary">
        {title}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>{children}</View>
    </View>
  );
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export const CalendarFiltersSheet = React.forwardRef<SheetRef, { value: CalFilters; onChange: (f: CalFilters) => void; serverOffset: number }>(function CalendarFiltersSheet({ value, onChange, serverOffset }, ref) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const close = () => (ref as React.RefObject<SheetRef | null>)?.current?.dismiss();
  const local = gmt(-new Date().getTimezoneOffset());
  return (
    <Sheet ref={ref} scroll maxDynamicContentSize={Math.round(height * 0.82)}>
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: Math.max(insets.bottom, space[4]) + space[4], gap: space[5] }} showsVerticalScrollIndicator={false}>
        <Display size="md" accessibilityRole="header">
          {t("mobileNews.filters")}
        </Display>
        <Group title={t("news.cal.impact")}>
          {IMPACTS.map(([i, label]) => (
            <Pill
              key={i}
              compact
              label={t(label)}
              selected={value.impacts.includes(i)}
              // at least one impact level stays on
              onPress={() => (value.impacts.includes(i) && value.impacts.length === 1 ? undefined : onChange({ ...value, impacts: toggle(value.impacts, i) }))}
            />
          ))}
        </Group>
        <Group title={t("mobileNews.cal.filters.currencies")}>
          <Pill compact label={t("mobileNews.cal.filters.allCurrencies")} selected={!value.currencies.length} onPress={() => onChange({ ...value, currencies: [] })} />
          {CURRENCIES.map((c) => (
            <Pill key={c} compact label={c} selected={value.currencies.includes(c)} onPress={() => onChange({ ...value, currencies: toggle(value.currencies, c) })} />
          ))}
        </Group>
        <Group title={t("mobileNews.cal.zone.title")}>
          <Pill compact label={t("mobileNews.cal.zone.myTime", { tz: local })} selected={value.zone === "local"} onPress={() => onChange({ ...value, zone: "local" })} />
          <Pill compact label={t("mobileNews.cal.zone.serverTime", { tz: gmt(serverOffset * 60) })} selected={value.zone === "server"} onPress={() => onChange({ ...value, zone: "server" })} />
        </Group>
        <View style={{ flexDirection: "row", gap: space[3], marginTop: space[1] }}>
          <Button label={t("mobileNews.cal.filters.reset")} variant="ghost" size="md" style={{ flex: 1, paddingHorizontal: space[3] }} onPress={() => onChange({ ...DEFAULT_CAL_FILTERS, zone: value.zone })} />
          <Button label={t("common.done")} size="md" style={{ flex: 1, paddingHorizontal: space[3] }} onPress={close} />
        </View>
      </BottomSheetScrollView>
    </Sheet>
  );
});

/** The app's switch: ember track when on, cream thumb (the web preview too). */
function KSwitch({ value, onValueChange, disabled, accessibilityLabel }: { value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean; accessibilityLabel: string }) {
  const web = { activeThumbColor: colors.cream, activeTrackColor: colors.ember } as object;
  return <Switch value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ false: colors.surface3, true: colors.ember }} thumbColor={colors.cream} ios_backgroundColor={colors.surface3} accessibilityLabel={accessibilityLabel} {...web} />;
}

export const AlertsSheet = React.forwardRef<SheetRef, { my: MyCalendar | undefined; canEdit: boolean }>(function AlertsSheet({ my, canEdit }, ref) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const reminders = useReminderCount();
  const [state, setState] = React.useState<Alerts | null>(my?.alerts ?? null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!busy) setState(my?.alerts ?? null);
  }, [my?.alerts, busy]);
  const on = !!state?.highImpact;
  const minutes = state?.minutes ?? 15;

  const save = async (next: Alerts | null) => {
    const prev = state;
    setState(next);
    setBusy(true);
    const r = next ? await saveAlerts(next) : await clearAlerts();
    setBusy(false);
    if (!r.ok) {
      setState(prev);
      haptic.error();
      toast.show({ title: t("news.alerts.error"), body: r.error.message, tone: "error" });
      return;
    }
    const cached = getQueryData<MyCalendar>(keys.my);
    if (cached) setQueryData<MyCalendar>(keys.my, { ...cached, alerts: next }, true);
    toast.show({ title: next ? t("news.alerts.saved", { minutes: next.minutes }) : t("news.alerts.off"), tone: next ? "success" : "neutral" }, 2000);
  };
  const flip = (v: boolean) => {
    if (!canEdit || busy) return;
    haptic.select();
    void save(v ? { highImpact: true, currencies: state?.currencies ?? [], minutes } : null);
  };

  return (
    <Sheet ref={ref}>
      <View style={{ gap: space[5], paddingTop: space[2], paddingBottom: Math.max(0, insets.bottom - space[4]) }}>
        <Display size="md" accessibilityRole="header">
          {t("news.alerts.title")}
        </Display>
        <PressableScale
          testID="alerts-toggle"
          onPress={() => flip(!on)}
          scaleTo={1}
          disabled={!canEdit}
          accessibilityRole="switch"
          accessibilityState={{ checked: on, disabled: !canEdit }}
          accessibilityLabel={t("news.alerts.toggle")}
          style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space[3] }}
        >
          <Text variant="headline" weight="600" style={{ flex: 1 }}>
            {t("news.alerts.toggle")}
          </Text>
          <KSwitch value={on} onValueChange={flip} disabled={!canEdit || busy} accessibilityLabel={t("news.alerts.toggle")} />
        </PressableScale>
        <Text variant="callout" tone="secondary">
          {!canEdit ? t("mobile.viewOnlyBody") : on ? t("news.alerts.onText", { minutes }) : t("news.alerts.offText")}
        </Text>
        {on ? (
          <View style={{ flexDirection: "row", gap: space[2] }} accessibilityRole="radiogroup">
            {REMIND_MINUTES.map((m) => (
              <Pill key={m} compact label={t("news.alerts.minutes", { m })} selected={minutes === m} onPress={() => (m !== minutes && canEdit && !busy ? void save({ highImpact: true, currencies: state?.currencies ?? [], minutes: m }) : undefined)} style={{ flex: 1, alignItems: "center" }} />
            ))}
          </View>
        ) : null}
        <Text variant="caption" tone="tertiary">
          {t("news.alerts.reminders", { count: reminders })}
        </Text>
      </View>
    </Sheet>
  );
});
