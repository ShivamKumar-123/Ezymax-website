"use client";

import * as React from "react";
import type { NavModule } from "@/components/kit";
import { moduleOff, modulesOn } from "@/lib/modules";

/** Modules and flags switched per broker (gateway tenant config); everything is on when unknown. */
export type ClientFeatures = { modules: Record<string, boolean>; flags: Record<string, boolean> };

const Ctx = React.createContext<ClientFeatures | null>(null);

export function FeaturesProvider({ value, children }: { value: ClientFeatures | null; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFeatures(): ClientFeatures | null {
  return React.useContext(Ctx);
}

/** False when the broker switched off what `expr` needs: a module key, "a|b" (either) or "a&b" (both). */
export function useModule(expr: string): boolean {
  return modulesOn(useFeatures()?.modules, expr);
}

/** A feature flag (D146): false only when the broker switched it off. */
export function useFlag(key: string): boolean {
  return useFeatures()?.flags[key] !== false;
}

/** Whether a link to a Client Area page may show: false when the page's module is switched off (lib/modules.ts). */
export function usePageOn(): (href: string) => boolean {
  const f = useFeatures();
  return React.useCallback((href: string) => !f || !moduleOff(f.modules, href), [f]);
}

/** Navigation without the modules this broker has switched off. */
export function navForFeatures(nav: NavModule[], f: ClientFeatures | null): NavModule[] {
  if (!f) return nav;
  const on = (href: string) => !moduleOff(f.modules, href);
  return nav.flatMap((m) => {
    if (!m.sub?.length) return on(m.href) ? [m] : [];
    const sub = m.sub.filter((s) => on(s.href));
    return sub.length ? [{ ...m, href: sub[0]!.href, sub }] : [];
  });
}
