"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Logo } from "@/components/kit";
import { Trans, useT } from "@kalks/i18n/react";

type State = { kind: "ask" } | { kind: "busy" } | { kind: "done"; email: string } | { kind: "error"; message: string };

export function UnsubscribeCard({ u, s }: { u: string; s: string }) {
  const t = useT();
  const valid = /^\d{1,18}$/.test(u) && /^[0-9a-f]{32}$/.test(s);
  const [st, setSt] = React.useState<State>(valid ? { kind: "ask" } : { kind: "error", message: t("shell.system.unsubscribe.incompleteLink") });
  const go = async () => {
    setSt({ kind: "busy" });
    try {
      const r = await fetch("/api/unsubscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ u: Number(u), s }) });
      const d = (await r.json().catch(() => ({}))) as { email?: string; error?: { message?: string } };
      if (!r.ok) return setSt({ kind: "error", message: d.error?.message ?? t("shell.system.unsubscribe.genericError") });
      setSt({ kind: "done", email: d.email ?? t("shell.system.unsubscribe.yourAddress") });
    } catch {
      setSt({ kind: "error", message: t("shell.system.unsubscribe.networkError") });
    }
  };
  return (
    <div className="w-full max-w-md text-center" data-testid="unsubscribe">
      <Logo height={26} className="mx-auto" />
      {st.kind === "done" ? (
        <>
          <h1 className="mt-10 text-[26px] font-medium tracking-[-0.02em]">{t("shell.system.unsubscribe.doneTitle")}</h1>
          <p className="mt-3 text-[15px] text-fg-2">
            <Trans k="shell.system.unsubscribe.doneText" vars={{ email: st.email }} tags={{ email: (c) => <span className="font-mono text-fg">{c}</span> }} />
          </p>
          <p className="mt-3 text-[13px] text-fg-3">{t("shell.system.unsubscribe.doneHint")}</p>
        </>
      ) : st.kind === "error" ? (
        <>
          <h1 className="mt-10 text-[26px] font-medium tracking-[-0.02em]">{t("shell.system.unsubscribe.invalidTitle")}</h1>
          <p className="mt-3 text-[15px] text-fg-2">{st.message}</p>
        </>
      ) : (
        <>
          <h1 className="mt-10 text-[26px] font-medium tracking-[-0.02em]">{t("shell.system.unsubscribe.askTitle")}</h1>
          <p className="mt-3 text-[15px] text-fg-2">{t("shell.system.unsubscribe.askText")}</p>
          <Button variant="ember" size="lg" className="mt-8" onClick={go} disabled={st.kind === "busy"} data-testid="unsubscribe-confirm">
            {st.kind === "busy" ? t("shell.system.unsubscribe.busy") : t("shell.system.unsubscribe.confirm")}
          </Button>
        </>
      )}
      <div className="mt-8">
        <Link href="/" className="text-[13.5px] text-ember hover:underline">
          {t("shell.system.unsubscribe.goToClientArea")}
        </Link>
      </div>
    </div>
  );
}
