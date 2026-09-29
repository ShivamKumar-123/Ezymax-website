import type { NextRequest } from "next/server";
import { publicShare } from "@/lib/growth";
import { shareImage } from "@/lib/share-image";

// Public share card image (PNG, 1200 × 630). No sign-in: /s/** is let through by proxy.ts. The card is read
// server-side with the internal token without counting a view (?view=0); only the page counts views.

type Ctx = { params: Promise<{ code: string }> };

function publicHost(req: NextRequest) {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { code } = await params;
  const s = await publicShare(code);
  if (s === "unavailable") return new Response("Share service unavailable", { status: 503, headers: { "cache-control": "no-store" } });
  if (!s) return new Response("Share not found", { status: 404, headers: { "cache-control": "no-store" } });

  const host = publicHost(req);
  const link = s.data.referralCode ? `${host}/r/${s.data.referralCode}` : host;
  const img = shareImage(s, link);

  const headers = new Headers(img.headers);
  headers.set("cache-control", "public, max-age=300");
  if (req.nextUrl.searchParams.get("download")) headers.set("content-disposition", `attachment; filename="kalks-share-${s.code}.png"`);
  return new Response(img.body, { status: 200, headers });
}
