import { NextResponse, type NextRequest } from "next/server";
import { clientIp, gateway } from "@/lib/gateway";
import { apiError, mutationAllowed, requireStaff } from "@/lib/bff";
import { walletConfigured, walletRaw, walletService } from "@/lib/wallet";
import { walletAllows, type WalletPerm } from "@/lib/wallet-perms";
import { tradingAllows } from "@/lib/trading-perms";

// Finance BFF: browser -> /api/wallet/<path> (same origin, staff cookie) -> wallet service /v1/admin/<path>.
// The staff session is verified with the gateway on every call and the permission for the route is checked
// here (lib/wallet-perms.ts); the wallet service checks the role again and writes its audit log.
//   GET names?ids=1,2  -> client names / emails from the gateway (needs clients.read in the gateway)
// Balance & credit (adjustments/*): a route lists the permissions of which any one is enough here; the wallet
// service then enforces the exact key (finance.adjust for add / deduct, finance.credit for credit,
// finance.adjust_force to force, finance.adjust_approve to approve) from the forwarded x-ezymex-staff-perms.
// Manual payments (manual/*: bank / UPI / crypto paid outside the platform):
//   GET manual/methods, manual/deposits, manual/deposits/<id>            finance.read
//   GET manual/media/<24 hex>  a QR code or payment screenshot           finance.read     (the image bytes, streamed)
//   POST manual/methods, PUT manual/methods/<id>, POST …/<id>/delete      finance.settings
//   POST manual/media  the raw QR image (PNG / JPG / WEBP ≤ 5 MB)         finance.settings (same-origin, raw bytes)
//   POST manual/deposits/<id>/(approve|reject)                           finance.approve
//   GET manual/deposits/export?<filters>  the CSV attachment             finance.export   (passed through as is)

type Method = "GET" | "POST" | "PUT";
type Perm = WalletPerm | "finance.adjust";
type Route = { method: Method; re: RegExp; perm: Perm | Perm[] };

const ADJ_READ: Perm[] = ["finance.read", "finance.adjust", "finance.credit", "finance.adjust_approve"];
const ADJ_WRITE: Perm[] = ["finance.adjust", "finance.credit"];
const allows = (staff: Parameters<typeof walletAllows>[0], p: Perm) => (p === "finance.adjust" ? tradingAllows(staff, p) : walletAllows(staff, p));

const N = "\\d{1,18}";
const ROUTES: Route[] = [
  { method: "GET", re: /^(summary|deposits|withdrawals|wallets|settings|reconciliation|audit)$/, perm: "finance.read" },
  { method: "GET", re: new RegExp(`^(deposits|withdrawals|wallets)/${N}$`), perm: "finance.read" },
  { method: "POST", re: new RegExp(`^deposits/${N}/(assign|reject|recheck)$`), perm: "finance.write" },
  { method: "POST", re: new RegExp(`^withdrawals/${N}/(approve|reject)$`), perm: "finance.approve" },
  { method: "POST", re: new RegExp(`^withdrawals/${N}/paid$`), perm: "finance.write" },
  { method: "GET", re: /^adjustments$/, perm: ADJ_READ },
  { method: "GET", re: new RegExp(`^adjustments/(${N}|settings|targets/${N})$`), perm: ADJ_READ },
  { method: "POST", re: /^adjustments(\/preview)?$/, perm: ADJ_WRITE },
  { method: "POST", re: new RegExp(`^adjustments/${N}/(approve|reject)$`), perm: "finance.adjust_approve" },
  { method: "POST", re: new RegExp(`^adjustments/${N}/cancel$`), perm: ADJ_WRITE },
  { method: "PUT", re: /^adjustments\/settings$/, perm: "finance.settings" },
  { method: "PUT", re: /^settings$/, perm: "finance.settings" },
  // manual payments (bank / UPI / crypto); images and the CSV export have their own handlers below
  { method: "GET", re: /^manual\/(methods|deposits)$/, perm: "finance.read" },
  { method: "GET", re: new RegExp(`^manual/deposits/${N}$`), perm: "finance.read" },
  { method: "POST", re: /^manual\/methods$/, perm: "finance.settings" },
  { method: "PUT", re: new RegExp(`^manual/methods/${N}$`), perm: "finance.settings" },
  { method: "POST", re: new RegExp(`^manual/methods/${N}/delete$`), perm: "finance.settings" },
  { method: "POST", re: new RegExp(`^manual/deposits/${N}/(approve|reject)$`), perm: "finance.approve" },
  // crypto checkouts (OxaPay). Recheck only asks the provider again and credits what it already owes,
  // so it needs no approval right of its own.
  { method: "GET", re: /^oxapay\/invoices$/, perm: "finance.read" },
  { method: "POST", re: new RegExp(`^oxapay/invoices/${N}/recheck$`), perm: "finance.read" },
];

