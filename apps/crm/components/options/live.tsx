"use client";

// Live Options page: suitability from the gateway (/api/suitability/options) and the client's Options accounts from
// the engine (an account trades CFDs or options, never both); "Start trading options" records the acceptance of the
// options terms and opens Ezymex Trader through the usual one-time SSO link, in options mode.

import * as React from "react";
import { toast } from "sonner";
import { tr, useT } from "@ezymex/i18n/react";
import { useReadOnly, useSession } from "@/components/session";
import { errorToast, productOf, tradingApi, useAccounts, withOptionsMode } from "@/components/trading/api";
import { accountFlavor } from "@/components/trading/archive";
import { isPropAccount } from "@/components/trading/ui";
import { TERMINAL_URL } from "@/lib/live";
import { SuitabilityError, suitabilityApi, useSuitability, type Suitability } from "./api";
import { OptionsPage, type OptionsController, type TradeAccount } from "./ui";

/** Opens Ezymex Trader signed in to `login`, in options mode. The tab opens inside the click (popup blockers), then
 *  `before` runs (e.g. recording the acceptance): false closes the tab again. */
async function openOptionsTerminal(login: number, before?: () => Promise<boolean>) {
  const w = window.open("about:blank", "_blank");
  try {
    if (before && !(await before())) {
      w?.close();
      return;
    }
    const r = await tradingApi<{ url: string }>(`accounts/${login}/sso`, { body: {} });
    const url = withOptionsMode(r.url);
    if (w && !w.closed) {
      w.opener = null;
      w.location.replace(url);
    } else {
      window.location.assign(url);
    }
  } catch (e) {
    w?.close();
    errorToast(tr("accounts.toast.openTraderFailed"), e);
  }
}

export function LiveOptions() {
  const t = useT();
  const user = useSession() as ReturnType<typeof useSession> & { impersonation?: unknown };
  // view-only logins and staff sessions (even full access) can't accept the terms for the client
  const readOnly = useReadOnly() || !!user.impersonation;
  const s = useSuitability();
  const { data: acc, error: accError } = useAccounts(0);

  const accounts = React.useMemo<TradeAccount[] | null>(() => {
    if (!acc) return null;
    return acc.accounts
      .filter((a) => a.status === "active" && productOf(a) === "options" && !isPropAccount(a) && !accountFlavor(a))
      .sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault) || (a.type === b.type ? 0 : a.type === "live" ? -1 : 1) || a.login - b.login)
      .map((a) => ({ login: a.login, type: a.type, name: a.name || a.groupName }));
  }, [acc]);

  const accept = React.useCallback(
    async (version: number) => {
      try {
        const d = await suitabilityApi<Suitability>("options/accept", { version });
        s.set(d);
        toast.success(t("options.intro.toastStarted"));
        return true;
      } catch (e) {
        if (e instanceof SuitabilityError && e.code === "disclosure_outdated") {
          toast.warning(t("options.intro.toastUpdated"));
          s.reload();
        } else toast.error(t("options.intro.toastFailed"), { description: e instanceof Error ? e.message : undefined });
        return false;
      }
    },
    [s, t],
  );

  const ctl: OptionsController = {
    data: s.data,
    error: s.error ? `${t("options.error.load")} ${s.error.message}` : null,
    reload: s.reload,
    accept,
    accounts,
    traderHref: !acc && accError ? `${TERMINAL_URL}/?mode=options` : null,
    openTrader: (a, before) => openOptionsTerminal(a.login, before),
    readOnly,
  };
  return <OptionsPage ctl={ctl} />;
}
