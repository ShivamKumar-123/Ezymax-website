import { create } from "zustand";

import { apiFetch } from "@/lib/api-client";

/**
 * Per-browser waitlist state.
 *
 * The landing is invite-only: login/register are hidden until this visitor's
 * request is approved. We remember the applicant's email in localStorage and
 * re-check its status (none | pending | approved | rejected) against the
 * server so the CTA reflects reality across visits.
 */
export type WaitlistStatus = "none" | "pending" | "approved" | "rejected";

const KEY = "fx_waitlist_email";

interface WaitlistState {
  hydrated: boolean;
  email: string | null;
  status: WaitlistStatus;
  hydrate: () => Promise<void>;
  submit: (input: { full_name: string; email: string; phone?: string }) => Promise<WaitlistStatus>;
  refresh: (email?: string) => Promise<void>;
  reset: () => void;
}

export const useWaitlist = create<WaitlistState>((set, get) => ({
  hydrated: false,
  email: null,
  status: "none",

  hydrate: async () => {
    if (get().hydrated) return;
    let email: string | null = null;
    try {
      email = localStorage.getItem(KEY);
    } catch {
      /* localStorage unavailable (private mode) — treat as fresh visitor */
    }
    set({ hydrated: true, email });
    if (email) await get().refresh(email);
  },

  submit: async ({ full_name, email, phone }) => {
    const data = await apiFetch<{ status: WaitlistStatus; message: string }>("/api/waitlist", {
      method: "POST",
      body: JSON.stringify({ full_name, email, phone }),
    });
    try {
      localStorage.setItem(KEY, email);
    } catch {
      /* ignore */
    }
    set({ email, status: data.status });
    return data.status;
  },

  refresh: async (email) => {
    const addr = email ?? get().email;
    if (!addr) return;
    try {
      const data = await apiFetch<{ status: WaitlistStatus }>(
        `/api/waitlist?email=${encodeURIComponent(addr)}`,
      );
      set({ status: data.status });
    } catch {
      /* network hiccup — keep the last known status */
    }
  },

  reset: () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    set({ email: null, status: "none" });
  },
}));
