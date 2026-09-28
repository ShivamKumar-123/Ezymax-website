"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Chip, ComingSoon, ModeGate, buttonVariants } from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { LIVE_PAGES, isLivePath, soonFor } from "@/lib/live";

function LiveFallback() {
  const pathname = usePathname() ?? "/";
  const soon = soonFor(pathname);
  return (
    <div>
      {soon && (
        <div className="flex justify-center pt-8">
          <Chip tone="ember" dot>
            Next release
          </Chip>
        </div>
      )}
      <ComingSoon
        title={soon?.title ?? "Not available yet"}
        text={soon?.text ?? "This part of the Back Office isn't connected to live data yet."}
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
