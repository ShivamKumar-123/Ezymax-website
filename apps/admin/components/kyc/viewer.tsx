"use client";

import * as React from "react";
import { Columns2, Download, FileText, Maximize2, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Chip, IconButton, Skeleton, cn } from "@ezymex/ui";
import type { CaseDoc } from "./types";

export const fileUrl = (id: number) => `/api/admin/kyc/documents/${id}/file`;

/**
 * Loads each document once (one audited read per document per page view) and shares an object URL between the
 * thumbnails, the main viewer and the side-by-side comparison. URLs are revoked when the case view closes.
 */
export function useDocFiles(docs: CaseDoc[]) {
  const [urls, setUrls] = React.useState<Record<number, string | "error">>({});
  const ids = docs.map((d) => d.id).join(",");
  React.useEffect(() => {
    let alive = true;
    const made: string[] = [];
    for (const d of docs) {
      fetch(fileUrl(d.id), { cache: "no-store", credentials: "same-origin" })
        .then(async (r) => {
          if (!r.ok) throw new Error(String(r.status));
          const u = URL.createObjectURL(await r.blob());
          made.push(u);
          if (alive) setUrls((x) => ({ ...x, [d.id]: u }));
        })
        .catch(() => alive && setUrls((x) => ({ ...x, [d.id]: "error" })));
    }
    return () => {
      alive = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
  return urls;
}

/** One document with zoom (buttons, wheel), rotate and drag-to-pan. */
export function DocPane({ doc, url, className, compact }: { doc: CaseDoc; url: string | "error" | undefined; className?: string; compact?: boolean }) {
  const [zoom, setZoom] = React.useState(1);
  const [rot, setRot] = React.useState(0);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const drag = React.useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  React.useEffect(() => {
    setZoom(1);
    setRot(0);
    setPan({ x: 0, y: 0 });
  }, [doc.id]);
  const clamp = (z: number) => Math.min(6, Math.max(0.5, Math.round(z * 100) / 100));
  const pdf = doc.mime === "application/pdf";
  const box = React.useRef<HTMLDivElement>(null);
  // wheel zoom needs a non-passive listener to keep the page from scrolling
  React.useEffect(() => {
    const el = box.current;
    if (!el || pdf || !doc.viewable) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [pdf, doc.viewable]);
  return (
    <div className={cn("flex min-w-0 flex-col", className)} data-testid={`pane-${doc.id}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">{doc.label}</div>
          <div className="truncate text-[11.5px] text-fg-3">
            {doc.mime.replace("image/", "").replace("application/", "").toUpperCase()}
            {doc.width ? ` · ${doc.width}×${doc.height}` : ""} · {(doc.size_bytes / 1024 / 1024).toFixed(2)} MB
          </div>
        </div>
        {!pdf && doc.viewable && (
          <div className="flex items-center gap-1">
            <IconButton size="sm" onClick={() => setZoom((z) => clamp(z / 1.25))} aria-label="Zoom out">
              <ZoomOut />
            </IconButton>
            <span className="k-num w-11 text-center text-[11.5px] text-fg-3">{Math.round(zoom * 100)}%</span>
            <IconButton size="sm" onClick={() => setZoom((z) => clamp(z * 1.25))} aria-label="Zoom in">
              <ZoomIn />
            </IconButton>
            <IconButton size="sm" onClick={() => setRot((r) => r - 90)} aria-label="Rotate left">
              <RotateCcw />
            </IconButton>
            <IconButton size="sm" onClick={() => setRot((r) => r + 90)} aria-label="Rotate right">
              <RotateCw />
            </IconButton>
            {!compact && (
              <IconButton
                size="sm"
                onClick={() => {
                  setZoom(1);
                  setRot(0);
                  setPan({ x: 0, y: 0 });
                }}
                aria-label="Fit"
              >
                <Maximize2 />
              </IconButton>
            )}
          </div>
        )}
      </div>
      <div
        className={cn("relative overflow-hidden rounded-[14px] border border-line bg-[#0a0a0c]", compact ? "h-[340px]" : "h-[480px]", zoom > 1 && "cursor-grab active:cursor-grabbing")}
        ref={box}
        onPointerDown={(e) => {
          if (zoom <= 1) return;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
        }}
        onPointerUp={() => (drag.current = null)}
      >
        {url === undefined ? (
          <Skeleton className="absolute inset-3" />
        ) : url === "error" ? (
          <div className="grid size-full place-items-center text-[12.5px] text-down">The file could not be loaded.</div>
        ) : pdf ? (
          <iframe src={url} title={doc.label} className="size-full bg-white" />
        ) : doc.viewable ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={doc.label}
            draggable={false}
            className="absolute left-1/2 top-1/2 max-h-full max-w-full select-none object-contain transition-transform duration-150"
            style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) rotate(${rot}deg) scale(${zoom})` }}
          />
        ) : (
          <div className="grid size-full place-items-center text-center text-[12.5px] text-fg-3">
            <div>
              <FileText className="mx-auto mb-2 size-8" />
              HEIC photos can't be shown in this browser.
              <a href={url} download={`kyc-${doc.id}.heic`} className="mt-2 flex items-center justify-center gap-1 text-ember hover:underline">
                <Download className="size-3.5" /> Download to view
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Thumb({ doc, url, active, onClick }: { doc: CaseDoc; url: string | "error" | undefined; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex w-[132px] shrink-0 flex-col gap-1.5 rounded-[12px] border p-1.5 text-left transition-colors", active ? "border-ember/60 bg-ember-soft/40" : "border-line bg-surface-2 hover:border-fg-3")}
      aria-pressed={active}
      data-testid={`thumb-${doc.id}`}
    >
      <span className="relative grid h-20 place-items-center overflow-hidden rounded-[8px] bg-[#0a0a0c]">
        {url && url !== "error" && doc.viewable ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <FileText className="size-6 text-fg-3" />
        )}
        {doc.status === "rejected" && <span className="absolute inset-x-0 bottom-0 bg-down/85 py-0.5 text-center text-[10px] font-medium text-white">Replaced / requested</span>}
      </span>
      <span className="truncate px-0.5 text-[11.5px] font-medium">{doc.label}</span>
    </button>
  );
}

/** Document viewer: thumbnails, zoom / rotate, and selfie-vs-ID comparison side by side. */
export function DocumentViewer({ docs }: { docs: CaseDoc[] }) {
  const urls = useDocFiles(docs);
  const [sel, setSel] = React.useState<number | null>(docs[0]?.id ?? null);
  const selfie = docs.find((d) => d.kind === "selfie" && d.current);
  const idFront = docs.find((d) => (d.kind === "id_document" || d.kind === "party_id") && d.side === "front" && d.current);
  const [compare, setCompare] = React.useState(false);
  const current = docs.find((d) => d.id === sel) ?? docs[0];
  if (!docs.length) return <div className="py-10 text-center text-[13px] text-fg-3">No documents uploaded yet.</div>;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[12.5px] text-fg-3">
          <Chip size="sm" tone="neutral">
            {docs.length} document{docs.length === 1 ? "" : "s"}
          </Chip>
          Encrypted at rest · streamed to staff only
        </div>
        {selfie && idFront && (
          <button
            type="button"
            onClick={() => setCompare((c) => !c)}
            className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors", compare ? "border-ember/50 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2 hover:text-fg")}
            data-testid="compare"
          >
            <Columns2 className="size-3.5" /> Compare selfie with ID
          </button>
        )}
      </div>
      {compare && selfie && idFront ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="compare-view">
          <DocPane doc={idFront} url={urls[idFront.id]} compact />
          <DocPane doc={selfie} url={urls[selfie.id]} compact />
        </div>
      ) : current ? (
        <DocPane doc={current} url={urls[current.id]} />
      ) : null}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {docs.map((d) => (
          <Thumb
            key={d.id}
            doc={d}
            url={urls[d.id]}
            active={!compare && d.id === current?.id}
            onClick={() => {
              setCompare(false);
              setSel(d.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}
