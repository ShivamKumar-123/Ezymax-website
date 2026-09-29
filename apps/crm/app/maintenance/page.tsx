import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@kalks/ui";
import { tenantConfig } from "@/lib/tenant-config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Maintenance" };

/** Shown instead of every Client Area page while the broker is in maintenance mode (staff keep working). */
export default async function MaintenancePage() {
  const cfg = await tenantConfig();
  const m = cfg?.maintenance;
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 text-fg">
      <div className="max-w-md text-center">
        <Logo height={26} className="mx-auto" />
        <h1 className="mt-10 text-[30px] font-medium tracking-[-0.02em]" data-testid="maintenance-title">
          We&apos;ll be right back
        </h1>
        <p className="mt-3 text-[15px] text-fg-2">{m?.active ? m.message : "The Client Area is available again."}</p>
        {m?.active && m.until && <p className="mt-3 text-[13px] text-fg-3">Expected back by {new Date(m.until).toUTCString()}</p>}
        <div className="mt-8 flex justify-center gap-4 text-[13.5px]">
          <Link href="/status" className="text-ember hover:underline">
            System status
          </Link>
          {!m?.active && (
            <Link href="/" className="text-ember hover:underline">
              Open the Client Area
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
