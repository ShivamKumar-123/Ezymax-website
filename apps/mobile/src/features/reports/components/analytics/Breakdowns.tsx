// Analytics breakdowns: by symbol (diverging bars), weekday and hour of the close (columns around a zero line, plus
// the weekday × hour heatmap), session of the open, and long vs short. Net P&L after charges, USD, server time.
// Plain views (no animation): they mount only when scrolled near, and a tap updates a single detail line.
import * as React from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { Card, Display, Mono, PressableScale, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { compactUsd, DAY_KEYS, sessionName, usd } from "../../format";
import { tint } from "../../tint";
import type { Analytics, Group, Stats } from "../../types";
import { SectionTitle, Tag } from "../Chrome";

const up = tint(colors.up, 0.85);
const down = tint(colors.down, 0.85);
const COL_ON = tint(colors.cream, 0.06);
const moneyTone = (v: number): "up" | "down" | "tertiary" => (v > 0 ? "up" : v < 0 ? "down" : "tertiary");

/* ------------------------------------------------------------------ */
/* By symbol                                                           */
/* ------------------------------------------------------------------ */

const SYMBOLS_COLLAPSED = 8;

export const BySymbol = React.memo(function BySymbol({ rows }: { rows: Group[] }) {
  const t = useT();
  const [all, setAll] = React.useState(false);
  const max = rows.reduce((m, g) => Math.max(m, Math.abs(g.net)), 0) || 1;
  const shown = all ? rows : rows.slice(0, SYMBOLS_COLLAPSED);
  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <SectionTitle title={t("portfolio.an.symbol.title")} subtitle={t("portfolio.an.symbol.subtitle")} />
      <Card padded={false} style={{ paddingHorizontal: space[4], paddingVertical: space[2] }}>
        {rows.length === 0 ? (
          <Text variant="callout" tone="tertiary" style={{ paddingVertical: space[4] }}>
            {t("portfolio.an.symbol.empty")}
          </Text>
        ) : (
          shown.map((g, i) => (
            <View
              key={g.key}
              accessible
              accessibilityLabel={`${g.key}: ${usd(g.net, true)}, ${t("portfolio.an.symbol.sub", { count: g.trades, rate: Math.round(g.winRate) })}`}
              style={{ height: 56, flexDirection: "row", alignItems: "center", gap: space[3], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}
            >
              <View style={{ width: 92, gap: 2 }}>
                <Mono size={13.5} weight="bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  {g.key}
                </Mono>
                <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ fontSize: 11 }}>
                  {t("portfolio.an.symbol.sub", { count: g.trades, rate: Math.round(g.winRate) })}
                </Text>
              </View>
              {/* diverging bar: losses grow to the start side, profits to the end side of the centre line */}
              <View style={{ flex: 1, height: 10, flexDirection: "row" }}>
                <View style={{ flex: 1, alignItems: "flex-end" }}>{g.net < 0 ? <View style={{ width: `${(Math.abs(g.net) / max) * 100}%`, minWidth: 3, height: 10, borderRadius: 3, backgroundColor: down }} /> : null}</View>
                <View style={{ width: 1, height: 18, marginTop: -4, backgroundColor: colors.lineStrong }} />
                <View style={{ flex: 1 }}>{g.net > 0 ? <View style={{ width: `${(g.net / max) * 100}%`, minWidth: 3, height: 10, borderRadius: 3, backgroundColor: up }} /> : null}</View>
              </View>
              <Mono size={13.5} weight="medium" tone={moneyTone(g.net)} align="right" style={{ width: 84 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {usd(g.net, true)}
              </Mono>
            </View>
          ))
        )}
        {rows.length > SYMBOLS_COLLAPSED ? (
          <PressableScale onPress={() => setAll((x) => !x)} haptics="select" scaleTo={1} style={{ minHeight: 44, justifyContent: "center", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.line }}>
            <Text variant="callout" weight="700" tone="ember">
              {all ? t("common.showLess") : t("common.showMore")}
            </Text>
          </PressableScale>
        ) : null}
      </Card>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* Columns around a zero line (weekday, hour)                          */
/* ------------------------------------------------------------------ */

type Col = { key: string; label: string; net: number; trades: number; winRate?: number };

function Columns({ cols, height, barW, values = true, selected, onSelect }: { cols: Col[]; height: number; barW: number; values?: boolean; selected: number | null; onSelect: (i: number) => void }) {
  const maxPos = cols.reduce((m, c) => Math.max(m, c.net), 0);
  const maxNeg = cols.reduce((m, c) => Math.max(m, -c.net), 0);
  const total = maxPos + maxNeg || 1;
  const pad = values ? 16 : 0;
  const plot = height - pad * 2;
  const base = pad + plot * (maxPos / total);
  return (
    <View style={{ height, flexDirection: "row" }}>
      <View pointerEvents="none" style={{ position: "absolute", start: 0, end: 0, top: base, height: 1, backgroundColor: colors.lineStrong }} />
      {cols.map((c, i) => {
        const h = Math.max(c.net ? 2 : 0, (Math.abs(c.net) / total) * plot);
        const on = selected === i;
        return (
          <Pressable
            key={c.key}
            onPress={() => {
              haptic.select();
              onSelect(i);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${c.label}: ${usd(c.net, true)}`}
            style={{ flex: 1, alignItems: "center" }}
          >
            {values && c.trades ? (
              <Mono size={9.5} tone={moneyTone(c.net)} numberOfLines={1} style={{ position: "absolute", top: c.net >= 0 ? base - h - 14 : base + h + 2 }}>
                {compactUsd(c.net)}
              </Mono>
            ) : null}
            <View
              style={{
                position: "absolute",
                top: c.net >= 0 ? base - h : base + 1,
                width: barW,
                height: h,
                borderRadius: Math.min(4, barW / 2),
                backgroundColor: c.net > 0 ? up : down,
                opacity: selected === null || on ? 1 : 0.4,
              }}
            />
            {on ? <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, width: barW + 8, borderRadius: 6, backgroundColor: COL_ON }} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function Detail({ col, fallback }: { col: Col | null; fallback: string }) {
  const t = useT();
  return (
    <View style={{ minHeight: 40, justifyContent: "center", borderTopWidth: 1, borderTopColor: colors.line, marginTop: space[2] }} accessibilityLiveRegion="polite">
      {col ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Text variant="callout" style={{ flex: 1 }} numberOfLines={1}>
            {col.label}
            <Text variant="callout" tone="tertiary">
              {` · ${t("portfolio.trades", { count: col.trades })}${col.winRate !== undefined && col.trades ? ` · ${t("portfolio.an.session.win", { rate: Math.round(col.winRate) })}` : ""}`}
            </Text>
          </Text>
          <Mono size={15} weight="bold" tone={moneyTone(col.net)}>
            {usd(col.net, true)}
          </Mono>
        </View>
      ) : (
        <Text variant="caption" tone="tertiary">
          {fallback}
        </Text>
      )}
    </View>
  );
}

export const ByWeekday = React.memo(function ByWeekday({ rows }: { rows: Group[] }) {
  const t = useT();
  const [sel, setSel] = React.useState<number | null>(null);
  const cols: Col[] = DAY_KEYS.map((k, i) => {
    const g = rows.find((x) => x.key === String(i));
    return { key: k, label: t(k), net: g?.net ?? 0, trades: g?.trades ?? 0, winRate: g?.winRate };
  });
  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <SectionTitle title={t("portfolio.an.weekday.title")} subtitle={t("portfolio.an.weekday.subtitle")} />
      <Card padded={false} style={{ padding: space[4] }}>
        <Columns cols={cols} height={150} barW={22} selected={sel} onSelect={(i) => setSel((s) => (s === i ? null : i))} />
        <View style={{ flexDirection: "row", marginTop: space[2] }}>
          {cols.map((c) => (
            <Text key={c.key} variant="label" tone="tertiary" align="center" style={{ flex: 1, fontSize: 10 }}>
              {c.label}
            </Text>
          ))}
        </View>
        <Detail col={sel === null ? null : cols[sel]!} fallback={t("mobileReports.an.tapBar")} />
      </Card>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* By hour (+ weekday × hour heatmap)                                  */
/* ------------------------------------------------------------------ */

const HOUR_TICKS = [0, 6, 12, 18, 23];

export const ByHour = React.memo(function ByHour({ heat, trades }: { heat: number[][]; trades?: number[][] }) {
  const t = useT();
  const { width } = useWindowDimensions();
  const inner = width - GUTTER * 2 - space[4] * 2;
  const [sel, setSel] = React.useState<{ kind: "hour"; h: number } | { kind: "cell"; d: number; h: number } | null>(null);
  const hours: Col[] = React.useMemo(
    () =>
      Array.from({ length: 24 }, (_, h) => {
        let net = 0;
        let n = 0;
        for (let d = 0; d < 7; d++) {
          net += heat[d]?.[h] ?? 0;
          n += trades?.[d]?.[h] ?? 0;
        }
        return { key: String(h), label: `${String(h).padStart(2, "0")}:00`, net: Math.round(net * 100) / 100, trades: n };
      }),
    [heat, trades],
  );
  const maxAbs = React.useMemo(() => heat.reduce((m, r) => r.reduce((a, v) => Math.max(a, Math.abs(v)), m), 0) || 1, [heat]);
  const labelW = 30;
  const cell = (inner - labelW) / 24;
  const gap = 2;
  const gridH = cell * 7;
  const best = React.useMemo(() => {
    let b: { d: number; h: number; v: number } | null = null;
    heat.forEach((r, d) => r.forEach((v, h) => ((trades?.[d]?.[h] ?? 0) > 0 && v > 0 && (!b || v > b.v) ? (b = { d, h, v }) : null)));
    return b as { d: number; h: number; v: number } | null;
  }, [heat, trades]);

  // one tap handler for the whole grid (168 cells stay plain views); coordinates are relative to the grid
  const pickCell = React.useCallback(
    (x: number, y: number) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const h = Math.max(0, Math.min(23, Math.floor(x / cell)));
      const d = Math.max(0, Math.min(6, Math.floor(y / cell)));
      haptic.select();
      setSel((s) => (s && s.kind === "cell" && s.d === d && s.h === h ? null : { kind: "cell", d, h }));
    },
    [cell],
  );
  const gridTap = React.useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onEnd((e) => pickCell(e.x, e.y)),
    [pickCell],
  );

  const detail: Col | null = sel === null ? null : sel.kind === "hour" ? hours[sel.h]! : { key: "c", label: `${t(DAY_KEYS[sel.d]!)} ${String(sel.h).padStart(2, "0")}:00`, net: heat[sel.d]?.[sel.h] ?? 0, trades: trades?.[sel.d]?.[sel.h] ?? 0 };

  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <SectionTitle title={t("portfolio.an.hour.title")} subtitle={t("portfolio.an.hour.subtitle")} right={best ? <Tag label={t("portfolio.an.hour.best", { day: t(DAY_KEYS[best.d]!), hour: String(best.h).padStart(2, "0") })} tone="mint" /> : undefined} />
      <Card padded={false} style={{ padding: space[4] }}>
        <Text variant="label" tone="tertiary" style={{ fontSize: 10, marginBottom: space[2] }}>
          {t("mobileReports.an.hour.byHour")}
        </Text>
        {/* time runs left to right in every language (like the equity curve) */}
        <View style={{ direction: "ltr" }}>
          <Columns cols={hours} height={104} barW={Math.max(3, inner / 24 - 4)} values={false} selected={sel?.kind === "hour" ? sel.h : null} onSelect={(h) => setSel((s) => (s?.kind === "hour" && s.h === h ? null : { kind: "hour", h }))} />
          <View style={{ height: 16, marginTop: space[1] }}>
            {HOUR_TICKS.map((h) => (
              <Mono key={h} size={9.5} tone="tertiary" align="center" style={{ position: "absolute", start: h * (inner / 24) + inner / 48 - 9, width: 18 }}>
                {String(h).padStart(2, "0")}
              </Mono>
            ))}
          </View>
        </View>

        <Text variant="label" tone="tertiary" style={{ fontSize: 10, marginTop: space[4], marginBottom: space[2] }}>
          {t("mobileReports.an.hour.byDayHour")}
        </Text>
        <View style={{ flexDirection: "row", direction: "ltr" }}>
          <View style={{ width: labelW }}>
            {DAY_KEYS.map((k) => (
              <Text key={k} variant="caption" tone="tertiary" style={{ height: cell, fontSize: 9, lineHeight: cell }} numberOfLines={1}>
                {t(k)}
              </Text>
            ))}
          </View>
          <GestureDetector gesture={gridTap}>
            <View accessible accessibilityRole="button" accessibilityLabel={t("mobileReports.an.hour.byDayHour")} style={{ width: cell * 24, height: gridH }}>
              {heat.slice(0, 7).map((r, d) => (
                <View key={d} style={{ flexDirection: "row", height: cell }}>
                  {Array.from({ length: 24 }, (_, h) => {
                    const v = r[h] ?? 0;
                    const n = trades?.[d]?.[h] ?? 0;
                    const a = 0.2 + 0.7 * Math.min(1, Math.abs(v) / maxAbs);
                    const on = sel?.kind === "cell" && sel.d === d && sel.h === h;
                    return (
                      <View
                        key={h}
                        style={{
                          width: cell - gap,
                          height: cell - gap,
                          marginEnd: gap,
                          borderRadius: 2,
                          backgroundColor: n === 0 || v === 0 ? colors.surface2 : tint(v > 0 ? colors.up : colors.down, a),
                          borderWidth: on ? 1 : 0,
                          borderColor: colors.cream,
                        }}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </GestureDetector>
        </View>
        <Detail col={detail} fallback={t("mobileReports.an.hour.tap")} />
      </Card>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* By session                                                          */
/* ------------------------------------------------------------------ */

export const BySession = React.memo(function BySession({ rows }: { rows: Analytics["bySession"] }) {
  const t = useT();
  const sorted = React.useMemo(() => [...rows].sort((a, b) => b.net - a.net), [rows]);
  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <SectionTitle title={t("portfolio.an.session.title")} subtitle={t("portfolio.an.session.subtitle")} />
      <Card padded={false} style={{ paddingHorizontal: space[4] }}>
        {sorted.map((x, i) => {
          const best = i === 0 && x.net > 0;
          return (
            <View
              key={x.session}
              accessible
              accessibilityLabel={`${sessionName(t, x.session)}: ${usd(x.net, true)}`}
              style={{ minHeight: 64, paddingVertical: space[3], flexDirection: "row", alignItems: "center", gap: space[3], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                  <Text variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {sessionName(t, x.session)}
                  </Text>
                  {best ? <Tag label={t("mobileReports.an.session.best")} tone="gold" /> : null}
                </View>
                <Mono size={11} tone="tertiary" numberOfLines={1}>
                  {`${x.hours} · ${t("portfolio.trades", { count: x.trades })}`}
                </Mono>
              </View>
              <View style={{ alignItems: "flex-end", gap: 3 }}>
                <Mono size={15} weight="bold" tone={moneyTone(x.net)}>
                  {usd(x.net, true)}
                </Mono>
                <Text variant="caption" tone="tertiary">
                  {x.trades ? t("portfolio.an.session.win", { rate: Math.round(x.winRate) }) : "—"}
                </Text>
              </View>
            </View>
          );
        })}
      </Card>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* Long vs short                                                       */
/* ------------------------------------------------------------------ */

export const LongShort = React.memo(function LongShort({ all, long, short }: { all: Stats; long: Stats; short: Stats }) {
  const t = useT();
  const total = Math.max(1, all.trades);
  const lp = Math.round((long.trades / total) * 100);
  const sp = Math.round((short.trades / total) * 100);
  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <SectionTitle title={t("portfolio.an.side.title")} subtitle={t("mobileReports.an.side.split", { long: t("portfolio.an.side.longPct", { value: lp }), short: t("portfolio.an.side.shortPct", { value: sp }) })} />
      <View style={{ height: 10, borderRadius: radius.pill, overflow: "hidden", flexDirection: "row", backgroundColor: colors.surface3, marginBottom: space[3] }}>
        <View style={{ width: `${(long.trades / total) * 100}%`, backgroundColor: colors.up }} />
        <View style={{ width: `${(short.trades / total) * 100}%`, backgroundColor: colors.down, borderStartWidth: long.trades && short.trades ? 2 : 0, borderColor: colors.bg }} />
      </View>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        {(
          [
            [t("portfolio.an.side.long"), long, "up"],
            [t("portfolio.an.side.short"), short, "down"],
          ] as const
        ).map(([k, st, tone]) => (
          <Card key={k} padded={false} style={{ flex: 1, padding: space[4], gap: space[2] }} accessible accessibilityLabel={`${k}: ${usd(st.net, true)}, ${t("portfolio.trades", { count: st.trades })}`}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text variant="label" color={tone === "up" ? colors.up : colors.down}>
                {k.toUpperCase()}
              </Text>
              <Mono size={11} tone="tertiary">
                {t("portfolio.trades", { count: st.trades })}
              </Mono>
            </View>
            <Display size="md" color={st.net > 0 ? colors.up : st.net < 0 ? colors.down : colors.text} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {usd(st.net, true)}
            </Display>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {t("portfolio.an.side.winPf", { rate: st.winRate.toFixed(0), pf: st.profitFactor === null ? (st.wins ? "∞" : "—") : st.profitFactor.toFixed(2) })}
            </Text>
          </Card>
        ))}
      </View>
    </View>
  );
});
