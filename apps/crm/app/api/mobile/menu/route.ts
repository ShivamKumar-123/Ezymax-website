import { NextResponse, type NextRequest } from "next/server";
import { fetchMe } from "@/lib/gateway";
import { SUPPORT_EMAIL } from "@/lib/live";
import { bearerOf, isLoopbackHost } from "@/lib/mobile";
import { tenantConfig } from "@/lib/tenant-config";
import { hostOf } from "@/lib/tenant-host";

// GET /api/mobile/menu: what the app's More tab offers this client (apps/mobile/src/features/more).
// - modules / flags: the broker's switches (gateway tenant config, D112 / D146). The app hides a module that is off,
//   like the Client Area navigation does; the module's own BFF routes refuse it anyway (proxy brokerGate).
// - brand: the broker's name and support email; legal: the broker website's legal pages (opened in the in-app
//   browser). Nothing here is secret; a session is still required, like every signed-in mobile route.

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };
/** Legal pages of the broker website (the Kalks website serves these paths). */
const LEGAL = [
  ["terms", "/terms"],
  ["privacy", "/privacy"],
  ["risk", "/risk-warning"],
  ["disclaimer", "/risk"],
  ["restricted", "/restricted-countries"],
] as const;
const FALLBACK_WEBSITE = "https://kalkstrade.com";

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
}

/** The broker's public website: its configured website domain, else this Client Area's host without `app.`. */
function websiteOf(configured: string | null | undefined, host: string | undefined): string {
  if (configured && /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(configured)) return configured.toLowerCase();
  const name = (host ?? "").replace(/:\d+$/, "");
  if (!name || isLoopbackHost(name) || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(name)) return FALLBACK_WEBSITE;
  return `https://${name.startsWith("app.") ? name.slice(4) : name}`;
}

export async function GET(req: NextRequest) {
  const token = bearerOf(req.headers);
  if (!token) return error(401, "unauthorized", "Please sign in.");
  const me = await fetchMe(token, req.headers);
  if (me === "unavailable") return error(503, "unavailable", "Sign-in service is unavailable. Please try again shortly.");
  if (!me) return error(401, "unauthorized", "Please sign in.");
  const host = hostOf(req.headers);
  const cfg = await tenantConfig(host ?? "");
  const brand = cfg?.branding;
  const website = websiteOf(brand?.urls?.website, host);
  return NextResponse.json(
    {
      modules: cfg?.modules ?? {},
      flags: cfg?.flags ?? {},
      brand: { name: brand?.name ?? cfg?.tenant.name ?? me.tenant?.name ?? "Kalks", support_email: brand?.support_email || SUPPORT_EMAIL, website },
      legal: LEGAL.map(([key, path]) => ({ key, url: `${website}${path}` })),
    },
    { headers: NO_STORE },
  );
}
