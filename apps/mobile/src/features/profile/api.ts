// Server calls of the profile screens, all through the Client Area BFF (/api/mobile/*, bearer session):
//   security/*        rewrite of /api/security/* (sessions, sign-ins, view-only logins, data requests)
//   notifications/prefs, auth/marketing   rewrites (notification topics, marketing consent)
//   auth/password, auth/stepup*           native auth routes (password change with an emailed code)
//   menu                                  native route: broker modules, support email, legal links
// Shapes mirror services/gateway (client_security.rs) and services/support (notify.rs).
import { api, apiGet, apiPost, type ApiResult } from "@/lib/api";
import { authPost } from "@/features/auth/api";

/* ---------------- query keys (useQuery / invalidate) ---------------- */

export const QK = {
  menu: "more:menu",
  kyc: "profile:kyc",
  sessions: "profile:sessions",
  logins: "profile:logins",
  viewers: "profile:viewers",
  requests: "profile:requests",
  prefs: "profile:prefs",
  marketing: "profile:marketing",
  accounts: "profile:accounts",
} as const;

/* ---------------- menu ---------------- */

export type MenuConfig = {
  modules: Record<string, boolean>;
  flags: Record<string, boolean>;
  brand: { name: string; support_email: string; website: string };
  legal: { key: "terms" | "privacy" | "risk" | "disclaimer" | "restricted"; url: string }[];
};
export const fetchMenu = () => apiGet<MenuConfig>("menu");

/* ---------------- sessions and sign-ins ---------------- */

export type SessionRow = {
  id: number;
  current: boolean;
  ip: string | null;
  user_agent: string | null;
  country: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  viewer: { id: number; label: string | null } | null;
};
export type SessionsPage = { items: SessionRow[]; idle_minutes: number; max_days: number };
export const fetchSessions = () => apiGet<SessionsPage>("security/sessions");
export const revokeSession = (id: number) => apiPost<{ status: string }>(`security/sessions/${id}/revoke`, {});
export const revokeOthers = () => apiPost<{ status: string; revoked: number }>("security/sessions/revoke-others", {});

export type LoginRow = { id: number; at: string; result: string; ip: string | null; user_agent: string | null; country: string | null; app?: string | null };
export const fetchLogins = () => apiGet<{ items: LoginRow[] }>("security/logins");

/* ---------------- view-only logins ---------------- */

export type ViewerSection = "dashboard" | "accounts" | "history" | "wallet" | "partner";
export const VIEWER_SECTIONS: ViewerSection[] = ["dashboard", "accounts", "history", "wallet", "partner"];

export type Viewer = {
  id: number;
  label: string;
  username: string;
  accounts: string[];
  sections: ViewerSection[];
  expires_at: string | null;
  revoked_at?: string | null;
  status: "active" | "expired" | "revoked";
  last_login_at: string | null;
  created_at: string;
};
export type ViewerActivity = { id: number; viewer_id: number | null; label: string | null; action: string; path: string | null; ip: string | null; user_agent: string | null; at: string };
export type ViewersPage = { items: Viewer[]; activity: ViewerActivity[]; max: number };
export const fetchViewers = () => apiGet<ViewersPage>("security/viewers");

export type ViewerDraft = { label: string; username?: string; accounts: string[]; sections: ViewerSection[]; expires_at: string | null };
export const createViewer = (d: ViewerDraft, stepupToken: string) => apiPost<{ viewer: Viewer; password: string }>("security/viewers", { ...d, username: d.username || undefined, stepup_token: stepupToken });
export const updateViewer = (id: number, d: Omit<ViewerDraft, "username">) => api<{ viewer: Viewer }>(`security/viewers/${id}`, { method: "PATCH", body: d });
export const viewerPassword = (id: number, stepupToken: string) => apiPost<{ password: string; username: string }>(`security/viewers/${id}/password`, { stepup_token: stepupToken });
export const revokeViewer = (id: number) => apiPost<{ status: string }>(`security/viewers/${id}/revoke`, {});

/** The client's trading accounts (to choose what a viewer may see). */
export type TradingAccount = { login: number; type: "live" | "demo"; groupName: string; currency: string };
export const fetchAccounts = () => apiGet<{ accounts: TradingAccount[] }>("trading/accounts");

/* ---------------- closure / data export requests (D94) ---------------- */

export type ClientRequest = {
  id: number;
  kind: "closure" | "data_export";
  status: "open" | "in_progress" | "completed" | "rejected" | "cancelled";
  reason: string | null;
  staff_note: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};
export const fetchRequests = () => apiGet<{ items: ClientRequest[] }>("security/requests");
export const createRequest = (kind: ClientRequest["kind"], reason?: string) => apiPost<{ request: ClientRequest }>("security/requests", { kind, reason: reason?.trim() || undefined });
export const cancelRequest = (id: number) => apiPost<{ request: ClientRequest }>(`security/requests/${id}/cancel`, {});
/** The personal-data export (JSON) once staff completed it. */
export const fetchExport = (id: number) => apiGet<Record<string, unknown>>(`security/requests/${id}/export`, { timeoutMs: 45_000 });

/* ---------------- password ---------------- */

export const changePassword = (current: string, next: string, stepupToken: string, signOutOthers: boolean) =>
  authPost<{ sessions_revoked: number }>("password", { current, new: next, stepup_token: stepupToken, sign_out_others: signOutOthers });

/** Same rules as the gateway (validate::password). */
export function passwordProblem(p: string) {
  if (p.length < 8) return "profile.password.rule.min" as const;
  if (p.length > 128) return "profile.password.rule.max" as const;
  if (!/[A-Z]/.test(p)) return "profile.password.rule.upper" as const;
  if (!/[a-z]/.test(p)) return "profile.password.rule.lower" as const;
  if (!/[0-9]/.test(p)) return "profile.password.rule.number" as const;
  if (!/[^A-Za-z0-9]/.test(p)) return "profile.password.rule.symbol" as const;
  return null;
}

/* ---------------- notification preferences ---------------- */

export type PrefCategory = { key: string; label: string; hint: string; locked: boolean };
export type Prefs = Record<string, { inApp: boolean; email: boolean }>;
export const fetchPrefs = () => apiGet<{ catalog: PrefCategory[]; prefs: Prefs }>("notifications/prefs");
export const savePref = (key: string, channel: "inApp" | "email", value: boolean) => api<{ prefs: Prefs }>("notifications/prefs", { method: "PUT", body: { prefs: { [key]: { [channel]: value } } } });

export const fetchMarketing = () => apiGet<{ marketing_consent?: boolean }>("auth/marketing");
export const saveMarketing = (consent: boolean): Promise<ApiResult<{ marketing_consent?: boolean }>> => api("auth/marketing", { method: "PUT", body: { consent } });
