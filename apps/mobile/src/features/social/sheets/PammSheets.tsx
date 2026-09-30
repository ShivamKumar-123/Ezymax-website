// PAMM sheets: the investor stop-loss (redeem me if my value falls this far below my net investment) and the
// confirmation to cancel a pending invest / redeem request. Both show the server's answer.
import * as React from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { invalidate } from "@/lib/query";
import { Button, Display, FormError, Sheet, Text, toast, type SheetRef } from "@/ui";
import { space } from "@/theme/tokens";
import { socialPatch, socialPost, type InvestmentView, type RequestView } from "../api";
import { usd } from "../format";
import { Slider, SwitchRow } from "../components/controls";
import { requestAmount } from "../components/rows";

export const StopLossSheet = React.forwardRef<SheetRef, { inv: InvestmentView | null }>(function StopLossSheet({ inv }, ref) {
  const t = useT();
  const [on, setOn] = React.useState(false);
  const [sl, setSl] = React.useState(20);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  React.useEffect(() => {
    setOn(inv?.stopLossPct !== null && inv?.stopLossPct !== undefined);
    setSl(inv?.stopLossPct ?? 20);
    setErr(null);
  }, [inv]);
  const dismiss = () => (ref as React.RefObject<SheetRef | null>)?.current?.dismiss();

  const save = async () => {
    if (!inv) return;
    setBusy(true);
    setErr(null);
    const r = await socialPatch(`investments/${inv.fundId}`, { stopLossPct: on ? sl : null });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    invalidate("social:inv");
    invalidate(`social:fund:${inv.fundId}`);
    toast.show({ title: on ? t("mobileSocial.sl.set", { sl }) : t("mobileSocial.sl.removed"), tone: "success" });
    dismiss();
  };

  return (
    <Sheet ref={ref}>
      {inv ? (
        <View style={{ gap: space[4], paddingTop: space[2] }}>
          <View style={{ gap: space[1] }}>
            <Display size="md">{t("mobileSocial.sl.title")}</Display>
            <Text variant="callout" tone="tertiary">
              {inv.fund.name}
            </Text>
          </View>
          <Text tone="secondary">{t("mobileSocial.sl.text", { amount: usd(inv.netInvested) })}</Text>
          <SwitchRow testID="sl-switch" title={t("mobileSocial.sl.on")} value={on} onChange={setOn} />
          <View style={{ gap: space[1], opacity: on ? 1 : 0.4 }} pointerEvents={on ? "auto" : "none"}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text variant="caption" tone="tertiary">
                {t("mobileSocial.follow.trigger")}
              </Text>
              <Text variant="callout" weight="700" style={{ fontFamily: "JetBrainsMono_700Bold" }}>
                {`−${sl}% · ${t("mobileSocial.invest.atValue", { amount: usd(inv.netInvested * (1 - sl / 100), 0) })}`}
              </Text>
            </View>
            <Slider value={sl} onChange={setSl} min={5} max={90} ticks={[5, 10, 20, 50, 90]} disabled={!on} accessibilityLabel={t("mobileSocial.inv.stopLoss")} format={(v) => `${v}%`} />
          </View>
          <Text variant="caption" tone="tertiary">
            {t("mobileSocial.sl.note")}
          </Text>
          <FormError message={err?.message} />
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <Button label={t("common.cancel")} variant="ghost" size="md" style={{ flex: 1, paddingHorizontal: space[3] }} disabled={busy} onPress={dismiss} />
            <Button testID="sl-save" label={t("common.save")} size="md" style={{ flex: 1, paddingHorizontal: space[3] }} loading={busy} onPress={() => void save()} />
          </View>
        </View>
      ) : null}
    </Sheet>
  );
});

export const CancelRequestSheet = React.forwardRef<SheetRef, { req: RequestView | null }>(function CancelRequestSheet({ req }, ref) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  React.useEffect(() => setErr(null), [req?.id]);
  const dismiss = () => (ref as React.RefObject<SheetRef | null>)?.current?.dismiss();

  const cancel = async () => {
    if (!req) return;
    setBusy(true);
    setErr(null);
    const r = await socialPost(`requests/${req.id}/cancel`, {});
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    invalidate("social:inv");
    invalidate(`social:fund:${req.fundId}`);
    invalidate(`social:stmt:${req.fundId}`);
    invalidate("wallet");
    toast.show({
      title: t("mobileSocial.cancelReq.done"),
      body: req.kind === "invest" ? t("mobileSocial.cancelReq.invest", { amount: usd(req.amount ?? 0) }) : t("mobileSocial.cancelReq.redeem"),
      tone: "success",
    });
    dismiss();
  };

  return (
    <Sheet ref={ref}>
      {req ? (
        <View style={{ gap: space[4], paddingTop: space[2] }}>
          <View style={{ gap: space[1] }}>
            <Display size="md">{t("mobileSocial.cancelReq.title")}</Display>
            <Text variant="callout" tone="tertiary">
              {`${t.dyn(`mobileSocial.inv.kind.${req.kind}`, req.kind)} · ${requestAmount(req, t)}`}
            </Text>
          </View>
          <Text tone="secondary">{req.kind === "invest" ? t("mobileSocial.cancelReq.invest", { amount: usd(req.amount ?? 0) }) : t("mobileSocial.cancelReq.redeem")}</Text>
          <FormError message={err?.message} />
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <Button label={t("mobileSocial.cancelReq.keep")} variant="ghost" size="md" style={{ flex: 1, paddingHorizontal: space[3] }} disabled={busy} onPress={dismiss} />
            <Button
              testID="cancel-confirm"
              label={t("mobileSocial.cancelReq.confirm")}
              variant="danger"
              size="md"
              style={{ flex: 1, paddingHorizontal: space[3] }}
              loading={busy}
              onPress={() => void cancel()}
            />
          </View>
        </View>
      ) : null}
    </Sheet>
  );
});
