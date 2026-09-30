// Request a payout: the server's quote (profit, split, fee refund, total), what happens next, then the request.
// Never optimistic: the payout exists once the server says so. Opening the sheet refreshes the quote, and the sheet
// follows the screen's list, so the amount confirmed is the server's current one (a closed trade moves it).
import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { Banner, Button, Display, Text, toast, Sheet, type SheetRef } from "@/ui";
import { space } from "@/theme/tokens";
import { ERROR_LINK, propMessage, refreshAfterMoney, refreshPayouts, requestPayout } from "../api";
import { sizeLabel, usd } from "../format";
import type { FundedAccount } from "../types";
import { KV } from "./bits";

export type PayoutSheetHandle = { open: (f: FundedAccount) => void };

export const PayoutSheet = React.forwardRef<PayoutSheetHandle, { funded?: FundedAccount[] }>(function PayoutSheet({ funded }, ref) {
  const t = useT();
  const router = useRouter();
  const sheet = React.useRef<SheetRef>(null);
  const [picked, setF] = React.useState<FundedAccount | null>(null);
  const f = (picked && funded?.find((x) => x.challengeId === picked.challengeId)) ?? picked;
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  // set synchronously on the first tap, so a double tap can't send the request twice
  const busyRef = React.useRef(false);

  React.useImperativeHandle(ref, () => ({
    open(x) {
      setF(x);
      setErr(null);
      setBusy(false);
      refreshPayouts();
      sheet.current?.present();
    },
  }));

  const submit = async () => {
    if (!f || !f.quote.eligible || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErr(null);
    const r = await requestPayout(f.challengeId);
    busyRef.current = false;
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      // the quote moved on the server (a position opened, a request already in review): show the new one behind
      refreshPayouts();
      return;
    }
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
            <Button label={t("mobileProp.request.submit", { amount: usd(q.total) })} loading={busy} disabled={!q.eligible} onPress={() => void submit()} testID="prop-payout-submit" />
          </>
        ) : null}
      </View>
    </Sheet>
  );
});
