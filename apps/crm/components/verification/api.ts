"use client";

// Browser side of the KYC BFF (app/api/kyc/[[...path]]/route.ts). Shapes mirror services/gateway/src/kyc.rs.

import * as React from "react";

export type CaseStatus = "draft" | "submitted" | "in_review" | "more_info" | "approved" | "rejected";
export type IdType = "passport" | "national_id" | "driving_licence";
export type DocKind = "id_document" | "proof_of_address" | "selfie" | "incorporation" | "company_address" | "party_id";
export type Side = "front" | "back" | "single";

export type Slot = { kind: DocKind; side: Side; party?: string | null };

export type Address = { line1: string; line2: string; city: string; postcode: string; country: string };
export type Company = { name: string; reg_number: string; country: string; incorporated_on: string; business: string; address: Address };
export type Party = { key?: string; first_name: string; last_name: string; date_of_birth: string; nationality: string; roles: ("director" | "ubo")[]; ownership: number | null; id_type: IdType };

/** Results of the browser's instant checks (lib: ./checks.ts), stored with the upload for the reviewer. */
export type ClientChecks = {
  source: "camera" | "file";
  width?: number;
  height?: number;
  blur?: { score: number; ok: boolean };
  glare?: { pct: number; ok: boolean };
  brightness?: { mean: number; ok: boolean };
  resolution?: { ok: boolean; min: number };
  fill?: { ratio: number; ok: boolean };
  mrz?: { found: boolean; lines: number };
  face?: { found: boolean; method: "face_detector" | "heuristic"; centered?: boolean };
  issue_date?: { date: string; age_days: number; ok: boolean };
  skipped?: string;
};

export type KycDocument = {
  id: number;
  kind: DocKind;
  side: Side;
  party: string | null;
  doc_type: string | null;
  mime: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  issue_date: string | null;
  status: "uploaded" | "accepted" | "rejected" | "superseded";
  created_at: string;
  checks: {
    format: { ok: boolean; detected: string } | null;
    resolution: { ok: boolean | null; width: number | null; height: number | null; min_side: number } | null;
    size: { ok: boolean; bytes: number } | null;
    issue_date: { ok: boolean | null; date: string | null } | null;
    client: ClientChecks | null;
  };
};

export type Requirement = Slot & { label: string; uploaded: boolean; document_id: number | null; requested: boolean; last_status: string | null };

export type TimelineEvent = { id: number; kind: string; actor_kind: string; at: string; meta: Record<string, unknown> };

export type KycCase = {
  id: number;
  reference: string;
  kind: "individual" | "corporate";
  status: CaseStatus;
  level: number;
  id_doc_type: IdType | null;
  details: { address?: Address; company?: Company; parties?: Party[] };
  requested: Slot[];
  requested_labels: string[];
  request_message: string | null;
  decision: { code: string; label: string | null; message: string | null } | null;
  allow_resubmit: boolean;
  submissions: number;
  submitted_at: string | null;
  review_started_at: string | null;
  decided_at: string | null;
  created_at: string;
};

export type KycState = {
  kyc_status: "unverified" | "pending" | "verified" | "rejected";
  identity_locked: boolean;
  profile: { first_name: string; last_name: string; date_of_birth: string; country: string; email: string };
  case: KycCase | null;
  editable: boolean;
  can_start: boolean;
  documents: KycDocument[];
  required: Requirement[];
  timeline: TimelineEvent[];
  history: { reference: string; kind: string; status: CaseStatus; decision_label: string | null; decided_at: string | null; created_at: string }[];
  review: { sla_hours: number; typical_hours: number };
  limits: { max_bytes: number; min_bytes: number; poa_max_age_days: number };
};

export type ApiError = { code: string; message: string; field?: string };
export type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiError };

function expired() {
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/api/auth/expired?next=${encodeURIComponent(next)}`);
}

async function parse<T>(res: Response): Promise<Result<T>> {
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    expired();
    return { ok: false, status: 401, error: { code: "unauthorized", message: "Your session has ended." } };
  }
  if (res.ok) return { ok: true, data: body as T };
  return { ok: false, status: res.status, error: (body as { error?: ApiError }).error ?? { code: "unknown", message: "Something went wrong. Please try again." } };
}

export async function kycPost<T = KycState>(action: "start" | "details" | "submit", body: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(`/api/kyc/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
    return parse<T>(res);
  } catch {
    return { ok: false, status: 0, error: { code: "network", message: "Can't reach Kalks. Check your connection and try again." } };
  }
}

export type UploadResult = { status: "ok"; document: KycDocument; state: KycState };

/** Multipart upload with progress (XHR: fetch has no upload progress). */
export function uploadDocument(
  slot: Slot,
  file: Blob,
  opts: { name: string; checks?: ClientChecks | null; issueDate?: string; docType?: string; onProgress?: (pct: number) => void },
): Promise<Result<UploadResult>> {
  const fd = new FormData();
  fd.append("file", file, opts.name);
  fd.append("kind", slot.kind);
  fd.append("side", slot.side);
  if (slot.party) fd.append("party", slot.party);
  if (opts.issueDate) fd.append("issue_date", opts.issueDate);
  if (opts.docType) fd.append("doc_type", opts.docType);
  if (opts.checks) fd.append("checks", JSON.stringify(opts.checks));
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/kyc/documents");
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let body: unknown = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON error page */
      }
      if (xhr.status === 401) {
        expired();
        return resolve({ ok: false, status: 401, error: { code: "unauthorized", message: "Your session has ended." } });
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve({ ok: true, data: body as UploadResult });
      resolve({ ok: false, status: xhr.status, error: (body as { error?: ApiError }).error ?? { code: "unknown", message: "Upload failed. Please try again." } });
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, error: { code: "network", message: "Upload interrupted. Check your connection and try again." } });
    xhr.send(fd);
  });
}

/** Loads the KYC state; `pollMs` refreshes it (used by the status tracker while a review is running). */
export function useKyc(pollMs?: number) {
  const [data, setData] = React.useState<KycState | null>(null);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    let alive = true;
    fetch("/api/kyc", { cache: "no-store", credentials: "same-origin" })
      .then((r) => parse<KycState>(r))
      .then((r) => {
        if (!alive) return;
        if (r.ok) {
          setData(r.data);
          setError(null);
        } else setError(r.error);
      })
      .catch(() => alive && setError({ code: "network", message: "Can't reach Kalks. Check your connection and try again." }));
    return () => {
      alive = false;
    };
  }, [tick]);
  React.useEffect(() => {
    if (!pollMs) return;
    const t = setInterval(() => setTick((n) => n + 1), pollMs);
    return () => clearInterval(t);
  }, [pollMs]);
  const reload = React.useCallback(() => setTick((n) => n + 1), []);
  return { data, setData, error, reload };
}

export const ID_TYPES: { value: IdType; label: string; hint: string }[] = [
  { value: "passport", label: "Passport", hint: "Photo page only" },
  { value: "national_id", label: "National ID", hint: "Front and back" },
  { value: "driving_licence", label: "Driving licence", hint: "Front and back" },
];

export function sameSlot(a: Slot, b: Slot) {
  return a.kind === b.kind && a.side === b.side && (a.party ?? null) === (b.party ?? null);
}

export function slotKey(s: Slot) {
  return `${s.kind}:${s.side}:${s.party ?? ""}`;
}
