"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { IS_DEMO, pathAllowed } from "@ezymex/mock";
import { EmptyState } from "./data";

/** Shown in live builds for modules that aren't backed by a real service yet. */
export function ComingSoon({ title = "Coming soon", text = "This part of Ezymex is being connected to live data and will be available shortly.", action }: { title?: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <EmptyState illustration="hourglass_not_done" title={title} text={text} action={action} />
    </div>
  );
}

/**
 * Live builds render only the pages listed in `allow` (path prefixes); everything else shows ComingSoon.
 * Demo builds render every page.
 */
export function ModeGate({ allow, children, fallback }: { allow: readonly string[]; children: React.ReactNode; fallback?: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  if (IS_DEMO || pathAllowed(pathname, allow)) return <>{children}</>;
  return <>{fallback ?? <ComingSoon />}</>;
}
