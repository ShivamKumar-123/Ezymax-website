import * as React from "react";
import { cn } from "../lib/cn";
import { WEB_ILLUSTRATIONS, type IllustrationName } from "./illustrations.generated";

export type { IllustrationName };

/**
 * The founder's illustrations on the web (public/illustrations of the app; made by scripts/process-illustrations.mjs
 * at the repo root). Only for empty and success states: never on data screens.
 *
 * Sized by its container: fills the available width up to `width` px and never gets taller than `maxHeight` px (tall
 * art is narrowed, so every picture sits in the same box). Intrinsic width / height keep the space reserved while it
 * loads (no layout shift); srcset lets the browser fetch the smallest file that is sharp at the screen's density.
 * Lazy and async-decoded unless `priority` (above the fold on a page of its own; never in a not-found or error file,
 * which rides along in every page's payload and would preload the art everywhere). Decorative by default: the heading
 * next to it says what the state is; pass `alt` when the art carries meaning on its own.
 */
export function Illustration({
  name,
  width = 200,
  maxHeight = Math.round(width * 0.75),
  alt = "",
  priority = false,
  className,
}: {
  name: IllustrationName;
  width?: number;
  maxHeight?: number;
  alt?: string;
  priority?: boolean;
  className?: string;
}) {
  const art = WEB_ILLUSTRATIONS[name];
  const shown = Math.min(width, Math.round((maxHeight * art.w) / art.h));
  const url = (suffix: string) => `/illustrations/${name}${suffix}.webp?v=${art.v}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static public files, sized by srcset (next/image runs unoptimized here)
    <img
      src={url("")}
      srcSet={art.files.map(([suffix, w]) => `${url(suffix)} ${w}w`).join(", ")}
      sizes={`${shown}px`}
      width={art.w}
      height={art.h}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      draggable={false}
      className={cn("block h-auto w-full select-none", className)}
      style={{ maxWidth: shown }}
    />
  );
}
