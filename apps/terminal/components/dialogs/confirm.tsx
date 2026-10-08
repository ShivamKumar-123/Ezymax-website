"use client";

// Confirm step for destructive bulk actions (close all / profitable / losing…, cancel all orders): one small dialog,
// opened from anywhere through askConfirm(). docs/TERMINAL-DESIGN.md §2.5 "Strong, logical keys".
import * as React from "react";
import { TriangleAlert } from "lucide-react";
import { useT } from "@ezymex/i18n/react";
import { TDialog } from "@/components/ui/primitives";
import { Button } from "@/components/ui/kit";

export interface ConfirmRequest {
  title: string;
  text: string;
  confirmLabel?: string;
  run: () => void;
}

let current: ConfirmRequest | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Ask before running a destructive action. */
export function askConfirm(r: ConfirmRequest) {
  current = r;
  emit();
}

export function ConfirmLayer() {
  const t = useT();
  const req = React.useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => current,
    () => null,
  );
  const close = React.useCallback(() => {
    current = null;
    emit();
  }, []);
  const ok = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (req) setTimeout(() => ok.current?.focus(), 30);
  }, [req]);
  if (!req) return null;
  return (
    <TDialog
      open
      onClose={close}
      width={420}
      icon={<TriangleAlert />}
      title={req.title}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            ref={ok}
            variant="primary"
            className="bg-sell-fill"
            onClick={() => {
              const run = req.run;
              close();
              run();
            }}
          >
            {req.confirmLabel ?? t("desk.cf.confirm")}
          </Button>
        </>
      }
    >
      <p className="px-4 py-3.5 text-[13px] leading-[19px] text-fg-2">{req.text}</p>
    </TDialog>
  );
}
