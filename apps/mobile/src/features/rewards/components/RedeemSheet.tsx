// Redeeming a catalogue item for points: what it gives and where it goes (the USDT wallet, a live account's bonus,
// or a voucher code), the cost and the balance after; a trading bonus needs a live account. The server checks the
// balance, the tier and the stock and deducts the points in the same transaction. A voucher code is shown once
// here (it stays listed under Vouchers).
import * as React from "react";
import { View } from "react-native";
import { Copy, Ticket } from "lucide-react-native";
import { useT } from "@/i18n";
import { Button, Display, FormError, IconButton, Mono, Sheet, Text, toast, type SheetRef } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { copyText } from "../../partner/share";
import { redeem, rewardsError } from "../api";
import { itemValue, pts } from "../format";
import type { CatalogueItem, Redemption } from "../types";
import { AccountPicker } from "./AccountPicker";

function KV({ label, value, tone }: { label: string; value: string; tone?: "gold" }) {
  return (
    <View style={{ minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3], borderTopWidth: 1, borderTopColor: colors.line }}>
      <Text variant="callout" tone="secondary">
        {label}
      </Text>
      <Text variant="callout" weight="700" tone={tone} numberOfLines={1} style={{ flexShrink: 1 }}>
        {value}
      </Text>
    </View>
  );
}

export function RedeemSheet({ sheetRef, item, balance }: { sheetRef: React.RefObject<SheetRef | null>; item: CatalogueItem | null; balance: number }) {
  const t = useT();
  const [login, setLogin] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<Redemption | null>(null);
  const needsAccount = item?.kind === "bonus_credit";

  const reset = React.useCallback(() => {
    setLogin(null);
    setErr(null);
    setDone(null);
    setBusy(false);
  }, []);

  const confirm = async () => {
    if (!item || (needsAccount && !login)) return;
    setBusy(true);
    setErr(null);
    const r = await redeem(item.id, needsAccount ? login : null);
    setBusy(false);
    if (!r.ok) {
      setErr(rewardsError(r.error));
      return;
    }
    if (r.data.redemption.voucherCode) {
      setDone(r.data.redemption);
      return;
    }
    toast.show({ title: t("mobileRewards.redeem.done", { name: item.name }), body: t(r.data.redemption.status === "pending" ? "mobileRewards.redeem.donePending" : "mobileRewards.redeem.doneBody", { points: pts(item.costPoints), balance: pts(r.data.balance) }), tone: "success" });
    sheetRef.current?.dismiss();
  };

  const dest = item?.kind === "cashback" ? t("mobileRewards.redeem.toWallet") : item?.kind === "bonus_credit" ? t("mobileRewards.redeem.toAccount") : t("mobileRewards.redeem.toVoucher");

  return (
    <Sheet ref={sheetRef} onDismiss={reset}>
      {done?.voucherCode ? (
        <View style={{ gap: space[4], paddingTop: space[2] }}>
          <View style={{ gap: 2 }}>
            <Text variant="label" tone="ember">
              {t("mobileRewards.redeem.voucherEyebrow")}
            </Text>
            <Display size="md">{t("mobileRewards.redeem.voucherTitle")}</Display>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], borderRadius: radius.lg, backgroundColor: colors.gold, paddingStart: space[5], paddingEnd: space[2], minHeight: 64 }} testID="voucher-code">
            <Ticket size={20} color={colors.ink} />
            <Mono size={20} weight="bold" color={colors.ink} selectable style={{ flex: 1, letterSpacing: 1 }}>
              {done.voucherCode}
            </Mono>
            <IconButton tone="ghost" accessibilityLabel={t("common.copy")} icon={<Copy size={18} color={colors.ink} />} onPress={() => void copyText(done.voucherCode!, t("mobileRewards.redeem.voucherCopied"))} />
          </View>
          <Text variant="caption" tone="tertiary">
            {t("mobileRewards.redeem.voucherBody")}
          </Text>
          <Button label={t("common.done")} onPress={() => sheetRef.current?.dismiss()} />
        </View>
      ) : item ? (
        <View style={{ gap: space[4], paddingTop: space[2] }}>
          <View style={{ gap: 2 }}>
            <Text variant="label" tone="ember">
              {t("mobileRewards.redeem.eyebrow")}
            </Text>
            <Display size="md" numberOfLines={2}>
              {item.name}
            </Display>
            <Text variant="caption" tone="tertiary">
              {item.description || itemValue(t, item)}
            </Text>
          </View>
          <View>
            <KV label={t("mobileRewards.redeem.reward")} value={itemValue(t, item)} />
            <KV label={t("mobileRewards.redeem.cost")} value={t("mobileRewards.value.pts", { points: pts(item.costPoints) })} tone="gold" />
            <KV label={t("mobileRewards.redeem.balance")} value={t("mobileRewards.value.pts", { points: pts(balance) })} />
            <KV label={t("mobileRewards.redeem.after")} value={t("mobileRewards.value.pts", { points: pts(balance - item.costPoints) })} />
            <KV label={t("mobileRewards.redeem.deliveredTo")} value={dest} />
          </View>
          {needsAccount ? (
            <View style={{ gap: space[2] }}>
              <Text variant="label" tone="tertiary">
                {t("mobileRewards.picker.label")}
              </Text>
              <AccountPicker value={login} onChange={setLogin} emptyHint={t("mobileRewards.redeem.accountHint")} onNavigate={() => sheetRef.current?.dismiss()} />
            </View>
          ) : null}
          {err ? <FormError message={err} /> : null}
          <Button label={t("mobileRewards.redeem.confirm", { points: pts(item.costPoints) })} onPress={() => void confirm()} loading={busy} disabled={needsAccount && !login} testID="redeem-confirm" />
        </View>
      ) : (
        <View style={{ height: 1 }} />
      )}
    </Sheet>
  );
}
