import type { NextRequest } from "next/server";
import { publicCertificate } from "@/lib/prop";
import { certImage } from "@/lib/prop-cert-image";

// Public certificate image (PNG, 1200 × 675). Same layout as the service's SVG (services/prop/src/certs.rs).
// No sign-in: /verify/** is let through by proxy.ts. The certificate is read server-side with the internal token.

type Ctx = { params: Promise<{ code: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { code } = await params;
  const c = await publicCertificate(code);
  if (c === "unavailable") return new Response("Certificate service unavailable", { status: 503, headers: { "cache-control": "no-store" } });
  if (!c) return new Response("Certificate not found", { status: 404, headers: { "cache-control": "no-store" } });

  const verify = `${req.nextUrl.host}/verify/${c.code}`;
  const img = certImage(c, verify);

  const headers = new Headers(img.headers);
  headers.set("cache-control", c.valid ? "public, max-age=300" : "no-store");
  if (req.nextUrl.searchParams.get("download")) headers.set("content-disposition", `attachment; filename="kalks-certificate-${c.code}.png"`);
  return new Response(img.body, { status: 200, headers });
}
