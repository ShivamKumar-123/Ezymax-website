"use client";

// Instant, in-browser quality checks run before anything is uploaded. They are deliberately simple and fast
// (one down-scaled grayscale pass): sharpness from the variance of the Laplacian, glare from clipped
// highlights, lighting from mean luminance, framing from where the edges are, a text-band heuristic for the
// two machine-readable lines of a passport, and face presence (the browser's FaceDetector where available,
// otherwise a brightness / contrast heuristic inside the oval). Results travel with the upload so the reviewer
// sees what the client saw. The gateway re-checks type, size and resolution on its side.

import { tr } from "@kalks/i18n/react";
import type { ClientChecks } from "./api";

export type Purpose = "id" | "poa" | "selfie" | "doc";

export const MIN_SIDE: Record<Purpose, number> = { id: 600, poa: 600, doc: 600, selfie: 480 };
const ANALYSIS_MAX = 800;

type Gray = { g: Float32Array; w: number; h: number };

function gray(source: CanvasImageSource, sw: number, sh: number, max = ANALYSIS_MAX): { gray: Gray; canvas: HTMLCanvasElement } {
  const scale = Math.min(1, max / Math.max(sw, sh));
  const w = Math.max(8, Math.round(sw * scale));
  const h = Math.max(8, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * px[j]! + 0.587 * px[j + 1]! + 0.114 * px[j + 2]!;
  return { gray: { g, w, h }, canvas };
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
  return { mean: sum / g.length, clipped: clipped / g.length };
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

/**
 * Passport MRZ heuristic: in the bottom third, rows with many sharp horizontal transitions are "text rows";
 * two bands of them spanning most of the width look like the two machine-readable lines.
 */
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

type FaceDetectorCtor = new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => { detect(src: CanvasImageSource): Promise<{ boundingBox: DOMRectReadOnly }[]> };

export function faceDetectorAvailable(): boolean {
  return typeof window !== "undefined" && "FaceDetector" in window;
}

async function detectFace(canvas: HTMLCanvasElement, grayImg: Gray): Promise<NonNullable<ClientChecks["face"]>> {
  if (faceDetectorAvailable()) {
    try {
      const FD = (window as unknown as { FaceDetector: FaceDetectorCtor }).FaceDetector;
      const faces = await new FD({ fastMode: true, maxDetectedFaces: 1 }).detect(canvas);
      if (faces.length) {
        const b = faces[0]!.boundingBox;
        const cx = (b.x + b.width / 2) / canvas.width;
        const cy = (b.y + b.height / 2) / canvas.height;
        return { found: true, method: "face_detector", centered: Math.abs(cx - 0.5) < 0.2 && Math.abs(cy - 0.5) < 0.25 };
      }
      return { found: false, method: "face_detector" };
    } catch {
      /* fall through to the heuristic */
    }
  }
  // heuristic: the oval holds a well-lit, textured subject that stands out from the background
  const { g, w, h } = grayImg;
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

/** Full check of a captured frame or chosen file (natural size sw × sh). */
export async function analyze(source: CanvasImageSource, sw: number, sh: number, purpose: Purpose, opts: { passport?: boolean; origin: "camera" | "file" }): Promise<ClientChecks> {
  const { gray: gi, canvas } = gray(source, sw, sh);
  const { variance, lap } = laplacian(gi);
  const s = stats(gi.g);
  const out: ClientChecks = { source: opts.origin, width: sw, height: sh };
  const min = MIN_SIDE[purpose];
  out.resolution = { ok: Math.min(sw, sh) >= min, min };
  const blurMin = purpose === "selfie" ? 18 : 55;
  out.blur = { score: Math.round(variance * 10) / 10, ok: variance >= blurMin };
  out.brightness = { mean: Math.round(s.mean), ok: s.mean >= 55 && s.mean <= 235 };
  if (purpose === "id" || purpose === "selfie") {
    // paper documents are white by nature; glare is only judged on cards and faces
    out.glare = { pct: Math.round(s.clipped * 1000) / 10, ok: s.clipped < 0.06 };
  }
  if (purpose !== "selfie") {
    const ratio = fillRatio(lap, gi.w, gi.h);
    out.fill = { ratio: Math.round(ratio * 100) / 100, ok: ratio >= 0.35 };
  }
  if (purpose === "id" && opts.passport) {
    const lines = mrzLines(gi);
    out.mrz = { found: lines >= 2, lines };
  }
  if (purpose === "selfie") out.face = await detectFace(canvas, gi);
  return out;
}

/** Cheap live sample of the camera (320 px) for on-screen guidance. */
export function liveSample(video: HTMLVideoElement, purpose: Purpose): { hint: string; good: boolean } {
  if (!video.videoWidth) return { hint: tr("kyc.camera.starting"), good: false };
  const { gray: gi } = gray(video, video.videoWidth, video.videoHeight, 320);
  const { variance } = laplacian(gi);
  const s = stats(gi.g);
  if (s.mean < 50) return { hint: tr("kyc.camera.live.tooDark"), good: false };
  if (s.mean > 238) return { hint: tr("kyc.camera.live.tooBright"), good: false };
  if ((purpose === "id" || purpose === "selfie") && s.clipped > 0.08) return { hint: tr("kyc.camera.live.glare"), good: false };
  if (variance < (purpose === "selfie" ? 10 : 30)) return { hint: tr("kyc.camera.live.holdSteady"), good: false };
  return { hint: purpose === "selfie" ? tr("kyc.camera.live.goodSelfie") : tr("kyc.camera.live.goodDoc"), good: true };
}

/** Decodes an image file for analysis (JPEG / PNG / WebP; HEIC decodes only where the browser supports it). */
export async function decode(file: Blob): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

/** Days between an ISO date and today (local), negative for future dates. */
export function ageDays(iso: string): number {
  const d = new Date(`${iso}T00:00:00`);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - d.getTime()) / 86_400_000);
}

// `skipped` is stored with the upload in English (the reviewer reads it); it is translated only for display.
const SKIPPED_KEYS = {
  "This image format is checked by our team after upload.": "kyc.check.skipped.format",
  "PDF documents are checked by our team after upload.": "kyc.check.skipped.pdf",
  "HEIC photos are checked by our team after upload.": "kyc.check.skipped.heic",
} as const;

export type CheckRow = { key: string; label: string; state: "ok" | "warn" | "fail" | "info"; detail: string };

/** Human rows for a check result (shown instantly, before upload). `fail` blocks the upload. */
export function checkRows(c: ClientChecks, purpose: Purpose, opts: { passport?: boolean } = {}): CheckRow[] {
  const rows: CheckRow[] = [];
  if (c.skipped) {
    const sk = SKIPPED_KEYS[c.skipped as keyof typeof SKIPPED_KEYS];
    rows.push({ key: "skipped", label: tr("kyc.check.quality"), state: "info", detail: sk ? tr(sk) : c.skipped });
    return rows;
  }
  if (c.resolution)
    rows.push({
      key: "resolution",
      label: tr("kyc.check.resolution"),
      state: c.resolution.ok ? "ok" : "fail",
      detail: c.resolution.ok ? `${c.width} × ${c.height} px` : tr("kyc.check.resolutionLow", { px: Math.min(c.width ?? 0, c.height ?? 0) }),
    });
  if (c.blur) rows.push({ key: "blur", label: tr("kyc.check.sharpness"), state: c.blur.ok ? "ok" : "warn", detail: c.blur.ok ? tr("kyc.check.sharp") : tr("kyc.check.blurry") });
  if (c.glare) rows.push({ key: "glare", label: tr("kyc.check.glare"), state: c.glare.ok ? "ok" : "warn", detail: c.glare.ok ? tr("kyc.check.noGlare") : tr("kyc.check.glareFound") });
  if (c.brightness)
    rows.push({
      key: "brightness",
      label: tr("kyc.check.lighting"),
      state: c.brightness.ok ? "ok" : "warn",
      detail: c.brightness.ok ? tr("kyc.check.wellLit") : c.brightness.mean < 55 ? tr("kyc.check.tooDark") : tr("kyc.check.overExposed"),
    });
  if (c.fill) rows.push({ key: "fill", label: tr("kyc.check.framing"), state: c.fill.ok ? "ok" : "warn", detail: c.fill.ok ? tr("kyc.check.fills") : tr("kyc.check.moveCloser") });
  if (purpose === "id" && opts.passport && c.mrz)
    rows.push({ key: "mrz", label: tr("kyc.check.mrz"), state: c.mrz.found ? "ok" : "warn", detail: c.mrz.found ? tr("kyc.check.mrzOk") : tr("kyc.check.mrzMissing") });
  if (c.face)
    rows.push({
      key: "face",
      label: tr("kyc.check.face"),
      state: c.face.found ? "ok" : "warn",
      detail: c.face.found ? (c.face.method === "face_detector" ? tr("kyc.check.faceDetected") : tr("kyc.check.faceInOval")) : tr("kyc.check.faceMissing"),
    });
  if (c.issue_date) rows.push({ key: "issue_date", label: tr("kyc.check.issueDate"), state: c.issue_date.ok ? "ok" : "fail", detail: c.issue_date.ok ? tr("kyc.check.issuedDaysAgo", { count: c.issue_date.age_days }) : tr("kyc.check.issueTooOld") });
  return rows;
}
