"use client";

import * as React from "react";
import { AlertTriangle, Camera, Check, CheckCircle2, FileText, Info, RefreshCw, Upload, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button, Chip, Field, Input, Progress, cn } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";
import { uploadDocument, slotKey, type ClientChecks, type KycDocument, type KycState, type Slot } from "./api";
import { MIN_SIDE, ageDays, analyze, checkRows, decode, faceDetectorAvailable, liveSample, type CheckRow, type Purpose } from "./checks";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT: Record<Purpose, string> = {
  id: "image/jpeg,image/png,image/heic,image/heif,application/pdf",
  poa: "image/jpeg,image/png,image/heic,image/heif,application/pdf",
  doc: "image/jpeg,image/png,image/heic,image/heif,application/pdf",
  selfie: "image/jpeg,image/png,image/heic,image/heif",
};

/** ID-1 card (credit-card size) and passport photo page proportions; A4 portrait for paper documents. */
export const ASPECT = { card: 85.6 / 53.98, passport: 125 / 88, a4: 210 / 297 } as const;

/** Local previews of what the client captured this session (never uploaded anywhere else). */
const previews = new Map<string, { url: string; mime: string }>();
export function previewFor(slot: Slot) {
  return previews.get(slotKey(slot));
}

export function cameraSupported() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

type Captured = { blob: Blob; url: string; mime: string; name: string; checks: ClientChecks };

/* ------------------------------------------------------------------ */
/* Camera with an on-screen guide                                      */
/* ------------------------------------------------------------------ */

