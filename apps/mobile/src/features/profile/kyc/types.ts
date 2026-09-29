// KYC shapes: the same as the Client Area (components/verification/api.ts), mirroring services/gateway/src/kyc.rs.
import type { MessageKey } from "@/i18n";

export type CaseStatus = "draft" | "submitted" | "in_review" | "more_info" | "approved" | "rejected";
export type IdType = "passport" | "national_id" | "driving_licence";
export type DocKind = "id_document" | "proof_of_address" | "selfie" | "incorporation" | "company_address" | "party_id";
export type Side = "front" | "back" | "single";
export type Slot = { kind: DocKind; side: Side; party?: string | null };

export type Address = { line1: string; line2: string; city: string; postcode: string; country: string };
export type Company = { name: string; reg_number: string; country: string; incorporated_on: string; business: string; address: Address };
export type Party = { key?: string; first_name: string; last_name: string; date_of_birth: string; nationality: string; roles: ("director" | "ubo")[]; ownership: number | null; id_type: IdType };

/** The phone's instant checks, stored with the upload for the reviewer (same fields as the web). */
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

export type Purpose = "id" | "poa" | "selfie" | "doc";

/** Short side in pixels the gateway accepts (kyc.rs: 480 for selfies, 600 otherwise). */
export const MIN_SIDE: Record<Purpose, number> = { id: 600, poa: 600, doc: 600, selfie: 480 };
export const MAX_BYTES = 10 * 1024 * 1024;
export const MIN_BYTES = 8 * 1024;
/** Proof of address must be issued within this many days (D89). */
export const POA_MAX_AGE_DAYS = 92;

/** ID-1 card and passport photo page proportions; A4 portrait for paper documents. */
export const ASPECT = { card: 85.6 / 53.98, passport: 125 / 88, a4: 210 / 297 } as const;

export const ID_TYPES: { value: IdType; label: MessageKey; hint: MessageKey }[] = [
  { value: "passport", label: "kyc.idType.passport", hint: "kyc.idType.passportHint" },
  { value: "national_id", label: "kyc.idType.nationalId", hint: "kyc.idType.frontAndBack" },
  { value: "driving_licence", label: "kyc.idType.drivingLicence", hint: "kyc.idType.frontAndBack" },
];

export const POA_TYPES: { value: string; label: MessageKey }[] = [
  { value: "utility_bill", label: "kyc.poaType.utilityBill" },
  { value: "bank_statement", label: "kyc.poaType.bankStatement" },
  { value: "government_letter", label: "kyc.poaType.governmentLetter" },
  { value: "tax_statement", label: "kyc.poaType.taxStatement" },
];

export const sameSlot = (a: Slot, b: Slot) => a.kind === b.kind && a.side === b.side && (a.party ?? null) === (b.party ?? null);
export const slotKey = (s: Slot) => `${s.kind}:${s.side}:${s.party ?? ""}`;

/** The current document in a slot (uploaded or accepted), if any. */
export function docFor(state: KycState, slot: Slot): KycDocument | null {
  const list = state.documents.filter((d) => sameSlot(d, slot) && (d.status === "uploaded" || d.status === "accepted"));
  return list[list.length - 1] ?? null;
}
