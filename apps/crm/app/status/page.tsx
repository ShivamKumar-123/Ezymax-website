import type { Metadata } from "next";
import { Logo } from "@ezymex/ui/logo";
import { getFormatter, getT } from "@ezymex/i18n/server";
import { publicStatus } from "@/lib/status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Status" };

const LABEL = { operational: "shell.system.status.operational", degraded: "shell.system.status.degraded", outage: "shell.system.status.outage", maintenance: "shell.system.status.maintenance" } as const;
const HEADLINE = { operational: "shell.system.status.headlineOperational", maintenance: "shell.system.status.headlineMaintenance", degraded: "shell.system.status.headlineDegraded", outage: "shell.system.status.headlineOutage" } as const;
const UTC: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "long", timeZone: "UTC" };
const DOT = { operational: "bg-up", degraded: "bg-warn", outage: "bg-down", maintenance: "bg-warn" } as const;

/** Public status page (app.ezymex.com/status): no sign-in, no internal details. */
export default async function StatusPage() {
  const [s, t, f] = await Promise.all([publicStatus(), getT(), getFormatter()]);
  const headline = t(HEADLINE[s.status === "operational" || s.status === "maintenance" || s.status === "degraded" ? s.status : "outage"]);
  return (
    <main className="min-h-dvh bg-bg px-4 py-10 text-fg">
      <div className="mx-auto max-w-2xl">
        <Logo height={24} />
        <h1 className="mt-8 text-[28px] font-medium tracking-[-0.02em]" data-testid="status-headline">
          {headline}
        </h1>
        <p className="mt-1 text-[13px] text-fg-3">{t("shell.system.status.checked", { time: f.dateTime(s.checked_at, UTC) })}</p>
        {s.maintenance && (
          <div className="mt-6 rounded-[16px] border border-warn/30 bg-warn-soft px-5 py-4 text-[14px]">
            {s.maintenance.message}
            {s.maintenance.until && <div className="mt-1 text-[12.5px] text-fg-3">{t("shell.system.status.expectedBack", { time: f.dateTime(s.maintenance.until, UTC) })}</div>}
          </div>
        )}
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
          {s.components.map((c) => (
            <li key={c.key} className="flex items-center justify-between px-5 py-4 text-[14.5px]">
              {c.name}
              <span className="flex items-center gap-2 text-[13px] text-fg-2">
                <span className={`size-2 rounded-full ${DOT[c.status]}`} />
                {t(LABEL[c.status])}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-[12.5px] text-fg-3">{t("shell.system.status.questions", { email: "support@ezymex.com" })}</p>
      </div>
    </main>
  );
}
