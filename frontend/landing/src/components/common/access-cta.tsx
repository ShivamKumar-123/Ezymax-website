"use client";

import { useEffect } from "react";

import { PillButton } from "@/components/ui/pill-button";
import { tradeConfig } from "@/lib/site";
import { useUi } from "@/lib/ui-store";
import { useWaitlist } from "@/lib/waitlist-store";

/**
 * The access call-to-action. The landing is invite-only, so what we show
 * depends on this visitor's waitlist status:
 *   none / rejected → "Join Waitlist" (opens the form)
 *   pending         → "On the waitlist" badge (login/register stay hidden)
 *   approved        → "Log in" + "Open account" (their account exists)
 */
export const AccessCta = ({ layout = "row" }: { layout?: "row" | "stack" }) => {
  const hydrate = useWaitlist((s) => s.hydrate);
  const hydrated = useWaitlist((s) => s.hydrated);
  const status = useWaitlist((s) => s.status);
  const setWaitlistOpen = useUi((s) => s.setWaitlistOpen);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const wrap = layout === "stack" ? "flex flex-col items-start gap-3" : "flex flex-wrap items-center gap-3";

  // Log in is ALWAYS available — the platform has existing users who must be
  // able to sign in from the landing. What changes is the "new user" door:
  // self-serve registration is replaced by the invite-only waitlist.

  // Fresh / rejected visitor: request access + log in.
  if (!hydrated || status === "none" || status === "rejected") {
    return (
      <div className={wrap}>
        <PillButton variant="dark" arrow="right" onClick={() => setWaitlistOpen(true)}>
          Join Waitlist
        </PillButton>
        <PillButton variant="outline" href={tradeConfig.login}>
          Log in
        </PillButton>
      </div>
    );
  }

  // Pending approval: show the badge, but still let them (or an existing
  // user on the same browser) log in.
  if (status === "pending") {
    return (
      <div className={wrap}>
        <span className="inline-flex items-center gap-2 rounded-pill border border-accent/30 bg-accent/[0.06] px-6 py-3.5 text-sm font-bold text-accent">
          <span className="size-1.5 rounded-full bg-accent" />
          On the waitlist — pending approval
        </span>
        <PillButton variant="outline" href={tradeConfig.login}>
          Log in
        </PillButton>
      </div>
    );
  }

  // Approved: create the account (register) or log in.
  return (
    <div className={wrap}>
      <PillButton variant="dark" arrow="right" href={tradeConfig.register}>
        Open account
      </PillButton>
      <PillButton variant="outline" href={tradeConfig.login}>
        Log in
      </PillButton>
    </div>
  );
};
