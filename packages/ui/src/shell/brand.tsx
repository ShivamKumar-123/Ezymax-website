"use client";

import * as React from "react";
import type { TenantBrand } from "./brand-vars";

const BrandContext = React.createContext<TenantBrand | null>(null);

/** Provides the broker brand of the current host (null or Kalks → the stock Kalks look). */
export function BrandProvider({ brand, children }: { brand: TenantBrand | null; children: React.ReactNode }) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

/** The broker brand, or null when the app runs as Kalks. */
export function useBrand(): TenantBrand | null {
  const b = React.useContext(BrandContext);
  return b && !b.default ? b : null;
}

/** The broker's name as text (`Kalks` by default). */
export function BrandName({ fallback = "Kalks" }: { fallback?: string }) {
  const b = useBrand();
  return <>{b?.name ?? fallback}</>;
}
