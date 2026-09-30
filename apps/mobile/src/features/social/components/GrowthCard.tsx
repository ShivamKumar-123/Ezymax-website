// Growth of $10,000 (time-weighted equity index) or a NAV history, on the Skia chart. While the finger scrubs, the
// index under it goes into a tiny store that only the header subscribes to: the canvas and the rest of the card
// never re-render during a scrub.
import * as React from "react";
import { View } from "react-native";
import { useFormat, useT } from "@/i18n";
import { createStore, useStore, type Store } from "@/lib/store";
import { Card, Mono, Pill, Text } from "@/ui";
import { colors, space } from "@/theme/tokens";
import { pct, shownTone } from "../format";
import { Chart } from "./chart/Chart";
import { Tag, type TagTone } from "./primitives";

export type Point = { t: number; v: number };
type Range = "1m" | "3m" | "1y" | "all";
const DAYS: Record<Range, number> = { "1m": 31, "3m": 92, "1y": 366, all: Infinity };
const RANGES = Object.keys(DAYS) as Range[];
const RANGE_KEY = { "1m": "mobileSocial.lb.period.1m", "3m": "mobileSocial.lb.period.3m", "1y": "mobileSocial.lb.period.1y", all: "mobileSocial.lb.period.all" } as const;

const MemoChart = React.memo(Chart);

export function GrowthCard({
  title,
  hint,
  points,
  format,
  emptyTitle,
  emptyText,
  testID,
}: {
  title: string;
  hint: string;
  points: Point[];
  format: (v: number) => string;
  emptyTitle: string;
  emptyText: string;
  testID?: string;
}) {
  const t = useT();
  const [range, setRange] = React.useState<Range>("all");
  const scrub = React.useMemo(() => createStore<number | null>(null), []);

  const shown = React.useMemo(() => {
    if (!points.length || range === "all") return points;
    const cut = points[points.length - 1]!.t - DAYS[range] * 86_400_000;
    const inRange = points.filter((p) => p.t >= cut);
    return inRange.length >= 2 ? inRange : points.slice(-2);
  }, [points, range]);
  const values = React.useMemo(() => shown.map((p) => p.v), [shown]);

  if (points.length < 2) {
    return (
      <Card testID={testID}>
        <Text variant="label" tone="tertiary">
          {title}
        </Text>
        <View style={{ paddingVertical: space[6], gap: space[2] }}>
          <Text variant="headline" weight="700">
            {emptyTitle}
          </Text>
          <Text variant="callout" tone="tertiary">
            {emptyText}
          </Text>
        </View>
      </Card>
    );
  }

  const first = shown[0]!.v;
  const last = shown[shown.length - 1]!.v;
  const lineColor = last > first ? colors.up : last < first ? colors.down : colors.text2;
  return (
    <Card testID={testID} padded={false}>
      <Header title={title} hint={hint} shown={shown} format={format} scrub={scrub} rangeLabel={t(RANGE_KEY[range])} />
      <MemoChart values={values} height={200} color={lineColor} baseline={first} onScrub={scrub.set} accessibilityLabel={`${title}: ${format(last)}, ${pct(first ? (last / first - 1) * 100 : 0)}`} />
      <View style={{ flexDirection: "row", gap: space[2], padding: space[4], paddingTop: space[3] }} accessibilityRole="tablist">
        {RANGES.map((r) => (
          <Pill key={r} compact label={t(RANGE_KEY[r])} selected={range === r} onPress={() => setRange(r)} />
        ))}
      </View>
    </Card>
  );
}

const tagTone = (change: number): TagTone => {
  const tone = shownTone(change);
  return tone === "secondary" ? "neutral" : tone;
};

/** The value (and date) under the finger, else the latest one: the only part that re-renders while scrubbing. */
function Header({ title, hint, shown, format, scrub, rangeLabel }: { title: string; hint: string; shown: Point[]; format: (v: number) => string; scrub: Store<number | null>; rangeLabel: string }) {
  const fmt = useFormat();
  const i = useStore(scrub);
  const first = shown[0]!.v;
  const at = i !== null ? (shown[i] ?? shown[shown.length - 1]!) : shown[shown.length - 1]!;
  const change = first ? (at.v / first - 1) * 100 : 0;
  return (
    <View style={{ padding: space[5], paddingBottom: space[3], gap: space[1] }}>
      <Text variant="label" tone="tertiary">
        {title}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], flexWrap: "wrap" }}>
        <Mono size={30} weight="bold" style={{ letterSpacing: -0.5 }}>
          {format(at.v)}
        </Mono>
        <Tag tone={tagTone(change)} label={`${pct(change)} · ${rangeLabel}`} />
      </View>
      <Text variant="caption" tone="tertiary">
        {i !== null ? fmt.date(at.t, { day: "numeric", month: "short", year: "numeric" }) : hint}
      </Text>
    </View>
  );
}
