'use client';

/**
 * White-label BrandingProvider — port of the stock4x tenant-branding
 * pattern.
 *
 * On a broker's custom domain, the whole app should carry the broker's
 * identity (name, logo, favicon, support contacts) instead of
 * SwissCresta's. Resolution:
 *
 *   1. Platform hosts (static allowlist below) → platform branding,
 *      no lookup. NEVER add `window.location.hostname` dynamically —
 *      every tenant domain would then self-classify as platform and
 *      skip the lookup (the historical stock4x "branding default on
 *      tenant domain" bug).
 *   2. Any other host → GET /api/v1/branding/by-domain?host=… (public,
 *      same-origin through the Next proxy). Only READY domains resolve;
 *      anything else falls back to the platform brand.
 *
 * Applies the brand to the document chrome (title + favicon) and
 * exposes `useBranding()` for components that want the name/logo/
 * support contacts.
 */

import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from 'react';

export interface BrandingPayload {
  is_white_label: boolean;
  brand_name: string | null;
  logo_url: string | null;
  support_email: string | null;
  support_whatsapp: string | null;
  partner_code: string | null;
}

const PLATFORM_BRANDING: BrandingPayload = {
  is_white_label: false,
  brand_name: null,
  logo_url: null,
  support_email: null,
  support_whatsapp: null,
  partner_code: null,
};

interface Ctx {
  branding: BrandingPayload;
  loading: boolean;
}

const BrandingCtx = createContext<Ctx>({ branding: PLATFORM_BRANDING, loading: false });

export function useBranding(): Ctx {
  return useContext(BrandingCtx);
}

/**
 * Display-ready brand values with platform defaults baked in — the one
 * hook UI chrome should use. On platform hosts: SwissCresta identity.
 * On a white-label tenant domain: the broker's name/logo, and
 * `isWhiteLabel` so components can hide platform-specific artwork.
 */
export function useBrandDisplay() {
  const { branding } = useBranding();
  const isWhiteLabel = branding.is_white_label;
  return {
    isWhiteLabel,
    /** Brand name for copy ("Welcome to X", footer, alt text). */
    name: (isWhiteLabel && branding.brand_name) ? branding.brand_name : 'SwissCresta',
    /** Tenant logo URL (same-origin /api/v1 path) or null → use the
     *  platform's bundled logo assets. */
    logoUrl: isWhiteLabel ? (branding.logo_url || null) : null,
    supportEmail: isWhiteLabel ? branding.support_email : null,
    supportWhatsapp: isWhiteLabel ? branding.support_whatsapp : null,
  };
}

/** Static platform-host allowlist. Update alongside PLATFORM_HOSTS in
 *  the backend .env when the platform gains a new hostname. */
const PLATFORM_HOSTS = new Set<string>([
  'swisscresta.com',
  'www.swisscresta.com',
  'trade.swisscresta.com',
  process.env.NEXT_PUBLIC_MARKETING_HOST || '',
  process.env.NEXT_PUBLIC_TRADE_HOST || '',
  'localhost',
  '127.0.0.1',
].filter(Boolean) as string[]);

export function isPlatformHost(host: string): boolean {
  const h = host.toLowerCase();
  if (PLATFORM_HOSTS.has(h)) return true;
  // Preview deploys of the PLATFORM build.
  return /\.(vercel|netlify|fly)\.(app|dev)$/.test(h);
}

/** Mutate (never replace) the favicon link — Next's metadata system owns
 *  the original node; replacing it crashes the reconciler. */
function applyBrandingChrome(brand: BrandingPayload) {
  if (typeof document === 'undefined') return;
  const name = (brand.brand_name || '').trim();
  if (name) document.title = name;

  const logo = brand.logo_url
    ? brand.logo_url.startsWith('http') ? brand.logo_url : brand.logo_url
    : null;
  if (logo) {
    const existing = document.head.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (existing) existing.href = logo;
    const ours = document.head.querySelector('link[data-wl-branding-icon]') as HTMLLinkElement | null;
    if (ours) {
      ours.href = logo;
    } else {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = logo;
      link.setAttribute('data-wl-branding-icon', '1');
      document.head.appendChild(link);
    }
  }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingPayload>(PLATFORM_BRANDING);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const host = window.location.hostname;
    if (isPlatformHost(host)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/v1/branding/by-domain?host=${encodeURIComponent(host)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const data = (await res.json()) as BrandingPayload;
        if (!cancelled && data && data.is_white_label) {
          setBranding(data);
          applyBrandingChrome(data);
        }
      } catch {
        // Network hiccup → keep platform branding; never block the app.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <BrandingCtx.Provider value={{ branding, loading }}>
      {children}
    </BrandingCtx.Provider>
  );
}

export default BrandingProvider;
