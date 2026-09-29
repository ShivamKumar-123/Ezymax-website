// KYC state through the BFF (/api/mobile/kyc -> /api/kyc -> gateway /v1/kyc): read with the screen cache (opens
// on the saved state, refreshes in the background), and every change answers with the new state, which replaces
// the cached one. The session's profile is refreshed after a change so the More header's chip follows.
import { apiGet, apiPost } from "@/lib/api";
import { setQueryData, useQuery } from "@/lib/query";
import { refreshMe } from "@/session";
import { QK } from "../api";
import type { KycState } from "./types";

export const fetchKyc = () => apiGet<KycState>("kyc");
export const kycPost = (action: "start" | "details" | "submit", body: unknown) => apiPost<KycState>(`kyc/${action}`, body);

export function useKyc(pollMs?: number, enabled = true) {
  return useQuery<KycState>(QK.kyc, fetchKyc, { persist: true, staleMs: 10_000, intervalMs: pollMs, enabled });
}

/** A new state from the server (start, details, upload, submit). */
export function applyKyc(s: KycState, refreshProfile = false) {
  setQueryData(QK.kyc, s, true);
  if (refreshProfile) void refreshMe();
}

export const hoursLabel = (t: (k: "kyc.hours", v: { count: number }) => string, h: number) => t("kyc.hours", { count: h <= 1 ? 1 : h });
