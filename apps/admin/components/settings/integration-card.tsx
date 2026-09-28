"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, BookOpen, Check, CircleHelp, KeyRound, Loader2, Plus, Plug, Save, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import { Button, Chip, CopyButton, Icon3D, Input, Segmented, Toggle, Tooltip, cn, formatDateTime } from "@kalks/ui";
import type { SetField, SetIntegration, SetIntegrationStatus, SetLaunchNeed } from "@kalks/mock/admin-platform-settings";
import { LogoTile, SecretInput, SelectInput } from "./kit";

export const STATUS_META: Record<SetIntegrationStatus, { label: string; tone: "up" | "down" | "warn" | "neutral" }> = {
  connected: { label: "Connected", tone: "up" },
  not_configured: { label: "Not configured", tone: "warn" },
  error: { label: "Error", tone: "down" },
  disabled: { label: "Disabled", tone: "neutral" },
};

export const NEED_META: Record<SetLaunchNeed, { label: string; tone: "ember" | "gold" | "neutral" | "info" }> = {
  required: { label: "Required at launch", tone: "ember" },
  recommended: { label: "Recommended", tone: "gold" },
  optional: { label: "Optional", tone: "neutral" },
  "post-launch": { label: "Post-launch", tone: "info" },
};

function initialValues(it: SetIntegration) {
  const v: Record<string, string> = {};
  for (const f of it.fields) v[f.key] = f.value ?? "";
  if (it.modes) v[it.modes.key] = it.modes.value;
  return v;
}

function randomKey(len: number, seed: number) {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let s = "";
  let x = seed;
  for (let i = 0; i < len; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    s += abc[x % abc.length];
  }
  return s;
}

