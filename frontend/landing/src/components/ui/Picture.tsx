import Image from "next/image";
import { cn } from "@/lib/cn";
import type { SiteImage } from "@/content/images";

type PictureProps = {
  image: SiteImage;
  className?: string;
  /** Warm orange-black colour grade so every photo sits in the brand palette. */
  tone?: "warm" | "none";
  /** Darken the bottom for text overlays. */
  fade?: "bottom" | "top" | "none";
  sizes?: string;
  priority?: boolean;
  rounded?: string;
};

export function Picture({ image, className, tone: toneProp, fade = "none", sizes = "(max-width: 768px) 100vw, 50vw", priority, rounded = "rounded-card" }: PictureProps) {
  const tone = toneProp ?? image.tone ?? "warm";
  return (
    <div className={cn("relative overflow-hidden bg-surface", rounded, className)}>
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn("object-cover transition-transform duration-[1200ms] ease-out-expo group-hover:scale-[1.04]", tone === "warm" && "brightness-[0.72] contrast-[1.12] saturate-[0.9]")}
      />
      {tone === "warm" ? (
        <div
          className="pointer-events-none absolute inset-0 mix-blend-color"
          style={{ background: "linear-gradient(135deg, rgb(255 106 0 / 0.6), rgb(150 20 20 / 0.6))" }}
          aria-hidden
        />
      ) : null}
      {tone === "warm" ? <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" aria-hidden /> : null}
      {fade === "bottom" ? <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" aria-hidden /> : null}
      {fade === "top" ? <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg via-bg/40 to-transparent" aria-hidden /> : null}
    </div>
  );
}
