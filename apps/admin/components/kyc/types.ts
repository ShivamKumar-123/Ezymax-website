// Shapes returned by the gateway KYC staff API (services/gateway/src/kyc/staff.rs) via /api/admin/kyc/*.

export type CaseStatus = "draft" | "submitted" | "in_review" | "more_info" | "approved" | "rejected";
export type Slot = { kind: string; side: string; party?: string | null };

export type Sla = { hours: number; age_seconds: number | null; due_at: string | null; remaining_seconds: number | null; breached: boolean } | null;

export type QueueItem = {
  id: number;
  reference: string;
  kind: "individual" | "corporate";
  status: CaseStatus;
  level: number;
  id_doc_type: string | null;
  company: string | null;
  user: { id: number; name: string; email: string; country: string; date_of_birth: string; kyc_status: string };
  reviewer: { id: number; name: string | null } | null;
  documents: number;
  flags: { duplicate_documents: number };
  submissions: number;
  risk_level: "low" | "medium" | "high" | null;
  decision: { code: string; label: string | null } | null;
  submitted_at: string | null;
  first_submitted_at: string | null;
  decided_at: string | null;
  created_at: string;
  sla: Sla;
};

export type QueuePage = {
  items: QueueItem[];
  total: number;
  page: number;
  per_page: number;
  counts: { submitted: number; in_review: number; more_info: number; draft: number; approved_7d: number; rejected_7d: number; breached: number };
  sla_hours: number;
  typical_hours: number;
  can_review: boolean;
};

export type ClientChecks = {
  source?: "camera" | "file";
  width?: number;
  height?: number;
  blur?: { score: number; ok: boolean };
  glare?: { pct: number; ok: boolean };
  brightness?: { mean: number; ok: boolean };
  resolution?: { ok: boolean; min: number };
  fill?: { ratio: number; ok: boolean };
  mrz?: { found: boolean; lines: number };
  face?: { found: boolean; method: string; centered?: boolean };
  issue_date?: { date: string; age_days: number; ok: boolean };
  skipped?: string;
};

export type ServerChecks = {
  format?: { ok: boolean; detected: string; declared: string; matches_declared: boolean };
  size?: { ok: boolean; bytes: number };
  resolution?: { ok: boolean | null; width: number | null; height: number | null; min_side: number };
  issue_date?: { ok: boolean | null; date: string | null; max_age_days: number };
  duplicate_other_clients?: number;
  encrypted?: string;
};

export type CaseDoc = {
  id: number;
  kind: string;
  side: string;
  party: string | null;
  label: string;
  doc_type: string | null;
  sha256: string;
  mime: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  original_name: string | null;
  issue_date: string | null;
  checks: { client?: ClientChecks | null; server?: ServerChecks };
  status: "uploaded" | "accepted" | "rejected" | "superseded";
  current: boolean;
  created_at: string;
  viewable: boolean;
  duplicates: { sha256: string; user_id: number; name: string; email: string }[];
};

export type Party = { key: string; first_name: string; last_name: string; date_of_birth: string; nationality: string; roles: string[]; ownership: number | null; id_type: string };

export type CaseDetail = {
  case: {
    id: number;
    reference: string;
    kind: "individual" | "corporate";
    status: CaseStatus;
    level: number;
    id_doc_type: string | null;
    details: {
      address?: { line1: string; line2: string; city: string; postcode: string; country: string };
      company?: { name: string; reg_number: string; country: string; incorporated_on: string; business: string; address: { line1: string; line2: string; city: string; postcode: string; country: string } };
      parties?: Party[];
    };
    requested: Slot[];
    requested_labels: string[];
    request_message: string | null;
    decision: { code: string; label: string | null; message: string | null } | null;
    allow_resubmit: boolean;
    risk_level: "low" | "medium" | "high" | null;
    risk_notes: string | null;
    checklist: Record<string, boolean>;
    reviewer: { id: number; name: string | null; is_me: boolean } | null;
    submissions: number;
    first_submitted_at: string | null;
    submitted_at: string | null;
    review_started_at: string | null;
    decided_at: string | null;
    created_at: string;
    updated_at: string;
    sla: Sla;
  };
  user: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    name: string;
    date_of_birth: string;
    country: string;
    phone: string;
    kyc_status: string;
    status: string;
    email_verified: boolean;
    identity_locked_at: string | null;
    created_at: string;
  };
  documents: CaseDoc[];
  superseded: CaseDoc[];
  required: (Slot & { label: string; uploaded: boolean; document_id: number | null; requested: boolean; last_status: string | null })[];
  missing: { field: string; message: string } | null;
  flags: { duplicate_documents: { sha256: string; user_id: number; name: string; email: string }[]; same_identity: { id: number; email: string; kyc_status: string }[] };
  timeline: { id: number; kind: string; actor_kind: string; actor_id: number | null; meta: Record<string, unknown>; at: string }[];
  notes: { id: number; body: string; at: string; staff: { id: number; name: string } }[];
  history: { id: number; reference: string; kind: string; status: CaseStatus; decision_label: string | null; submitted_at: string | null; decided_at: string | null; created_at: string }[];
  checklist: { key: string; label: string }[];
  reasons: { code: string; label: string }[];
  can_review: boolean;
};
