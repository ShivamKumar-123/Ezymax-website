// Analytics, top of the page: the net P&L hero block and the stat tiles (win rate, profit factor, Sharpe,
// drawdown, averages, holding time, streaks, best / worst trade). Huge numbers, small labels.
import * as React from "react";
import { useWindowDimensions, View } from "react-native";
import { useT } from "@/i18n";
import { ColorBlock, Display, Mono, Text } from "@/ui";
import { blockColors, colors, GUTTER, radius, space, type BlockColor } from "@/theme/tokens";
import { fmtHold, pct, usd } from "../../format";
import type { Analytics, TradeRef } from "../../types";

export const Hero = React.memo(function Hero({ d, periodLabel }: { d: Analytics; periodLabel: string }) {
  const t = useT();
  const s = d.stats;
  const label = t("mobileReports.an.hero.label", { period: periodLabel });
  const net = usd(s.net, true);
  const stats: [string, string][] = [
    [t("mobileReports.an.hero.return"), pct(d.curve.returnPct, 2, true)],
    [t("mobileReports.an.hero.trades"), String(s.trades)],
    [t("mobileReports.an.hero.lots"), s.lots.toFixed(2)],
  ];
  return (
    <ColorBlock color="ember" style={{ marginHorizontal: GUTTER }} accessible accessibilityLabel={`${label}: ${net}. ${stats.map(([k, v]) => `${k} ${v}`).join(", ")}`}>
      <Text variant="label" color={colors.ink2}>
        {label}
      </Text>
      <Display size="hero" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={{ marginTop: space[3] }}>
        {net}
      </Display>
      <View style={{ flexDirection: "row", marginTop: space[5], paddingTop: space[4], borderTopWidth: 1, borderTopColor: "rgba(14,14,16,0.16)" }}>
        {stats.map(([k, v]) => (
          <View key={k} style={{ flex: 1, gap: 3 }}>
            <Text variant="label" color={colors.ink2} numberOfLines={1} style={{ fontSize: 10 }}>
              {k}
            </Text>
            <Mono size={17} weight="bold" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {v}
            </Mono>
          </View>
        ))}
      </View>
    </ColorBlock>
  );
});

const TILE_H = 136;

function Tile({ color, label, value, valueColor, sub, children, width }: { color?: BlockColor; label: string; value?: string; valueColor?: string; sub?: string; children?: React.ReactNode; width: number }) {
  const ink = !!color;
  return (
    <View
      accessible
      accessibilityLabel={[label, value, sub].filter(Boolean).join(". ")}
      style={{ width, height: TILE_H, borderRadius: radius.card, padding: space[4], justifyContent: "space-between", backgroundColor: color ? blockColors[color] : colors.surface, borderWidth: color ? 0 : 1, borderColor: colors.line, overflow: "hidden" }}
    >
      <Text variant="label" color={ink ? colors.ink2 : colors.text3} numberOfLines={1} style={{ fontSize: 10.5 }}>
        {label}
      </Text>
      {children ?? (
        <Display size="lg" color={valueColor ?? (ink ? colors.ink : colors.text)} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
          {value}
        </Display>
      )}
      {sub ? (
        <Text variant="caption" color={ink ? colors.ink2 : colors.text3} numberOfLines={2}>
          {sub}
        </Text>
      ) : (
        <View />
      )}
    </View>
  );
}

const money = (v: number) => (v > 0 ? colors.up : v < 0 ? colors.down : colors.text);

function TradeTile({ label, tr, width }: { label: string; tr: TradeRef; width: number }) {
  const t = useT();
  if (!tr) return <Tile label={label} value="—" sub={t("mobileReports.an.tile.none")} width={width} />;
  const side = tr.side === "buy" ? t("common.buy") : t("common.sell");
  return (
    <Tile label={label} value={usd(tr.net, true)} sub={t("mobileReports.an.tile.trade", { side: side.toUpperCase(), volume: tr.volume, ticket: tr.ticket })} width={width}>
      <View style={{ gap: 2 }}>
        <Text variant="headline" numberOfLines={1}>
          {tr.symbol}
        </Text>
        <Display size="md" color={money(tr.net)} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {usd(tr.net, true)}
        </Display>
      </View>
    </Tile>
  );
}

