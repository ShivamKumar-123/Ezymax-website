"use client";

import * as React from "react";
import { Button, Dialog, Icon3D, Toggle } from "@kalks/ui";
import type { PartnerLevel } from "@kalks/mock/admin-partners";
import { MiniField, NumInput, Section, Select, SettingRow, auditToast } from "@/components/config/kit";

export function LevelEditDialog({ level, open, onOpenChange, onSave }: { level: PartnerLevel | null; open: boolean; onOpenChange: (o: boolean) => void; onSave: (l: PartnerLevel) => void }) {
  const [d, setD] = React.useState<PartnerLevel | null>(level);
  React.useEffect(() => setD(level), [level]);
  if (!d) return null;
  const c = (patch: Partial<PartnerLevel["criteria"]>) => setD({ ...d, criteria: { ...d.criteria, ...patch } });
  const b = (patch: Partial<PartnerLevel["benefits"]>) => setD({ ...d, benefits: { ...d.benefits, ...patch } });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={620}
      title={
        <span className="flex items-center gap-3">
          <Icon3D name={d.icon} size={36} />
          Edit {d.name} level
        </span>
      }
      description="Changes apply at the next evaluation run (01 Oct 00:05 GMT+3)."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="ember"
            size="sm"
            onClick={() => {
              onSave(d);
              onOpenChange(false);
              auditToast(`${d.name} level updated`, `${d.criteria.activeClients} clients · ${d.criteria.monthlyLots.toLocaleString()} lots · ×${d.benefits.rateMultiplier.toFixed(2)}`);
            }}
          >
            Save level
          </Button>
        </>
      }
    >
      <Section title="Qualification criteria" hint="All criteria must be met across the evaluation window">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MiniField label="Active clients"><NumInput value={d.criteria.activeClients} onChange={(v) => c({ activeClients: v })} step={5} min={0} suffix="clients" /></MiniField>
          <MiniField label="Monthly lots"><NumInput value={d.criteria.monthlyLots} onChange={(v) => c({ monthlyLots: v })} step={50} min={0} suffix="lots" /></MiniField>
          <MiniField label="Net deposits (window)"><NumInput value={d.criteria.minNetDeposits} onChange={(v) => c({ minNetDeposits: v })} step={5000} min={0} prefix="$" /></MiniField>
          <MiniField label="Evaluation window">
            <Select value={String(d.criteria.windowDays)} onChange={(v) => c({ windowDays: +v })} options={[{ value: "30", label: "30 days" }, { value: "60", label: "60 days" }, { value: "90", label: "90 days" }]} />
          </MiniField>
        </div>
      </Section>
      <Section title="Benefits">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MiniField label="Rate multiplier" hint="vs. Bronze"><NumInput value={d.benefits.rateMultiplier} onChange={(v) => b({ rateMultiplier: v })} step={0.05} min={1} max={3} prefix="×" decimals={2} /></MiniField>
          <MiniField label="Payout frequency">
            <Select value={d.benefits.payoutFrequency} onChange={(v) => b({ payoutFrequency: v })} options={["Monthly", "Bi-weekly", "Weekly", "Daily"] as const} />
          </MiniField>
          <MiniField label="Marketing budget / month"><NumInput value={d.benefits.marketingBudget} onChange={(v) => b({ marketingBudget: v })} step={500} min={0} prefix="$" /></MiniField>
        </div>
        <div className="mt-2 divide-y divide-line">
          <SettingRow label="Dedicated partner manager"><Toggle checked={d.benefits.dedicatedManager} onChange={(v) => b({ dedicatedManager: v })} label="Dedicated manager" /></SettingRow>
          <SettingRow label="Custom landing pages" hint="White-label funnels on partner sub-domain"><Toggle checked={d.benefits.customLanding} onChange={(v) => b({ customLanding: v })} label="Custom landing" /></SettingRow>
          <SettingRow label="Events & roadshow invites"><Toggle checked={d.benefits.eventsInvites} onChange={(v) => b({ eventsInvites: v })} label="Events" /></SettingRow>
        </div>
      </Section>
    </Dialog>
  );
}
