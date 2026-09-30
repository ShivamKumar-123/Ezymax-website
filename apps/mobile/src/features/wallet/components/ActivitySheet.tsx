// Transaction detail sheet (history and recent activity): status, amount, network, addresses, the explorer link
// the server built (explorer_url), confirmations, the statement note of Back Office adjustments, and "Cancel" for a
// withdrawal that is still waiting for review (the server decides; nothing changes until it answers). The content
// scrolls when it is taller than the screen (a long note on a small phone), so the actions stay reachable.
import * as React from "react";
import { View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { ExternalLink } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { useSession } from "@/session";
import { Button, Display, FormError, Sheet, Text, type SheetRef } from "@/ui";
import { colors, space } from "@/theme/tokens";
import { cancelWithdrawal, CHAIN_LABEL, refreshWallet, walletError, type ActivityItem } from "../api";
import { shortAddress } from "../lib/address";
import { fmtAmount } from "../lib/money";
import { activityCurrency, activityStatus, activityTitle, isDimmed } from "./ActivityRow";
import { CopyButton, InfoRow, StatusChip, Tile } from "./parts";

export type ActivitySheetHandle = { open: (item: ActivityItem) => void };

/** Opens https explorer links from the server in the in-app browser. */
export function openExplorer(url: string | null | undefined) {
  if (url && /^https:\/\//.test(url)) void WebBrowser.openBrowserAsync(url).catch(() => {});
}

export const ActivitySheet = React.forwardRef<ActivitySheetHandle, { onChanged?: () => void }>(function ActivitySheet({ onChanged }, ref) {
  const insets = useSafeAreaInsets();
  const sheet = React.useRef<SheetRef>(null);
  const [item, setItem] = React.useState<ActivityItem | null>(null);
  React.useImperativeHandle(ref, () => ({
    open: (a) => {
      setItem(a);
      sheet.current?.present();
    },
  }));
  return (
    <Sheet ref={sheet} scroll topInset={insets.top + space[2]} onDismiss={() => setItem(null)}>
      <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }}>
        {item ? <Detail key={`${item.type}${item.id}`} item={item} onClose={() => sheet.current?.dismiss()} onChanged={onChanged} /> : <View style={{ height: 1 }} />}
      </BottomSheetScrollView>
    </Sheet>
  );
});

