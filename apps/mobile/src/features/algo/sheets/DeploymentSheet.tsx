// The controls of one running strategy, each behind its own confirmation: pause (no new entries), resume, stop
// (keep the open positions, or close them), the kill switch (stop at once, closing its positions by default) and
// close its open positions. The server's answer is shown as it is (positions closed, any that failed): never
// optimistic. Haptics only when positions are closed (a money moment), like a close in the Trade tab.
import * as React from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { Banner, Button, Display, FormError, Sheet, Text, type SheetRef } from "@/ui";
import { space } from "@/theme/tokens";
import { algoPost, refreshAlgo, type ActionResult, type Deployment } from "../api";
import { Note, StatGrid } from "../components/bits";
import { RadioCard, SwitchRow } from "../components/controls";
import { kindLabel } from "../format";

export type DeploymentAction = "pause" | "resume" | "stop" | "kill" | "close";

export type DeploymentSheetRef = { open: (d: Deployment, action: DeploymentAction) => void };

type Done = { action: DeploymentAction; closed: number; failed: number };

export const DeploymentSheet = React.forwardRef<DeploymentSheetRef, { onChanged?: () => void }>(function DeploymentSheet({ onChanged }, ref) {
  const t = useT();
  const sheet = React.useRef<SheetRef>(null);
  const [dep, setDep] = React.useState<Deployment | null>(null);
  const [action, setAction] = React.useState<DeploymentAction>("pause");
  const [close, setClose] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [done, setDone] = React.useState<Done | null>(null);
  // a sheet closed while the server answers comes back with the answer
  const shown = React.useRef(false);
  const reopen = () => {
    if (!shown.current) {
      shown.current = true;
      sheet.current?.present();
    }
  };

  React.useImperativeHandle(ref, () => ({
    open(d, a) {
      setDep(d);
      setAction(a);
      // stop keeps the positions by default (like the web); the kill switch closes them by default
      setClose(a === "kill");
      setErr(null);
      setDone(null);
      setBusy(false);
      shown.current = true;
      sheet.current?.present();
    },
  }));

  const dismiss = () => sheet.current?.dismiss();
  const open = dep?.openPositions ?? 0;

  // one request at a time, even for two taps before the button shows its spinner
  const inFlight = React.useRef(false);
  const run = async () => {
    if (!dep || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setErr(null);
    const path = action === "close" ? "close-positions" : action;
    const body = action === "stop" || action === "kill" ? { closePositions: close } : {};
    // closing positions is a money moment (like a close in the Trade tab): the only one here that gets haptics
    const closing = action === "close" || ((action === "stop" || action === "kill") && close);
    const r = await algoPost<ActionResult>(`deployments/${dep.id}/${path}`, body, action === "kill" || action === "stop" || action === "close" ? 60_000 : 30_000);
    inFlight.current = false;
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      reopen();
      return;
    }
    const closed = Number(r.data.closed ?? 0);
    // money moved: positions were closed
    if (closing && closed > 0) haptic.success();
    setDone({ action, closed, failed: Number(r.data.failed ?? 0) });
    refreshAlgo();
    onChanged?.();
    reopen();
  };

  const kind = dep ? `${kindLabel(t, dep.accountType)} ${dep.login}` : "";
  const title =
    action === "pause"
      ? t("mobileAlgo.ctl.pauseTitle")
      : action === "resume"
        ? t("mobileAlgo.ctl.resumeTitle")
        : action === "stop"
          ? t("mobileAlgo.ctl.stopTitle")
          : action === "kill"
            ? t("mobileAlgo.ctl.killTitle")
            : t("mobileAlgo.ctl.closeTitle");
  const body =
    action === "pause"
      ? t("mobileAlgo.ctl.pauseBody")
      : action === "resume"
        ? t("mobileAlgo.ctl.resumeBody")
        : action === "stop"
          ? t("mobileAlgo.ctl.stopBody")
          : action === "kill"
            ? t("mobileAlgo.ctl.killBody")
            : t("mobileAlgo.ctl.closeBody", { count: open });
  const confirm =
    action === "pause"
      ? t("mobileAlgo.ctl.pause")
      : action === "resume"
        ? t("mobileAlgo.ctl.resume")
        : action === "stop"
          ? t("mobileAlgo.ctl.stop")
          : action === "kill"
            ? t("mobileAlgo.ctl.killNow")
            : t("mobileAlgo.ctl.closePositions");
  const danger = action === "kill" || action === "close" || (action === "stop" && close);

  return (
    <Sheet
      ref={sheet}
      onDismiss={() => {
        shown.current = false;
        if (!busy) setDone(null);
      }}
    >
      {!dep ? (
        <View />
      ) : done ? (
        <View style={{ gap: space[4], paddingTop: space[2] }} testID="dep-action-done">
          <Display size="md">{t(`mobileAlgo.ctl.done.${done.action}`)}</Display>
          {done.action === "stop" || done.action === "kill" || done.action === "close" ? (
            <StatGrid
              columns={2}
              items={[
                { label: t("mobileAlgo.ctl.closedLabel"), value: String(done.closed) },
                { label: t("mobileAlgo.ctl.failedLabel"), value: String(done.failed), tone: done.failed ? "gold" : undefined },
              ]}
            />
          ) : null}
          <Text tone="secondary">
            {done.action === "pause"
              ? t("mobileAlgo.ctl.donePause")
              : done.action === "resume"
                ? t("mobileAlgo.ctl.doneResume")
                : done.closed || done.failed
                  ? t("mobileAlgo.ctl.doneClosed", { count: done.closed })
                  : done.action === "close"
                    ? t("mobileAlgo.ctl.doneNothing")
                    : t("mobileAlgo.ctl.doneKept")}
          </Text>
          {done.failed ? <Banner tone="warn" title={t("mobileAlgo.ctl.failedTitle", { count: done.failed })} body={t("mobileAlgo.ctl.failedBody")} /> : null}
          <Button label={t("common.done")} onPress={dismiss} testID="dep-action-ok" />
        </View>
      ) : (
        <View style={{ gap: space[4], paddingTop: space[2] }} testID={`dep-action-${action}`}>
          <View style={{ gap: space[1] }}>
            <Display size="md">{title}</Display>
            <Text variant="callout" tone="tertiary" numberOfLines={2}>
              {`${dep.strategyName} · v${dep.version} · ${kind}`}
            </Text>
          </View>
          <Text tone="secondary">{body}</Text>
          {action === "stop" && open > 0 ? (
            <View style={{ gap: space[2] }} accessibilityRole="radiogroup">
              <RadioCard testID="stop-keep" selected={!close} onPress={() => setClose(false)} title={t("mobileAlgo.ctl.keepTitle")} text={t("mobileAlgo.ctl.keepText", { count: open })} />
              <RadioCard testID="stop-close" selected={close} onPress={() => setClose(true)} title={t("mobileAlgo.ctl.closeAllTitle")} text={t("mobileAlgo.ctl.closeAllText", { count: open })} />
            </View>
          ) : null}
          {action === "kill" ? <SwitchRow testID="kill-close" title={t("mobileAlgo.ctl.killClose")} hint={t("mobileAlgo.ctl.killCloseHint")} value={close} onChange={setClose} /> : null}
          {(action === "stop" || action === "kill") && dep.subscriptionId ? <Note>{t("mobileAlgo.ctl.copyNote")}</Note> : null}
          <FormError message={err?.message} />
          {/* stacked full width, like every confirmation: "Close positions" fits in any language */}
          <View style={{ gap: space[2] }}>
            <Button testID="dep-action-confirm" label={confirm} variant={danger ? "danger" : "primary"} size="md" loading={busy} onPress={() => void run()} />
            <Button label={t("common.cancel")} variant="ghost" size="md" disabled={busy} onPress={dismiss} />
          </View>
        </View>
      )}
    </Sheet>
  );
});
