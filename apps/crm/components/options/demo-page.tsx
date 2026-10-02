"use client";

// Demo Options page: the same screens with local state (nothing is saved). Like the gateway, accepting the options
// terms ("Start trading options") is the only step.

import * as React from "react";
import { toast } from "sonner";
import { ACCOUNTS } from "@kalks/mock";
import { useT } from "@kalks/i18n/react";
import { TERMINAL_URL } from "@/lib/live";
import type { Suitability } from "./api";
import { demoSuitability } from "./demo";
import { OptionsPage, type OptionsController, type TradeAccount } from "./ui";

export function DemoOptions() {
  const t = useT();
  const [data, setData] = React.useState<Suitability>(() => demoSuitability());

  const accounts = React.useMemo<TradeAccount[]>(
    () => ACCOUNTS.filter((a) => !a.cent).map((a) => ({ login: Number(a.login), type: a.type, name: a.nickname ?? `${a.group} · ${a.mode === "netting" ? "Netting" : "Hedging"}` })),
    [],
  );

  const ctl: OptionsController = {
    data,
    error: null,
    reload: () => {},
    demo: true,
    readOnly: false,
    accounts,
    accept: async (version) => {
      await new Promise((r) => setTimeout(r, 450));
      setData((d) => ({ ...d, disclosureAccepted: true, acceptedVersion: version, acceptedAt: new Date().toISOString(), eligible: true, missing: [] }));
      toast.success(t("options.intro.toastStarted"));
      return true;
    },
    openTrader: async (a, before) => {
      // the tab opens inside the click (popup blockers), then the acceptance is recorded
      const w = window.open("about:blank", "_blank");
      if (before && !(await before())) {
        w?.close();
        return;
      }
      const url = `${TERMINAL_URL}/?account=${a.login}&mode=options`;
      if (w && !w.closed) {
        w.opener = null;
        w.location.replace(url);
      } else window.location.assign(url);
    },
  };
  return <OptionsPage ctl={ctl} />;
}
