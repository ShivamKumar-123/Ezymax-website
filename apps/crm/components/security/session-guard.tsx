"use client";

// Session upkeep in the Client Area shell (D32):
// * SessionGuard checks the session every 30 s (and when the tab comes back) so a device signed out from
//   another device, or by support, leaves the Client Area within seconds; and signs the client out after the
//   broker's idle time without any input (shared across tabs through localStorage).
// * ViewerBar marks a view-only session (D90): who is being viewed, that nothing can be changed, and the
//   pages opened are reported to the owner's activity log. Refused changes get one clear message.

import * as React from "react";
import { usePathname } from "next/navigation";
import { Eye, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import type { NavModule } from "@kalks/ui";
import { logout, useSession } from "@/components/session";
import { viewerPageAllowed, type ViewerScope } from "@/lib/viewer";

const ACTIVITY_KEY = "kalks.lastActivity";
const CHECK_MS = 30_000;
const WARN_MS = 60_000;

function expired() {
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/api/auth/expired?next=${encodeURIComponent(next)}`);
}

function readActivity(): number {
  try {
    return Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeActivity(t: number) {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(t));
  } catch {
    /* private mode: this tab's own timer still works */
  }
}

export function SessionGuard() {
  const t = useT();
  const tRef = React.useRef(t);
  tRef.current = t;
  const me = useSession();
  const idleMs = Math.max(5, me.session?.idle_minutes ?? 1440) * 60_000;
  const last = React.useRef(Date.now());
  const warned = React.useRef(false);

  // revoked / expired elsewhere: check now and then, and whenever the tab becomes visible again
  React.useEffect(() => {
    let stop = false;
    const check = async () => {
      if (stop || document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
        if (!stop && r.status === 401) expired();
      } catch {
        /* offline: try again later */
      }
    };
    const timer = setInterval(check, CHECK_MS);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stop = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  // idle sign-out: any input in any tab counts as activity
  React.useEffect(() => {
    const now = Date.now();
    last.current = now;
    writeActivity(now);
    let lastWrite = now;
    const bump = () => {
      const t = Date.now();
      last.current = t;
      warned.current = false;
      if (t - lastWrite > 5_000) {
        lastWrite = t;
        writeActivity(t);
      }
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = setInterval(() => {
      const seen = Math.max(last.current, readActivity());
      const quiet = Date.now() - seen;
      if (quiet >= idleMs) {
        toast.dismiss("idle-warning");
        void logout();
        return;
      }
      if (quiet >= idleMs - WARN_MS && !warned.current) {
        warned.current = true;
        toast.warning(tRef.current("security.idle.warnTitle"), {
          id: "idle-warning",
          description: tRef.current("security.idle.warnText"),
          duration: WARN_MS,
          action: { label: tRef.current("security.idle.stay"), onClick: bump },
        });
      }
    }, 5_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(timer);
    };
  }, [idleMs]);

  return null;
}

/** Navigation of a view-only session: only the pages of its sections. */
export function navForViewer(nav: NavModule[], scope: Pick<ViewerScope, "sections">): NavModule[] {
  return nav.flatMap((m) => {
    if (!m.sub?.length) return viewerPageAllowed(scope, m.href) ? [m] : [];
    const sub = m.sub.filter((s) => viewerPageAllowed(scope, s.href));
    return sub.length ? [{ ...m, href: sub[0]!.href, sub }] : [];
  });
}

export function ViewerBar({ viewer, owner }: { viewer: ViewerScope; owner: string }) {
  const t = useT();
  const tRef = React.useRef(t);
  tRef.current = t;
  const pathname = usePathname() ?? "/";

  // pages opened by the viewer, for the owner's activity log
  React.useEffect(() => {
    void fetch("/api/security/viewer-activity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      credentials: "same-origin",
    }).catch(() => {});
  }, [pathname]);

  // any refused change gets one clear message, whatever button triggered it
  React.useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await original(...args);
      if (res.status === 403) {
        res
          .clone()
          .json()
          .then((d: { error?: { code?: string } }) => {
            if (d?.error?.code === "viewer_read_only") toast.info(tRef.current("security.viewerBar.title"), { id: "viewer-read-only", description: tRef.current("security.viewerBar.refused") });
          })
          .catch(() => {});
      }
      return res;
    };
    return () => {
      window.fetch = original;
    };
  }, []);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-info/30 bg-info-soft px-4 py-2.5 text-[13px]" data-testid="viewer-bar">
      <div className="flex min-w-0 items-center gap-2.5">
        <Eye className="size-4 shrink-0 text-info" />
        <span className="min-w-0">
          <span className="font-medium text-fg">{t("security.viewerBar.title")}</span>
          <span className="text-fg-2">
            {" "}
            · {viewer.label} · {t("security.viewerBar.viewing", { owner })}
          </span>
        </span>
      </div>
      <Button size="xs" variant="surface" onClick={() => void logout()}>
        <LogOut /> {t("security.signOut")}
      </Button>
    </div>
  );
}
