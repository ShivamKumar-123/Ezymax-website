import { NextResponse } from "next/server";
import { publicStatus } from "@/lib/status";

// Public status (no sign-in): overall state, maintenance notice and per-component state, nothing internal.
export async function GET() {
  return NextResponse.json(await publicStatus(), { headers: { "cache-control": "public, max-age=15" } });
}
