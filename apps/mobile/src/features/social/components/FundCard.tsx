// A PAMM fund as a card (NAV huge, returns, AUM / investors / drawdown / fee / minimum, rollover, lock-in and
// freeze terms) and the holding card of "My investments".
import * as React from "react";
import { View } from "react-native";
import { CalendarClock, Lock, Snowflake } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { Button, Mono, PressableScale, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import type { FundView, InvestmentView, RequestView } from "../api";
import { compactUsd, ddText, nav4, pct, periodLabel, shownTone, units4, usd } from "../format";
import { Avatar } from "./identity";
import { StatGrid, Tag, type TagTone } from "./primitives";
import { RequestRow } from "./rows";

export const fundTone = (s: FundView["status"]): TagTone => (s === "active" ? "good" : s === "frozen" ? "gold" : "neutral");

export const FundCard = React.memo(function FundCard({
  f,
  onOpen,
  onPressIn,
  onInvest,
}: {
  f: FundView;
  onOpen: (id: number) => void;
  onPressIn: (id: number) => void;
  onInvest: (id: number) => void;
}) {
  const t = useT();
  const fmt = useFormat();
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingBottom: space[3] }}>
      <PressableScale
        testID={`fund-card-${f.id}`}
        onPress={() => onOpen(f.id)}
        onPressIn={() => onPressIn(f.id)}
        scaleTo={0.985}
        accessibilityLabel={`${f.name}, ${t("mobileSocial.fund.by", { name: f.master.nickname })}, ${t("mobileSocial.navPerUnit")} ${nav4(f.nav)}`}
        style={{ borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: space[5], gap: space[4] }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <Avatar name={f.master.nickname} size={44} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text variant="headline" weight="700" numberOfLines={1}>
              {f.name}
            </Text>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {t("mobileSocial.fund.by", { name: f.master.nickname })}
            </Text>
          </View>
          <Tag tone={fundTone(f.status)} label={t(`mobileSocial.fund.status.${f.status}`)} icon={f.status === "frozen" ? <Snowflake size={12} color={colors.gold} /> : undefined} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[3] }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" tone="tertiary">
              {t("mobileSocial.navPerUnit")}
            </Text>
            <Mono size={34} weight="bold" style={{ letterSpacing: -0.5 }}>
              {nav4(f.nav)}
            </Mono>
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Mono size={15} weight="bold" tone={shownTone(f.return1m)}>
              {pct(f.return1m)}
            </Mono>
            <Text variant="caption" tone="tertiary">
              {t("mobileSocial.fund.return1m")}
            </Text>
          </View>
        </View>
        <StatGrid
          columns={3}
          items={[
            { label: t("mobileSocial.aum"), value: compactUsd(f.aum) },
            { label: t("mobileSocial.investors"), value: fmt.number(f.investors, 0) },
            { label: t("mobileSocial.fund.returnAll"), value: pct(f.returnAll, 1), tone: shownTone(f.returnAll, 1) },
            { label: t("mobileSocial.fund.drawdown"), value: ddText(f.drawdownPct), tone: f.drawdownPct > 0 ? "down" : undefined },
            { label: t("mobileSocial.fund.perfFee"), value: `${f.perfFeePct}%` },
            { label: t("mobileSocial.fund.min"), value: usd(f.minInvestment, 0) },
          ]}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Tag
            tone="ember"
            icon={<CalendarClock size={12} color={colors.ember} />}
            label={t("mobileSocial.fund.rolloverNext", { period: periodLabel(f.period, t), next: f.nextRolloverAt ? fmt.dateTime(f.nextRolloverAt) : "—" })}
          />
          {f.lockInDays > 0 ? (
            <Tag tone="gold" icon={<Lock size={12} color={colors.gold} />} label={t("mobileSocial.fund.lockInDays", { d: f.lockInDays })} />
          ) : (
            <Tag label={t("mobileSocial.fund.noLockIn")} />
          )}
          <Tag icon={<Snowflake size={12} color={colors.text2} />} label={t("mobileSocial.fund.freezeChip", { dd: f.maxDdPct })} />
        </View>
        <Button testID={`fund-invest-${f.id}`} label={t("mobileSocial.fund.invest")} size="md" disabled={f.status !== "active"} onPress={() => onInvest(f.id)} />
      </PressableScale>
    </View>
  );
});