const MEDIA_ID = /^manual\/media\/([0-9a-f]{24})$/;
const MAX_IMAGE = 5 * 1024 * 1024;

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });

async function handle(req: NextRequest, parts: string[], method: Method) {
  const path = parts.map((p) => decodeURIComponent(p)).join("/");
  if (!walletConfigured()) return apiError(503, "not_configured", "The wallet service is not configured for the Back Office.");
  if (method === "GET" && path === "names") return names(req);
  if (method === "POST" && path === "manual/media") return uploadQr(req);
  if (method === "GET" && path === "manual/deposits/export") return exportCsv(req);
  const media = method === "GET" ? MEDIA_ID.exec(path) : null;
  if (media) return image(req, media[1]!);
  const route = ROUTES.find((r) => r.method === method && r.re.test(path));
  if (!route) return apiError(404, "not_found", "Not found.");
  let body: unknown;
  if (method !== "GET") {
    const blocked = mutationAllowed(req);
    if (blocked) return blocked;
    body = await req.json().catch(() => null);
    if (body === null || typeof body !== "object" || Array.isArray(body)) return apiError(400, "bad_request", "Invalid request body.");
  }
  const who = await requireStaff(req);
  if (who instanceof NextResponse) return who;
  const perms = Array.isArray(route.perm) ? route.perm : [route.perm];
  if (!perms.some((p) => allows(who.staff, p))) return apiError(403, "forbidden", "Your role doesn't allow this.");
  const r = await walletService(`/v1/admin/${path}${method === "GET" ? req.nextUrl.search : ""}`, { method, body, staff: who.staff, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  return json(r.data, r.status);
}

const unavailable = () => apiError(503, "unavailable", "The wallet service is unavailable. Please try again shortly.");

/** A JSON answer of the service (an upload result or an error) passed on with its status. */
async function passJson(res: Response) {
  const text = await res.text().catch(() => "");
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!data || typeof data !== "object") data = { error: { code: "bad_gateway", message: "The wallet service returned an unexpected response." } };
  return json(data, res.status);
}

/** A QR code for a payment method: the raw image bytes, same-origin only, finance.settings. */
async function uploadQr(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let same = false;
  try {
    same = !!origin && new URL(origin).host === host;
  } catch {
    same = false;
  }
  if (!same) return apiError(403, "forbidden", "Cross-site request blocked.");
  const who = await requireStaff(req);
  if (who instanceof NextResponse) return who;
  if (!walletAllows(who.staff, "finance.settings")) return apiError(403, "forbidden", "Your role doesn't allow this.");
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_IMAGE) return apiError(413, "too_large", "Images can be up to 5 MB.");
  const bytes = await req.arrayBuffer();
  if (bytes.byteLength > MAX_IMAGE) return apiError(413, "too_large", "Images can be up to 5 MB.");
  if (bytes.byteLength === 0) return apiError(400, "bad_request", "Choose an image to upload.");
  const res = await walletRaw("/v1/admin/manual/media", { method: "POST", raw: bytes, staff: who.staff, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent"), timeoutMs: 60_000 });
  return res ? passJson(res) : unavailable();
}

/** A QR code or a client's payment screenshot (finance.read): the bytes streamed with the service's type and cache headers. */
async function image(req: NextRequest, id: string) {
  const who = await requireStaff(req);
  if (who instanceof NextResponse) return who;
  if (!walletAllows(who.staff, "finance.read")) return apiError(403, "forbidden", "Your role doesn't allow this.");
  const inm = req.headers.get("if-none-match");
  const res = await walletRaw(`/v1/admin/manual/media/${id}`, {
    staff: who.staff,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    headers: inm && inm.length <= 100 ? { "if-none-match": inm } : undefined,
  });
  if (!res) return unavailable();
  if (res.status !== 200 && res.status !== 304) return passJson(res);
  const h = new Headers();
  for (const k of ["content-type", "content-length", "cache-control", "etag", "x-content-type-options", "content-security-policy"]) {
    const v = res.headers.get(k);
    if (v) h.set(k, v);
  }
  // staff-only bytes: never in a shared cache, whatever the service allows (a screenshot stays no-store)
  h.set("cache-control", /no-store/.test(h.get("cache-control") ?? "") ? "private, no-store" : "private, max-age=86400");
  if (!h.has("x-content-type-options")) h.set("x-content-type-options", "nosniff");
  return new NextResponse(res.status === 304 ? null : res.body, { status: res.status, headers: h });
}

/** The manual deposit requests as CSV with the list's filters (finance.export; the wallet audits the export). */
async function exportCsv(req: NextRequest) {
  const who = await requireStaff(req);
  if (who instanceof NextResponse) return who;
  if (!walletAllows(who.staff, "finance.export")) return apiError(403, "forbidden", "Your role doesn't allow this.");
  const res = await walletRaw(`/v1/admin/manual/deposits/export${req.nextUrl.search}`, { staff: who.staff, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent"), timeoutMs: 60_000 });
  if (!res) return unavailable();
  if (!res.ok) return passJson(res);
  const h = new Headers({ "cache-control": "no-store", "x-content-type-options": "nosniff" });
  h.set("content-type", res.headers.get("content-type") ?? "text/csv; charset=utf-8");
  h.set("content-disposition", res.headers.get("content-disposition") ?? 'attachment; filename="manual-deposits.csv"');
  return new NextResponse(res.body, { status: 200, headers: h });
}

const NAME_TTL = 5 * 60_000;
const cache = new Map<string, { name: string; email: string; kyc: string; at: number }>();

/** `?ids=1,2,3` → `{ names: { "1": { name, email, kyc_status } } }` (gateway, needs clients.read). */
async function names(req: NextRequest) {
  const who = await requireStaff(req);
  if (who instanceof NextResponse) return who;
  if (!walletAllows(who.staff, "finance.read")) return apiError(403, "forbidden", "Your role doesn't allow this.");
  const ids = Array.from(new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").filter((x) => /^\d{1,18}$/.test(x)))).slice(0, 100);
  const out: Record<string, { name: string; email: string; kyc_status: string }> = {};
  if (!who.staff.permissions?.includes("clients.read")) return json({ names: out });
  const now = Date.now();
  await Promise.all(
    ids.map(async (id) => {
      const hit = cache.get(id);
      if (hit && now - hit.at < NAME_TTL) {
        out[id] = { name: hit.name, email: hit.email, kyc_status: hit.kyc };
        return;
      }
      const r = await gateway<{ user?: { name: string; email: string; kyc_status: string } }>(`/v1/admin/users/${id}`, { token: who.token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
      if (r.status === 200 && r.data.user) {
        cache.set(id, { name: r.data.user.name, email: r.data.user.email, kyc: r.data.user.kyc_status, at: now });
        out[id] = { name: r.data.user.name, email: r.data.user.email, kyc_status: r.data.user.kyc_status };
      }
    }),
  );
  if (cache.size > 5000) cache.clear();
  return json({ names: out });
}

type Ctx = { params: Promise<{ path: string[] }> };
export async function GET(req: NextRequest, { params }: Ctx) {
  return handle(req, (await params).path, "GET");
}
export async function POST(req: NextRequest, { params }: Ctx) {
  return handle(req, (await params).path, "POST");
}
export async function PUT(req: NextRequest, { params }: Ctx) {
  return handle(req, (await params).path, "PUT");
}
