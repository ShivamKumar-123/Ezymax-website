"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Globe, Network, Tag } from "lucide-react";
import { Button, Dialog, DialogClose, Field, Input, Segmented, Toggle, cn } from "@ezymex/ui";
import { ORG_EMPLOYEES, SEC_CURRENT_IP, type SecIpRule } from "@ezymex/mock/admin-platform-security";
import { cidrContains, cidrSize, validateCidr } from "./cidr";

export type RuleDraft = Pick<SecIpRule, "cidr" | "label" | "scope" | "scopeValue" | "enabled">;

const ROLES = ["Super Admin", "Dealer", "Risk", "Finance", "Compliance / KYC", "Support", "Sales", "IB manager"];

export function IpRuleDialog({
  open,
  onOpenChange,
  initial,
  prefill,
  onSave,
}: {
  prefill?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: SecIpRule | null;
  onSave: (d: RuleDraft) => void;
}) {
  const [cidr, setCidr] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [scope, setScope] = React.useState<SecIpRule["scope"]>("all");
  const [scopeValue, setScopeValue] = React.useState<string>("");
  const [enabled, setEnabled] = React.useState(true);
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setCidr(initial?.cidr ?? prefill ?? "");
    setLabel(initial?.label ?? "");
    setScope(initial?.scope ?? "all");
    setScopeValue(initial?.scopeValue ?? "");
    setEnabled(initial?.enabled ?? true);
    setTouched(false);
  }, [open, initial, prefill]);

  const err = validateCidr(cidr);
  const labelErr = label.trim().length < 3 ? "Give the range a recognisable label" : null;
  const scopeErr = scope !== "all" && !scopeValue ? `Choose a ${scope}` : null;
  const valid = !err && !labelErr && !scopeErr;
  const coversMe = !err && cidrContains(cidr.trim(), SEC_CURRENT_IP);

  const submit = () => {
    setTouched(true);
    if (!valid) {
      toast.error("Fix the highlighted fields", { description: err ?? labelErr ?? scopeErr ?? undefined });
      return;
    }
    onSave({ cidr: cidr.trim(), label: label.trim(), scope, scopeValue: scope === "all" ? undefined : scopeValue, enabled });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={540}
      title={initial ? "Edit whitelist entry" : "Add whitelist entry"}
      description="Staff can only sign in from whitelisted ranges while enforcement is on."
      footer={
        <>
          <DialogClose asChild>
            <Button size="sm" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button size="sm" variant="ember" onClick={submit}>
            {initial ? "Save changes" : "Add entry"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="IP address or CIDR" hint={!err ? cidrSize(cidr.trim()) : "IPv4 or IPv6"} error={touched || cidr ? err ?? undefined : undefined}>
          <Input
            value={cidr}
            onChange={(e) => setCidr(e.target.value)}
            placeholder="185.44.76.0/24"
            leading={<Network />}
            inputClassName="font-mono"
            className={cn(cidr && err && "border-down/50", cidr && !err && "border-up/40")}
            trailing={cidr ? err ? <AlertCircle className="size-4 text-down" /> : <CheckCircle2 className="size-4 text-up" /> : null}
          />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {["185.44.76.0/24", `${SEC_CURRENT_IP}/32`, "10.40.0.0/16"].map((s) => (
            <button key={s} onClick={() => setCidr(s)} className="rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-fg-2 hover:bg-surface-3 hover:text-fg">
              {s}
            </button>
          ))}
        </div>
        {coversMe && (
          <div className="flex items-center gap-2 rounded-[12px] border border-up/25 bg-up-soft px-3 py-2 text-[12px] text-up">
            <CheckCircle2 className="size-3.5" /> This range includes your current IP <span className="font-mono">{SEC_CURRENT_IP}</span>
          </div>
        )}
        <Field label="Label" error={touched ? labelErr ?? undefined : undefined}>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Limassol HQ — main floor" leading={<Tag />} />
        </Field>
        <div>
          <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Applies to</div>
          <Segmented
            size="sm"
            value={scope}
            onChange={(v) => {
              setScope(v);
              setScopeValue("");
            }}
            options={[
              { value: "all", label: <><Globe className="size-3.5" /> All staff</> },
              { value: "role", label: "A role" },
              { value: "user", label: "One user" },
            ]}
          />
          {scope !== "all" && (
            <div className="mt-3 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {(scope === "role" ? ROLES : ORG_EMPLOYEES.filter((e) => e.status !== "suspended").map((e) => e.name)).map((v) => (
                <button
                  key={v}
                  onClick={() => setScopeValue(v)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[12px] transition-colors",
                    scopeValue === v ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2 hover:bg-surface-3",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          {touched && scopeErr && <div className="mt-1.5 text-xs text-down">{scopeErr}</div>}
        </div>
        <div className="flex items-center justify-between rounded-[14px] border border-line px-4 py-3">
          <div>
            <div className="text-[13px] font-medium">Active</div>
            <div className="text-[12px] text-fg-3">Disabled entries are kept but not matched</div>
          </div>
          <Toggle checked={enabled} onChange={setEnabled} label="Active" />
        </div>
      </div>
    </Dialog>
  );
}
