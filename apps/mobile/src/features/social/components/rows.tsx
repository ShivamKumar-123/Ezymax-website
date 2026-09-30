// Fixed-height, memoised rows for the copy / MAM detail lists: positions, pending orders, the copy log, fees,
// MAM deals and PAMM requests / rollovers.
import * as React from "react";
import { View } from "react-native";
import { useFormat, useT } from "@/i18n";
import { fmtPrice } from "@/lib/format";
import { instrument } from "@/market/instruments";
import { Mono, PressableScale, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import type { CopyLogEntry, FeeView, MamDeal, MamLogEntry, Order, Position, RequestView } from "../api";
import { nav4, shownTone, units4, usd } from "../format";
import { Tag, type TagTone } from "./primitives";

export const ROW = 64;

const rowStyle = { height: ROW, marginHorizontal: GUTTER, flexDirection: "row" as const, alignItems: "center" as const, gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line };

function Side({ side }: { side: "buy" | "sell" }) {
  const t = useT();
  return (
    <View style={{ width: 44, height: 24, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: side === "buy" ? colors.upSoft : colors.downSoft }}>
      <Text variant="caption" weight="700" color={side === "buy" ? colors.up : colors.down}>
        {t(side === "buy" ? "mobileSocial.side.buy" : "mobileSocial.side.sell")}
      </Text>
    </View>
  );
}

export const PositionRow = React.memo(function PositionRow({ p }: { p: Position }) {
  const t = useT();
  const d = instrument(p.symbol).digits;
  return (
    <View style={rowStyle}>
      <Side side={p.side} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", gap: space[2], alignItems: "baseline" }}>
          <Text variant="callout" weight="700">
            {p.symbol}
          </Text>
          <Mono size={12} tone="tertiary">{`${p.volume.toFixed(2)} ${t("mobileSocial.lotsUnit")}`}</Mono>
        </View>
        <Mono size={11.5} tone="tertiary" numberOfLines={1}>
          {`#${p.ticket} · ${fmtPrice(p.openPrice, d)}${p.currentPrice ? ` → ${fmtPrice(p.currentPrice, d)}` : ""}`}
        </Mono>
      </View>
      <Mono size={15} weight="bold" tone={shownTone(p.profit)}>
        {usd(p.profit, 2, true)}
      </Mono>
    </View>
  );
});

export const OrderRow = React.memo(function OrderRow({ o }: { o: Order }) {
  const t = useT();
  const d = instrument(o.symbol).digits;
  return (
    <View style={rowStyle}>
      <Side side={o.side} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", gap: space[2], alignItems: "baseline" }}>
          <Text variant="callout" weight="700">
            {o.symbol}
          </Text>
          <Text variant="caption" tone="tertiary">
            {t.dyn(`mobileSocial.orderType.${o.type}`, o.type)}
          </Text>
        </View>
        <Mono size={11.5} tone="tertiary">{`#${o.ticket} · ${o.volume.toFixed(2)} ${t("mobileSocial.lotsUnit")}`}</Mono>
      </View>
      <Mono size={14} weight="medium">
        {o.price !== null ? fmtPrice(o.price, d) : "—"}
      </Mono>
    </View>
  );
});

const logTone = (s: string): TagTone => (s === "ok" || s === "done" ? "good" : s === "skipped" ? "neutral" : "ember");

export const LogRow = React.memo(function LogRow({ l }: { l: CopyLogEntry | MamLogEntry }) {
  const t = useT();
  const fmt = useFormat();
  return (
    <View style={rowStyle}>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", gap: space[2], alignItems: "baseline" }}>
          <Text variant="callout" weight="700">
            {t.dyn(`mobileSocial.logAction.${l.action}`, l.action.replace(/_/g, " "))}
          </Text>
          {l.volume !== null && l.volume !== undefined ? <Mono size={12} tone="tertiary">{`${l.volume.toFixed(2)} ${t("mobileSocial.lotsUnit")}`}</Mono> : null}
        </View>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {[fmt.dateTime(l.at), l.message].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <Tag tone={logTone(l.status)} label={t.dyn(`mobileSocial.logStatus.${l.status}`, l.status)} />
    </View>
  );
});

const feeTone = (s: FeeView["status"]): TagTone => (s === "paid" ? "good" : s === "pending" ? "gold" : s === "approved" ? "periwinkle" : "neutral");

export const FeeRow = React.memo(function FeeRow({ f }: { f: FeeView }) {
  const t = useT();
  const fmt = useFormat();
  return (
    <View style={rowStyle}>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text variant="callout" weight="700" numberOfLines={1}>
          {t("mobileSocial.feeRow.period", { from: fmt.date(f.periodStart, { day: "numeric", month: "short" }), to: fmt.date(f.periodEnd, { day: "numeric", month: "short" }) })}
        </Text>
        <Mono size={11.5} tone="tertiary" numberOfLines={1}>
          {t("mobileSocial.feeRow.hwm", { from: usd(f.hwmBefore), to: usd(f.hwmAfter) })}
        </Mono>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Mono size={15} weight="bold">
          {usd(f.amount)}
        </Mono>
        <Tag tone={feeTone(f.status)} label={t.dyn(`mobileSocial.feeStatus.${f.status}`, f.status)} />
      </View>
    </View>
  );
});

export const DealRow = React.memo(function DealRow({ d }: { d: MamDeal }) {
  const t = useT();
  const fmt = useFormat();
  const digits = instrument(d.symbol).digits;
  const result = d.profit + d.swap;
  return (
    <View style={rowStyle}>
      <Side side={d.side} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", gap: space[2], alignItems: "baseline" }}>
          <Text variant="callout" weight="700">
            {d.symbol}
          </Text>
          <Text variant="caption" tone="tertiary">
            {d.entry === "in" ? t("mobileSocial.link.dealOpen") : t("mobileSocial.link.dealClose")}
          </Text>
        </View>
        <Mono size={11.5} tone="tertiary" numberOfLines={1}>
          {`${d.volume.toFixed(2)} @ ${fmtPrice(d.price, digits)} · ${fmt.dateTime(d.time)}`}
        </Mono>
      </View>
      {d.entry === "in" ? (
        <Mono size={13} tone="tertiary">
          {d.commission ? usd(-d.commission, 2, true) : "—"}
        </Mono>
      ) : (
        <Mono size={15} weight="bold" tone={shownTone(result)}>
          {usd(result, 2, true)}
        </Mono>
      )}
    </View>
  );
});

const reqTone = (s: RequestView["status"]): TagTone => (s === "done" ? "good" : s === "pending" ? "gold" : "neutral");

export function requestAmount(r: RequestView, t: ReturnType<typeof useT>) {
  if (r.kind === "invest") return usd(r.amount ?? 0);
  if (r.all) return t("mobileSocial.inv.allUnits");
  if (r.units !== null && r.units !== undefined) return t("mobileSocial.inv.unitsValue", { units: units4(r.units) });
  return usd(r.amount ?? 0);
}

/** A PAMM invest / redeem request; pending ones can be cancelled. */
export const RequestRow = React.memo(function RequestRow({ r, fundName, onCancel }: { r: RequestView; fundName?: string; onCancel?: (r: RequestView) => void }) {
  const t = useT();
  const fmt = useFormat();
  const result =
    r.status === "done"
      ? [
          r.unitsDelta !== null ? t("mobileSocial.inv.result", { units: `${r.unitsDelta > 0 ? "+" : ""}${units4(r.unitsDelta)}`, nav: nav4(r.nav) }) : null,
          r.amountOut !== null ? usd(r.amountOut) : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : r.reason
        ? r.reason.replace(/_/g, " ")
        : fmt.dateTime(r.createdAt);
  return (
    <View style={rowStyle}>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", gap: space[2], alignItems: "baseline" }}>
          <Text variant="callout" weight="700">
            {t.dyn(`mobileSocial.inv.kind.${r.kind}`, r.kind)}
          </Text>
          <Mono size={13} weight="medium">
            {requestAmount(r, t)}
          </Mono>
        </View>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {[fundName, result].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {r.status === "pending" && onCancel ? (
        <PressableScale
          testID={`req-cancel-${r.id}`}
          onPress={() => onCancel(r)}
          accessibilityLabel={t("mobileSocial.inv.cancelRequest")}
          style={{ height: 36, paddingHorizontal: space[3], borderRadius: radius.pill, justifyContent: "center", borderWidth: 1, borderColor: colors.lineStrong }}
        >
          <Text variant="callout" weight="700">
            {t("mobileSocial.inv.cancelRequest")}
          </Text>
        </PressableScale>
      ) : (
        <Tag tone={reqTone(r.status)} label={t.dyn(`mobileSocial.inv.reqStatus.${r.status}`, r.status)} />
      )}
    </View>
  );
});
