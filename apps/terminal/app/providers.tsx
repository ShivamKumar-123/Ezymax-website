"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@kalks/ui";
import type { PartialCatalog } from "@kalks/i18n";
import { I18nProvider, useLocale } from "@kalks/i18n/react";

/** Phones get top-center toasts (full width), everything else top-right. */
function useNarrow() {
  const [n, setN] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const f = () => setN(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return n;
}

/**
 * Terminal providers: same theme/tooltip stack as the CRM, with compact toasts at the top.
 * The terminal shell moves them clear of its chrome through --t-toast-top / --t-toast-right
 * (below the chart toolbar, left of the order panel); other pages use the defaults.
 */
export function TerminalProviders({ children, locale, messages }: { children: React.ReactNode; locale: string; messages: PartialCatalog }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} themes={["dark", "light"]} disableTransitionOnChange>
      <I18nProvider locale={locale} messages={messages}>
        <TooltipProvider>
          {children}
          <TerminalToaster />
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

// Toasts keep their slot next to the order panel; in right-to-left layouts the page mirrors, so they stay top-right
// (clear of the chart toolbar) and only their text direction follows the language.
function TerminalToaster() {
  const narrow = useNarrow();
  const { dir } = useLocale();
  return (
    <Toaster
      dir={dir}
      position={narrow ? "top-center" : "top-right"}
      offset={{ top: "var(--t-toast-top, 16px)", right: "var(--t-toast-right, 16px)" }}
      mobileOffset={{ top: "var(--t-toast-top-m, 12px)", left: 10, right: 10 }}
      visibleToasts={3}
      gap={6}
      toastOptions={{
        classNames: {
          toast: "!rounded-[9px] !border !border-line-top !bg-panel-2 !text-fg !py-2.5 !px-3 !gap-2 !shadow-[0_16px_40px_-18px_rgba(0,0,0,0.7)] !text-[12px]",
          title: "!font-medium",
          description: "!text-fg-3 !font-mono !text-[10.5px] !leading-[14px]",
          actionButton: "!bg-ember !text-white !text-[11px] !h-6 !rounded-[5px]",
        },
      }}
    />
  );
}
