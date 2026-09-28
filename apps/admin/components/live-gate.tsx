"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ComingSoon, ModeGate, buttonVariants } from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { LIVE_PAGES, isLivePath, soonFor } from "@/lib/live";

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
  if (IS_DEMO) return <>{children}</>;
  return (
    <ModeGate allow={LIVE_PAGES} fallback={<LiveFallback />}>
      {isLivePath(pathname) ? children : <LiveFallback />}
    </ModeGate>
  );
}
