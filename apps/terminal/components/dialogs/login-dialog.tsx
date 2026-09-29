"use client";

import * as React from "react";
import { ArrowUpRight, KeyRound } from "lucide-react";
import { useTerminal } from "@/lib/store";
import { useT } from "@kalks/i18n/react";
import { CLIENT_AREA } from "@/lib/guest";
import { TDialog } from "@/components/ui/primitives";
import { EngineLoginForm } from "@/components/account/login-form";

/** Live builds: "Login to Trade Account…" inside the terminal. The new login joins the account switcher. */
export function LoginDialog() {
  const T = useTerminal();
  const t = useT();
  const open = T.ui.loginDialog;
  const close = React.useCallback(() => T.setUi({ loginDialog: false }), [T]);
  if (!open) return null;
  return (
    <TDialog open onClose={close} width={400} icon={<KeyRound />} title={t("trader.loginDialog.title")} subtitle={t("trader.loginDialog.subtitle")}>
      <div className="p-4">
        <EngineLoginForm
          autoFocus
          onSuccess={(r) => {
            close();
            if (T.guest) return window.location.replace(`/?account=${r.login}`);
            void T.accountAdded(r.login);
          }}
          footer={
            <div className="flex items-center justify-between text-[11.5px] text-fg-3">
              <a href={`${CLIENT_AREA}/accounts`} target="_blank" rel="noreferrer" className="hover:text-fg">
                {t("trader.login.forgotPassword")}
              </a>
              <a href={`${CLIENT_AREA}/accounts`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-fg">
                {t("trader.login.openAnAccount")} <ArrowUpRight className="size-3" />
              </a>
            </div>
          }
        />
      </div>
    </TDialog>
  );
}
