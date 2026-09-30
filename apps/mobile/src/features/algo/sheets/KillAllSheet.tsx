// The account-wide kill switch (D84): stop every strategy at once and block webhook and API orders until it is
// released, optionally closing every position automation opened (strategy / webhook / API) on all accounts.
// Releasing only lifts the block: stopped strategies stay stopped until they are deployed again. The server's
// answer is shown as it is.
import * as React from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { Banner, Button, Display, FormError, Sheet, Text, type SheetRef } from "@/ui";
import { space } from "@/theme/tokens";
import { algoPost, refreshAlgo } from "../api";
import { StatGrid } from "../components/bits";
import { SwitchRow } from "../components/controls";

export type KillAllRef = { open: (mode: "kill" | "release") => void };

type Result = { stopped: number; closed: number; failed: number };

export const KillAllSheet = React.forwardRef<KillAllRef, { running: number }>(function KillAllSheet({ running }, ref) {
  const t = useT();
  const sheet = React.useRef<SheetRef>(null);
  const [mode, setMode] = React.useState<"kill" | "release">("kill");
  const [close, setClose] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [res, setRes] = React.useState<Result | null>(null);
  // a sheet closed while the server answers comes back with the answer
  const shown = React.useRef(false);
  const reopen = () => {
    if (!shown.current) {
      shown.current = true;
      sheet.current?.present();
    }
  };

  React.useImperativeHandle(ref, () => ({
    open(m) {
      setMode(m);
      setClose(true);
      setErr(null);
      setRes(null);
      setBusy(false);
      shown.current = true;
      sheet.current?.present();
    },
  }));

  const dismiss = () => sheet.current?.dismiss();

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const kill = mode === "kill";
    const r = await algoPost<Partial<Result>>("controls/kill", { killed: kill, closePositions: kill && close }, 120_000);
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      reopen();
      return;
    }
    const out = { stopped: Number(r.data.stopped ?? 0), closed: Number(r.data.closed ?? 0), failed: Number(r.data.failed ?? 0) };
    // money moved: positions were closed
    if (kill && out.closed > 0) haptic.success();
    setRes(out);
    refreshAlgo();
    reopen();
  };

  return (
    <Sheet
      ref={sheet}
      onDismiss={() => {
        shown.current = false;
        if (!busy) setRes(null);
      }}
    >
      {res ? (
        <View style={{ gap: space[4], paddingTop: space[2] }} testID="kill-done">
          <Display size="md">{mode === "kill" ? t("mobileAlgo.kill.doneTitle") : t("mobileAlgo.kill.releasedTitle")}</Display>
          {mode === "kill" ? (
            <StatGrid
              columns={3}
              items={[
                { label: t("mobileAlgo.kill.stopped"), value: String(res.stopped) },
                { label: t("mobileAlgo.ctl.closedLabel"), value: String(res.closed) },
                { label: t("mobileAlgo.ctl.failedLabel"), value: String(res.failed), tone: res.failed ? "gold" : undefined },
              ]}
            />
          ) : null}
          <Text tone="secondary">{mode === "kill" ? t("mobileAlgo.kill.doneBody") : t("mobileAlgo.kill.releasedBody")}</Text>
          {res.failed ? <Banner tone="warn" title={t("mobileAlgo.ctl.failedTitle", { count: res.failed })} body={t("mobileAlgo.ctl.failedBody")} /> : null}
          <Button label={t("common.done")} onPress={dismiss} testID="kill-ok" />
        </View>
      ) : mode === "kill" ? (
        <View style={{ gap: space[4], paddingTop: space[2] }} testID="kill-sheet">
          <View style={{ gap: space[2] }}>
            <Display size="md">{t("mobileAlgo.kill.title")}</Display>
            <Text tone="secondary">{t("mobileAlgo.kill.body", { count: running })}</Text>
          </View>
          <SwitchRow testID="kill-all-close" title={t("mobileAlgo.kill.alsoClose")} hint={t("mobileAlgo.kill.alsoCloseHint")} value={close} onChange={setClose} />
          <FormError message={err?.message} />
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <Button label={t("common.cancel")} variant="ghost" size="md" full={false} style={{ flex: 1 }} disabled={busy} onPress={dismiss} />
            <Button testID="kill-confirm" label={t("mobileAlgo.kill.confirm")} variant="danger" size="md" full={false} style={{ flex: 1 }} loading={busy} onPress={() => void run()} />
          </View>
        </View>
      ) : (
        <View style={{ gap: space[4], paddingTop: space[2] }} testID="release-sheet">
          <View style={{ gap: space[2] }}>
            <Display size="md">{t("mobileAlgo.kill.releaseTitle")}</Display>
            <Text tone="secondary">{t("mobileAlgo.kill.releaseBody")}</Text>
          </View>
          <FormError message={err?.message} />
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <Button label={t("common.cancel")} variant="ghost" size="md" full={false} style={{ flex: 1 }} disabled={busy} onPress={dismiss} />
            <Button testID="release-confirm" label={t("mobileAlgo.kill.release")} size="md" full={false} style={{ flex: 1 }} loading={busy} onPress={() => void run()} />
          </View>
        </View>
      )}
    </Sheet>
  );
});
