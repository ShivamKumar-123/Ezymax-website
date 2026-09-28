import { cn } from "../lib/cn";

/** Founder's Kalks wordmark (traced from brand/kalks_logo_*.png), tinted via currentColor. */
export function Logo({ className, height = 22 }: { className?: string; height?: number }) {
  return (
    <span
      role="img"
      aria-label="Kalks"
      className={cn("inline-block shrink-0 bg-current text-fg", className)}
      style={{
        height,
        width: height * (1954 / 541),
        WebkitMask: "url(/assets/brand/kalks-logo.svg) center / contain no-repeat",
        mask: "url(/assets/brand/kalks-logo.svg) center / contain no-repeat",
      }}
    />
  );
}

/** The K glyph alone, used in the icon rail and favicons. */
export function LogoMark({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <span
      role="img"
      aria-label="Kalks"
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        height: size,
        width: size * (653 / 541),
        WebkitMask: "url(/assets/brand/kalks-mark.svg) center / contain no-repeat",
        mask: "url(/assets/brand/kalks-mark.svg) center / contain no-repeat",
      }}
    />
  );
}
