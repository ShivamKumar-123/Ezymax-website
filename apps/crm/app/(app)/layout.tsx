import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { IS_DEMO } from "@ezymex/mock/mode";
import { SESSION_COOKIE, fetchMe, safeNext } from "@/lib/gateway";
import { SessionProvider } from "@/components/session";
import { ClientShell } from "@/components/shell";
import { FeaturesProvider } from "@/components/tenant-config";
import { tenantConfig } from "@/lib/tenant-config";

// Server-side session gate for every Client Area page: validates the HttpOnly session cookie with the
// gateway and hands the real client to the (client-side) shell. Demo builds skip it and browse as the
// sample client, so prospects can look around without an account. The shell gates live builds to the
// pages backed by real data (components/live-gate.tsx, lib/live.ts).
export default async function ClientAreaLayout({ children }: { children: React.ReactNode }) {
  if (IS_DEMO) {
    return (
      <SessionProvider>
        <ClientShell>{children}</ClientShell>
      </SessionProvider>
    );
  }

  const h = await headers();
  const next = safeNext(h.get("x-ezymex-path"), "");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");

  // session and broker config are independent: fetch them together
  const [user, cfg] = await Promise.all([fetchMe(token, h), tenantConfig()]);
  if (user === "unavailable") throw new Error("Sign-in service is unavailable. Please try again shortly.");
  if (!user) redirect(next ? `/api/auth/expired?next=${encodeURIComponent(next)}` : "/api/auth/expired");

  return (
    <SessionProvider user={user}>
      <FeaturesProvider value={cfg ? { modules: cfg.modules, flags: cfg.flags } : null}>
        <ClientShell>{children}</ClientShell>
      </FeaturesProvider>
    </SessionProvider>
  );
}
