"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "../components/overlays";

export function Providers({ children, defaultTheme = "dark" }: { children: React.ReactNode; defaultTheme?: "dark" | "light" }) {
  return (
    <ThemeProvider attribute="class" defaultTheme={defaultTheme} enableSystem={false} themes={["dark", "light"]} disableTransitionOnChange>
      <TooltipProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            classNames: {
              toast: "!rounded-2xl !border !border-line !bg-surface !text-fg !shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)]",
              description: "!text-fg-3",
            },
          }}
        />
      </TooltipProvider>
    </ThemeProvider>
  );
}
