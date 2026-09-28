"use client";

import * as React from "react";
import { toast } from "sonner";
import { Ban, ExternalLink, KeyRound, Palette, PlayCircle, Receipt } from "lucide-react";
import { Avatar, Button, Chip, CopyButton, Dialog, Flag, Money, Progress, Sparkline, formatDateTime, formatNumber } from "@kalks/ui";
import { BRK_INVOICES, BRK_MODULES, type BrkTenant } from "@kalks/mock/admin-platform-brokers";
import { ConfirmDialog, PlanChip, SectionLabel, TenantLogo, TenantStatus, compactUsd } from "./kit";
import { MODULE_ICON } from "./module-icons";

export function TenantDrawer({ tenant, onOpenChange, onStatus }: { tenant: BrkTenant | null; onOpenChange: (o: boolean) => void; onStatus: (id: string, s: BrkTenant["status"]) => void }) {
  const [confirm, setConfirm] = React.useState(false);
  const t = tenant;
  if (!t) return null;
  const invoices = BRK_INVOICES.filter((i) => i.tenantId === t.id).slice(0, 3);
  const suspended = t.status === "suspended";
  const usage: [string, number, number][] = [
    ["Clients", t.clients, t.maxClients],
    ["Staff seats", t.staff, t.maxStaff],
    ["Symbols", t.symbols, t.maxSymbols],
  ];
  return (
    <>
      <Dialog
        open={!!tenant}
        onOpenChange={onOpenChange}
        side="right"
        title={
          <span className="flex items-center gap-3">
            <TenantLogo color={t.color} mark={t.mark} size={36} />
            <span>
              {t.name}
              <span className="block font-mono text-[12px] font-normal text-fg-3">{t.id} · {t.domain}</span>
            </span>
          </span>
        }
        footer={
          <>
            {t.plan !== "owner" && (
              <Button size="sm" variant={suspended ? "up-outline" : "down-outline"} onClick={() => setConfirm(true)}>
                {suspended ? <PlayCircle /> : <Ban />} {suspended ? "Reactivate" : "Suspend"}
              </Button>
            )}
            <Button size="sm" variant="surface" onClick={() => toast.success(`Impersonation session started`, { description: `Signed into admin.${t.domain} as platform owner · 30 min, audited` })}>
              <KeyRound /> Open tenant admin
            </Button>
            <Button size="sm" variant="ember" onClick={() => toast.success("Branding editor opened", { description: t.name })}>
              <Palette /> Edit tenant
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <PlanChip plan={t.plan} />
            <TenantStatus status={t.status} />
            <Chip>
              <Flag country={t.country} className="size-3.5" /> {t.countryName}
            </Chip>
            <Chip>{t.regulator}</Chip>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ["Clients", <span key="c" className="k-num">{formatNumber(t.clients, 0)}</span>, `${formatNumber(t.activeTraders, 0)} active traders`],
              ["30d volume", <span key="v" className="k-num">{compactUsd(t.volume30d)}</span>, <Sparkline key="s" data={t.trend} width={90} height={22} tone="gold" />],
              ["Net revenue 30d", <Money key="n" value={t.netRevenue30d} decimals={0} />, "Broker P&L after LP costs"],
              ["Rev-share 30d", <Money key="r" value={t.revShare30d} decimals={0} className="text-gold" />, `${t.revSharePct}% · licence $${formatNumber(t.mrr, 0)}/mo`],
            ].map(([l, v, s], i) => (
              <div key={i} className="k-row p-4">
                <div className="k-label">{l}</div>
                <div className="mt-2 text-xl font-semibold tracking-tight">{v}</div>
                <div className="mt-1 text-[12px] text-fg-3">{s}</div>
              </div>
            ))}
          </div>

          <div>
            <SectionLabel>Limits usage</SectionLabel>
            <div className="space-y-3">
              {usage.map(([l, v, max]) => {
                const pct = (v / max) * 100;
                return (
                  <div key={l}>
                    <div className="mb-1.5 flex justify-between text-[12.5px]">
                      <span className="text-fg-2">{l}</span>
                      <span className="k-num text-fg-3">
                        <span className="text-fg">{formatNumber(v, 0)}</span> / {formatNumber(max, 0)}
                      </span>
                    </div>
                    <Progress value={pct} tone={pct > 85 ? "down" : pct > 65 ? "warn" : "up"} />
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <SectionLabel>Modules · {t.modules.length}</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {BRK_MODULES.map((m) => {
                const on = t.modules.includes(m.key);
                const Icon = MODULE_ICON[m.key];
                return (
                  <span key={m.key} className={on ? "inline-flex items-center gap-1.5 rounded-full border border-ember/25 bg-ember-soft px-2.5 py-1 text-[12px] text-fg" : "inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] text-fg-3 line-through decoration-fg-3/50"}>
                    <Icon className={on ? "size-3.5 text-ember" : "size-3.5"} /> {m.name}
                  </span>
                );
              })}
            </div>
          </div>

          <div>
            <SectionLabel>Domains</SectionLabel>
            <div className="space-y-2">
              {["app", "admin", "trade", "api"].map((s) => (
                <div key={s} className="k-row flex items-center justify-between px-3.5 py-2.5">
                  <span className="font-mono text-[13px]">
                    <span className="text-ember">{s}.</span>
                    {t.domain}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Chip size="sm" tone={t.status === "onboarding" && s !== "admin" ? "warn" : "up"}>{t.status === "onboarding" && s !== "admin" ? "DNS pending" : "SSL valid"}</Chip>
                    <CopyButton value={`https://${s}.${t.domain}`} label="URL" />
                    <button onClick={() => toast.message(`Opening https://${s}.${t.domain}`)} className="text-fg-3 hover:text-fg" aria-label="Open">
                      <ExternalLink className="size-3.5" />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Recent invoices</SectionLabel>
            {invoices.length ? (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv.number} className="k-row flex items-center gap-3 px-3.5 py-2.5">
                    <Receipt className="size-4 text-fg-3" />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[12.5px]">{inv.number}</div>
                      <div className="text-[11.5px] text-fg-3">{inv.period} · due {formatDateTime(inv.due, { day: "2-digit", month: "short" })}</div>
                    </div>
                    <Money value={inv.total} decimals={0} countUp={false} className="text-[13px]" />
                    <Chip size="sm" tone={inv.status === "paid" ? "up" : inv.status === "overdue" ? "down" : "warn"}>
                      {inv.status}
                    </Chip>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-fg-3">{t.plan === "owner" ? "Platform owner — not billed." : "No invoices issued yet."}</p>
            )}
          </div>

          <div className="k-row flex items-center gap-3 p-4">
            <Avatar src={t.contact.photo} name={t.contact.name} size={40} />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium">{t.contact.name}</div>
              <div className="truncate text-[12px] text-fg-3">Primary contact · {t.billingEmail}</div>
            </div>
            <Button size="xs" variant="surface" onClick={() => toast.success("Email draft opened", { description: t.contact.name })}>
              Contact
            </Button>
          </div>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        danger={!suspended}
        title={suspended ? `Reactivate ${t.name}?` : `Suspend ${t.name}?`}
        description={suspended ? "Client and staff logins will be restored immediately." : "Client Area and Back Office logins are blocked. Open positions keep running; stop-outs still apply."}
        confirmLabel={suspended ? "Reactivate tenant" : "Suspend tenant"}
        onConfirm={() => {
          onStatus(t.id, suspended ? "active" : "suspended");
          toast[suspended ? "success" : "warning"](suspended ? `${t.name} reactivated` : `${t.name} suspended`, { description: "Tenant admins notified by email" });
        }}
      />
    </>
  );
}
