"use client";

// The broker's module switches and feature flags (lib/modules.ts) for client components. The root layout reads them
// with the brand (lib/tenant-brand.ts) and provides them here; null (gateway unreachable, demo builds) = everything on.
import * as React from "react";
import { modulesOn, pageModule, type Features } from "./modules";

const Ctx = React.createContext<Features | null>(null);

export function FeaturesProvider({ value, children }: { value: Features | null; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** False when the broker switched off what `expr` needs: a module key, "a|b" (either) or "a&b" (both). */
export function useModule(expr: string): boolean {
  return modulesOn(React.useContext(Ctx)?.modules, expr);
}

/** A feature flag: false only when the broker switched it off. */
export function useFlag(key: string): boolean {
  return React.useContext(Ctx)?.flags[key] !== false;
}

/** Whether a link to a Client Area page (`/academy`, `/wallet`…) may show: false when its module is switched off. */
export function usePageOn(): (path: string) => boolean {
  const modules = React.useContext(Ctx)?.modules;
  return React.useCallback((path: string) => modulesOn(modules, pageModule(path)), [modules]);
}
