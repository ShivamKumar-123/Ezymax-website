"use client";

// A temporary notice that work is going on, shown at the top of every Client Area page.
//
// TEMPORARY: this is here while the dashboard is being rebuilt. Remove the component and its line in
// client-shell.tsx once that work ships - a notice that outlives the work it describes teaches people to
// ignore the next one.
//
// It is deliberately a notice and not a maintenance page. Clients have open leveraged positions and real
// balances here; locking them out while the market moves could cost them a margin call they could not act on.
// So nothing is blocked - the bar only explains why things may look different today.

import { Wrench } from "lucide-react";
import { useT } from "@ezymex/i18n/react";

export function MaintenanceNotice() {
  const t = useT();
  return (
    <div role="status" className="border-b border-ember/25 bg-ember-soft">
      <div className="mx-auto flex max-w-[1640px] items-center gap-2.5 px-4 py-2.5 sm:px-6 lg:px-8">
        <Wrench className="size-4 shrink-0 text-ember" strokeWidth={2} />
        <p className="text-[12.5px] font-medium leading-snug text-fg-2">{t("shell.maintenance.text")}</p>
      </div>
    </div>
  );
}
