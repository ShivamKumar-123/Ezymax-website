// Monthly statements: fixed-height rows (FlashList) and the sheet that downloads a month as PDF / Excel / CSV.
import * as React from "react";
import { View } from "react-native";
import { ChevronRight, Download } from "lucide-react-native";
import { useT } from "@/i18n";
import { fmtMoney } from "@/lib/format";
import { Button, ColorBlock, Display, Mono, PressableScale, Sheet, Skeleton, Text, type SheetRef } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { tint } from "../tint";
import type { MonthRow, StFormat } from "../types";
import type { StatementRequest } from "../useStatementDownload";
import { Flip, Label } from "./Chrome";
import { FORMATS } from "./StatementForm";

export const MONTH_ROW_H = 76;

const money = (v: number, currency: string, signed = false) => fmtMoney(v, { currency, signed });

export const MonthItem = React.memo(function MonthItem({ m, label, currency, onOpen }: { m: MonthRow; label: string; currency: string; onOpen: (m: MonthRow) => void }) {
  const t = useT();
  const trades = t("portfolio.closedTrades", { count: m.trades });
  const net = money(m.net, currency, true);
  return (
    <PressableScale
      onPress={() => onOpen(m)}
      scaleTo={0.985}
      accessibilityLabel={t("mobileReports.st.monthly.a11y", { month: label, net, trades })}
      style={{ height: MONTH_ROW_H, marginHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
        <Download size={18} color={colors.text2} strokeWidth={1.75} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="headline" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {trades}
        </Text>
      </View>
      <Mono size={15} weight="medium" tone={m.net > 0 ? "up" : m.net < 0 ? "down" : "tertiary"}>
        {net}
      </Mono>
      <Flip>
        <ChevronRight size={18} color={colors.text3} />
      </Flip>
    </PressableScale>
  );
});

export function MonthRowsSkeleton({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <View accessibilityLabel={label} accessible>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ height: MONTH_ROW_H, marginHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Skeleton w={44} h={44} r={22} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton w={132} h={15} />
            <Skeleton w={88} h={11} />
          </View>
          <Skeleton w={84} h={16} />
        </View>
      ))}
    </View>
  );
}

type SheetProps = { month: MonthRow | null; label: string; login: number; currency: string; busy: string | null; onDownload: (r: StatementRequest) => void };

export const MonthSheet = React.forwardRef<SheetRef, SheetProps>(function MonthSheet({ month, label, login, currency, busy, onDownload }, ref) {
  const t = useT();
  return (
    <Sheet ref={ref}>
      {month ? (
        <View style={{ gap: space[4], paddingTop: space[2] }}>
          <View style={{ gap: 2 }}>
            <Label>{`#${login}`}</Label>
            <Display size="md" accessibilityRole="header">
              {t("mobileReports.st.month.title", { month: label })}
            </Display>
            <Text variant="caption" tone="tertiary">
              {t("portfolio.closedTrades", { count: month.trades })}
            </Text>
          </View>
          <ColorBlock color="cream" padded={false} style={{ paddingHorizontal: space[5], paddingVertical: space[2] }}>
            <Figure label={t("portfolio.st.monthly.net")} value={money(month.net, currency, true)} first />
            <Figure label={t("portfolio.st.monthly.deposits")} value={money(month.deposits, currency)} />
            <Figure label={t("portfolio.st.monthly.withdrawn")} value={money(month.withdrawals, currency)} />
          </ColorBlock>
          <Label>{t("mobileReports.st.month.formats")}</Label>
          <View style={{ gap: space[2] }}>
            {FORMATS.map((f) => {
              const key = `${month.month}-${f.key}`;
              return (
                <Button
                  key={f.key}
                  variant={f.key === "pdf" ? "primary" : "secondary"}
                  size="md"
                  label={busy === key ? t("mobileReports.st.preparing") : f.label}
                  loading={busy === key}
                  disabled={!!busy && busy !== key}
                  icon={<f.Icon size={18} color={f.key === "pdf" ? colors.ink : colors.text} strokeWidth={1.75} />}
                  onPress={() => onDownload({ key, login, from: month.from, to: month.to, format: f.key as StFormat })}
                  accessibilityLabel={`${f.label}. ${t(f.note)}`}
                />
              );
            })}
          </View>
        </View>
      ) : (
        <View />
      )}
    </Sheet>
  );
});

function Figure({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: space[3], borderTopWidth: first ? 0 : 1, borderTopColor: tint(colors.ink, 0.12) }}>
      <Text variant="label" color={colors.ink2} numberOfLines={1} style={{ flex: 1, fontSize: 10.5 }}>
        {label}
      </Text>
      <Mono size={16} weight="bold" color={colors.ink} numberOfLines={1}>
        {value}
      </Mono>
    </View>
  );
}
