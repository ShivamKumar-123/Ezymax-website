// Revoke a MAM link (bottom sheet): close the open MAM trades at market, or keep them as ordinary trades. The
// fees due up to now are settled at once. Shows the server's answer (closed, fee settled).
import * as React from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { invalidate } from "@/lib/query";
import { Button, Display, FormError, Sheet, Text, type SheetRef } from "@/ui";
import { space } from "@/theme/tokens";
import { socialPost, type LinkView, type RevokeResult } from "../api";
import { usd } from "../format";
import { RadioCard } from "../components/controls";

export const RevokeSheet = React.forwardRef<SheetRef, { link: LinkView | null; onRevoked?: () => void }>(function RevokeSheet({ link, onRevoked }, ref) {
  const t = useT();
  const [close, setClose] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [res, setRes] = React.useState<RevokeResult | null>(null);
  React.useEffect(() => {
    setClose(false);
    setErr(null);
    setRes(null);
  }, [link?.id]);
  const dismiss = () => (ref as React.RefObject<SheetRef | null>)?.current?.dismiss();
  const open = link ? link.mamPositions + link.mamOrders : 0;

  const revoke = async () => {
    if (!link) return;
    setBusy(true);
    setErr(null);
    const r = await socialPost<RevokeResult>(`mam/links/${link.id}/revoke`, { closePositions: open > 0 && close });
    setBusy(false);
    if (!r.ok) {
      haptic.error();
      setErr(r.error);
      return;
    }
    haptic.success();
    setRes(r.data);
    invalidate("social:mam:");
    onRevoked?.();
  };

  return (
    <Sheet ref={ref} onDismiss={() => setRes(null)}>
      {!link ? null : res ? (
        <View style={{ gap: space[4], paddingTop: space[2] }} testID="revoke-result">
          <Display size="md">{t("mobileSocial.revoke.done")}</Display>
          <Text tone="secondary">
            {[
              t("mobileSocial.revoke.doneText", { name: link.manager?.name ?? "MAM", login: link.login }),
              open > 0 ? t("mobileSocial.revoke.closed", { count: res.closed?.length ?? 0 }) : "",
              res.fee ? t("mobileSocial.revoke.feesSettled", { amount: usd(res.fee) }) : "",
            ]
              .filter(Boolean)
              .join(" ")}
          </Text>
          <Button label={t("common.done")} onPress={dismiss} />
        </View>
      ) : (
        <View style={{ gap: space[4], paddingTop: space[2] }}>
          <View style={{ gap: space[1] }}>
            <Display size="md">{t("mobileSocial.revoke.title")}</Display>
            <Text variant="callout" tone="tertiary">
              {t("mobileSocial.revoke.sub", { name: link.manager?.name ?? "MAM", login: link.login })}
            </Text>
          </View>
          <Text tone="secondary">{t("mobileSocial.revoke.text")}</Text>
          {open > 0 ? (
            <View style={{ gap: space[2] }} accessibilityRole="radiogroup">
              <RadioCard testID="revoke-keep" selected={!close} onPress={() => setClose(false)} title={t("mobileSocial.revoke.keep")} text={t("mobileSocial.revoke.keepText")} />
              <RadioCard testID="revoke-close" selected={close} onPress={() => setClose(true)} title={t("mobileSocial.revoke.close")} text={t("mobileSocial.revoke.closeText", { count: open })} />
            </View>
          ) : (
            <Text variant="callout" tone="tertiary">
              {t("mobileSocial.revoke.noTrades")}
            </Text>
          )}
          <FormError message={err?.message} />
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <Button label={t("mobileSocial.revoke.cancel")} variant="ghost" size="md" style={{ flex: 1, paddingHorizontal: space[3] }} disabled={busy} onPress={dismiss} />
            <Button
              testID="revoke-confirm"
              label={t("mobileSocial.revoke.confirm")}
              variant="danger"
              size="md"
              style={{ flex: 1, paddingHorizontal: space[3] }}
              loading={busy}
              onPress={() => void revoke()}
            />
          </View>
        </View>
      )}
    </Sheet>
  );
});
