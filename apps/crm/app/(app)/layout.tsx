import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, fetchMe, safeNext } from "@/lib/gateway";
import { SessionProvider } from "@/components/session";
import { ClientShell } from "@/components/shell";

// Server-side session gate for every Client Area page: validates the HttpOnly session cookie with the
// gateway and hands the real client to the (client-side) shell.
export default async function ClientAreaLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const next = safeNext(h.get("x-kalks-path"), "");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");

  const user = await fetchMe(token, h);
  if (user === "unavailable") throw new Error("Sign-in service is unavailable. Please try again shortly.");
  if (!user) redirect(next ? `/api/auth/expired?next=${encodeURIComponent(next)}` : "/api/auth/expired");

  return (
    <SessionProvider user={user}>
      <ClientShell>{children}</ClientShell>
    </SessionProvider>
  );
}
