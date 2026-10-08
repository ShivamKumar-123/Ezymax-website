import Image from "next/image";

import { site } from "@/content/site";
import { cn } from "@/lib/cn";

/**
 * The Ezymex wordmark.
 *
 * A glowing orange lockup whose halo is carried in the alpha channel, so it
 * composites on any dark surface rather than only on pure black. It sits in
 * the page's own palette, so one cut serves everywhere and there is no
 * reversed version to keep in sync.
 *
 * Callers size it by height and let the width follow; every call site passes
 * `h-*` and relies on `w-auto` below. The source is 760px wide, comfortably
 * above the largest 2x render on the site.
 */
const LOGO_WIDTH = 760;
const LOGO_HEIGHT = 160;

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
