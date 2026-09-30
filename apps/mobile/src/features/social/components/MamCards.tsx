// MAM cards: a programme row (manager track record, method, fees, Connect) and a managed-account link card.
import * as React from "react";
import { View } from "react-native";
import { useFormat, useT } from "@/i18n";
import { Mono, PressableScale, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import type { LinkView, ManagerView } from "../api";
import { ddText, mamFeesText, methodLabel, pct, shownTone, usd } from "../format";
import { alpha } from "../tint";
import { Avatar, RiskMeter } from "./identity";
import { StatGrid, Tag, type TagTone } from "./primitives";

export const linkTone = (s: LinkView["status"]): TagTone => (s === "active" ? "good" : s === "revoked" ? "neutral" : "gold");

export const MANAGER_ROW = 124;

/** A MAM programme: name and 1Y return, the manager and the allocation method with the state (Connect / Linked /
 *  Frozen), the fee terms in full, then max drawdown, linked accounts and the risk meter. */
export const ManagerRow = React.memo(function ManagerRow({ m, linked, onPress, onPressIn }: { m: ManagerView; linked: boolean; onPress: (m: ManagerView) => void; onPressIn?: (m: ManagerView) => void }) {
  const t = useT();
  const r1y = m.track?.return1y ?? 0;
  const who = [m.nickname, methodLabel(m.method, t)].filter(Boolean).join(" · ");
  return (
    <PressableScale
      testID={`mam-manager-${m.id}`}
      onPress={() => onPress(m)}
      onPressIn={onPressIn ? () => onPressIn(m) : undefined}
      scaleTo={0.985}
      accessibilityLabel={`${m.name}, ${who}, ${mamFeesText(m, t)}`}
      style={{ height: MANAGER_ROW, marginHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}
    >
      <Avatar name={m.nickname ?? m.name} size={44} />
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Text variant="headline" weight="700" numberOfLines={1} style={{ flex: 1 }}>
            {m.name}
          </Text>
          <Mono size={16} weight="bold" tone={shownTone(r1y, 1)}>
            {pct(r1y, 1)}
          </Mono>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {who}
          </Text>
          {linked ? (
            <Tag compact tone="good" label={t("mobileSocial.mam.linked")} />
          ) : m.status === "active" ? (
            <Tag compact tone="ember" label={t("mobileSocial.mam.connect")} />
          ) : (
            <Tag compact tone="gold" label={t("mobileSocial.status.frozen")} />
          )}
        </View>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {mamFeesText(m, t)}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>
            {`${t("mobileSocial.maxDd")} ${ddText(m.track?.maxDd ?? 0)} · ${t("mobileSocial.mam.accounts", { count: m.accounts })}`}
          </Text>
          {m.track ? <RiskMeter risk={m.track.riskScore} /> : null}
        </View>
      </View>
    </PressableScale>
  );
});

export const LinkCard = React.memo(function LinkCard({ l, onOpen, onPressIn }: { l: LinkView; onOpen: (id: number) => void; onPressIn?: (id: number) => void }) {
  const t = useT();
  const fmt = useFormat();
  const active = l.status === "active";
  const status = active
    ? t("mobileSocial.status.active")
    : l.status === "revoked"
      ? t("mobileSocial.status.revoked")
      : t.dyn(`mobileSocial.mam.stopReason.${l.stopReason ?? ""}`, t("mobileSocial.status.stopped"));
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingBottom: space[3] }}>
      <PressableScale
        testID={`mam-link-${l.id}`}
        onPress={() => onOpen(l.id)}
        onPressIn={onPressIn ? () => onPressIn(l.id) : undefined}
        scaleTo={0.985}
        accessibilityLabel={`${l.manager?.name ?? ""}, ${t("mobileSocial.mam.account", { login: l.login })}, ${status}`}
        style={{
          borderRadius: radius.card,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: active ? alpha(colors.periwinkle, 0.35) : colors.line,
          padding: space[5],
          gap: space[4],
          opacity: active ? 1 : 0.72,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <Avatar name={l.manager?.nickname ?? "MAM"} size={44} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text variant="headline" weight="700" numberOfLines={1}>
              {l.manager?.name ?? "MAM"}
            </Text>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {`${t("mobileSocial.mam.account", { login: l.login })} · ${t("mobileSocial.mam.linkedOn", { date: fmt.date(l.createdAt) })}`}
            </Text>
          </View>
          <Tag tone={linkTone(l.status)} label={status} />
        </View>
        <StatGrid
          columns={2}
          items={[
            { label: t("common.equity"), value: usd(l.equity) },
            { label: t("mobileSocial.mam.result"), value: usd(l.mamResult, 2, true), tone: shownTone(l.mamResult) },
            { label: t("mobileSocial.mam.openTrades"), value: `${l.mamPositions}${l.mamOrders ? ` ${t("mobileSocial.mam.plusPending", { n: l.mamOrders })}` : ""}` },
            { label: t("mobileSocial.mam.limits"), value: `${l.maxLot ?? "—"} · ${l.equityStop ? usd(l.equityStop, 0) : "—"}` },
          ]}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Tag label={`${l.perfFeePct}%${l.mgmtFeePct ? ` + ${l.mgmtFeePct}%/y` : ""}`} />
          <Tag label={`${t("mobileSocial.mam.feesPaid")} ${usd(l.feesPaid)}`} />
        </View>
      </PressableScale>
    </View>
  );
});
