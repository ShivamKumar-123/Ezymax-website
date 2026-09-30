// Writes sent from a bottom sheet (redeem, claim, join, a new campaign link) always end on the server's answer, like
// the wallet's money sheets:
// - one request at a time: a second tap, the keyboard's return key or a reopened sheet can't send it again;
// - while it is in flight the sheet can't be swiped away and its form is not reset;
// - closed with a tap outside meanwhile, the sheet comes back when the answer arrives, so a one-time credential, a
//   voucher code or the reason for a refusal is never lost.
import * as React from "react";
import type { SheetRef } from "@/ui";

export function useSheetWrite(sheetRef: React.RefObject<SheetRef | null>) {
  const shown = React.useRef(false);
  const inflight = React.useRef(false);
  const [busy, setBusy] = React.useState(false);

  /** Sheet callbacks: `shown` turns false as soon as the sheet starts to close (a tap outside, a swipe). */
  const sheetProps = React.useMemo(
    () => ({
      onAnimate: (_from: number, to: number) => {
        shown.current = to >= 0;
      },
      onChange: (index: number) => {
        shown.current = index >= 0;
      },
    }),
    [],
  );

  /** Runs one write; resolves to its result, or null when another one is still in flight. */
  const run = React.useCallback(async <R>(fn: () => Promise<R>): Promise<R | null> => {
    if (inflight.current) return null;
    inflight.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }, []);

  /** Shows the sheet again when it was closed while the server was answering. */
  const bringBack = React.useCallback(() => {
    if (!shown.current) sheetRef.current?.present();
  }, [sheetRef]);

  /** A write is in flight (read in onDismiss: the form must not be reset under it). */
  const sending = React.useCallback(() => inflight.current, []);

  return { busy, run, bringBack, sending, sheetProps, shown };
}

/** A guard for writes sent from a screen (not a sheet): one request at a time, whatever fires it. */
export function useOneAtATime() {
  const inflight = React.useRef(false);
  const [busy, setBusy] = React.useState(false);
  const run = React.useCallback(async <R>(fn: () => Promise<R>): Promise<R | null> => {
    if (inflight.current) return null;
    inflight.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, run };
}