function frameRect(containerAspect: number, docAspect: number, purpose: Purpose) {
  if (purpose === "selfie") {
    const h = 0.74;
    const w = (h * 0.76) / containerAspect;
    return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
  }
  let w = 0.84;
  let h = (w * containerAspect) / docAspect;
  if (h > 0.84) {
    h = 0.84;
    w = (h * docAspect) / containerAspect;
  }
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

export function CameraView({
  purpose,
  aspect,
  passport,
  onCapture,
  onUnavailable,
  onCancel,
}: {
  purpose: Purpose;
  aspect: number;
  passport?: boolean;
  onCapture: (c: Captured) => void;
  onUnavailable: (message: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const video = React.useRef<HTMLVideoElement>(null);
  const [dims, setDims] = React.useState<{ w: number; h: number } | null>(null);
  const [hint, setHint] = React.useState({ hint: t("kyc.camera.starting"), good: false });
  const [busy, setBusy] = React.useState(false);
  const streamRef = React.useRef<MediaStream | null>(null);
  const goodRun = React.useRef(0);
  const selfie = purpose === "selfie";

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: selfie ? "user" : { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        const v = video.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play().catch(() => {});
      } catch (e) {
        const name = (e as { name?: string })?.name;
        onUnavailable(name === "NotAllowedError" ? t("kyc.camera.blocked") : t("kyc.camera.none"));
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = React.useCallback(async () => {
    const v = video.current;
    if (!v || !v.videoWidth || busy) return;
    setBusy(true);
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    // documents are cropped to the guide (plus a margin so all four corners stay visible)
    let sx = 0;
    let sy = 0;
    let sw = vw;
    let sh = vh;
    if (purpose === "id" || purpose === "doc") {
      const f = frameRect(vw / vh, aspect, purpose);
      const m = 0.05;
      sx = Math.max(0, (f.x - f.w * m) * vw);
      sy = Math.max(0, (f.y - f.h * m) * vh);
      sw = Math.min(vw - sx, f.w * (1 + 2 * m) * vw);
      sh = Math.min(vh - sy, f.h * (1 + 2 * m) * vh);
    }
    const c = document.createElement("canvas");
    c.width = Math.round(sw);
    c.height = Math.round(sh);
    c.getContext("2d")!.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const checks = await analyze(c, c.width, c.height, purpose, { passport, origin: "camera" });
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
    setBusy(false);
    if (!blob) return;
    onCapture({ blob, url: URL.createObjectURL(blob), mime: "image/jpeg", name: `${purpose}-${Date.now()}.jpg`, checks });
  }, [aspect, busy, onCapture, passport, purpose]);

  // live guidance (and hands-free capture of a detected, centred face)
  React.useEffect(() => {
    const t = setInterval(async () => {
      const v = video.current;
      if (!v || !v.videoWidth) return;
      const s = liveSample(v, purpose);
      setHint(s);
      if (selfie && faceDetectorAvailable() && s.good) {
        const probe = await analyze(v, v.videoWidth, v.videoHeight, "selfie", { origin: "camera" }).catch(() => null);
        goodRun.current = probe?.face?.found && probe.face.centered ? goodRun.current + 1 : 0;
        if (goodRun.current >= 3) {
          goodRun.current = 0;
          void capture();
        }
      }
    }, 500);
    return () => clearInterval(t);
  }, [capture, purpose, selfie]);

  const containerAspect = dims ? dims.w / dims.h : 16 / 9;
  const f = frameRect(containerAspect, aspect, purpose);
  const stroke = hint.good ? "var(--k-up)" : "rgba(255,255,255,0.85)";
  return (
    <div className="space-y-3">
      <div className="relative w-full overflow-hidden rounded-[18px] border border-line bg-black" style={{ aspectRatio: String(containerAspect) }}>
        <video
          ref={video}
          muted
          playsInline
          autoPlay
          aria-label={t("kyc.camera.previewAria")}
          onLoadedMetadata={(e) => setDims({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })}
          className={cn("absolute inset-0 size-full object-cover", selfie && "-scale-x-100")}
        />
        <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <mask id={`guide-${purpose}`}>
              <rect width="100" height="100" fill="white" />
              {selfie ? (
                <ellipse cx="50" cy="50" rx={(f.w * 100) / 2} ry={(f.h * 100) / 2} fill="black" />
              ) : (
                <rect x={f.x * 100} y={f.y * 100} width={f.w * 100} height={f.h * 100} rx="2.2" ry={2.2 * containerAspect} fill="black" />
              )}
            </mask>
          </defs>
          <rect width="100" height="100" fill="rgba(0,0,0,0.55)" mask={`url(#guide-${purpose})`} />
          {selfie ? (
            <ellipse cx="50" cy="50" rx={(f.w * 100) / 2} ry={(f.h * 100) / 2} fill="none" stroke={stroke} strokeWidth="0.5" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 3 }} />
          ) : (
            <rect x={f.x * 100} y={f.y * 100} width={f.w * 100} height={f.h * 100} rx="2.2" ry={2.2 * containerAspect} fill="none" stroke={stroke} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 3 }} />
          )}
          {!selfie && purpose === "id" && passport && (
            <rect x={f.x * 100 + f.w * 4} y={(f.y + f.h * 0.78) * 100} width={f.w * 92} height={f.h * 16} fill="none" stroke="rgba(255,255,255,0.5)" strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 1.5 }} />
          )}
        </svg>
        <div className="absolute inset-x-0 top-3 flex justify-center px-3">
          <span className={cn("rounded-full px-3 py-1 text-[12.5px] font-medium text-white", hint.good ? "bg-up/85" : "bg-black/60")} role="status" aria-live="polite">
            {hint.hint}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3">
          <button type="button" onClick={onCancel} className="grid size-10 place-items-center rounded-full bg-black/55 text-white hover:bg-black/70" aria-label={t("kyc.camera.closeAria")}>
            <X className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => void capture()}
            disabled={!dims || busy}
            aria-label={t("kyc.camera.captureAria")}
            className="grid size-16 place-items-center rounded-full border-4 border-white/85 bg-white/15 transition-transform active:scale-95 disabled:opacity-50"
          >
            <span className={cn("size-11 rounded-full", hint.good ? "bg-up" : "bg-white")} />
          </button>
          <span className="size-10" />
        </div>
      </div>
      <p className="text-center text-[12px] text-fg-3">
        {selfie
          ? t("kyc.camera.guide.selfie")
          : purpose === "poa"
            ? t("kyc.camera.guide.poa")
            : passport
              ? t("kyc.camera.guide.passport")
              : t("kyc.camera.guide.card")}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Check list                                                          */
