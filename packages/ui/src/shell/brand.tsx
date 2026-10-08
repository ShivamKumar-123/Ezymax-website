"use client";

import * as React from "react";
import type { TenantBrand } from "./brand-vars";

const BrandContext = React.createContext<TenantBrand | null>(null);

/** Provides the broker brand of the current host (null or Ezymex → the stock Ezymex look). */
export function BrandProvider({ brand, children }: { brand: TenantBrand | null; children: React.ReactNode }) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

/** The broker brand, or null when the app runs as Ezymex. */
export function useBrand(): TenantBrand | null {
  const b = React.useContext(BrandContext);
  return b && !b.default ? b : null;
}

/** The broker's name as text (`Ezymex` by default). */
export function BrandName({ fallback = "Ezymex" }: { fallback?: string }) {
  const b = useBrand();
  return <>{b?.name ?? fallback}</>;
}
