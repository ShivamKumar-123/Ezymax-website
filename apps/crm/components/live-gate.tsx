"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, LayoutGrid } from "lucide-react";
import { Button, ComingSoon, ModeGate } from "@/components/kit";
import { IS_LIVE, pathAllowed } from "@kalks/mock";
import { LIVE_GATED, LIVE_PAGES, SUPPORT_EMAIL, TERMINAL_URL, soonFor } from "@/lib/live";
import { useT } from "@kalks/i18n/react";

/** "Coming soon" page for a path that isn't backed by real data yet (live builds only). */
export function SoonPage({ pathname }: { pathname: string }) {
  const t = useT();
  const soon = soonFor(pathname);
  return (
    <ComingSoon
      title={soon?.title ?? t("shell.gate.title")}
      text={soon?.text ?? t("shell.gate.text", { email: SUPPORT_EMAIL })}
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link href="/">
            <Button variant="surface">
              <LayoutGrid /> {t("shell.gate.backToDashboard")}
            </Button>
          </Link>
          <a href={TERMINAL_URL} target="_blank" rel="noopener">
            <Button variant="ember">
              {t("shell.gate.launchTrader")} <ArrowUpRight />
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
