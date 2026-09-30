// One wallet transaction (deposit, withdrawal, transfer, other credit / debit) as a fixed-height list row. Memoised
// on the fields that change, so a refetch that returns the same rows re-renders nothing. Incoming money is green,
// outgoing is plain (red is for losses); failed / cancelled amounts are struck through.
// The row is built for a 360 pt phone: a short title (the detail sheet has the long one), the status never cut, then
// whatever detail still fits, and a compact date (the time for today, else the day).
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

/** The row's short title from the Client Area's translated wording: "Deposit · BEP20" (the amount carries the
 *  currency), "To #login" / "From #login" for transfers (the Client Area's own transfer list). */
export function rowTitle(a: ActivityItem, t: T): string {
  switch (a.type) {
    case "deposit":
      return a.chain ? `${t("wallet.txType.deposit")} · ${CHAIN_LABEL[a.chain].short}` : t("wallet.txType.deposit");
    case "withdrawal":
      return a.chain ? `${t("wallet.txType.withdrawal")} · ${CHAIN_LABEL[a.chain].short}` : t("wallet.txType.withdrawal");
    case "transfer":
      return a.direction === "out" ? t("wallet.transfer.toLogin", { login: a.login }) : t("wallet.transfer.fromLogin", { login: a.login });
    default:
      return activityTitle(a, t);
  }
}

type Fmt = ReturnType<typeof useFormat>;
const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

/** Today's rows show the time, this year's the day, older ones the day and year (server time, like statements). */
export function rowDate(iso: string, fmt: Fmt, now = Date.now()): string {
  const day = fmt.date(iso, DAY);
  if (day === fmt.date(now, DAY)) return fmt.time(iso);
  return fmt.date(iso, { year: "numeric" }) === fmt.date(now, { year: "numeric" }) ? fmt.date(iso, { day: "numeric", month: "short" }) : day;
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
  // "7 / 15": the status beside it already says "Confirming"
  if (a.type === "deposit" && a.status === "confirming" && a.required_confirmations) return `${Math.min(a.confirmations ?? 0, a.required_confirmations)} / ${a.required_confirmations}`;
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
  const when = rowDate(item.created_at, fmt);
  const title = rowTitle(item, t);
  const amount = `${item.direction === "in" ? "+" : "−"}${fmtAmount(item.amount)}`;
  return (
    <PressableScale
      onPress={onPress ? () => onPress(item) : undefined}
      onPressIn={onPressIn ? () => onPressIn(item) : undefined}
      disabled={!onPress}
      scaleTo={0.985}
      accessibilityLabel={`${activityTitle(item, t)}, ${amount} ${activityCurrency(item)}, ${st ? t(st.label) : ""}, ${fmt.dateTime(item.created_at)}`}
      testID={`activity-${item.type}-${item.id}`}
      style={{ height: ACTIVITY_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER }}
    >
      <RowIcon a={item} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
          <Text variant="callout" weight="600" numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </Text>
          <Mono size={15} weight="bold" numberOfLines={1} tone={dim ? "tertiary" : item.direction === "in" ? "up" : "primary"} style={[{ flexShrink: 0 }, dim ? { textDecorationLine: "line-through" } : null]}>
            {amount}
          </Mono>
          <Text variant="caption" tone="tertiary" style={{ flexShrink: 0 }}>
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
          <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 0 }}>
            {when}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

const same = (a: ActivityItem, b: ActivityItem) =>
  a.id === b.id && a.type === b.type && a.status === b.status && a.updated_at === b.updated_at && a.confirmations === b.confirmations && a.amount === b.amount && a.note === b.note && a.tx_hash === b.tx_hash;

export const ActivityRow = React.memo(Row, (p, n) => p.onPress === n.onPress && p.onPressIn === n.onPressIn && same(p.item, n.item));

/** Loading rows shaped like ActivityRow (static, no shimmer). */
export function ActivitySkeleton({ rows = 5 }: { rows?: number }) {
  const t = useT();
  return (
    <View accessibilityLabel={t("common.loading")} accessible>
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