/* ------------------------------------------------------------------ */

const ROW_ICON = {
  ok: <CheckCircle2 className="size-4 text-up" />,
  warn: <AlertTriangle className="size-4 text-warn" />,
  fail: <X className="size-4 text-down" />,
  info: <Info className="size-4 text-info" />,
};

export function CheckList({ rows, stagger = true }: { rows: CheckRow[]; stagger?: boolean }) {
  const t = useT();
  return (
    <ul className="space-y-1.5" aria-label={t("kyc.check.listAria")}>
      {rows.map((r, i) => (
        <motion.li
          key={r.key}
          initial={stagger ? { opacity: 0, y: 4 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: stagger ? 0.12 * i : 0, duration: 0.2 }}
          className="flex items-start gap-2.5 text-[13px]"
          data-check={r.key}
          data-state={r.state}
        >
          <span className="mt-0.5 shrink-0">{ROW_ICON[r.state]}</span>
          <span className="min-w-0">
            <span className="font-medium text-fg">{r.label}</span>
            <span className={cn("ms-1.5", r.state === "fail" ? "text-down" : r.state === "warn" ? "text-warn" : "text-fg-3")}>{r.detail}</span>
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* One document slot: capture / choose -> instant checks -> upload     */
/* ------------------------------------------------------------------ */

type Mode = "idle" | "camera" | "checking" | "review" | "uploading" | "done" | "error";

export function DocSlot({
  slot,
  label,
  hint,
  purpose,
  aspect = ASPECT.card,
  passport,
  doc,
  requested,
  issueDate,
  docType,
  blocked,
  preferCamera,
  onUploaded,
}: {
  slot: Slot;
  label: string;
  hint: string;
  purpose: Purpose;
  aspect?: number;
  passport?: boolean;
  doc?: KycDocument | null;
  requested?: boolean;
  issueDate?: string;
  docType?: string;
  /** Reason the slot can't be used yet (e.g. "Enter the issue date first"). */
  blocked?: string | null;
  preferCamera?: boolean;
  onUploaded: (s: KycState) => void;
}) {
  const t = useT();
  const current = doc && (doc.status === "uploaded" || doc.status === "accepted") ? doc : null;
  const [mode, setMode] = React.useState<Mode>(current ? "done" : "idle");
  const [cap, setCap] = React.useState<Captured | null>(null);
  const [pct, setPct] = React.useState(0);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const local = previewFor(slot);
  const canCamera = cameraSupported();
  const testId = slotKey(slot).replace(/[:]/g, "-");

  React.useEffect(() => {
    if (current && mode === "idle") setMode("done");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  async function pickFile(file: File) {
    setMsg(null);
    if (file.size > MAX_BYTES) return fail(t("kyc.slot.error.tooLarge"));
    setMode("checking");
    const mime = file.type || "application/octet-stream";
    let checks: ClientChecks = { source: "file" };
    if (mime.startsWith("image/") && mime !== "image/heic" && mime !== "image/heif") {
      const bmp = await decode(file);
      if (bmp) {
        checks = await analyze(bmp, bmp.width, bmp.height, purpose, { passport, origin: "file" });
        bmp.close();
      } else checks.skipped = "This image format is checked by our team after upload."; // stored in English for the reviewer; translated in checkRows
    } else if (mime === "application/pdf") {
      if (purpose === "selfie") return fail(t("kyc.slot.error.selfiePhoto"));
      checks.skipped = "PDF documents are checked by our team after upload.";
    } else if (mime === "image/heic" || mime === "image/heif") {
      checks.skipped = "HEIC photos are checked by our team after upload.";
    } else {
      return fail(t("kyc.slot.error.format"));
    }
    if (issueDate) checks.issue_date = { date: issueDate, age_days: ageDays(issueDate), ok: ageDays(issueDate) <= 92 && ageDays(issueDate) >= 0 };
    setCap({ blob: file, url: URL.createObjectURL(file), mime, name: file.name || "document", checks });
    setMode("review");
  }

  function fail(m: string) {
    setMsg(m);
    setMode("error");
  }

  async function send() {
    if (!cap) return;
    setMode("uploading");
    setPct(0);
    const r = await uploadDocument(slot, cap.blob, { name: cap.name, checks: cap.checks, issueDate, docType, onProgress: setPct });
    if (!r.ok) return fail(r.error.message);
    previews.set(slotKey(slot), { url: cap.url, mime: cap.mime });
    setMode("done");
    onUploaded(r.data.state);
  }

  const rows = cap ? checkRows(cap.checks, purpose, { passport }) : [];
  const hardFail = rows.some((r) => r.state === "fail");
  const warns = rows.filter((r) => r.state === "warn").length;
  const isImage = (cap?.mime ?? local?.mime ?? current?.mime ?? "").startsWith("image/") && !(cap?.mime ?? local?.mime ?? current?.mime ?? "").includes("hei");

  return (
    <div
      className={cn("rounded-[18px] border bg-surface-2 p-4", mode === "done" ? "border-up/30" : requested ? "border-warn/50" : "border-line", ["camera", "review", "uploading"].includes(mode) && "lg:col-span-2")}
      data-testid={`slot-${testId}`}
      data-mode={mode}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
            {label}
            {requested && mode !== "done" && (
              <Chip size="sm" tone="warn" dot>
                {t("kyc.slot.requested")}
              </Chip>
            )}
          </div>
          <div className="mt-0.5 text-[12px] text-fg-3">{hint}</div>
        </div>
        {mode === "done" && (
          <Chip size="sm" tone="up">
            <Check className="size-3" /> {t("kyc.slot.uploaded")}
          </Chip>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept={ACCEPT[purpose]}
        capture={purpose === "selfie" ? "user" : undefined}
        className="sr-only"
        aria-label={t("kyc.slot.uploadAria", { label })}
        data-testid={`file-${testId}`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void pickFile(f);
        }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {mode === "camera" ? (
          <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CameraView
              purpose={purpose}
              aspect={aspect}
              passport={passport}
              onCancel={() => setMode(current ? "done" : "idle")}
              onUnavailable={(m) => {
                setNote(m);
                setMode(current ? "done" : "idle");
              }}
              onCapture={(c) => {
                if (issueDate) c.checks.issue_date = { date: issueDate, age_days: ageDays(issueDate), ok: ageDays(issueDate) <= 92 && ageDays(issueDate) >= 0 };
                setCap(c);
                setMode("review");
              }}
            />
          </motion.div>
        ) : mode === "checking" ? (
          <motion.div key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid min-h-40 place-items-center text-[13px] text-fg-3">
            {t("kyc.slot.checkingPhoto")}
          </motion.div>
        ) : (mode === "review" || mode === "uploading") && cap ? (
          <motion.div key="review" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Preview url={cap.url} image={isImage} round={purpose === "selfie"} />
            <div className="flex min-w-0 flex-col">
              <CheckList rows={rows} />
              <div className="mt-auto pt-4">
                {mode === "uploading" ? (
                  <div>
                    <div className="mb-1.5 flex justify-between text-[12px] text-fg-3">
                      <span>{t("kyc.slot.uploading")}</span>
                      <span className="k-num">{pct}%</span>
                    </div>
                    <Progress value={pct} />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ember" size="sm" disabled={hardFail} onClick={() => void send()} data-testid={`use-${testId}`}>
                      <Check /> {warns ? t("kyc.slot.useAnyway") : purpose === "selfie" ? t("kyc.slot.useSelfie") : t("kyc.slot.usePhoto")}
                    </Button>
                    <Button variant="surface" size="sm" onClick={() => setMode(cap.checks.source === "camera" ? "camera" : "idle")}>
                      <RefreshCw /> {cap.checks.source === "camera" ? t("kyc.slot.retake") : t("kyc.slot.chooseAnother")}
                    </Button>
                  </div>
                )}
                {warns > 0 && mode === "review" && <p className="mt-2 text-[11.5px] text-fg-3">{t("kyc.slot.clearerFaster")}</p>}
              </div>
            </div>
          </motion.div>
        ) : mode === "done" ? (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4">
            {local ? (
              <Preview url={local.url} image={local.mime.startsWith("image/") && !local.mime.includes("hei")} small round={purpose === "selfie"} />
            ) : (
              <span className="grid size-16 shrink-0 place-items-center rounded-[12px] border border-line bg-surface-3 text-fg-3">
                <FileText className="size-6" />
              </span>
            )}
            <div className="min-w-0 flex-1 text-[12.5px]">
              <div className="flex items-center gap-1.5 font-medium text-up">
                <CheckCircle2 className="size-4" /> {t("kyc.slot.received")}
              </div>
              <div className="mt-0.5 text-fg-3">
                {current?.checks?.resolution?.width ? `${current.checks.resolution.width} × ${current.checks.resolution.height} px · ` : ""}
                {current ? `${(current.size_bytes / 1024 / 1024).toFixed(2)} MB` : ""}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => (canCamera && (preferCamera || purpose !== "poa") ? setMode("camera") : input.current?.click())} disabled={!!blocked}>
              {t("kyc.slot.replace")}
            </Button>
          </motion.div>
        ) : (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {mode === "error" && msg && (
              <div className="mb-3 flex items-start gap-2 rounded-[12px] border border-down/30 bg-down-soft px-3 py-2 text-[12.5px] text-down" role="alert">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {msg}
              </div>
            )}
            {note && (
              <div className="mb-3 flex items-start gap-2 rounded-[12px] border border-line bg-surface-3 px-3 py-2 text-[12.5px] text-fg-2" role="status">
                <Info className="mt-0.5 size-4 shrink-0" /> {note}
              </div>
            )}
            {blocked ? (
              <div className="rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-fg-3">{blocked}</div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {canCamera && !note && (
                  <button
                    type="button"
                    onClick={() => setMode("camera")}
                    className={cn("flex items-center gap-3 rounded-[14px] border px-4 py-3.5 text-start transition-colors", purpose === "poa" && !preferCamera ? "border-line bg-surface hover:border-ember/40" : "border-ember/40 bg-ember-soft/40 hover:border-ember/70")}
                    data-testid={`camera-${testId}`}
                  >
                    <Camera className="size-5 shrink-0 text-ember" />
                    <span>
                      <span className="block text-[13.5px] font-medium">{purpose === "selfie" ? t("kyc.slot.takeSelfie") : t("kyc.slot.takePhoto")}</span>
                      <span className="block text-[11.5px] text-fg-3">{t("kyc.slot.instantCheck")}</span>
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  className={cn("flex items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-3.5 text-start transition-colors hover:border-ember/40", (!canCamera || note) && "sm:col-span-2")}
                >
                  <Upload className="size-5 shrink-0 text-fg-2" />
                  <span>
                    <span className="block text-[13.5px] font-medium">{t("kyc.slot.uploadFile")}</span>
                    <span className="block text-[11.5px] text-fg-3">{purpose === "selfie" ? t("kyc.slot.formatsSelfie") : t("kyc.slot.formats")}</span>
                  </span>
                </button>
              </div>
            )}
            <p className="mt-2 text-[11px] text-fg-3">{t("kyc.slot.minSide", { min: MIN_SIDE[purpose] })}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Preview({ url, image, small, round }: { url: string; image: boolean; small?: boolean; round?: boolean }) {
  const t = useT();
  if (!image)
    return (
      <div className={cn("grid place-items-center rounded-[12px] border border-line bg-surface-3 text-fg-3", small ? "size-16 shrink-0" : "aspect-[4/3] w-full")}>
        <FileText className={small ? "size-6" : "size-10"} />
      </div>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={t("kyc.slot.previewAlt")} className={cn("border border-line bg-black object-contain", small ? "size-16 shrink-0 rounded-[12px] object-cover" : "aspect-[4/3] w-full rounded-[12px]", round && small && "rounded-full")} />
  );
}

/* ------------------------------------------------------------------ */
/* Proof of address: document type + issue date check, then the slot  */
/* ------------------------------------------------------------------ */

/** Labels are message keys: translate at render with t(). */
export const POA_TYPES = [
  { value: "utility_bill", label: "kyc.poaType.utilityBill" },
  { value: "bank_statement", label: "kyc.poaType.bankStatement" },
  { value: "government_letter", label: "kyc.poaType.governmentLetter" },
  { value: "tax_statement", label: "kyc.poaType.taxStatement" },
] as const;

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PoaSlot({
  slot,
  label,
  doc,
  requested,
  onUploaded,
  company,
}: {
  slot: Slot;
  label: string;
  doc?: KycDocument | null;
  requested?: boolean;
  onUploaded: (s: KycState) => void;
  company?: boolean;
}) {
  const t = useT();
  const [type, setType] = React.useState<string>(doc?.doc_type ?? "utility_bill");
  const [date, setDate] = React.useState<string>(doc?.issue_date ?? "");
  const age = date ? ageDays(date) : null;
  const ok = age !== null && age >= 0 && age <= 92;
  const poaType = POA_TYPES.find((o) => o.value === type);
  const typeLabel = poaType ? t(poaType.label).toLocaleLowerCase() : t("kyc.poa.document");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("kyc.poa.documentType")}>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label={t("kyc.poa.documentType")}
            className="h-11 w-full rounded-[14px] border border-line bg-surface-2 px-3.5 text-sm outline-none focus:border-ember/50"
          >
            {POA_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.label)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={t("kyc.poa.issueDateLabel")}
          hint={
            age === null ? undefined : ok ? (
              <span className="inline-flex items-center gap-1 text-up">
                <Check className="size-3.5" /> {age === 0 ? t("kyc.poa.issuedToday") : t("kyc.check.issuedDaysAgo", { count: age })}
              </span>
            ) : (
              <span className="text-down">{age < 0 ? t("kyc.poa.future") : t("kyc.poa.tooOldShort")}</span>
            )
          }
        >
          <Input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} aria-label={t("kyc.poa.issueDateAria")} data-testid={`issue-${slot.kind}`} />
        </Field>
      </div>
      {age !== null && !ok && age > 92 && (
        <div className="flex items-start gap-2 rounded-[12px] border border-down/30 bg-down-soft px-3 py-2 text-[12.5px] text-down" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />{" "}
          {t(company ? "kyc.poa.tooOldCompany" : "kyc.poa.tooOld", { type: typeLabel })}
        </div>
      )}
      <DocSlot
        slot={slot}
        label={label}
        hint={company ? t("kyc.poa.hintCompany") : t("kyc.poa.hint")}
        purpose="poa"
        aspect={ASPECT.a4}
        doc={doc}
        requested={requested}
        issueDate={ok ? date : undefined}
        docType={type}
        blocked={ok ? null : t("kyc.poa.blocked")}
        onUploaded={onUploaded}
      />
    </div>
  );
}
