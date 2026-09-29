import type { Metadata } from "next";
import { Logo } from "@kalks/ui";
import { publicStatus } from "@/lib/status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Status" };

const LABEL = { operational: "Operational", degraded: "Degraded", outage: "Outage", maintenance: "Scheduled maintenance" } as const;
const DOT = { operational: "bg-up", degraded: "bg-warn", outage: "bg-down", maintenance: "bg-warn" } as const;

/** Public status page (app.kalkstrade.com/status): no sign-in, no internal details. */
export default async function StatusPage() {
  const s = await publicStatus();
  const headline = s.status === "operational" ? "All systems operational" : s.status === "maintenance" ? "Scheduled maintenance in progress" : s.status === "degraded" ? "Some systems are degraded" : "Some systems are down";
  return (
    <main className="min-h-dvh bg-bg px-4 py-10 text-fg">
      <div className="mx-auto max-w-2xl">
        <Logo height={24} />
        <h1 className="mt-8 text-[28px] font-medium tracking-[-0.02em]" data-testid="status-headline">
          {headline}
        </h1>
        <p className="mt-1 text-[13px] text-fg-3">Checked {new Date(s.checked_at).toUTCString()} · refreshes every 15 seconds on reload</p>
        {s.maintenance && (
          <div className="mt-6 rounded-[16px] border border-warn/30 bg-warn-soft px-5 py-4 text-[14px]">
            {s.maintenance.message}
            {s.maintenance.until && <div className="mt-1 text-[12.5px] text-fg-3">Expected back by {new Date(s.maintenance.until).toUTCString()}</div>}
          </div>
        )}
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
          {s.components.map((c) => (
            <li key={c.key} className="flex items-center justify-between px-5 py-4 text-[14.5px]">
              {c.name}
              <span className="flex items-center gap-2 text-[13px] text-fg-2">
                <span className={`size-2 rounded-full ${DOT[c.status]}`} />
                {LABEL[c.status]}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-[12.5px] text-fg-3">Questions? support@kalkstrade.com</p>
      </div>
    </main>
  );
}
