// Date picker in a bottom sheet: a Monday-first month grid with month steps, limited to [min, max]
// (the account's first day and today). 44 pt day targets.
import * as React from "react";
import { Pressable, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { Display, PressableScale, Sheet, Text, type SheetRef } from "@/ui";
import { colors, space } from "@/theme/tokens";
import { addMonths, cmpYm, monthUtc, monthWeeks, ymOf, type Ym } from "../calendar";
import { DAY_KEYS } from "../format";
import { Flip } from "./Chrome";

type Props = { title: string; value: string; min?: string; max: string; onSelect: (day: string) => void };

export const DateSheet = React.forwardRef<SheetRef, Props>(function DateSheet(props, ref) {
  return (
    <Sheet ref={ref}>
      <DateGrid {...props} />
    </Sheet>
  );
});

function DateGrid({ title, value, min, max, onSelect }: Props) {
  const t = useT();
  const fmt = useFormat();
  const [ym, setYm] = React.useState<Ym>(() => ymOf(value || max));
  const lo = min ? ymOf(min) : null;
  const hi = ymOf(max);
  const canPrev = !lo || cmpYm(ym, lo) > 0;
  const canNext = cmpYm(ym, hi) < 0;
  const weeks = React.useMemo(() => monthWeeks(ym), [ym]);
  const today = max;
  return (
    <View style={{ paddingTop: space[2] }}>
      <Text variant="label" tone="tertiary">
        {title}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: space[2], marginBottom: space[4] }}>
        <Display size="md" style={{ flex: 1 }} accessibilityRole="header" accessibilityLiveRegion="polite">
          {fmt.date(monthUtc(ym), { month: "long", year: "numeric", timeZone: "UTC" })}
        </Display>
        <View style={{ flexDirection: "row", gap: space[2] }}>
          <StepButton
            label={t("mobileReports.st.prevMonth")}
            disabled={!canPrev}
            onPress={() => setYm((x) => addMonths(x, -1))}
            icon={
              <Flip>
                <ChevronLeft size={20} color={colors.text} />
              </Flip>
            }
          />
          <StepButton
            label={t("mobileReports.st.nextMonth")}
            disabled={!canNext}
            onPress={() => setYm((x) => addMonths(x, 1))}
            icon={
              <Flip>
                <ChevronRight size={20} color={colors.text} />
              </Flip>
            }
          />
        </View>
      </View>
      <View style={{ flexDirection: "row" }}>
        {DAY_KEYS.map((k) => (
          <Text key={k} variant="label" tone="tertiary" align="center" style={{ flex: 1, fontSize: 10 }}>
            {t(k)}
          </Text>
        ))}
      </View>
      <View style={{ marginTop: space[2], gap: 2 }}>
        {weeks.map((row, i) => (
          <View key={i} style={{ flexDirection: "row" }}>
            {row.map((d, c) => {
              if (!d) return <View key={c} style={{ flex: 1, height: 44 }} />;
              const disabled = d > max || (!!min && d < min);
              const selected = d === value;
              return (
                <Pressable
                  key={d}
                  disabled={disabled}
                  onPress={() => {
                    haptic.select();
                    onSelect(d);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={fmt.date(`${d}T00:00:00Z`, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
                  style={({ pressed }) => ({ flex: 1, height: 44, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.28 : pressed ? 0.6 : 1 })}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: selected ? colors.ember : "transparent", borderWidth: d === today && !selected ? 1 : 0, borderColor: colors.lineStrong }}>
                    <Text variant="callout" weight={selected ? "700" : "500"} color={selected ? colors.ink : colors.text}>
                      {String(Number(d.slice(8)))}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Round 44 pt month step (dimmed and inert at the ends of the range). */
export function StepButton({ label, icon, disabled, onPress }: { label: string; icon: React.ReactNode; disabled?: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} haptics="select" accessibilityLabel={label} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line }}>
      {icon}
    </PressableScale>
  );
}
