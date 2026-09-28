import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { IS_DEMO } from "@kalks/mock/mode";
import { DEMO_STAFF, STAFF_COOKIE, fetchStaff, safeNext } from "@/lib/gateway";
import { StaffProvider } from "@/components/staff-session";
import { BackOfficeShell } from "@/components/shell";
import { LiveGate } from "@/components/live-gate";

// Server-side session gate for every Back Office page: validates the staff session cookie with the gateway.
// Demo builds have no staff sign-in: prospects browse the mock showcase as a demo staff member.
export default async function BackOfficeLayout({ children }: { children: React.ReactNode }) {
  if (IS_DEMO) {
    return (
      <StaffProvider staff={DEMO_STAFF}>
        <BackOfficeShell>{children}</BackOfficeShell>
      </StaffProvider>
    );
  }

  const h = await headers();
  const next = safeNext(h.get("x-kalks-path"), "");
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");

  const staff = await fetchStaff(token, h);
  if (staff === "unavailable") throw new Error("Sign-in service is unavailable. Please try again shortly.");
  if (!staff) redirect(next ? `/api/auth/expired?next=${encodeURIComponent(next)}` : "/api/auth/expired");

  return (
    <StaffProvider staff={staff}>
      <BackOfficeShell>
        <LiveGate>{children}</LiveGate>
      </BackOfficeShell>
    </StaffProvider>
  );
}
