"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Logo } from "@kalks/ui";

type State = { kind: "ask" } | { kind: "busy" } | { kind: "done"; email: string } | { kind: "error"; message: string };

export function UnsubscribeCard({ u, s }: { u: string; s: string }) {
  const valid = /^\d{1,18}$/.test(u) && /^[0-9a-f]{32}$/.test(s);
  const [st, setSt] = React.useState<State>(valid ? { kind: "ask" } : { kind: "error", message: "This unsubscribe link isn't complete. Open it again from the email, or change your email preferences in the Client Area under Profile → Notifications." });
  const go = async () => {
    setSt({ kind: "busy" });
    try {
      const r = await fetch("/api/unsubscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ u: Number(u), s }) });
      const d = (await r.json().catch(() => ({}))) as { email?: string; error?: { message?: string } };
      if (!r.ok) return setSt({ kind: "error", message: d.error?.message ?? "Something went wrong. Please try again." });
      setSt({ kind: "done", email: d.email ?? "your address" });
    } catch {
      setSt({ kind: "error", message: "We couldn't reach the server. Please try again." });
    }
  };
  return (
    <div className="w-full max-w-md text-center" data-testid="unsubscribe">
      <Logo height={26} className="mx-auto" />
      {st.kind === "done" ? (
        <>
          <h1 className="mt-10 text-[26px] font-medium tracking-[-0.02em]">You&apos;re unsubscribed</h1>
          <p className="mt-3 text-[15px] text-fg-2">
            We won&apos;t send news and offers to <span className="font-mono text-fg">{st.email}</span> any more. Account emails such as sign-in codes, deposits, withdrawals and verification still arrive.
          </p>
          <p className="mt-3 text-[13px] text-fg-3">Changed your mind? Switch it back on in the Client Area under Profile → Notifications.</p>
        </>
      ) : st.kind === "error" ? (
        <>
          <h1 className="mt-10 text-[26px] font-medium tracking-[-0.02em]">Link not valid</h1>
          <p className="mt-3 text-[15px] text-fg-2">{st.message}</p>
        </>
      ) : (
        <>
          <h1 className="mt-10 text-[26px] font-medium tracking-[-0.02em]">Unsubscribe from news and offers?</h1>
          <p className="mt-3 text-[15px] text-fg-2">You&apos;ll stop getting promotional emails. Account emails such as sign-in codes, deposits, withdrawals and verification are not affected.</p>
          <Button variant="ember" size="lg" className="mt-8" onClick={go} disabled={st.kind === "busy"} data-testid="unsubscribe-confirm">
            {st.kind === "busy" ? "Unsubscribing…" : "Unsubscribe"}
          </Button>
        </>
      )}
      <div className="mt-8">
        <Link href="/" className="text-[13.5px] text-ember hover:underline">
          Go to the Client Area
        </Link>
      </div>
    </div>
  );
}