function Detail({ item, onClose, onChanged }: { item: ActivityItem; onClose: () => void; onChanged?: () => void }) {
  const t = useT();
  const fmt = useFormat();
  const st = activityStatus(item);
  const dim = isDimmed(item);
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  // a view-only login can look but not cancel (the server refuses it too)
  const viewer = useSession((s) => !!s.viewer);
  const canCancel = item.type === "withdrawal" && item.status === "requested" && !viewer;
  const cur = activityCurrency(item);

  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const r = await cancelWithdrawal(Number(item.id));
    setBusy(false);
    if (!r.ok) {
      setErr(walletError(r.error, "wallet.withdraw.cancelFailed"));
      return;
    }
    refreshWallet();
    onChanged?.();
    onClose();
  };

  const rows: React.ReactNode[] = [];
  const network = item.chain ? `${CHAIN_LABEL[item.chain].name} (${CHAIN_LABEL[item.chain].short})` : item.network;
  if (network) rows.push(<InfoRow key="net" label={t("wallet.network")} value={network} />);
  if (item.address && (item.type === "deposit" || item.type === "withdrawal"))
    rows.push(<InfoRow key="addr" label={item.type === "deposit" ? t("wallet.from") : t("wallet.to")} value={shortAddress(item.address, 8, 6)} mono trailing={<CopyButton compact value={item.address} label={t("wallet.address")} />} />);
  if (item.type === "transfer" && item.login) rows.push(<InfoRow key="acct" label={t("common.account")} value={`#${item.login}`} mono />);
  if (item.type === "deposit" && item.required_confirmations && (item.status === "confirming" || item.status === "pending"))
    rows.push(<InfoRow key="conf" label={t("mobileWallet.detail.confirmations")} value={`${Math.min(item.confirmations ?? 0, item.required_confirmations)} / ${item.required_confirmations}`} mono />);
  if (item.tx_hash) rows.push(<InfoRow key="tx" label={t("wallet.transactionHash")} value={shortAddress(item.tx_hash, 8, 6)} mono trailing={<CopyButton compact value={item.tx_hash} label={t("wallet.transactionHash")} />} />);
  if (item.note)
    rows.push(
      <InfoRow
        key="note"
        label={item.type === "withdrawal" && item.status === "rejected" ? t("mobileWallet.detail.reason") : item.type === "transfer" ? t("mobileWallet.detail.reason") : t("mobileWallet.detail.note")}
        value={item.note}
      />,
    );
  rows.push(<InfoRow key="date" label={t("common.date")} value={fmt.dateTime(item.created_at, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} />);
  rows.push(<InfoRow key="ref" label={t("mobileWallet.detail.reference")} value={`${t(item.type === "deposit" ? "wallet.txType.deposit" : item.type === "withdrawal" ? "wallet.txType.withdrawal" : item.type === "transfer" ? "wallet.txType.transfer" : "wallet.activity.walletTx")} #${item.id}`} last />);

  return (
    <View style={{ gap: space[4], paddingTop: space[2] }} testID="activity-sheet">
      <View style={{ gap: space[2] }}>
        <Text variant="headline" weight="700" numberOfLines={2}>
          {activityTitle(item, t)}
        </Text>
        {st ? <StatusChip tone={st.tone} label={t(st.label)} /> : null}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[2] }}>
          <Display size="lg" color={dim ? colors.text3 : item.direction === "in" ? colors.up : colors.text} style={dim ? { textDecorationLine: "line-through" } : undefined}>
            {`${item.direction === "in" ? "+" : "−"}${fmtAmount(item.amount)}`}
          </Display>
          <Text variant="headline" tone="tertiary" style={{ marginBottom: 4 }}>
            {cur}
          </Text>
        </View>
      </View>

      {item.type === "withdrawal" && item.fee !== null && item.net_amount !== null ? (
        <View style={{ flexDirection: "row", gap: space[2] }}>
          <Tile label={t("wallet.fee")} value={`${fmtAmount(item.fee)} USDT`} />
          <Tile label={t("wallet.youReceive")} value={`${fmtAmount(item.net_amount)} USDT`} />
        </View>
      ) : null}

      <View>{rows}</View>

      <FormError message={err} />

      {confirming ? (
        <View style={{ gap: space[3] }}>
          <Text tone="secondary">{t("mobileWallet.withdraw.cancelConfirm")}</Text>
          {/* stacked full width: the labels stay whole on a 360 pt phone and in longer languages */}
          <Button label={t("mobileWallet.withdraw.cancelAction")} variant="danger" size="md" loading={busy} onPress={cancel} testID="confirm-cancel-withdrawal" />
          <Button label={t("mobileWallet.keep")} variant="ghost" size="md" disabled={busy} onPress={() => setConfirming(false)} />
        </View>
      ) : (
        <View style={{ gap: space[3] }}>
          {item.explorer_url ? (
            <Button label={t("mobileWallet.viewOnExplorer")} variant="secondary" size="md" icon={<ExternalLink size={17} color={colors.text} />} onPress={() => openExplorer(item.explorer_url)} />
          ) : null}
          {canCancel ? <Button label={t("mobileWallet.withdraw.cancelAction")} variant="danger" size="md" onPress={() => setConfirming(true)} testID="cancel-withdrawal" /> : null}
          {!item.explorer_url && !canCancel ? <Button label={t("common.close")} variant="secondary" size="md" onPress={onClose} /> : null}
        </View>
      )}
    </View>
  );
}
