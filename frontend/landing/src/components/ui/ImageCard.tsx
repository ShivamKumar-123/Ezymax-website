import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SiteImage } from "@/content/images";
import { Picture } from "./Picture";

type ImageCardProps = {
  title: string;
  body?: string;
  href: string;
  image: SiteImage;
  eyebrow?: string;
  index?: number;
  className?: string;
  aspect?: string;
};

/** Photo card: image on top with a warm grade, title and arrow below. */
export function ImageCard({ title, body, href, image, eyebrow, index, className, aspect = "aspect-[16/10]" }: ImageCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface transition-all duration-500 ease-out-expo hover:-translate-y-1 hover:border-orange-500/50 hover:shadow-card",
        className,
      )}
    >
      <div className={cn("relative", aspect)}>
        <Picture image={image} className="absolute inset-0" rounded="rounded-none" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
        {eyebrow ? (
          <span className="absolute top-4 left-4 rounded-full bg-black/55 px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-ink uppercase backdrop-blur-md">
            {eyebrow}
          </span>
        ) : null}
        {typeof index === "number" ? (
          <span className="absolute top-4 right-4 font-mono text-xs text-ink/70">{String(index + 1).padStart(2, "0")}</span>
        ) : null}
      </div>
      <div className="flex flex-1 items-start justify-between gap-4 p-6">
        <div>
          <h3 className="font-display text-xl font-semibold leading-snug text-ink">{title}</h3>
          {body ? <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p> : null}
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-ink transition-all duration-300 group-hover:rotate-45 group-hover:border-orange-500 group-hover:bg-orange-500 group-hover:text-black">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
    </Link>
  );
}
