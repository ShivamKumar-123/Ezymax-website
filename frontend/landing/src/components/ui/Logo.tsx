import Image from "next/image";

import { site } from "@/content/site";
import { cn } from "@/lib/cn";

/**
 * The Ezymex wordmark.
 *
 * The mark is a chrome-and-orange 3D lockup, which happens to sit in the same
 * palette as the page it renders on — so one cut serves everywhere and there
 * is no reversed version to keep in sync.
 *
 * Callers size it by height and let the width follow; every call site passes
 * `h-*` and relies on `w-auto` below. The source is 800px wide, roughly 4x the
 * largest 2x render on the site.
 */
const LOGO_WIDTH = 800;
const LOGO_HEIGHT = 242;

export const LOGO_SRC = "/assets/brand/logo.png";

export function Logo({
  className,
  title = site.name,
  priority = false,
}: {
  className?: string;
  title?: string;
  /** Set on the header, which is above the fold on every route. */
  priority?: boolean;
}) {
  return (
    <Image
      src={LOGO_SRC}
      alt={title}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      priority={priority}
      className={cn("h-6 w-auto", className)}
    />
  );
}
