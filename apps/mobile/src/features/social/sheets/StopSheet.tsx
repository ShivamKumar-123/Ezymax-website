// Stop copying (bottom sheet): close every copied position now, or keep them open on the copy account and manage
// them yourself; optionally move the balance back to the wallet. The server's answer is shown as it is (closed,
// kept, returned, failures): never optimistic.
import * as React from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { invalidate } from "@/lib/query";
import { Banner, Button, Display, FormError, Sheet, Text, type SheetRef } from "@/ui";
import { space } from "@/theme/tokens";
import { socialPost, type StopResult, type SubscriptionView } from "../api";
import { usd } from "../format";
import { RadioCard, SwitchRow } from "../components/controls";
import { StatGrid } from "../components/primitives";

export const StopSheet = React.forwardRef<SheetRef, { sub: SubscriptionView | null; onStopped?: () => void }>(function StopSheet({ sub, onStopped }, ref) {
  const t = useT();
  const [close, setClose] = React.useState(true);
  const [returnFunds, setReturnFunds] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [res, setRes] = React.useState<StopResult | null>(null);

  React.useEffect(() => {
    setClose(true);
    setReturnFunds(true);
    setErr(null);
    setRes(null);
  }, [sub?.id]);

  const dismiss = () => (ref as React.RefObject<SheetRef | null>)?.current?.dismiss();

  const stop = async () => {
    if (!sub) return;
    setBusy(true);
    setErr(null);
    const r = await socialPost<StopResult>(`subscriptions/${sub.id}/stop`, { returnFunds, closePositions: close });
    setBusy(false);
    if (!r.ok) {
      haptic.error();
      setErr(r.error);
      return;
    }
    haptic.success();
    setRes(r.data);
    invalidate("social:");
    invalidate("wallet");
    onStopped?.();
  };

  const open = sub ? sub.positions + sub.orders : 0;
  return (
    <Sheet ref={ref} onDismiss={() => setRes(null)}>
      {!sub ? null : res ? (
        <View style={{ gap: space[4], paddingTop: space[2] }} testID="stop-result">
          <Display size="md">{t("mobileSocial.stop.done")}</Display>
          <StatGrid
            columns={2}
            items={[
              { label: t("mobileSocial.stop.positionsClosed"), value: String(res.closed?.length ?? 0) },
              { label: t("mobileSocial.stop.returnedLabel"), value: res.returned !== null && res.returned !== undefined ? usd(res.returned) : "—" },
            ]}
          />
          <Text tone="secondary">
            {[
              close || open === 0 ? t("mobileSocial.stop.closed", { count: res.closed?.length ?? 0 }) : t("mobileSocial.stop.kept", { login: sub.login }),
              res.returned
                ? t("mobileSocial.stop.returned", { amount: usd(res.returned) })
                : returnFunds
                  ? t("mobileSocial.stop.notMoved", { login: sub.login })
                  : t("mobileSocial.stop.stays", { login: sub.login }),
            ].join(" ")}
          </Text>
          {res.failed?.length ? (
            <Banner tone="error" title={t("mobileSocial.stop.failed", { count: res.failed.length })} body={res.failed.map((f) => `${f.ticket ? `#${f.ticket}: ` : ""}${f.error}`).join("\n")} />
          ) : null}
          <Button label={t("common.done")} onPress={dismiss} />
        </View>
      ) : (
        <View style={{ gap: space[4], paddingTop: space[2] }}>
          <View style={{ gap: space[1] }}>
            <Display size="md">{t("mobileSocial.stop.title")}</Display>
            <Text variant="callout" tone="tertiary">
              {t("mobileSocial.stop.sub", { name: sub.master.nickname, login: sub.login })}
            </Text>
          </View>
          <View style={{ gap: space[2] }} accessibilityRole="radiogroup">
            <RadioCard testID="stop-close" selected={close} onPress={() => setClose(true)} title={t("mobileSocial.stop.closeAll")} text={t("mobileSocial.stop.closeAllText", { count: open })} />
            {open > 0 ? <RadioCard testID="stop-keep" selected={!close} onPress={() => setClose(false)} title={t("mobileSocial.stop.keep")} text={t("mobileSocial.stop.keepText")} /> : null}
          </View>
          <SwitchRow testID="stop-return" title={t("mobileSocial.stop.returnFunds")} hint={!close ? t("mobileSocial.stop.returnFundsKeep") : undefined} value={returnFunds} onChange={setReturnFunds} />
          <StatGrid
            columns={2}
            items={[
              { label: t("mobileSocial.stop.equityNow"), value: usd(sub.equity) },
              { label: t("mobileSocial.stop.feesPending"), value: usd(sub.feesPending) },
            ]}
          />
          <Text variant="caption" tone="tertiary">
            {t("mobileSocial.stop.undone", { name: sub.master.nickname })}
          </Text>
          <FormError message={err?.message} />
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <Button label={t("mobileSocial.stop.cancel")} variant="ghost" size="md" style={{ flex: 1, paddingHorizontal: space[3] }} disabled={busy} onPress={dismiss} />
            <Button
              testID="stop-confirm"
              label={t("mobileSocial.stop.confirm")}
              variant="danger"
              size="md"
              style={{ flex: 1, paddingHorizontal: space[3] }}
              loading={busy}
              onPress={() => void stop()}
            />
          </View>
        </View>
      )}
    </Sheet>
  );
});
