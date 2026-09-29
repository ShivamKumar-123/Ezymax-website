// Request a payout: the server's quote (profit, split, fee refund, total), what happens next, then the request.
// Never optimistic: the payout exists once the server says so.
import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { Banner, Button, Display, Text, toast, Sheet, type SheetRef } from "@/ui";
import { space } from "@/theme/tokens";
import { ERROR_LINK, propMessage, refreshAfterMoney, requestPayout } from "../api";
import { sizeLabel, usd } from "../format";
import type { FundedAccount } from "../types";
import { KV } from "./bits";

export type PayoutSheetHandle = { open: (f: FundedAccount) => void };

export const PayoutSheet = React.forwardRef<PayoutSheetHandle>(function PayoutSheet(_, ref) {
  const t = useT();
  const router = useRouter();
  const sheet = React.useRef<SheetRef>(null);
  const [f, setF] = React.useState<FundedAccount | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);

  React.useImperativeHandle(ref, () => ({
    open(x) {
      setF(x);
      setErr(null);
      setBusy(false);
      sheet.current?.present();
    },
  }));

  const submit = async () => {
    if (!f || busy) return;
    setBusy(true);
    setErr(null);
    const r = await requestPayout(f.challengeId);
    setBusy(false);
    if (!r.ok) {
      haptic.error();
      setErr(r.error);
      return;
    }
    haptic.success();
    refreshAfterMoney();
    sheet.current?.dismiss();
    toast.show({ title: t("mobileProp.request.done"), body: t("mobileProp.request.doneBody", { amount: usd(r.data.payout.total) }), tone: "success" }, 3200);
  };

  const q = f?.quote;
  const link = err ? ERROR_LINK[err.code] : undefined;
  return (
    <Sheet ref={sheet} enablePanDownToClose={!busy} onDismiss={() => setF(null)}>
      <View style={{ paddingTop: space[2], paddingBottom: space[2], gap: space[5] }}>
        {f && q ? (
          <>
            <View style={{ gap: space[2] }}>
              <Text variant="label" tone="ember">
                {t("mobileProp.request.eyebrow")}
              </Text>
              <Display size="hero" numberOfLines={1} adjustsFontSizeToFit>
                {usd(q.total)}
              </Display>
              <Text variant="callout" tone="secondary">
                {f.planName} · {sizeLabel(f.size)}
                {f.login ? ` · #${f.login}` : ""}
              </Text>
            </View>
            <View>
              <KV label={t("mobileProp.request.profit")} value={usd(q.profit)} />
              <KV label={t("mobileProp.request.share", { pct: q.split })} value={usd(q.traderAmount)} />
              {q.feeRefund > 0 ? <KV label={t("mobileProp.request.feeRefund")} value={usd(q.feeRefund)} /> : null}
              <KV label={t("mobileProp.request.total")} value={usd(q.total)} tone="up" last />
            </View>
            <Text variant="caption" tone="tertiary">
              {t("mobileProp.request.note")}
            </Text>
            {err ? <Banner tone="error" title={propMessage(err)} action={link ? t(link.label) : undefined} onAction={link ? () => (sheet.current?.dismiss(), setTimeout(() => router.push(link.href), 180)) : undefined} /> : null}
            <Button label={t("mobileProp.request.submit", { amount: usd(q.total) })} loading={busy} onPress={() => void submit()} testID="prop-payout-submit" />
          </>
        ) : null}
      </View>
    </Sheet>
  );
});
