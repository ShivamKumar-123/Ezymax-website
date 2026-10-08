"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ComingSoon, ModeGate, buttonVariants } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LIVE_PAGES, isLivePath, soonFor } from "@/lib/live";
import { canOpen } from "@/lib/access";
import { useStaff } from "@/components/staff-session";

function NoAccess() {
  const staff = useStaff();
  return (
    <ComingSoon
      title="Not available for your role"
      text={`Your role (${staff.role_label}) doesn't include this page. Ask a Super Admin if you need access.`}
      action={
        <Link href="/org" className={buttonVariants({ variant: "surface" })}>
          <ArrowLeft /> See your access
        </Link>
      }
    />
  );
}

function LiveFallback() {
  const pathname = usePathname() ?? "/";
  const soon = soonFor(pathname);
  return (
    <div>
      <ComingSoon
        title={soon?.title ?? "Not enabled yet"}
        text={soon?.text ?? "This section isn't enabled for this workspace yet."}
        action={
          <Link href="/" className={buttonVariants({ variant: "surface" })}>
            <ArrowLeft /> Back to Command Center
          </Link>
        }
      />
    </div>
  );
}

/** Live builds render only real-data pages; everything else shows Coming soon. Demo builds render every page. */
export function LiveGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const staff = useStaff();
  if (IS_DEMO) return <>{children}</>;
  if (!canOpen(staff, pathname)) return <NoAccess />;
  return (
    <ModeGate allow={LIVE_PAGES} fallback={<LiveFallback />}>
      {isLivePath(pathname) ? children : <LiveFallback />}
    </ModeGate>
  );
}
