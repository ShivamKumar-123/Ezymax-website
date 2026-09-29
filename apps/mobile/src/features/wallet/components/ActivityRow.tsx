// One wallet transaction (deposit, withdrawal, transfer, other credit / debit) as a fixed-height list row. Memoised
// on the fields that change, so a refetch that returns the same rows re-renders nothing. Incoming money is green,
// outgoing is plain (red is for losses); failed / cancelled amounts are struck through.
import * as React from "react";
import { View } from "react-native";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Award } from "lucide-react-native";
import { useFormat, useT, type MessageKey, type T } from "@/i18n";
import { Mono, PressableScale, Skeleton, Text } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { CHAIN_LABEL, type ActivityItem, type DepositStatus, type WithdrawalStatus } from "../api";
import { shortAddress } from "../lib/address";
import { fmtAmount } from "../lib/money";
import { DEPOSIT_STATUS, StatusDot, TRANSFER_STATUS, WITHDRAWAL_STATUS, type StatusDef } from "./parts";

export const ACTIVITY_ROW_HEIGHT = 72;

/** Other credits and debits by ledger kind (the web's labels; Back Office adjustments show their statement note). */
const KIND_LABEL: Record<string, MessageKey> = {
  commission: "wallet.kind.commission",
  ib_payout: "wallet.kind.ibPayout",
  prop_purchase: "wallet.kind.propPurchase",
  prop_payout: "wallet.kind.propPayout",
  pamm_invest: "wallet.kind.pammInvest",
  pamm_redeem: "wallet.kind.pammRedeem",
  copy_fee: "wallet.kind.copyFee",
  mam_fee: "wallet.kind.mamFee",
  adjustment: "wallet.kind.adjustment",
  adjustment_in: "wallet.kind.adjustment",
  adjustment_out: "wallet.kind.adjustment",
  manual_deposit: "wallet.txType.deposit",
  manual_withdrawal: "wallet.txType.withdrawal",
  refund: "wallet.kind.refund",
};

export function activityTitle(a: ActivityItem, t: T): string {
  switch (a.type) {
    case "deposit":
      return t("wallet.depositLine", { network: a.chain ? CHAIN_LABEL[a.chain].short : "" }).trim();
    case "withdrawal":
      return t("wallet.withdrawalLine", { network: a.chain ? CHAIN_LABEL[a.chain].short : "" }).trim();
    case "transfer":
      return a.direction === "out" ? t("wallet.activity.toTrading", { login: a.login }) : t("wallet.activity.fromTrading", { login: a.login });
    default: {
      const k = KIND_LABEL[a.kind ?? ""];
      return k ? t(k) : t("wallet.activity.walletTx");
    }
  }
}

export function activityStatus(a: ActivityItem): StatusDef | null {
  if (a.type === "deposit") return DEPOSIT_STATUS[a.status as DepositStatus] ?? null;
  if (a.type === "withdrawal") return WITHDRAWAL_STATUS[a.status as WithdrawalStatus] ?? null;
  if (a.type === "transfer") return TRANSFER_STATUS[a.status] ?? null;
  return null;
}

export const isDimmed = (a: Pick<ActivityItem, "status">) => a.status === "failed" || a.status === "rejected" || a.status === "cancelled";
export const isSettled = (a: Pick<ActivityItem, "status">) => a.status === "completed" || a.status === "credited";

/** Currency the row amount is in: a transfer back from a trading account is booked in USD (1:1). */
export const activityCurrency = (a: ActivityItem) => (a.type === "transfer" && a.direction === "in" ? "USD" : a.currency || "USDT");

function subtitle(a: ActivityItem, t: T): string {
  if (a.type === "deposit" && a.status === "confirming" && a.required_confirmations) return t("wallet.activity.confirmations", { done: Math.min(a.confirmations ?? 0, a.required_confirmations), required: a.required_confirmations });
  if (a.type === "withdrawal" && a.address) return t("wallet.activity.to", { address: shortAddress(a.address) });
  return a.note ?? "";
}

function RowIcon({ a }: { a: ActivityItem }) {
  const inbound = a.direction === "in";
  const dim = isDimmed(a);
  const Icon = a.type === "transfer" ? ArrowLeftRight : a.type === "other" ? Award : inbound ? ArrowDownLeft : ArrowUpRight;
  const fg = dim ? colors.text3 : inbound ? colors.up : colors.text2;
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: dim ? colors.surface2 : inbound ? colors.upSoft : colors.surface2 }}>
      <Icon size={18} color={fg} strokeWidth={2} />
    </View>
  );
}

function Row({ item, onPress, onPressIn }: { item: ActivityItem; onPress?: (a: ActivityItem) => void; onPressIn?: (a: ActivityItem) => void }) {
  const t = useT();
  const fmt = useFormat();
  const st = activityStatus(item);
  const dim = isDimmed(item);
  const sub = subtitle(item, t);
  const when = fmt.dateTime(item.created_at);
  const title = activityTitle(item, t);
  const amount = `${item.direction === "in" ? "+" : "−"}${fmtAmount(item.amount)}`;
  return (
    <PressableScale
      onPress={onPress ? () => onPress(item) : undefined}
      onPressIn={onPressIn ? () => onPressIn(item) : undefined}
      disabled={!onPress}
      scaleTo={0.985}
      accessibilityLabel={`${title}, ${amount} ${activityCurrency(item)}, ${st ? t(st.label) : ""}, ${when}`}
      testID={`activity-${item.type}-${item.id}`}
      style={{ height: ACTIVITY_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER }}
    >
      <RowIcon a={item} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
          <Text variant="callout" weight="600" numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </Text>
          <Mono size={15} weight="bold" tone={dim ? "tertiary" : item.direction === "in" ? "up" : "primary"} style={dim ? { textDecorationLine: "line-through" } : undefined}>
            {amount}
          </Mono>
          <Text variant="caption" tone="tertiary">
            {activityCurrency(item)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 }}>
            {st && !isSettled(item) ? <StatusDot tone={st.tone} label={t(st.label)} /> : null}
            {sub ? (
              <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
                {st && !isSettled(item) ? `· ${sub}` : sub}
              </Text>
            ) : null}
          </View>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {when}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

const same = (a: ActivityItem, b: ActivityItem) =>
  a.id === b.id && a.type === b.type && a.status === b.status && a.updated_at === b.updated_at && a.confirmations === b.confirmations && a.amount === b.amount && a.note === b.note;

export const ActivityRow = React.memo(Row, (p, n) => p.onPress === n.onPress && p.onPressIn === n.onPressIn && same(p.item, n.item));

/** Loading rows shaped like ActivityRow (static, no shimmer). */
export function ActivitySkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Loading" accessible>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ height: ACTIVITY_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER }}>
          <Skeleton w={40} h={40} r={20} />
          <View style={{ flex: 1, gap: 7 }}>
            <Skeleton w="62%" h={13} />
            <Skeleton w="44%" h={10} />
          </View>
          <View style={{ alignItems: "flex-end", gap: 7 }}>
            <Skeleton w={78} h={14} />
            <Skeleton w={36} h={10} />
          </View>
        </View>
      ))}
    </View>
  );
}
