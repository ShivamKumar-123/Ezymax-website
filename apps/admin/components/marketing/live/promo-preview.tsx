"use client";

/**
 * Brand promotions as clients see them (Client Area components/growth/hero-carousel.tsx and updates.tsx, the app's
 * dashboard): the hero slide, the Events & updates card, the post body (markdown subset, rendered as text, never
 * HTML) and the image field of the editor (upload with preview and size hints, or an image URL).
 */
import * as React from "react";
import { ArrowUpRight, CalendarDays, ImagePlus, Link2, MapPin, Trash2, Upload, Video, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, cn } from "@ezymex/ui";
import { parseBlocks, Inline } from "@/components/academy-live/markdown";
import { MAX_IMAGE_BYTES, errText, mkUpload, type BannerKind, type BannerLayout, type Tone } from "./api";

/* ------------------------------------------------------------------ */
/* Sizes                                                                */
/* ------------------------------------------------------------------ */

/** Recommended image sizes: the hero is a 4:1 strip across the dashboard, cards are 16:9. */
export const IMAGE_SIZE: Record<BannerLayout, { w: number; h: number; label: string }> = {
  hero: { w: 1600, h: 400, label: "1600 × 400 (4:1)" },
  card: { w: 800, h: 450, label: "800 × 450 (16:9)" },
};

/** A note when an image's size doesn't suit the layout (null = fine). */
export function sizeNote(layout: BannerLayout, w: number, h: number): string | null {
  const want = IMAGE_SIZE[layout];
  const ratio = w / h;
  const target = want.w / want.h;
  if (Math.abs(ratio - target) / target > 0.15) return `This image is ${w} × ${h}: it will be cropped to ${layout === "hero" ? "4:1" : "16:9"}. Best: ${want.label}.`;
  if (w < want.w / 2) return `This image is ${w} × ${h}: it may look soft. Best: ${want.label}.`;
  return null;
}

/* ------------------------------------------------------------------ */
/* Dates                                                                */
/* ------------------------------------------------------------------ */

const dt = (iso: string, o: Intl.DateTimeFormatOptions) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-GB", o);
};

