import Image from "next/image";

export interface BrandLogoProps {
  /**
   * Which surface the logo sits on — `light` picks the black wordmark, `dark`
   * picks the white one. Both keep the gold mandala, so neither is filtered.
   */
  tone?: "light" | "dark";
  /** Rendered height utility. Override for a larger lockup (e.g. the loader). */
  className?: string;
}

/** Intrinsic sizes after trimming each export to its artwork. */
const VARIANTS = {
  light: { src: "/assets/brand/logo-on-light.png", width: 2060, height: 456 },
  dark: { src: "/assets/brand/logo-on-dark.png", width: 2443, height: 490 },
} as const;

export const BrandLogo = ({ tone = "light", className }: BrandLogoProps) => {
  const variant = VARIANTS[tone];

  return (
    <Image
      src={variant.src}
      alt="fxartha"
      width={variant.width}
      height={variant.height}
      priority
      // Intrinsic dimensions are passed through untouched and the height comes
      // from `className`, so Next serves a correctly-sized, undistorted image
      // instead of upscaling a small one.
      className={`w-auto ${className ?? "h-10"}`}
    />
  );
};
