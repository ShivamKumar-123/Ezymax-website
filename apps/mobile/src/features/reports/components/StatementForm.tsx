// "Generate a statement": period (day / month / year / custom), format (PDF / Excel / CSV), sections to include,
// then Download. The period rules are the Client Area's (server days, [from, to)).
import * as React from "react";
import { Platform, Switch, View } from "react-native";
import { CalendarDays, FileSpreadsheet, FileText, Sheet as SheetIcon } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { Button, PillRow, PressableScale, Text, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { isoDay, monthsSince, statementRange, yearsSince } from "../api";
import type { ReportAccount, StFormat, StOptions, StPeriod } from "../types";
import type { StatementRequest } from "../useStatementDownload";
import { Label } from "./Chrome";
import { DateSheet } from "./DateSheet";

export const FORMATS: { key: StFormat; label: string; note: "portfolio.st.format.pdf" | "portfolio.st.format.xlsx" | "portfolio.st.format.csv"; Icon: typeof FileText }[] = [
  { key: "pdf", label: "PDF", note: "portfolio.st.format.pdf", Icon: FileText },
  { key: "xlsx", label: "Excel", note: "portfolio.st.format.xlsx", Icon: FileSpreadsheet },
  { key: "csv", label: "CSV", note: "portfolio.st.format.csv", Icon: SheetIcon },
];

type Props = { account: ReportAccount; busy: string | null; onDownload: (r: StatementRequest) => void };

export function StatementForm({ account, busy, onDownload }: Props) {
  const t = useT();
  const fmt = useFormat();
  const today = isoDay(new Date());
  const [period, setPeriod] = React.useState<StPeriod>("month");
  const [day, setDay] = React.useState(today);
  const [month, setMonth] = React.useState(today.slice(0, 7));
  const [year, setYear] = React.useState(today.slice(0, 4));
  const [from, setFrom] = React.useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = React.useState(today);
  const [format, setFormat] = React.useState<StFormat>("pdf");
  const [opts, setOpts] = React.useState<StOptions>({ open: true, charges: true, deals: true });
  const daySheet = React.useRef<SheetRef>(null);
  const fromSheet = React.useRef<SheetRef>(null);
  const toSheet = React.useRef<SheetRef>(null);

  const created = account.createdAt ? isoDay(new Date(account.createdAt)) : undefined;
  const months = React.useMemo(() => monthsSince(account.createdAt, today), [account.createdAt, today]);
  const years = React.useMemo(() => yearsSince(account.createdAt, today), [account.createdAt, today]);
  const range = statementRange({ period, day, month, year, from, to });
  const dayLabel = (d: string) => fmt.date(`${d}T00:00:00Z`, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const shortDay = (d: string) => fmt.date(`${d}T00:00:00Z`, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const monthLabel = (m: string) => fmt.date(`${m}-01T00:00:00Z`, { month: "long", year: "numeric", timeZone: "UTC" });
  const periodLabel = period === "day" ? dayLabel(day) : period === "month" ? monthLabel(month) : period === "year" ? t("portfolio.st.yearLabel", { year }) : range ? t("portfolio.st.rangeLabel", { from: shortDay(from), to: shortDay(to) }) : "";
  const current = FORMATS.find((f) => f.key === format)!;
  const key = `form-${format}`;

  return (
    <View style={{ gap: space[5], paddingTop: space[6] }}>
      <View style={{ gap: space[3] }}>
        <Label style={{ marginHorizontal: GUTTER }}>{t("portfolio.st.period")}</Label>
        <PillRow<StPeriod>
          value={period}
          onChange={setPeriod}
          contentPadding={GUTTER}
          items={[
            { key: "day", label: t("portfolio.st.period.day") },
            { key: "month", label: t("portfolio.st.period.month") },
            { key: "year", label: t("portfolio.st.period.year") },
            { key: "custom", label: t("portfolio.st.period.custom") },
          ]}
        />
        {period === "month" ? (
          <PillRow compact value={month} onChange={setMonth} contentPadding={GUTTER} items={months.map((m) => ({ key: m, label: fmt.date(`${m}-01T00:00:00Z`, { month: "short", year: "numeric", timeZone: "UTC" }) }))} />
        ) : period === "year" ? (
          <PillRow compact value={year} onChange={setYear} contentPadding={GUTTER} items={years.map((y) => ({ key: y, label: y === today.slice(0, 4) ? `${y} · ${t("portfolio.st.ytd")}` : y }))} />
        ) : period === "day" ? (
          <View style={{ paddingHorizontal: GUTTER }}>
            <DateField label={t("mobileReports.st.day")} value={dayLabel(day)} onPress={() => daySheet.current?.present()} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: GUTTER, flexDirection: "row", gap: space[3] }}>
            <View style={{ flex: 1 }}>
              <DateField label={t("portfolio.st.from")} value={shortDay(from)} onPress={() => fromSheet.current?.present()} />
            </View>
            <View style={{ flex: 1 }}>
              <DateField label={t("portfolio.st.to")} value={shortDay(to)} invalid={from > to} onPress={() => toSheet.current?.present()} />
            </View>
          </View>
        )}
      </View>

      <View style={{ gap: space[3], paddingHorizontal: GUTTER }}>
        <Label>{t("portfolio.st.formatLabel")}</Label>
        <View style={{ flexDirection: "row", gap: space[2] }} accessibilityRole="radiogroup">
          {FORMATS.map((f) => {
            const on = f.key === format;
            return (
              <PressableScale
                key={f.key}
                onPress={() => setFormat(f.key)}
                haptics="select"
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${f.label}. ${t(f.note)}`}
                style={{ flex: 1, height: 84, borderRadius: radius.lg, padding: space[3], justifyContent: "space-between", backgroundColor: on ? colors.cream : colors.surface, borderWidth: 1, borderColor: on ? colors.cream : colors.line }}
              >
                <f.Icon size={20} color={on ? colors.ink : colors.text2} strokeWidth={1.75} />
                <Text variant="headline" weight="700" color={on ? colors.ink : colors.text}>
                  {f.label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        <Text variant="caption" tone="tertiary">
          {t(current.note)}
        </Text>
      </View>

      <View style={{ paddingHorizontal: GUTTER, gap: space[1] }}>
        <Label style={{ marginBottom: space[2] }}>{t("mobileReports.st.include")}</Label>
        <Option label={t("portfolio.st.opt.open")} value={opts.open} onChange={(v) => setOpts((o) => ({ ...o, open: v }))} />
        <Option label={t("portfolio.st.opt.charges")} value={opts.charges} onChange={(v) => setOpts((o) => ({ ...o, charges: v }))} />
        <Option label={t("portfolio.st.opt.deals")} value={opts.deals} onChange={(v) => setOpts((o) => ({ ...o, deals: v }))} />
      </View>

      <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
        <Text variant="caption" tone={range ? "secondary" : "down"} align="center" accessibilityLiveRegion="polite">
          {range ? t("mobileReports.st.summary", { login: account.login, period: periodLabel, format: current.label }) : t("portfolio.st.invalidPeriod")}
        </Text>
        <Button
          label={busy === key ? t("mobileReports.st.preparing") : t("portfolio.st.download")}
          loading={busy === key}
          disabled={!range || (!!busy && busy !== key)}
          onPress={() => range && onDownload({ key, login: account.login, from: range.from, to: range.to, format, opts })}
          testID="statement-download"
        />
      </View>

      <DateSheet ref={daySheet} title={t("mobileReports.st.pickDay")} value={day} min={created} max={today} onSelect={(d) => (setDay(d), daySheet.current?.dismiss())} />
      <DateSheet ref={fromSheet} title={t("mobileReports.st.pickFrom")} value={from} min={created} max={today} onSelect={(d) => (setFrom(d), fromSheet.current?.dismiss())} />
      <DateSheet ref={toSheet} title={t("mobileReports.st.pickTo")} value={to} min={created} max={today} onSelect={(d) => (setTo(d), toSheet.current?.dismiss())} />
    </View>
  );
}

function DateField({ label, value, invalid, onPress }: { label: string; value: string; invalid?: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      haptics="select"
      scaleTo={0.985}
      accessibilityLabel={`${label}: ${value}`}
      style={{ height: 56, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: invalid ? colors.down : colors.line, paddingHorizontal: space[4], flexDirection: "row", alignItems: "center", gap: space[3] }}
    >
      <CalendarDays size={18} color={colors.text3} strokeWidth={1.75} />
      <View style={{ flex: 1 }}>
        <Label>{label}</Label>
        <Text variant="callout" weight="600" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {value}
        </Text>
      </View>
    </PressableScale>
  );
}

/** react-native-web's switch has its own "on" colours (teal by default). */
const WEB_SWITCH = Platform.OS === "web" ? ({ activeThumbColor: colors.cream, activeTrackColor: colors.ember } as object) : {};

function Option({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const toggle = () => {
    haptic.select();
    onChange(!value);
  };
  return (
    <PressableScale
      onPress={toggle}
      scaleTo={1}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}
    >
      <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
        {label}
      </Text>
      {/* the switch keeps its own geometry in right-to-left layouts (the web one splits apart otherwise) */}
      <View style={{ direction: "ltr" }}>
        <Switch
          value={value}
          onValueChange={(v) => {
            haptic.select();
            onChange(v);
          }}
          trackColor={{ false: colors.surface3, true: colors.ember }}
          thumbColor={colors.cream}
          ios_backgroundColor={colors.surface3}
          {...WEB_SWITCH}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
    </PressableScale>
  );
}