export function IntegrationCard({ it, onStatus }: { it: SetIntegration; onStatus: (id: string, s: SetIntegrationStatus) => void }) {
  const [vals, setVals] = React.useState(() => initialValues(it));
  const [saved, setSaved] = React.useState(() => initialValues(it));
  const [list, setList] = React.useState<string[]>(() => it.fields.find((f) => f.type === "list")?.list ?? []);
  const [newItem, setNewItem] = React.useState("");
  const [status, setStatus] = React.useState<SetIntegrationStatus>(it.status);
  const [testing, setTesting] = React.useState(false);
  const [help, setHelp] = React.useState(false);
  const [checked, setChecked] = React.useState(it.lastChecked);
  const [latency, setLatency] = React.useState(it.latencyMs);
  const [error, setError] = React.useState(it.error);
  const [secretKeys, setSecretKeys] = React.useState(0); // bump to remount secret inputs after generation
  const disabled = status === "disabled";
  const mode = it.modes ? vals[it.modes.key] : undefined;
  const fields = it.fields.filter((f) => !f.when || f.when === mode);
  const dirty = JSON.stringify(vals) !== JSON.stringify(saved) || (it.fields.some((f) => f.type === "list") && list.join() !== (it.fields.find((f) => f.type === "list")?.list ?? []).join());

  const set = (k: string, v: string) => setVals((s) => ({ ...s, [k]: v }));
  const update = (s: SetIntegrationStatus) => {
    setStatus(s);
    onStatus(it.id, s);
  };

  const test = () => {
    if (disabled) {
      toast.info(`${it.name} is disabled`, { description: "Kalks runs B-book at launch. Enable the FIX session when an LP is onboarded." });
      return;
    }
    const missing = fields.filter((f) => f.required && f.type !== "readonly" && !vals[f.key]);
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      setChecked("2026-09-24T15:45:00Z");
      if (missing.length) {
        toast.error(`${it.name}: connection failed`, { description: `Missing ${missing.map((m) => m.label).join(", ")}` });
        return;
      }
      const bad = list.find((u) => u.includes("reuters.com"));
      if (bad) {
        setError(`RSS feed returned HTTP 403 — ${bad.replace("https://", "")}`);
        update("error");
        toast.error(`${it.provider}: 1 feed failing`, { description: `${bad.replace("https://", "")} returned HTTP 403. Remove or replace it.` });
        return;
      }
      const ms = latency ?? 60 + ((it.id.length * 37) % 180);
      setLatency(ms);
      setError(undefined);
      update("connected");
      toast.success(`${it.provider} connected`, { description: `Handshake OK · ${ms} ms · credentials valid` });
    }, 1100);
  };

  const save = () => {
    setSaved(vals);
    toast.success(`${it.name} saved`, { description: "Secrets encrypted at rest (AES-256) · change written to the audit log" });
  };

  const generateVapid = () => {
    set("public", `BEl6${randomKey(83, 7)}`);
    set("private", randomKey(43, 19));
    setSecretKeys((k) => k + 1);
    toast.success("VAPID key pair generated", { description: "Save, then test to activate web push" });
  };

  const meta = STATUS_META[status];
  const need = NEED_META[it.need];

  return (
    <div
      className={cn(
        "k-card relative flex h-full flex-col overflow-hidden transition-colors",
        status === "error" && "border-down/30",
        status === "connected" && "hover:border-[var(--k-border-top)]",
      )}
    >
      {status === "connected" && <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-up/10 blur-3xl" />}
      {status === "error" && <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-down/15 blur-3xl" />}

      {/* header */}
      <div className="relative flex items-start gap-4 px-5 pt-5">
        <LogoTile icon={it.icon} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[16px] font-medium tracking-tight">{it.name}</h3>
            <Chip size="sm" tone={need.tone}>
              {need.label}
            </Chip>
          </div>
          <div className="mt-0.5 text-[13px] text-fg-2">{it.provider}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {it.id === "lp" ? (
            <Tooltip content={disabled ? "Enable A-book routing" : "Disable"}>
              <span>
                <Toggle
                  checked={!disabled}
                  onChange={(v) => {
                    update(v ? "not_configured" : "disabled");
                    toast(v ? "LP session enabled — fill in the FIX details" : "LP session disabled · B-book only");
                  }}
                  label="Enable liquidity provider"
                />
              </span>
            </Tooltip>
          ) : null}
          <Chip tone={meta.tone} dot>
            {meta.label}
          </Chip>
        </div>
      </div>

      <p className="relative mt-3 px-5 text-[13px] leading-relaxed text-fg-3">{it.description}</p>

      {(it.meta?.length || it.note) && (
        <div className="relative mt-3 flex flex-wrap gap-1.5 px-5">
          {it.note && (
            <Chip size="sm" tone={disabled ? "info" : "warn"}>
              {it.note}
            </Chip>
          )}
          {it.meta?.map((m) => (
            <Chip key={m.label} size="sm" tone={m.tone ?? "neutral"}>
              <span className="text-fg-3">{m.label}</span> {m.value}
            </Chip>
          ))}
        </div>
      )}

      <AnimatePresence initial={false}>
        {status === "error" && error && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="relative mx-5 mt-3 overflow-hidden">
            <div className="flex items-start gap-2.5 rounded-[12px] border border-down/25 bg-down-soft px-3.5 py-2.5 text-[12.5px] text-down">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 break-words">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* fields */}
      <div className="relative mt-4 flex-1 px-5">
        {it.modes && (
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[12.5px] font-medium text-fg-2">{it.modes.label}</span>
            <Segmented size="xs" value={mode ?? it.modes.value} onChange={(v) => set(it.modes!.key, v)} options={it.modes.options} />
          </div>
        )}
        <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", disabled && "pointer-events-none opacity-45")}>
          {fields.map((f) => (
            <FieldControl
              key={f.key + (f.type === "secret" ? secretKeys : "")}
              f={f}
              value={vals[f.key] ?? ""}
              onChange={(v) => set(f.key, v)}
              list={list}
              setList={setList}
              newItem={newItem}
              setNewItem={setNewItem}
              disabled={disabled}
            />
          ))}
        </div>
        {disabled && (
          <div className="mt-4 flex items-start gap-3 rounded-[14px] border border-info/20 bg-info-soft px-4 py-3.5">
            <Icon3D name="shield" size={36} className="shrink-0" />
            <div className="text-[12.5px] leading-relaxed text-fg-2">
              <div className="text-[13px] font-medium text-fg">100% B-book at launch</div>
              All client flow is internalised and hedged manually by the dealing desk. When an LP is onboarded, enable this session, paste the FIX session sheet and set A-book rules in{" "}
              <Link href="/trading/routing" className="text-info underline-offset-2 hover:underline">
                Trading → Book &amp; routing
              </Link>
              .
            </div>
          </div>
        )}
        {it.id === "push" && (
          <Button size="sm" variant="surface" className="mt-3" onClick={generateVapid}>
            <KeyRound /> Generate key pair
          </Button>
        )}

        <AnimatePresence initial={false}>
          {help && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-3 rounded-[12px] border border-info/20 bg-info-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-fg-2">
                <span className="font-medium text-info">Where to get it · </span>
                {it.whereToGet}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* footer */}
      <div className="relative mt-5 flex flex-wrap items-center gap-2 border-t border-line bg-black/15 px-5 py-3">
        <div className="mr-auto flex min-w-0 items-center gap-2 text-[11.5px] text-fg-3">
          {checked && status !== "disabled" ? (
            <>
              <span className={cn("size-1.5 rounded-full", status === "connected" ? "bg-up" : status === "error" ? "bg-down" : "bg-warn")} />
              <span className="k-num truncate">
                Checked {formatDateTime(checked, { hour: "2-digit", minute: "2-digit" })}
                {latency && status === "connected" ? ` · ${latency} ms` : ""}
              </span>
            </>
          ) : (
            <span>{disabled ? "Not in use" : "Never tested"}</span>
          )}
        </div>
        <button type="button" onClick={() => setHelp((h) => !h)} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] transition-colors hover:bg-surface-3 hover:text-fg", help ? "text-fg" : "text-fg-3")}>
          <CircleHelp className="size-3.5" /> Where to get
        </button>
        <a href={it.docsUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg">
          <BookOpen className="size-3.5" /> Docs
        </a>
        {dirty && (
          <Button size="sm" variant="surface" onClick={save}>
            <Save /> Save
          </Button>
        )}
        <Button size="sm" variant={status === "connected" || disabled ? "surface" : "ember"} onClick={test} disabled={testing}>
          {testing ? <Loader2 className="animate-spin" /> : status === "connected" ? <Zap /> : <Plug />}
          {testing ? "Testing…" : "Test connection"}
        </Button>
      </div>
    </div>
  );
}

function FieldControl({
  f,
  value,
  onChange,
  list,
  setList,
  newItem,
  setNewItem,
  disabled,
}: {
  f: SetField;
  value: string;
  onChange: (v: string) => void;
  list: string[];
  setList: React.Dispatch<React.SetStateAction<string[]>>;
  newItem: string;
  setNewItem: (v: string) => void;
  disabled: boolean;
}) {
  const label = (
    <>
      {f.label}
      {f.required && <span className="ml-0.5 text-ember">*</span>}
    </>
  );
  const wrap = (child: React.ReactNode) => (
    <div className={cn("flex min-w-0 flex-col gap-1.5", f.span === 2 && "sm:col-span-2")}>
      <span className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-fg-2">
        <span className="truncate">{label}</span>
        {f.hint && <span className="truncate text-[11.5px] font-normal text-fg-3">{f.hint}</span>}
      </span>
      {child}
    </div>
  );

  switch (f.type) {
    case "secret":
      return wrap(<SecretInput value={value} reveal={f.reveal} placeholder={f.placeholder ?? "Not set"} onChange={onChange} disabled={disabled} />);
    case "select":
      return wrap(<SelectInput value={value} onChange={onChange} options={f.options ?? []} disabled={disabled} />);
    case "toggle":
      return wrap(
        <div className="flex h-11 items-center justify-between rounded-[14px] border border-line bg-surface-2 px-3.5">
          <span className="text-[13px] text-fg-2">{value === "on" ? "Enabled" : "Disabled"}</span>
          <Toggle checked={value === "on"} onChange={(v) => onChange(v ? "on" : "off")} label={f.label} />
        </div>,
      );
    case "readonly":
      return wrap(
        <div className="flex h-11 items-center gap-2 rounded-[14px] border border-dashed border-line bg-surface-2/50 px-3.5">
          <span className={cn("min-w-0 flex-1 truncate text-[12.5px]", value.startsWith("http") ? "font-mono text-fg" : "text-fg-2")}>{value}</span>
          {value.startsWith("http") && <CopyButton value={value} label={f.label} />}
        </div>,
      );
    case "list":
      return wrap(
        <div className="space-y-1.5">
          {list.map((u) => (
            <div key={u} className={cn("flex h-10 items-center gap-2 rounded-[12px] border bg-surface-2 px-3", u.includes("reuters.com") ? "border-down/30" : "border-line")}>
              <span className={cn("size-1.5 shrink-0 rounded-full", u.includes("reuters.com") ? "bg-down" : "bg-up")} />
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-2">{u}</span>
              <button type="button" onClick={() => { setList((l) => l.filter((x) => x !== u)); toast("Feed removed", { description: u }); }} className="grid size-6 place-items-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-down" aria-label="Remove feed">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^https?:\/\/.+\..+/.test(newItem)) {
                toast.error("Enter a valid feed URL", { description: "Must start with https://" });
                return;
              }
              setList((l) => [...l, newItem]);
              setNewItem("");
              toast.success("Feed added", { description: newItem });
            }}
          >
            <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="https://example.com/rss" className="h-10 flex-1" inputClassName="font-mono text-[12px]" />
            <Button size="sm" variant="surface" type="submit" className="h-10">
              <Plus /> Add
            </Button>
          </form>
        </div>,
      );
    default:
      return wrap(
        <Input
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder}
          inputMode={f.type === "number" ? "decimal" : undefined}
          inputClassName={cn(f.type === "url" || /address|xpub|id|host|sid|user|access|bucket|endpoint|sender|target|client/i.test(f.key + f.label) ? "font-mono text-[12.5px]" : "")}
          trailing={
            f.suffix ? (
              <span className="text-[12px]">{f.suffix}</span>
            ) : value && f.type !== "number" && !disabled ? (
              value.length > 3 ? <Check className="size-3.5 text-up" /> : null
            ) : null
          }
        />,
      );
  }
}

export function StatusDot({ status }: { status: SetIntegrationStatus }) {
  return <span className={cn("size-2 rounded-full", status === "connected" ? "bg-up" : status === "error" ? "bg-down" : status === "disabled" ? "bg-fg-3" : "bg-warn")} />;
}

