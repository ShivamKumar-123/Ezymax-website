import { z } from "zod";

import { getServerEnv } from "@/env";
import { ApiError, handle } from "@/lib/api";

/**
 * Waitlist proxy — the browser calls this same-origin route; it forwards to
 * the gateway's public waitlist endpoints server-side (keeps api.fxartha.com
 * off the browser and avoids CORS). See AGENTS.md rule #9.
 */

const joinSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.email(),
  phone: z.string().max(20).optional(),
});

function gatewayBase(): string {
  const { GATEWAY_API_URL } = getServerEnv();
  return (GATEWAY_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
}

// Submit a waitlist request.
export const POST = handle(async (req) => {
  const input = joinSchema.parse(await req.json());

  const upstream = await fetch(`${gatewayBase()}/api/v1/waitlist/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await upstream.json().catch(() => null)) as
    | { status?: string; message?: string; detail?: string }
    | null;

  if (!upstream.ok) {
    const msg =
      (body?.detail as string) ||
      (upstream.status === 429
        ? "Too many attempts — please try again later."
        : "Could not join the waitlist.");
    throw new ApiError(upstream.status === 429 ? 429 : 502, "upstream_error", msg);
  }
  return { status: body?.status ?? "pending", message: body?.message ?? "" };
});

// Check current status for an email (for gating the landing UI).
export const GET = handle(async (req) => {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) throw new ApiError(400, "missing_email", "email is required");

  const upstream = await fetch(
    `${gatewayBase()}/api/v1/waitlist/status?email=${encodeURIComponent(email)}`,
    { headers: { accept: "application/json" } },
  );
  const body = (await upstream.json().catch(() => null)) as { status?: string } | null;
  if (!upstream.ok) throw new ApiError(502, "upstream_error", "Status check failed.");

  return { status: body?.status ?? "none" };
});
