import { NextResponse, type NextRequest } from "next/server";
import { walletCallback } from "@/lib/wallet";

// OxaPay's payment notification for a crypto checkout (services/wallet, ops::oxapay).
//
// This is the one route under /api/wallet with no session: the caller is OxaPay, not a signed-in client, and
// the `HMAC` header is what proves it. It is listed in proxy.ts so the sign-in gate lets it through, and it
// is a static segment, so it wins over the [...path] catch-all beside it.
//
// The body is forwarded byte for byte. OxaPay signs the raw bytes, so parsing and re-serialising the JSON
// here would break every signature. Nothing in this file inspects the payload; the wallet verifies the
// signature and then asks OxaPay what the payment actually is before crediting anything.
//
// OxaPay expects `200 ok`. Anything else counts as a failed delivery and it retries, up to five attempts
// over about three and a half hours — which is what we want for a wallet that is briefly down.

/** OxaPay's callbacks are small; anything larger is not one of theirs. */
const MAX_BODY = 64 * 1024;

export async function POST(req: NextRequest) {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY) return new NextResponse("too large", { status: 413 });

  const raw = await req.arrayBuffer().catch(() => null);
  if (!raw || raw.byteLength === 0 || raw.byteLength > MAX_BODY) {
    return new NextResponse("bad request", { status: 400 });
  }
  const hmac = req.headers.get("hmac");
  const r = await walletCallback("/v1/oxapay/callback", raw, hmac);

  // 200 with the literal "ok" is what OxaPay checks for; any other status asks it to try again.
  if (r.status === 200) return new NextResponse("ok", { status: 200, headers: { "cache-control": "no-store" } });
  return new NextResponse("retry", { status: r.status >= 500 ? 503 : r.status, headers: { "cache-control": "no-store" } });
}
