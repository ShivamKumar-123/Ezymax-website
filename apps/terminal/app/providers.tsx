"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@kalks/ui";

/** Terminal providers: same theme/tooltip stack as the CRM, with dense bottom-right toasts. */
export function TerminalProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} themes={["dark", "light"]} disableTransitionOnChange>
      <TooltipProvider>
        {children}
        <Toaster
          position="bottom-right"
          offset={{ bottom: 40, right: 14 }}
          mobileOffset={{ bottom: 70 }}
          visibleToasts={4}
          toastOptions={{
            classNames: {
              toast: "!rounded-[10px] !border !border-line-top !bg-panel-2 !text-fg !py-3 !shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)] !text-[12.5px]",
              description: "!text-fg-3 !font-mono !text-[11px]",
            },
          }}
        />
      </TooltipProvider>
    </ThemeProvider>
  );
}
