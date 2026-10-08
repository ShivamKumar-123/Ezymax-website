"use client";

/**
 * Slim banner when the active account is a copy-trading follower account: trades are managed by the master,
 * the client watches P&L here and manages copying in the Client Area (/social/copy). Nothing is blocked.
 * Shown when the account's group is `copy` / `copy-*` (or the engine's role says so), or after the engine
 * rejected a request with `copy_account`.
 */
import * as React from "react";
import { Copy, ExternalLink } from "lucide-react";
import { useT } from "@ezymex/i18n/react";
import { useTerminal } from "@/lib/store";
import { CLIENT_AREA } from "@/lib/guest";
import { COPY_ACCOUNT_EVENT, copyMasterName, type EngineTradingAccount } from "@/lib/engine/map";

export function CopyBanner() {
  const T = useTerminal();
  const t = useT();
  const login = T.live && !T.guest ? T.session.login : null;
  const acc = T.account as Partial<EngineTradingAccount>;
  const [flagged, setFlagged] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!login) return;
    const on = () => setFlagged(login);
    window.addEventListener(COPY_ACCOUNT_EVENT, on);
    return () => window.removeEventListener(COPY_ACCOUNT_EVENT, on);
  }, [login]);

  if (!login) return null;
  const copy = !!acc.engine?.copy || flagged === login;
  if (!copy) return null;
  const master = copyMasterName(acc.nickname);
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line bg-panel px-3 py-1.5 text-[12px]" data-testid="trader-copy-banner">
      <span className="flex min-w-0 items-center gap-2">
        <Copy className="size-3.5 shrink-0 text-ember" />
        <span className="truncate text-fg-2">{master ? t("trader.copyBanner.text", { master }) : t("trader.copyBanner.textNoName")}</span>
      </span>
      <a href={`${CLIENT_AREA}/social/copy`} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 font-medium text-ember hover:underline">
        {t("trader.copyBanner.manage")} <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
