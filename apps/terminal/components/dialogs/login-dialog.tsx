"use client";

import * as React from "react";
import { ArrowUpRight, KeyRound } from "lucide-react";
import { useTerminal } from "@/lib/store";
import { CLIENT_AREA } from "@/lib/guest";
import { TDialog } from "@/components/ui/primitives";
import { EngineLoginForm } from "@/components/account/login-form";

/** Live builds: "Login to Trade Account…" inside the terminal. The new login joins the account switcher. */
export function LoginDialog() {
  const T = useTerminal();
  const open = T.ui.loginDialog;
  const close = React.useCallback(() => T.setUi({ loginDialog: false }), [T]);
  if (!open) return null;
  return (
    <TDialog open onClose={close} width={400} icon={<KeyRound />} title="Login to trade account" subtitle="Each login keeps its own session in the account switcher">
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
                Forgot password?
              </a>
              <a href={`${CLIENT_AREA}/accounts`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-fg">
                Open an account <ArrowUpRight className="size-3" />
              </a>
            </div>
          }
        />
      </div>
    </TDialog>
  );
}
