// Tenant (broker) branding shared by the apps. Server-safe: no React here, so layouts can call it.
// The gateway serves the brand of the request's host (GET /v1/public/tenant-config → `branding`);
// Ezymex itself (`default: true`) keeps the built-in look.

export type TenantBrand = {
  slug: string;
  name: string;
  /** True for the platform's own tenant (Ezymex): the stock logo and colours are used. */
  default?: boolean;
  logo_url?: string | null;
  primary?: string | null;
  accent?: string | null;
  support_email?: string | null;
  /** First active domain per app, e.g. { app: "https://app.broker.com", trade: "https://trade.broker.com" }. */
  urls?: Partial<Record<"website" | "app" | "trade" | "admin", string | null>>;
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Only hex colours ever reach CSS. */
export function brandColor(v: string | null | undefined): string | null {
  return v && HEX.test(v) ? v.toLowerCase() : null;
}

/** A branded tenant (anything but Ezymex' own look). */
export function isCustomBrand(b: TenantBrand | null | undefined): b is TenantBrand {
  return !!b && !b.default;
}

/**
 * CSS overriding the design tokens with the broker's colours: primary → the `ember` action colour (buttons,
 * links, active states, page glow), accent → `gold`. Empty for Ezymex. Rendered as a <style> tag by the root layouts (values are validated hex colours).
 */
export function brandCss(b: TenantBrand | null | undefined): string {
  if (!isCustomBrand(b)) return "";
  const p = brandColor(b.primary);
  const a = brandColor(b.accent);
  const vars: string[] = [];
  if (p) {
    vars.push(
      `--k-ember:${p}`,
      `--k-ember-2:color-mix(in oklab,${p} 78%,#ffffff)`,
      `--k-ember-soft:color-mix(in oklab,${p} 12%,transparent)`,
      `--k-brand-primary:${p}`,
    );
  }
  if (a) vars.push(`--k-gold:${a}`, `--k-gold-soft:color-mix(in oklab,${a} 12%,transparent)`, `--k-brand-accent:${a}`);
  if (!vars.length) return "";
  let css = `html:root,html.dark,html.light{${vars.join(";")}}`;
  // the primary button and the page glow carry fixed Ezymex ember values in the stylesheet (unlayered rules win)
  if (p) {
    css +=
      `.k-ember-btn{background:linear-gradient(135deg,color-mix(in oklab,${p} 82%,#ffffff),${p});` +
      `box-shadow:0 8px 24px -8px color-mix(in oklab,${p} 60%,transparent),inset 0 1px 0 rgba(255,255,255,.25)}` +
      `.k-glow{background:radial-gradient(900px 380px at 50% -140px,color-mix(in oklab,${p} 45%,transparent),color-mix(in oklab,${p} 16%,transparent) 45%,transparent 72%)}`;
  }
  return css;
}

/** Host part of a brand URL (`https://app.broker.com` → `app.broker.com`). */
export function brandHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
