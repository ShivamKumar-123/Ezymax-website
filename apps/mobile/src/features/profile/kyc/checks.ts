// Instant quality checks before anything is uploaded: the same maths and thresholds as the Client Area
// (apps/crm/components/verification/checks.ts), run on one down-scaled grayscale pass of the photo: sharpness from
// the variance of the Laplacian, glare from clipped highlights, lighting from mean luminance, framing from where the
// edges are, a text-band heuristic for a passport's two machine-readable lines, and a brightness / contrast
// heuristic for a face inside the selfie oval. The results travel with the upload so the reviewer sees what the
// client saw; the gateway re-checks type, size and resolution itself.
import { i18n } from "@/i18n";
import { ageDays } from "../format";
import { MIN_SIDE, POA_MAX_AGE_DAYS, type ClientChecks, type Purpose } from "./types";

/** Long side of the analysed copy (px). */
export const ANALYSIS_MAX = 800;

type Gray = { g: Float32Array; w: number; h: number };

export function toGray(rgba: ArrayLike<number>, w: number, h: number): Gray {
  const g = new Float32Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * rgba[j]! + 0.587 * rgba[j + 1]! + 0.114 * rgba[j + 2]!;
  return { g, w, h };
}

/** Variance of the 4-neighbour Laplacian (higher = sharper) and the Laplacian magnitude map. */
function laplacian({ g, w, h }: Gray) {
  const lap = new Float32Array(w * h);
  let sum = 0;
  let sq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = g[i - w]! + g[i + w]! + g[i - 1]! + g[i + 1]! - 4 * g[i]!;
      lap[i] = Math.abs(v);
      sum += v;
      sq += v * v;
      n++;
    }
  }
  const mean = sum / Math.max(1, n);
  return { variance: sq / Math.max(1, n) - mean * mean, lap };
}

function stats(g: Float32Array) {
  let sum = 0;
  let clipped = 0;
  for (let i = 0; i < g.length; i++) {
    sum += g[i]!;
    if (g[i]! >= 250) clipped++;
  }
  return { mean: sum / Math.max(1, g.length), clipped: clipped / Math.max(1, g.length) };
}

/** Bounding box that holds the central 94% of edge pixels, as a fraction of the image area. */
function fillRatio(lap: Float32Array, w: number, h: number) {
  const cols = new Float64Array(w);
  const rows = new Float64Array(h);
  let total = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (lap[y * w + x]! > 24) {
        cols[x]!++;
        rows[y]!++;
        total++;
      }
    }
  }
  if (total < 50) return 0;
  const bounds = (arr: Float64Array) => {
    let acc = 0;
    let lo = 0;
    let hi = arr.length - 1;
    for (let i = 0; i < arr.length; i++) {
      acc += arr[i]!;
      if (acc >= total * 0.03) {
        lo = i;
        break;
      }
    }
    acc = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      acc += arr[i]!;
      if (acc >= total * 0.03) {
        hi = i;
        break;
      }
    }
    return Math.max(0, hi - lo) / arr.length;
  };
  return bounds(cols) * bounds(rows);
}

/** Passport MRZ heuristic: two bands of dense sharp transitions spanning most of the width in the bottom third. */
function mrzLines({ g, w, h }: Gray) {
  const start = Math.floor(h * 0.62);
  const textRow: boolean[] = [];
  for (let y = start; y < h; y++) {
    let transitions = 0;
    let first = -1;
    let last = -1;
    for (let x = 1; x < w; x++) {
      if (Math.abs(g[y * w + x]! - g[y * w + x - 1]!) > 38) {
        transitions++;
        if (first < 0) first = x;
        last = x;
      }
    }
    textRow.push(transitions > w * 0.08 && last - first > w * 0.55);
  }
  let bands = 0;
  let run = 0;
  let gap = 0;
  for (const t of textRow) {
    if (t) {
      run++;
      gap = 0;
    } else if (run > 0 && ++gap > 1) {
      if (run >= 2) bands++;
      run = 0;
      gap = 0;
    }
  }
  if (run >= 2) bands++;
  return bands;
}

/** A well-lit, textured subject inside the oval that stands out from the background. */
function faceHeuristic({ g, w, h }: Gray): NonNullable<ClientChecks["face"]> {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w * 0.26;
  const ry = h * 0.36;
  let inSum = 0;
  let inSq = 0;
  let inN = 0;
  let outSum = 0;
  let outN = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const v = g[y * w + x]!;
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1) {
        inSum += v;
        inSq += v * v;
        inN++;
      } else if (d > 1.4) {
        outSum += v;
        outN++;
      }
    }
  }
  const mean = inSum / Math.max(1, inN);
  const sd = Math.sqrt(Math.max(0, inSq / Math.max(1, inN) - mean * mean));
  const contrastWithBg = Math.abs(mean - outSum / Math.max(1, outN));
  return { found: mean > 55 && mean < 225 && sd > 16 && contrastWithBg > 4, method: "heuristic", centered: true };
}

/**
 * Full check of a photo. `rgba` is the analysed copy (w × h, RGBA); `sw × sh` the photo's real size.
 */
