"use client";

import * as React from "react";
import { Button, Dialog } from "@ezymex/ui";

type Ask = { title: string; text?: React.ReactNode; confirm?: string; tone?: "ember" | "danger" };

/**
 * In-app confirmation instead of the browser's `confirm()`: `const [ask, confirmDialog] = useConfirm()`,
 * render `confirmDialog` once, then `if (!(await ask({ title: "Delete …?" }))) return;`.
 */
export function useConfirm(): [(a: Ask) => Promise<boolean>, React.ReactNode] {
  const [state, setState] = React.useState<(Ask & { resolve: (ok: boolean) => void }) | null>(null);
  const ask = React.useCallback((a: Ask) => new Promise<boolean>((resolve) => setState({ ...a, resolve })), []);
  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };
  const dialog = (
    <Dialog
      open={!!state}
      onOpenChange={(o) => !o && close(false)}
      width={440}
      title={state?.title ?? ""}
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant={state?.tone === "danger" ? "down-outline" : "ember"} onClick={() => close(true)} data-testid="confirm-ok">
            {state?.confirm ?? "Confirm"}
          </Button>
        </>
      }
    >
      {state?.text ? <div className="text-[13.5px] leading-relaxed text-fg-2">{state.text}</div> : null}
    </Dialog>
  );
  return [ask, dialog];
}
