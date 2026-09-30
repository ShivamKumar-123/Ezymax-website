import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@kalks/ui/logo";
import { Illustration } from "@kalks/ui/illustration";
import { getFormatter, getT } from "@kalks/i18n/server";
import { tenantConfig } from "@/lib/tenant-config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Maintenance" };

const UTC: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "long", timeZone: "UTC" };

/** Shown instead of every Client Area page while the broker is in maintenance mode (staff keep working). */
export default async function MaintenancePage() {
  const [cfg, t, f] = await Promise.all([tenantConfig(), getT(), getFormatter()]);
  const m = cfg?.maintenance;
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 text-fg">
      <div className="max-w-md text-center">
        <Logo height={26} className="mx-auto" />
        <Illustration name="maintenance" width={280} maxHeight={190} priority className="mx-auto mt-10" />
        <h1 className="mt-8 text-[30px] font-medium tracking-[-0.02em]" data-testid="maintenance-title">
          {t("shell.system.maintenance.title")}
        </h1>
        <p className="mt-3 text-[15px] text-fg-2">{m?.active ? m.message : t("shell.system.maintenance.available")}</p>
        {m?.active && m.until && <p className="mt-3 text-[13px] text-fg-3">{t("shell.system.maintenance.expectedBack", { time: f.dateTime(m.until, UTC) })}</p>}
        <div className="mt-8 flex justify-center gap-4 text-[13.5px]">
          <Link href="/status" className="text-ember hover:underline">
            {t("shell.system.maintenance.statusLink")}
          </Link>
          {!m?.active && (
            <Link href="/" className="text-ember hover:underline">
              {t("shell.system.maintenance.openClientArea")}
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
