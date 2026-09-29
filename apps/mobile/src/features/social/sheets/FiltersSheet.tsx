// Leaderboard filters (sort, programme, risk score, track record) in a bottom sheet. Each chip applies at once
// (the list behind updates); the choice is kept on this phone.
import * as React from "react";
import { View } from "react-native";
import { useT, type MessageKey } from "@/i18n";
import { Button, Display, Pill, Sheet, Text, type SheetRef } from "@/ui";
import { space } from "@/theme/tokens";
import type { LbProgram, LbRisk, LbSort } from "../api";
import { DEFAULT_FILTERS, setFilters, useFilters } from "../state";

const SORTS: [LbSort, MessageKey][] = [
  ["return", "mobileSocial.lb.sort.return"],
  ["dd", "mobileSocial.lb.sort.dd"],
  ["aum", "mobileSocial.lb.sort.aum"],
  ["followers", "mobileSocial.lb.sort.followers"],
  ["age", "mobileSocial.lb.sort.age"],
];
const PROGRAMS: [LbProgram, MessageKey][] = [
  ["all", "mobileSocial.lb.program.all"],
  ["copy", "mobileSocial.lb.program.copy"],
  ["pamm", "mobileSocial.lb.program.pamm"],
];
const RISKS: [LbRisk, MessageKey][] = [
  ["all", "mobileSocial.lb.risk.all"],
  ["low", "mobileSocial.lb.risk.low"],
  ["med", "mobileSocial.lb.risk.med"],
  ["high", "mobileSocial.lb.risk.high"],
];
const TRACKS: [number, MessageKey][] = [
  [0, "mobileSocial.lb.track.any"],
  [30, "mobileSocial.lb.track.30"],
  [90, "mobileSocial.lb.track.90"],
  [180, "mobileSocial.lb.track.180"],
  [365, "mobileSocial.lb.track.365"],
];

function Group<K extends string | number>({ title, items, value, onChange }: { title: string; items: [K, MessageKey][]; value: K; onChange: (k: K) => void }) {
  const t = useT();
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="label" tone="tertiary">
        {title}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }} accessibilityRole="radiogroup">
        {items.map(([k, label]) => (
          <Pill key={String(k)} compact label={t(label)} selected={k === value} onPress={() => onChange(k)} />
        ))}
      </View>
    </View>
  );
}

export const FiltersSheet = React.forwardRef<SheetRef, object>(function FiltersSheet(_props, ref) {
  const t = useT();
  const f = useFilters();
  const close = () => (ref as React.RefObject<SheetRef | null>)?.current?.dismiss();
  return (
    <Sheet ref={ref}>
      <View style={{ gap: space[5], paddingTop: space[2] }}>
        <Display size="md">{t("mobileSocial.lb.filters")}</Display>
        <Group title={t("mobileSocial.lb.sortBy")} items={SORTS} value={f.sort} onChange={(sort) => setFilters({ sort })} />
        <Group title={t("mobileSocial.lb.programme")} items={PROGRAMS} value={f.program} onChange={(program) => setFilters({ program })} />
        <Group title={t("mobileSocial.lb.riskScore")} items={RISKS} value={f.risk} onChange={(risk) => setFilters({ risk })} />
        <Group title={t("mobileSocial.lb.track")} items={TRACKS} value={f.minDays} onChange={(minDays) => setFilters({ minDays })} />
        <View style={{ flexDirection: "row", gap: space[3], marginTop: space[1] }}>
          <Button
            label={t("mobileSocial.lb.clearFilters")}
            variant="ghost"
            size="md"
            style={{ flex: 1, paddingHorizontal: space[3] }}
            onPress={() => setFilters({ ...DEFAULT_FILTERS, period: f.period })}
          />
          <Button label={t("common.done")} size="md" style={{ flex: 1, paddingHorizontal: space[3] }} onPress={close} />
        </View>
      </View>
    </Sheet>
  );
});