export function analyzePixels(rgba: ArrayLike<number>, w: number, h: number, meta: { sw: number; sh: number; purpose: Purpose; passport?: boolean; origin: "camera" | "file" }): ClientChecks {
  const gi = toGray(rgba, w, h);
  const { variance, lap } = laplacian(gi);
  const s = stats(gi.g);
  const { purpose } = meta;
  const out: ClientChecks = { source: meta.origin, width: meta.sw, height: meta.sh };
  const min = MIN_SIDE[purpose];
  out.resolution = { ok: Math.min(meta.sw, meta.sh) >= min, min };
  const blurMin = purpose === "selfie" ? 18 : 55;
  out.blur = { score: Math.round(variance * 10) / 10, ok: variance >= blurMin };
  out.brightness = { mean: Math.round(s.mean), ok: s.mean >= 55 && s.mean <= 235 };
  // paper documents are white by nature; glare is only judged on cards and faces
  if (purpose === "id" || purpose === "selfie") out.glare = { pct: Math.round(s.clipped * 1000) / 10, ok: s.clipped < 0.06 };
  if (purpose !== "selfie") {
    const ratio = fillRatio(lap, gi.w, gi.h);
    out.fill = { ratio: Math.round(ratio * 100) / 100, ok: ratio >= 0.35 };
  }
  if (purpose === "id" && meta.passport) {
    const lines = mrzLines(gi);
    out.mrz = { found: lines >= 2, lines };
  }
  if (purpose === "selfie") out.face = faceHeuristic(gi);
  return out;
}

/** Checks for a file whose pixels can't be read here (PDF, HEIC, or a decode failure): the team checks it. */
export function skippedChecks(origin: "camera" | "file", reason: "pdf" | "heic" | "format", size?: { w: number; h: number }): ClientChecks {
  // stored in English for the reviewer; translated only for display (checkRows)
  const skipped = reason === "pdf" ? "PDF documents are checked by our team after upload." : reason === "heic" ? "HEIC photos are checked by our team after upload." : "This image format is checked by our team after upload.";
  return { source: origin, ...(size ? { width: size.w, height: size.h } : {}), skipped };
}

export function issueDateCheck(ymd: string): NonNullable<ClientChecks["issue_date"]> {
  const age = ageDays(ymd);
  return { date: ymd, age_days: age, ok: age >= 0 && age <= POA_MAX_AGE_DAYS };
}

const SKIPPED_KEYS = {
  "This image format is checked by our team after upload.": "kyc.check.skipped.format",
  "PDF documents are checked by our team after upload.": "kyc.check.skipped.pdf",
  "HEIC photos are checked by our team after upload.": "kyc.check.skipped.heic",
} as const;

export type CheckRow = { key: string; label: string; state: "ok" | "warn" | "fail" | "info"; detail: string };

/** Human rows for a check result (shown instantly, before upload). `fail` blocks the upload. */
export function checkRows(c: ClientChecks, purpose: Purpose, opts: { passport?: boolean } = {}): CheckRow[] {
  const t = i18n.t;
  const rows: CheckRow[] = [];
  if (c.skipped) {
    const sk = SKIPPED_KEYS[c.skipped as keyof typeof SKIPPED_KEYS];
    rows.push({ key: "skipped", label: t("kyc.check.quality"), state: "info", detail: sk ? t(sk) : c.skipped });
    if (c.issue_date) rows.push({ key: "issue_date", label: t("kyc.check.issueDate"), state: c.issue_date.ok ? "ok" : "fail", detail: c.issue_date.ok ? t("kyc.check.issuedDaysAgo", { count: c.issue_date.age_days }) : t("kyc.check.issueTooOld") });
    return rows;
  }
  if (c.resolution)
    rows.push({
      key: "resolution",
      label: t("kyc.check.resolution"),
      state: c.resolution.ok ? "ok" : "fail",
      detail: c.resolution.ok ? `${c.width} × ${c.height} px` : t("kyc.check.resolutionLow", { px: Math.min(c.width ?? 0, c.height ?? 0) }),
    });
  if (c.blur) rows.push({ key: "blur", label: t("kyc.check.sharpness"), state: c.blur.ok ? "ok" : "warn", detail: c.blur.ok ? t("kyc.check.sharp") : t("kyc.check.blurry") });
  if (c.glare) rows.push({ key: "glare", label: t("kyc.check.glare"), state: c.glare.ok ? "ok" : "warn", detail: c.glare.ok ? t("kyc.check.noGlare") : t("kyc.check.glareFound") });
  if (c.brightness)
    rows.push({
      key: "brightness",
      label: t("kyc.check.lighting"),
      state: c.brightness.ok ? "ok" : "warn",
      detail: c.brightness.ok ? t("kyc.check.wellLit") : c.brightness.mean < 55 ? t("kyc.check.tooDark") : t("kyc.check.overExposed"),
    });
  if (c.fill) rows.push({ key: "fill", label: t("kyc.check.framing"), state: c.fill.ok ? "ok" : "warn", detail: c.fill.ok ? t("kyc.check.fills") : t("kyc.check.moveCloser") });
  if (purpose === "id" && opts.passport && c.mrz) rows.push({ key: "mrz", label: t("kyc.check.mrz"), state: c.mrz.found ? "ok" : "warn", detail: c.mrz.found ? t("kyc.check.mrzOk") : t("kyc.check.mrzMissing") });
  if (c.face) rows.push({ key: "face", label: t("kyc.check.face"), state: c.face.found ? "ok" : "warn", detail: c.face.found ? t("kyc.check.faceInOval") : t("kyc.check.faceMissing") });
  if (c.issue_date) rows.push({ key: "issue_date", label: t("kyc.check.issueDate"), state: c.issue_date.ok ? "ok" : "fail", detail: c.issue_date.ok ? t("kyc.check.issuedDaysAgo", { count: c.issue_date.age_days }) : t("kyc.check.issueTooOld") });
  return rows;
}

/** Any automatic check the reviewer will see flagged (review list chip). */
export function flagged(c: ClientChecks | null | undefined): boolean {
  if (!c) return false;
  return Object.values(c).some((v) => v && typeof v === "object" && ("ok" in v ? (v as { ok: boolean }).ok === false : "found" in v ? (v as { found: boolean }).found === false : false));
}
