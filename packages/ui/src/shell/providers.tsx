"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import type { Locale, PartialCatalog } from "@kalks/i18n";
import { I18nProvider, useLocale } from "@kalks/i18n/react";
import { TooltipProvider } from "../components/overlays";

export type I18nInit = {
  locale: string;
  messages: PartialCatalog;
  /** Same-origin endpoint that saves the language on the signed-in user's profile (POST { locale }). */
  persistUrl?: string;
};

function I18n({ init, children }: { init?: I18nInit; children: React.ReactNode }) {
  const router = useRouter();
  if (!init) return <>{children}</>;
  const persist = (code: Locale) => {
    if (!init.persistUrl) return;
    void fetch(init.persistUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ locale: code }) }).catch(() => {});
  };
  return (
    <I18nProvider locale={init.locale} messages={init.messages} onChange={persist} refresh={() => router.refresh()}>
      {children}
    </I18nProvider>
  );
}

function DirToaster() {
  const { dir } = useLocale();
  return (
    <Toaster
      dir={dir}
      position={dir === "rtl" ? "top-left" : "top-right"}
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border !border-line !bg-surface !text-fg !shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)]",
          description: "!text-fg-3",
        },
      }}
    />
  );
}

export function Providers({ children, defaultTheme = "dark", i18n }: { children: React.ReactNode; defaultTheme?: "dark" | "light"; i18n?: I18nInit }) {
  return (
    <ThemeProvider attribute="class" defaultTheme={defaultTheme} enableSystem={false} themes={["dark", "light"]} disableTransitionOnChange>
      <I18n init={i18n}>
        <TooltipProvider>
          {children}
          <DirToaster />
        </TooltipProvider>
      </I18n>
    </ThemeProvider>
  );
}
