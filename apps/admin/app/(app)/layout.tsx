import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_COOKIE, fetchStaff, safeNext } from "@/lib/gateway";
import { StaffProvider } from "@/components/staff-session";
import { BackOfficeShell } from "@/components/shell";

// Server-side session gate for every Back Office page: validates the staff session cookie with the gateway.
export default async function BackOfficeLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const next = safeNext(h.get("x-kalks-path"), "");
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");

  const staff = await fetchStaff(token, h);
  if (staff === "unavailable") throw new Error("Sign-in service is unavailable. Please try again shortly.");
  if (!staff) redirect(next ? `/api/auth/expired?next=${encodeURIComponent(next)}` : "/api/auth/expired");

  return (
    <StaffProvider staff={staff}>
      <BackOfficeShell>{children}</BackOfficeShell>
    </StaffProvider>
  );
}
