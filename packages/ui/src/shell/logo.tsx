"use client";

import { cn } from "../lib/cn";
import { useBrand } from "./brand";

/**
 * The wordmark. Ezymex: the blade E mark + wordmark (assets/brand/ezymex-logo.svg), tinted via currentColor.
 * A white-label broker (BrandProvider): its logo image, or its name set in type when it has no logo.
 */
export function Logo({ className, height = 22 }: { className?: string; height?: number }) {
  const brand = useBrand();
  if (brand) {
    if (brand.logo_url) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logo_url} alt={brand.name} className={cn("inline-block w-auto max-w-[200px] shrink-0 object-contain object-left", className)} style={{ height }} />
      );
    }
    return (
      <span
        className={cn("inline-block max-w-[220px] shrink-0 truncate font-semibold leading-none tracking-[-0.02em] text-fg", className)}
        style={{ fontSize: Math.round(height * 0.82), lineHeight: `${height}px`, height }}
      >
        {brand.name}
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label="Ezymex"
      className={cn("inline-block shrink-0 bg-current text-fg", className)}
      style={{
        height,
        width: height * (2801 / 559),
        WebkitMask: "url(/assets/brand/ezymex-logo.svg) center / contain no-repeat",
        mask: "url(/assets/brand/ezymex-logo.svg) center / contain no-repeat",
      }}
    />
  );
}

/** The mark alone (icon rail, compact headers): Ezymex' K glyph, a broker's logo, or its initial on its colour. */
export function LogoMark({ className, size = 22 }: { className?: string; size?: number }) {
  const brand = useBrand();
  if (brand) {
    if (brand.logo_url) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logo_url} alt={brand.name} className={cn("inline-block shrink-0 object-contain", className)} style={{ height: size, width: size }} />
      );
    }
    return (
      <span
        role="img"
        aria-label={brand.name}
        className={cn("inline-grid shrink-0 place-items-center rounded-[5px] bg-ember font-semibold leading-none text-white", className, "text-white")}
        style={{ height: size, width: size, fontSize: Math.round(size * 0.58) }}
      >
        {brand.name.trim().charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label="Ezymex"
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        height: size,
        width: size * (652 / 460),
        WebkitMask: "url(/assets/brand/ezymex-mark.svg) center / contain no-repeat",
        mask: "url(/assets/brand/ezymex-mark.svg) center / contain no-repeat",
      }}
    />
  );
}
