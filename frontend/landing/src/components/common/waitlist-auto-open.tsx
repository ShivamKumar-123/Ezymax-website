"use client";

import { useEffect } from "react";

import { useUi } from "@/lib/ui-store";
import { useWaitlist } from "@/lib/waitlist-store";

/**
 * Auto-opens the waitlist form once when a fresh visitor lands, so the
 * invite-only ask is front-and-centre. Skipped for visitors who are already
 * pending/approved, and shown at most once per browser session (the modal's
 * own close/backdrop/Escape dismiss it). Waits for the intro loader to finish.
 */
const SESSION_KEY = "fx_waitlist_prompted";

export const WaitlistAutoOpen = () => {
  const hydrate = useWaitlist((s) => s.hydrate);
  const hydrated = useWaitlist((s) => s.hydrated);
  const status = useWaitlist((s) => s.status);
  const ready = useUi((s) => s.ready);
  const setWaitlistOpen = useUi((s) => s.setWaitlistOpen);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!ready || !hydrated) return;
    if (status !== "none") return; // already on the list / approved — don't nag

    let prompted = false;
    try {
      prompted = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      /* sessionStorage unavailable — fall through and prompt once */
    }
    if (prompted) return;

    const id = setTimeout(() => {
      setWaitlistOpen(true);
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
    }, 1500);
    return () => clearTimeout(id);
  }, [ready, hydrated, status, setWaitlistOpen]);

  return null;
};
