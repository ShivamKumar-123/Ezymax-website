// Monthly returns as a phone-sized heat grid: one block per year (4 × 3 months), the cell tint grows with the
// size of the month's return (green / red: money).
import * as React from "react";
import { View } from "react-native";
import { useFormat, useT } from "@/i18n";
import { Mono, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { pct } from "../format";
import { StatGrid } from "./primitives";

type Month = { month: string; returnPct: number };

export const MonthlyGrid = React.memo(function MonthlyGrid({ monthly }: { monthly: Month[] }) {
  const t = useT();
  const fmt = useFormat();
  const parsed = React.useMemo(
    () =>
      monthly
        .map((m) => ({ year: Number(m.month.slice(0, 4)), month: Number(m.month.slice(5, 7)) - 1, ret: m.returnPct }))
        .filter((m) => Number.isFinite(m.year) && m.month >= 0 && m.month < 12 && Number.isFinite(m.ret)),
    [monthly],
  );
  const years = React.useMemo(() => Array.from(new Set(parsed.map((x) => x.year))).sort((a, b) => b - a), [parsed]);
  const monthName = React.useCallback((mo: number) => fmt.date(Date.UTC(2000, mo, 15), { month: "short", timeZone: "UTC" }), [fmt]);

  if (!parsed.length) {
    return (
      <Text variant="callout" tone="tertiary" style={{ paddingVertical: space[4] }}>
        {t("mobileSocial.master.monthlyEmpty")}
      </Text>
    );
  }

  const best = parsed.reduce((a, b) => (b.ret > a.ret ? b : a));
  const worst = parsed.reduce((a, b) => (b.ret < a.ret ? b : a));
  const positive = parsed.filter((x) => x.ret > 0).length;

  return (
    <View style={{ gap: space[5] }}>
      {years.map((y) => {
        const cells = parsed.filter((x) => x.year === y);
        const ytd = (cells.reduce((acc, x) => acc * (1 + x.ret / 100), 1) - 1) * 100;
        return (
          <View key={y} style={{ gap: space[2] }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
              <Mono size={15} weight="bold">
                {String(y)}
              </Mono>
              <Mono size={15} weight="bold" tone={ytd > 0 ? "up" : ytd < 0 ? "down" : "secondary"}>
                {pct(ytd, 1)}
              </Mono>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, direction: "ltr" }}>
              {Array.from({ length: 12 }, (_, mo) => {
                const c = cells.find((x) => x.month === mo);
                const a = c ? Math.min(1, Math.abs(c.ret) / 8) : 0;
                const flat = !c || c.ret === 0;
                const bg = flat ? colors.surface2 : c.ret > 0 ? `rgba(52,199,123,${0.1 + a * 0.5})` : `rgba(240,82,82,${0.1 + a * 0.5})`;
                const fg = !c ? colors.text3 : flat ? colors.text2 : a > 0.55 ? colors.text : c.ret > 0 ? colors.up : colors.down;
                return (
                  <View
                    key={mo}
                    accessible
                    accessibilityLabel={`${monthName(mo)} ${y}: ${c ? pct(c.ret) : "—"}`}
                    style={{ width: "23.5%", flexGrow: 1, height: 52, borderRadius: radius.sm, backgroundColor: bg, paddingHorizontal: space[2], justifyContent: "center", gap: 2 }}
                  >
                    <Text variant="caption" color={c ? colors.text2 : colors.text3} style={{ fontSize: 11 }}>
                      {monthName(mo)}
                    </Text>
                    <Mono size={13} weight="bold" color={fg}>
                      {c ? pct(c.ret, 1) : "—"}
                    </Mono>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
      {parsed.length > 1 ? (
        <StatGrid
          columns={3}
          items={[
            { label: t("mobileSocial.master.bestMonth"), value: pct(best.ret, 1), tone: best.ret > 0 ? "up" : best.ret < 0 ? "down" : undefined, sub: `${monthName(best.month)} ${best.year}` },
            { label: t("mobileSocial.master.worstMonth"), value: pct(worst.ret, 1), tone: worst.ret > 0 ? "up" : worst.ret < 0 ? "down" : undefined, sub: `${monthName(worst.month)} ${worst.year}` },
            { label: t("mobileSocial.master.positiveMonths"), value: `${Math.round((positive / parsed.length) * 100)}%`, sub: `${positive} / ${parsed.length}` },
          ]}
        />
      ) : null}
    </View>
  );
});
