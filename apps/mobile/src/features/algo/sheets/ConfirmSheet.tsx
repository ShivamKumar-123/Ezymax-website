// A confirmation in a bottom sheet for one server action (revoke a key, delete a webhook, cancel a subscription,
// archive a strategy): what happens, the action button, the server's error in place when it refuses. Never
// optimistic: the sheet closes only after the server confirmed, then the caller shows the result.
import * as React from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import type { ApiError, ApiResult } from "@/lib/api";
import { Button, Display, FormError, Sheet, Text, type SheetRef } from "@/ui";
import { space } from "@/theme/tokens";

export type ConfirmSpec = {
  title: string;
  body: string;
  confirm: string;
  /** the button that closes the sheet without acting (default "Cancel") */
  dismiss?: string;
  danger?: boolean;
  run: () => Promise<ApiResult<unknown>>;
  onDone?: () => void;
  testID?: string;
};

export const ConfirmSheet = React.forwardRef<SheetRef, { spec: ConfirmSpec | null }>(function ConfirmSheet({ spec }, ref) {
  const t = useT();
  const sheet = React.useRef<SheetRef>(null);
  React.useImperativeHandle(ref, () => sheet.current as SheetRef, []);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  React.useEffect(() => {
    setErr(null);
    setBusy(false);
  }, [spec]);
  // closed while the server answers: a refusal comes back in the sheet
  const shown = React.useRef(false);

  const go = async () => {
    if (!spec || busy) return;
    setBusy(true);
    setErr(null);
    const r = await spec.run();
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      if (!shown.current) sheet.current?.present();
      return;
    }
    sheet.current?.dismiss();
    spec.onDone?.();
  };

  return (
    <Sheet
      ref={sheet}
      onChange={(i) => {
        shown.current = i >= 0;
      }}
      onDismiss={() => {
        shown.current = false;
        if (!busy) setErr(null);
      }}
    >
      {spec ? (
        <View style={{ gap: space[4], paddingTop: space[2] }} testID={spec.testID}>
          <View style={{ gap: space[2] }}>
            <Display size="md">{spec.title}</Display>
            <Text tone="secondary">{spec.body}</Text>
          </View>
          <FormError message={err?.message} />
          <View style={{ gap: space[2] }}>
            <Button testID={spec.testID ? `${spec.testID}-confirm` : undefined} label={spec.confirm} variant={spec.danger ? "danger" : "primary"} size="md" loading={busy} onPress={() => void go()} />
            <Button label={spec.dismiss ?? t("common.cancel")} variant="ghost" size="md" disabled={busy} onPress={() => sheet.current?.dismiss()} />
          </View>
        </View>
      ) : (
        <View />
      )}
    </Sheet>
  );
});
