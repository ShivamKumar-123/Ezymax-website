"use client";

import * as React from "react";
import { Flag as FlagIcon } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, DialogClose, Field, Input, Segmented, cn } from "@ezymex/ui";
import { FLG_ENVS, FLG_TENANTS, type FlgEnv, type FlgFlag } from "@ezymex/mock/admin-flags";
import { PEOPLE } from "@ezymex/mock";
import { RangeSlider, Textarea } from "./kit";

export function NewFlagDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; onCreate: (f: FlgFlag) => void }) {
  const [key, setKey] = React.useState("wallet.instant_usdt_withdrawals");
  const [desc, setDesc] = React.useState("Auto-approve USDT withdrawals under $1,000 for verified clients");
  const [type, setType] = React.useState<FlgFlag["type"]>("release");
  const [rollout, setRollout] = React.useState(10);
  const [envs, setEnvs] = React.useState<Record<FlgEnv, boolean>>({ dev: true, staging: true, prod: false });
  const valid = /^[a-z0-9_]+\.[a-z0-9_]+$/.test(key) && desc.trim().length > 5;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New feature flag"
      description="Flags are evaluated per tenant and per client (sticky hashing on client ID)."
      width={560}
      footer={
        <>
          <DialogClose asChild>
            <Button size="sm" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            variant="ember"
            disabled={!valid}
            onClick={() => {
              onCreate({
                key,
                description: desc,
                type,
                enabled: envs.prod,
                rollout,
                envs,
                tenants: Object.fromEntries(FLG_TENANTS.map((t) => [t.id, envs.prod ? rollout : 0])),
                owner: PEOPLE[4]!,
                changedAt: "2026-09-24T09:00:00Z",
                createdAt: "2026-09-24T09:00:00Z",
                evaluations24h: 0,
              });
              toast.success(`${key} created`, { description: `${FLG_ENVS.filter((e) => envs[e.key]).map((e) => e.label).join(", ")} · ${rollout}% default rollout` });
              onOpenChange(false);
            }}
          >
            <FlagIcon /> Create flag
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Key" hint="module.snake_case" error={valid || !key ? undefined : "Use module.name in lowercase"}>
          <Input value={key} onChange={(e) => setKey(e.target.value.toLowerCase())} inputClassName="font-mono text-[13px]" />
        </Field>
        <Field label="Description">
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="min-h-20" />
        </Field>
        <div>
          <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Type</div>
          <Segmented size="sm" value={type} onChange={setType} options={[{ value: "release", label: "Release" }, { value: "experiment", label: "Experiment" }, { value: "ops", label: "Ops / kill switch" }]} />
        </div>
        <div>
          <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Environments</div>
          <div className="flex gap-2">
            {FLG_ENVS.map((e) => (
              <button key={e.key} type="button" onClick={() => setEnvs((m) => ({ ...m, [e.key]: !m[e.key] }))} className={cn("h-9 rounded-full border px-3.5 text-[12.5px]", envs[e.key] ? "border-ember/40 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-3 hover:text-fg")}>
                {e.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 flex justify-between text-[12.5px]">
            <span className="font-medium text-fg-2">Default rollout per tenant</span>
            <span className="k-num text-fg">{rollout}%</span>
          </div>
          <RangeSlider value={rollout} onChange={setRollout} />
        </div>
      </div>
    </Dialog>
  );
}