export const Tiles = React.memo(function Tiles({ d }: { d: Analytics }) {
  const t = useT();
  const { width } = useWindowDimensions();
  const w = Math.floor((width - GUTTER * 2 - space[3]) / 2);
  const s = d.stats;
  const c = d.curve;
  const pf = s.profitFactor === null ? (s.wins ? "∞" : "—") : s.profitFactor.toFixed(2);
  const edge = s.profitFactor === null ? (s.wins ? t("portfolio.an.kpi.noLosing") : t("portfolio.an.kpi.noTrades")) : s.profitFactor >= 1.5 ? t("portfolio.an.kpi.strongEdge") : s.profitFactor >= 1 ? t("portfolio.an.kpi.thinEdge") : t("portfolio.an.kpi.losingEdge");
  const row = { flexDirection: "row" as const, gap: space[3] };
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
      <View style={row}>
        <Tile color="gold" label={t("portfolio.an.kpi.winRate")} value={`${s.winRate.toFixed(1)}%`} sub={t("portfolio.an.kpi.winsLosses", { wins: s.wins, losses: s.losses })} width={w} />
        <Tile color="mint" label={t("portfolio.an.kpi.profitFactor")} value={pf} sub={edge} width={w} />
      </View>
      <View style={row}>
        <Tile color="periwinkle" label={t("mobileReports.an.tile.sharpe")} value={c.sharpe === null ? "—" : c.sharpe.toFixed(2)} sub={t("mobileReports.an.tile.sortino", { value: c.sortino === null ? "—" : c.sortino.toFixed(2) })} width={w} />
        <Tile label={t("portfolio.an.kpi.maxDrawdown")} value={pct(c.maxDrawdown)} valueColor={c.maxDrawdown < 0 ? colors.down : colors.text} sub={t("portfolio.an.kpi.nowDrawdown", { value: c.currentDrawdown.toFixed(2) })} width={w} />
      </View>
      <View style={row}>
        <Tile label={t("mobileReports.an.tile.avgWinLoss")} width={w} sub={t("portfolio.an.kpi.winsLosses", { wins: s.wins, losses: s.losses })}>
          <View>
            <Display size="sm" color={s.avgWin ? colors.up : colors.text3} numberOfLines={1} adjustsFontSizeToFit>
              {s.avgWin ? usd(s.avgWin, true) : "—"}
            </Display>
            <Display size="sm" color={s.avgLoss ? colors.down : colors.text3} numberOfLines={1} adjustsFontSizeToFit>
              {s.avgLoss ? usd(-s.avgLoss) : "—"}
            </Display>
          </View>
        </Tile>
        <Tile label={t("mobileReports.an.tile.expectancy")} value={usd(s.expectancy, true)} valueColor={money(s.expectancy)} sub={t("mobileReports.an.tile.rr", { value: s.rewardRisk === null ? "—" : s.rewardRisk.toFixed(2) })} width={w} />
      </View>
      <View style={row}>
        <Tile label={t("portfolio.an.kpi.avgHold")} value={fmtHold(t, s.avgHoldSecs)} sub={t("mobileReports.an.tile.holdSplit", { win: fmtHold(t, s.avgHoldWinSecs), loss: fmtHold(t, s.avgHoldLossSecs) })} width={w} />
        <Tile label={t("mobileReports.an.tile.streaks")} value={`${s.maxConsecWins} / ${s.maxConsecLosses}`} sub={t("mobileReports.an.tile.streaksSub")} width={w} />
      </View>
      <View style={row}>
        <TradeTile label={t("portfolio.an.stats.best")} tr={s.best} width={w} />
        <TradeTile label={t("portfolio.an.stats.worst")} tr={s.worst} width={w} />
      </View>
    </View>
  );
});
