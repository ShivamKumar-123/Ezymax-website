import { cn } from "@/lib/cn";
import { site } from "@/content/site";

/**
 * The Ezymax wordmark, set as type.
 *
 * Two things it is not, and why:
 *
 * It is not the previous brand's traced SVG path — that was ~7 KB of geometry
 * spelling out a different name, which is why it could only be replaced, not
 * renamed.
 *
 * And it is not the existing EZYMAX PNG. That artwork is blue and silver on
 * transparent; this page is #060606 with an orange accent, so the darker half
 * of the mark disappears into the background and the rest fights the palette.
 * Type in the display face reads correctly and costs nothing.
 *
 * TEMPORARY: replace with real artwork cut for a dark, warm ground when it
 * arrives. Keep the `h-*` + `w-auto` contract — every call site sizes this by
 * height.
 */
export function Logo({
  className,
  title = site.name,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span
      role="img"
      aria-label={title}
      className={cn(
        "inline-flex items-center font-display text-[1.45em] leading-none font-bold tracking-tight text-ink select-none",
        className,
      )}
    >
      {title}
      <span aria-hidden className="text-orange-500">
        .
      </span>
    </span>
  );
}
