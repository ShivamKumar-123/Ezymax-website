// Shapes returned by the gateway admin API (services/gateway/src/admin.rs) via /api/admin/*.

export type Stats = {
  clients: { total: number; email_verified: number; kyc_verified: number; kyc_pending: number; registered_today: number; registered_7d: number; registered_30d: number; online?: number; away?: number; restricted?: number; hidden?: number; deleted?: number };
  sessions: { clients: number; staff: number };
  staff: { active: number };
  security: { logins_24h: number; failed_logins_24h: number; audit_events_24h: number };
  registrations: { day: string; count: number }[];
  generated_at: string;
};

export type Client = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  name: string;
  phone_dial: string;
  phone: string;
  country: string;
  date_of_birth: string;
  referral_code: string;
  /** The client's code from before name-free codes (2026-10-10, first name + digits); it still attributes sign-ups. */
  referral_code_legacy?: string | null;
  referred_by: number | null;
  kyc_status: "unverified" | "pending" | "verified" | "rejected";
  status: "active" | "blocked" | "closed";
  email_verified: boolean;
  email_verified_at: string | null;
  locked: boolean;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
  active_sessions: number;
  /** Presence (gateway client_controls.rs): online = active in the last 2 min, away = 2–15 min. */
  presence?: "online" | "away" | "offline";
  last_active_at?: string | null;
  /** Apps the client is in right now: client_area, trader. */
  apps?: string[];
  /** Active restriction kinds (login, trading, close_only, deposits, withdrawals, transfers, ib, social, freeze). */
  restrictions?: string[];
  /** Hidden from the Back Office lists (test / spam account; gateway client_lifecycle.rs). The client is not affected. */
  hidden?: boolean;
  hidden_at?: string | null;
  /** Deleted with history: personal data erased, account closed, financial records kept. */
  deleted?: boolean;
  deleted_at?: string | null;
};

export type Paged<T> = { items: T[]; total: number; page: number; per_page: number };
/** `counts`: what the "Show hidden" switch adds (hidden clients, deleted clients). */
export type UsersPage = Paged<Client> & { counts?: { hidden: number; deleted: number } };

export type AuditEvent = {
  id: number;
  actor: { kind: "user" | "staff" | "system" | "anonymous"; id: number | null; name?: string | null; email?: string | null; role_label?: string | null };
  action: string;
  target: { kind: string | null; id: number | null; name?: string | null; email?: string | null };
  ip: string | null;
  user_agent: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};
export type AuditPage = Paged<AuditEvent> & { actions: string[] };

export type ClientDetail = {
  user: Client & {
    terms_accepted_at: string | null;
    failed_logins: number;
    updated_at: string | null;
    referred_code_raw: string | null;
    /** The code used at sign-up belongs to a client whose referral link wasn't active (no deposit yet, or the wallet
     *  couldn't be asked), so the sign-up was not attributed; `referral_held_for` is that client. */
    referral_held?: "not_funded" | "unverified" | null;
    /** Who hid / deleted the client (staff name) and why. */
    hidden_reason?: string | null;
    hidden_by?: string | null;
    deleted_reason?: string | null;
    deleted_by?: string | null;
  };
  referrer: { id: number; email: string; name: string; referral_code: string } | null;
  referral_held_for?: { id: number; email: string; name: string; referral_code: string } | null;
  referrals: { total: number; items: { id: number; email: string; name: string; kyc_status: string; email_verified: boolean; created_at: string }[] };
  sessions: { active: number; total: number };
  trusted_devices: number;
  last_login: { at: string; ip: string | null; user_agent: string | null; via: string | null } | null;
  /** First-touch marketing attribution and marketing-email consent (gateway marketing.rs). */
  attribution?: {
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_term: string | null;
    utm_content: string | null;
    landing_page: string | null;
    referrer: string | null;
    partner_campaign: string | null;
    marketing_consent: boolean;
    marketing_consent_at: string | null;
    marketing_unsubscribed_at: string | null;
  };
  events: AuditEvent[];
};

export type Session = {
  id: number;
  fingerprint: string;
  subject: { kind: "user" | "staff"; id: number; name: string | null; email: string | null; role_label: string | null };
  ip: string | null;
  /** Approximate location (ISO country, lowercase) from the edge, when known. */
  country?: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  current: boolean;
  /** A client's view-only login (D90) signed in on the client's account. */
  viewer?: { id: number; label: string | null } | null;
};
export type SessionsPage = Paged<Session>;

export type StaffMember = {
  id: number;
  email: string;
  name: string;
  role: string;
  role_label: string;
  status: "active" | "disabled";
  locked: boolean;
  last_login_at: string | null;
  last_activity_at: string | null;
  created_at: string;
  active_sessions: number;
  trusted_devices: number;
  is_me: boolean;
};

export type HealthResp = {
  checked_at: string;
  services: { key: string; name: string; detail: string; ok: boolean; reachable: boolean; latency_ms: number; facts: Record<string, string> }[];
};
