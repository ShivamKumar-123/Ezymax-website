// The signed-in client as the profile screens need it: the gateway's /auth/me record carries a few fields the
// shared session type doesn't declare (identity lock, staff sessions), plus the verification badge shown in the
// More header, on Profile and on Verification.
import type { MessageKey } from "@/i18n";
import { useSession, type Me } from "@/session";

export type MeExtra = Me & {
  /** D92: name and date of birth are locked after identity verification */
  identity_locked?: boolean;
  google_linked?: boolean;
  /** a Back Office staff member opened this session as the client ("log in as client") */
  impersonation?: { mode?: "read_only" | "full"; staff_name?: string } | null;
};

export const useMeX = () => useSession((s) => s.user) as MeExtra | null;

/** View-only logins and read-only staff sessions can look but not change anything (the servers refuse it too). */
export function useReadOnly(): boolean {
  const viewer = useSession((s) => !!s.viewer);
  const staffRo = useSession((s) => (s.user as MeExtra | null)?.impersonation?.mode === "read_only");
  return viewer || staffRo;
}

export type BadgeTone = "mint" | "gold" | "ember" | "periwinkle" | "neutral";
export type KycBadge = { key: "verified" | "review" | "action" | "rejected" | "progress" | "none"; tone: BadgeTone; label: MessageKey };

/** Verification status chip (same states as the Client Area profile card). */
export function kycBadge(me: Pick<Me, "kyc_status" | "kyc_case_status"> | null | undefined): KycBadge {
  const status = me?.kyc_status ?? "unverified";
  const kase = me?.kyc_case_status ?? null;
  if (status === "verified") return { key: "verified", tone: "mint", label: "common.verified" };
  if (kase === "more_info") return { key: "action", tone: "gold", label: "kyc.levels.actionNeeded" };
  if (status === "pending" || kase === "submitted" || kase === "in_review") return { key: "review", tone: "gold", label: "kyc.levels.inReview" };
  if (status === "rejected" || kase === "rejected") return { key: "rejected", tone: "ember", label: "kyc.tracker.stage.notApproved" };
  if (kase === "draft") return { key: "progress", tone: "periwinkle", label: "profile.kycCard.inProgress" };
  return { key: "none", tone: "neutral", label: "profile.notVerified" };
}

/** Initials for the avatar ("Arjun Mehta" -> "AM"). */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const s = parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : (parts[0]?.slice(0, 2) ?? "");
  return s.toUpperCase() || "K";
}
