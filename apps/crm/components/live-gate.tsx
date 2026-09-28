"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, LayoutGrid } from "lucide-react";
import { Button, ComingSoon, ModeGate } from "@kalks/ui";
import { IS_LIVE, pathAllowed } from "@kalks/mock";
import { LIVE_GATED, LIVE_PAGES, TERMINAL_URL, soonFor } from "@/lib/live";

/** "Coming soon" page for a path that isn't backed by real data yet (live builds only). */
export function SoonPage({ pathname }: { pathname: string }) {
  const soon = soonFor(pathname);
  return (
    <ComingSoon
      title={soon?.title ?? "Coming soon"}
      text={soon?.text ?? "This part of the Kalks Client Area is not available yet. Everything you see elsewhere is live."}
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link href="/">
            <Button variant="surface">
              <LayoutGrid /> Back to dashboard
            </Button>
          </Link>
          <a href={TERMINAL_URL} target="_blank" rel="noopener">
            <Button variant="ember">
              Launch Kalks Trader <ArrowUpRight />
            </Button>
          </a>
        </div>
      }
    />
  );
}

/** Live builds render only LIVE_PAGES (minus LIVE_GATED); demo builds render every page. */
export function LiveGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const fallback = <SoonPage pathname={pathname} />;
  if (IS_LIVE && pathAllowed(pathname, LIVE_GATED)) return fallback;
  return (
    <ModeGate allow={LIVE_PAGES} fallback={fallback}>
      {children}
    </ModeGate>
  );
}