/** "Thu 12 Nov, 18:00 – 21:00 GMT+4" (the viewer's time zone). */
export function eventRange(start: string | null, end: string | null) {
  if (!start) return "";
  const a = dt(start, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const tz = dt(start, { timeZoneName: "short" }).split(" ").pop() ?? "";
  if (!end) return `${a} ${tz}`;
  const sameDay = new Date(start).toDateString() === new Date(end).toDateString();
  const b = sameDay ? dt(end, { hour: "2-digit", minute: "2-digit" }) : dt(end, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return `${a} – ${b} ${tz}`;
}

export const isLink = (s: string | null | undefined) => !!s && /^https:\/\//i.test(s.trim());

/** Month + day badge of an event. */
export function DateBadge({ iso, className }: { iso: string; className?: string }) {
  return (
    <span className={cn("flex w-12 shrink-0 flex-col items-center overflow-hidden rounded-[10px] border border-white/15 bg-black/55 text-white backdrop-blur", className)}>
      <span className="w-full bg-ember py-0.5 text-center text-[9.5px] font-semibold uppercase tracking-[0.08em]">{dt(iso, { month: "short" })}</span>
      <span className="k-num py-1 text-[17px] font-semibold leading-none">{dt(iso, { day: "numeric" })}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Hero slide                                                           */
/* ------------------------------------------------------------------ */

type Preview = {
  kind: BannerKind;
  title: string;
  body: string;
  ctaLabel: string | null;
  tone: Tone;
  dismissible: boolean;
  eventStartsAt: string | null;
  eventEndsAt: string | null;
  location: string | null;
};

const CTA_TONE: Record<Tone, string> = { ember: "bg-ember text-white", gold: "bg-gold text-[#1a1204]", neutral: "bg-white text-black", up: "bg-up text-white" };

/** The dashboard hero as clients see it: the image across the page, the copy and the CTA on a dark gradient. */
export function HeroPreview({ b, image, className }: { b: Preview; image: string | null; className?: string }) {
  return (
    <div className={cn("relative isolate flex aspect-[4/1] min-h-[132px] w-full overflow-hidden rounded-[16px] border border-line bg-surface-3", className)}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 -z-10 grid place-items-center bg-gradient-to-br from-surface-3 to-surface-2 text-[12px] text-fg-3">Add an image · {IMAGE_SIZE.hero.label}</div>
      )}
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/45 to-transparent" />
      <div className="flex min-w-0 max-w-[68%] flex-col justify-center gap-1 px-4 py-3 text-white sm:px-6">
        {b.kind === "event" && b.eventStartsAt && (
          <span className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-white/80">
            <CalendarDays className="size-3" /> {eventRange(b.eventStartsAt, b.eventEndsAt)}
          </span>
        )}
        <div className="line-clamp-2 text-[15px] font-semibold leading-tight tracking-tight sm:text-[18px]">{b.title || "Hero title"}</div>
        {b.body && <div className="line-clamp-2 text-[11.5px] leading-snug text-white/80 sm:text-[12.5px]">{b.body}</div>}
        {(b.ctaLabel || b.kind !== "banner") && (
          <span className={cn("mt-1.5 inline-flex h-7 w-fit items-center gap-1 rounded-full px-3 text-[11.5px] font-medium", CTA_TONE[b.tone] ?? CTA_TONE.ember)}>
            {b.ctaLabel || "Read more"} <ArrowUpRight className="size-3.5" />
          </span>
        )}
      </div>
      <span className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5" aria-hidden>
        <span className="h-1.5 w-5 rounded-full bg-white" />
        <span className="size-1.5 rounded-full bg-white/45" />
        <span className="size-1.5 rounded-full bg-white/45" />
      </span>
      {b.dismissible && (
        <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-black/45 text-white/80" aria-hidden>
          <X className="size-3.5" />
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Events & updates card                                                */
/* ------------------------------------------------------------------ */

export function UpdateCardPreview({ b, image, className }: { b: Preview; image: string | null; className?: string }) {
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-[16px] border border-line bg-surface", className)}>
      <div className="relative aspect-video bg-surface-3">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[12px] text-fg-3">No image · {IMAGE_SIZE.card.label}</div>
        )}
        {b.kind === "event" && b.eventStartsAt && <DateBadge iso={b.eventStartsAt} className="absolute left-2.5 top-2.5" />}
        <span className="absolute right-2.5 top-2.5 rounded-full border border-white/15 bg-black/55 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur">{b.kind === "event" ? "Event" : "Announcement"}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <div className="line-clamp-2 text-[14px] font-medium leading-snug tracking-tight">{b.title || "Title"}</div>
        {b.kind === "event" && b.eventStartsAt && <div className="text-[11.5px] text-fg-3">{eventRange(b.eventStartsAt, b.eventEndsAt)}</div>}
        {b.body && <div className="line-clamp-2 text-[12px] leading-snug text-fg-2">{b.body}</div>}
        {b.kind === "event" && b.location && (
          <div className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-fg-3">
            {isLink(b.location) ? <Video className="size-3.5 shrink-0" /> : <MapPin className="size-3.5 shrink-0" />}
            <span className="truncate">{isLink(b.location) ? "Online" : b.location}</span>
          </div>
        )}
        <span className="mt-auto pt-2 text-[12px] font-medium text-ember">{b.ctaLabel || "Read more"} →</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Post body: the markdown subset, as text (never HTML)                 */
/* ------------------------------------------------------------------ */

const HTTPS_LINK = /(\[[^\]]+\]\(https:\/\/[^)\s]+\))/g;

/** Inline markdown plus https:// links (new tab); everything else as the Academy renders it. */
export function PostInline({ text }: { text: string }) {
  return (
    <>
      {text.split(HTTPS_LINK).map((part, i) => {
        const m = /^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/.exec(part);
        return m ? (
          <a key={i} href={m[2]} target="_blank" rel="noopener noreferrer nofollow" className="text-ember underline decoration-ember/40 underline-offset-2">
            {m[1]}
          </a>
        ) : (
          <Inline key={i} text={part} />
        );
      })}
    </>
  );
}

export function PostBody({ src, className }: { src: string; className?: string }) {
  const blocks = React.useMemo(() => parseBlocks(src), [src]);
  return (
    <div className={cn("text-[14px] leading-[1.7] text-fg-2", className)}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h":
            return b.level === 2 ? (
              <h2 key={i} className="mb-2 mt-6 text-[18px] font-medium tracking-tight text-fg first:mt-0">
                <PostInline text={b.text} />
              </h2>
            ) : (
              <h3 key={i} className="mb-1.5 mt-5 text-[15.5px] font-medium tracking-tight text-fg first:mt-0">
                <PostInline text={b.text} />
              </h3>
            );
          case "p":
            return (
              <p key={i} className="my-3 first:mt-0">
                <PostInline text={b.text} />
              </p>
            );
          case "ul":
          case "ol":
            return (
              <ul key={i} className="my-3 space-y-1.5">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2.5">
                    {b.t === "ul" ? <span className="mt-[10px] size-1.5 shrink-0 rounded-full bg-ember/80" /> : <span className="k-num w-5 shrink-0 text-fg-3">{b.start + j}.</span>}
                    <span className="min-w-0">
                      <PostInline text={it} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          case "quote":
            return (
              <blockquote key={i} className="my-4 border-s-2 border-ember/60 ps-3.5 text-fg">
                <PostInline text={b.text.replace(/^\*\*([^*]+)\*\*:?\s*/, "$1: ")} />
              </blockquote>
            );
          case "code":
            return (
              <pre key={i} className="my-3 overflow-x-auto rounded-[12px] border border-line bg-surface-2 px-3.5 py-3 font-mono text-[12.5px] text-fg">
                {b.text}
              </pre>
            );
          case "table":
            return (
              <div key={i} className="my-3 overflow-x-auto rounded-[12px] border border-line">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-surface-2">
                      {b.head.map((c, j) => (
                        <th key={j} className="border-b border-line px-3 py-2 text-start text-[11.5px] font-medium uppercase tracking-wider text-fg-3">
                          <PostInline text={c} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-b border-line last:border-0">
                        {r.map((c, x) => (
                          <td key={x} className="px-3 py-2 align-top">
                            <PostInline text={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "hr":
            return <hr key={i} className="my-5 border-line" />;
        }
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Image field: upload (drag & drop or pick) with preview, or a URL      */
/* ------------------------------------------------------------------ */

export function ImageField({
  layout,
  image,
  mediaId,
  url,
  onMedia,
  onUrl,
}: {
  layout: BannerLayout;
  /** What the preview shows (the upload through this BFF, else the URL). */
  image: string | null;
  mediaId: string;
  url: string;
  onMedia: (id: string) => void;
  onUrl: (url: string) => void;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [drag, setDrag] = React.useState(false);
  const [dims, setDims] = React.useState<{ w: number; h: number } | null>(null);
  const [useUrl, setUseUrl] = React.useState(!mediaId && !!url);
  const want = IMAGE_SIZE[layout];
  React.useEffect(() => setDims(null), [image]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) return toast.error("PNG, JPG or WEBP only");
    if (f.size > MAX_IMAGE_BYTES) return toast.error("Images can be up to 5 MB", { description: `${f.name} is ${(f.size / 1024 / 1024).toFixed(1)} MB.` });
    setBusy(true);
    const r = await mkUpload(f);
    setBusy(false);
    if (!r.ok) return toast.error("Upload failed", { description: errText(r.error) });
    onMedia(r.data.media.id);
    setUseUrl(false);
    toast.success("Image uploaded", { description: `${f.name} · ${(f.size / 1024).toFixed(0)} KB` });
  };
  const note = dims ? sizeNote(layout, dims.w, dims.h) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-fg-2">
        <span>Image</span>
        <span className="text-[11.5px] font-normal text-fg-3">
          {layout === "hero" ? "Hero" : "Card"}: {want.label} · PNG, JPG or WEBP ≤ 5 MB
        </span>
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload an image"
        data-testid="banner-image-drop"
        onClick={() => !busy && input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void pick(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "relative flex cursor-pointer items-center justify-center overflow-hidden rounded-[14px] border border-dashed bg-surface-2 transition-colors",
          layout === "hero" ? "aspect-[4/1] min-h-[96px]" : "aspect-video max-h-[200px]",
          drag ? "border-ember bg-ember-soft" : "border-line hover:border-fg-3",
        )}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1.5 px-4 text-center text-[12.5px] text-fg-3">
            <ImagePlus className="size-5" />
            {busy ? "Uploading…" : "Drop an image here or click to choose"}
          </span>
        )}
        {busy && image && <span className="absolute inset-0 grid place-items-center bg-black/50 text-[12.5px] text-white">Uploading…</span>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void pick(e.target.files?.[0] ?? undefined).finally(() => (e.target.value = ""))} />
      <div className="flex flex-wrap items-center gap-2">
        {dims && (
          <Chip size="sm" tone={note ? "warn" : "up"}>
            {dims.w} × {dims.h}
          </Chip>
        )}
        {note && <span className="text-[11.5px] text-warn">{note}</span>}
        <span className="ml-auto flex gap-1.5">
          <Button size="xs" variant="surface" onClick={() => input.current?.click()} disabled={busy}>
            <Upload /> {image ? "Replace" : "Upload"}
          </Button>
          <Button size="xs" variant="surface" onClick={() => setUseUrl((v) => !v)}>
            <Link2 /> URL
          </Button>
          {image && (
            <Button
              size="xs"
              variant="surface"
              aria-label="Remove image"
              onClick={() => {
                onMedia("");
                onUrl("");
              }}
            >
              <Trash2 />
            </Button>
          )}
        </span>
      </div>
      {useUrl && (
        <input
          aria-label="Image URL"
          value={url}
          placeholder="https://… or /assets/photos/…"
          onChange={(e) => {
            onUrl(e.target.value);
            if (e.target.value) onMedia("");
          }}
          className="h-10 w-full rounded-[12px] border border-line bg-surface-2 px-3 font-mono text-[12.5px] text-fg outline-none placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10"
        />
      )}
    </div>
  );
}