/** One PAMM holding: value, P&L, units, HWM, stop-loss, pending requests (cancellable) and the actions. */
export const HoldingCard = React.memo(function HoldingCard({
  inv,
  onOpen,
  onAdd,
  onRedeem,
  onStopLoss,
  onCancel,
}: {
  inv: InvestmentView;
  /** opens the fund; left out on the fund's own screen (the header is then plain text, no press feedback) */
  onOpen?: (id: number) => void;
  onAdd: (id: number) => void;
  onRedeem: (id: number) => void;
  onStopLoss: (inv: InvestmentView) => void;
  onCancel: (r: RequestView) => void;
}) {
  const t = useT();
  const fmt = useFormat();
  const f = inv.fund;
  const locked = !!inv.lockedUntil && Date.parse(inv.lockedUntil) > Date.now();
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingBottom: space[3] }}>
      <View style={{ borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingVertical: space[5], gap: space[4] }}>
        <PressableScale
          testID={`holding-${inv.fundId}`}
          onPress={onOpen ? () => onOpen(inv.fundId) : undefined}
          disabled={!onOpen}
          scaleTo={0.985}
          accessibilityRole={onOpen ? "link" : "text"}
          style={{ paddingHorizontal: space[5], flexDirection: "row", alignItems: "center", gap: space[3] }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text variant="headline" weight="700" numberOfLines={1}>
              {f.name}
            </Text>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {`${t("mobileSocial.fund.by", { name: f.master.nickname })} · ${t("mobileSocial.fund.rolloverNext", { period: periodLabel(f.period, t), next: f.nextRolloverAt ? fmt.dateTime(f.nextRolloverAt) : "—" })}`}
            </Text>
          </View>
          <Tag tone={fundTone(f.status)} label={t(`mobileSocial.fund.status.${f.status}`)} />
        </PressableScale>
        <View style={{ paddingHorizontal: space[5], flexDirection: "row", alignItems: "flex-end", gap: space[3] }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" tone="tertiary">
              {t("mobileSocial.value")}
            </Text>
            <Mono size={30} weight="bold" style={{ letterSpacing: -0.5 }} numberOfLines={1} adjustsFontSizeToFit>
              {usd(inv.value)}
            </Mono>
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Mono size={15} weight="bold" tone={shownTone(inv.pnl)}>
              {usd(inv.pnl, 2, true)}
            </Mono>
            <Mono size={12} tone={shownTone(inv.pnlPct, 2, "tertiary")}>
              {pct(inv.pnlPct)}
            </Mono>
          </View>
        </View>
        <View style={{ paddingHorizontal: space[5] }}>
          <StatGrid
            columns={3}
            items={[
              { label: t("mobileSocial.units"), value: units4(inv.units) },
              { label: t("mobileSocial.nav"), value: nav4(inv.nav) },
              { label: t("mobileSocial.inv.netInvested"), value: usd(inv.netInvested) },
              { label: t("mobileSocial.inv.hwmNav"), value: nav4(inv.hwmNav) },
              { label: t("mobileSocial.inv.feesPaid"), value: usd(inv.feesPaid) },
              { label: t("mobileSocial.inv.stopLoss"), value: inv.stopLossPct !== null ? `−${inv.stopLossPct}%` : t("common.off") },
            ]}
          />
        </View>
        {locked ? (
          <Tag
            tone="gold"
            style={{ marginHorizontal: space[5], alignSelf: "flex-start" }}
            icon={<Lock size={12} color={colors.gold} />}
            label={t("mobileSocial.inv.lockedTo", { date: fmt.date(inv.lockedUntil!) })}
          />
        ) : null}
        {inv.pending.length ? (
          <View>
            {inv.pending.map((r) => (
              <RequestRow key={r.id} r={r} fundName={t("mobileSocial.inv.pendingUntil", { next: f.nextRolloverAt ? fmt.dateTime(f.nextRolloverAt) : "—" })} onCancel={onCancel} />
            ))}
          </View>
        ) : null}
        <View style={{ paddingHorizontal: space[5], flexDirection: "row", gap: space[2] }}>
          <Button
            testID={`holding-add-${inv.fundId}`}
            label={t("mobileSocial.inv.add")}
            variant="secondary"
            size="sm"
            style={{ flex: 1, paddingHorizontal: space[2] }}
            disabled={f.status !== "active"}
            onPress={() => onAdd(inv.fundId)}
          />
          <Button
            testID={`holding-redeem-${inv.fundId}`}
            label={t("mobileSocial.inv.redeem")}
            variant="secondary"
            size="sm"
            style={{ flex: 1, paddingHorizontal: space[2] }}
            disabled={inv.units <= 0}
            onPress={() => onRedeem(inv.fundId)}
          />
          <Button
            testID={`holding-sl-${inv.fundId}`}
            label={t("mobileSocial.inv.stopLoss")}
            variant="secondary"
            size="sm"
            style={{ flex: 1, paddingHorizontal: space[2] }}
            onPress={() => onStopLoss(inv)}
          />
        </View>
      </View>
    </View>
  );
});
