"use client";

// "Get the app" on the sign-in pages: the Android build, offered where someone is already about to sign in.
//
// It is hidden on iPhone, because there is no iOS build and an .apk is nothing an iPhone can do anything with -
// offering it there would be offering a dead end. Everywhere else it shows, including on a desktop, where the
// file is still worth having to send to a phone.
//
// Dismissing it is remembered in this browser, so it asks once rather than on every visit. That memory is a
// convenience and nothing more: a cleared browser or a private window simply sees it again, which is why
// nothing here depends on the value being there.

import * as React from "react";
import { Download, Smartphone, X } from "lucide-react";
import { useT } from "@ezymex/i18n/react";
import { cn } from "@/components/kit";

/** Served by nginx from /srv/ezymex/downloads on this same host, so it needs no absolute URL. */
const APK = "/download/ezymex.apk";
const DISMISSED = "ezymex:get-the-app:dismissed";

/** Whether this browser can do anything with an Android package. */
function canInstall(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPhone, iPad and iPod have no build to offer; an iPad on desktop mode reports as a Mac with touch
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return !ios;
}

export function GetTheApp({ className }: { className?: string }) {
  const t = useT();
  // nothing renders on the server: what to show depends on the browser and on what it remembers
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISSED) === "1";
    } catch {
      // a private window or blocked site data: show it, rather than hide it on a guess
    }
    setShow(!dismissed && canInstall());
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISSED, "1");
    } catch {
      // not remembering is only a repeated offer, so there is nothing to handle
    }
  };

  return (
    // The row wraps: on a narrow phone the button drops under the words rather than squeezing them into a column
    // three lines tall beside it. The words keep at least 150px, so the title stays on one line.
    <div className={cn("relative flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-md border border-line bg-surface-2/60 py-3 pe-10 ps-3.5", className)}>
      <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-ember-soft text-ember">
        <Smartphone className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1 basis-[150px]">
        <p className="text-[13.5px] font-medium leading-tight">{t("auth.getApp.title")}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-fg-3">{t("auth.getApp.sub")}</p>
      </div>
      <a
        href={APK}
        className="ms-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ember px-3.5 py-2 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
      >
        <Download className="size-3.5" /> {t("auth.getApp.cta")}
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("common.close")}
        className="absolute end-2 top-2 grid size-6 place-items-center rounded-full text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
