"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  BadgeCheck,
  Building2,
  Check,
  Globe2,
  ImageUp,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { Button, Chip, CopyButton, Dialog, Field, Flag, Input, Segmented, Stepper, Toggle, cn, formatNumber } from "@ezymex/ui";
import { BRK_COUNTRIES, BRK_MODULES, BRK_PLANS, BRK_REGULATORS, type BrkModuleKey } from "@ezymex/mock/admin-platform-brokers";
import { SectionLabel, Select, TenantLogo } from "./kit";
import { MODULE_ICON } from "./module-icons";

export interface NewTenant {
  legalName: string;
  brand: string;
  regNo: string;
  country: string;
  regulator: string;
  licenceNo: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  domain: string;
  subs: Record<"app" | "admin" | "trade" | "api", boolean>;
  logo?: string;
  primary: string;
  accent: string;
  plan: "starter" | "growth" | "enterprise";
  modules: BrkModuleKey[];
  maxClients: number;
  maxStaff: number;
  maxSymbols: number;
  setupFee: number;
  licence: number;
  revShare: number;
  billingEmail: string;
  terms: string;
  autoSuspend: boolean;
}

const STEPS = ["Company", "Domains", "Branding", "Modules", "Limits & billing", "Review"];
const PRIMARY_SWATCHES = ["#ff5a1f", "#e9b949", "#22c55e", "#38bdf8", "#14b8a6", "#f04438", "#fb7185", "#a3e635", "#f5f5f7"];
const ACCENT_SWATCHES = ["#e9b949", "#ff8a3d", "#22c55e", "#38bdf8", "#f5f5f7", "#94a3b8"];

const SUBS: { key: keyof NewTenant["subs"]; label: string; purpose: string }[] = [
  { key: "app", label: "app", purpose: "Client Area" },
  { key: "admin", label: "admin", purpose: "Back Office" },
  { key: "trade", label: "trade", purpose: "Web terminal" },
  { key: "api", label: "api", purpose: "REST / WebSocket API" },
];

function planDefaults(plan: NewTenant["plan"]) {
  const p = BRK_PLANS.find((x) => x.key === plan)!;
  return {
    plan,
    modules: BRK_MODULES.filter((m) => m.plans[plan]).map((m) => m.key),
    maxClients: p.maxClients,
    maxStaff: p.maxStaff,
    maxSymbols: p.maxSymbols,
    setupFee: p.setupFee,
    licence: p.licence,
    revShare: p.revShare,
  };
}

const INITIAL: NewTenant = {
  legalName: "Orion Bay Markets Ltd",
  brand: "Orion Bay",
  regNo: "MU-C208841",
  country: "mu",
  regulator: "FSC Mauritius",
  licenceNo: "GB25204471",
  contactName: "Daniel Okafor",
  contactEmail: "daniel@orionbay.com",
  contactPhone: "+230 5 841 2290",
  domain: "orionbay.com",
  subs: { app: true, admin: true, trade: true, api: false },
  primary: "#14b8a6",
  accent: "#e9b949",
  billingEmail: "finance@orionbay.com",
  terms: "Net 15",
  autoSuspend: true,
  ...planDefaults("growth"),
};

type DnsState = "pending" | "checking" | "verified";

export function CreateTenantWizard({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; onCreate: (t: NewTenant) => void }) {
  const [step, setStep] = React.useState(0);
  const [dir, setDir] = React.useState(1);
  const [t, setT] = React.useState<NewTenant>(INITIAL);
  const [dns, setDns] = React.useState<DnsState>("pending");
  const set = <K extends keyof NewTenant>(k: K, v: NewTenant[K]) => setT((p) => ({ ...p, [k]: v }));

  React.useEffect(() => {
    if (!open) {
      const id = setTimeout(() => {
        setStep(0);
        setT(INITIAL);
        setDns("pending");
      }, 250);
      return () => clearTimeout(id);
    }
  }, [open]);

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  const canNext = step !== 0 || (t.legalName.trim() && t.brand.trim() && t.contactEmail.includes("@"));

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={1040}
      title={
        <span className="flex items-center gap-3">
          <TenantLogo color={t.primary} mark={(t.brand || "N")[0]!.toUpperCase()} src={t.logo} size={30} />
          New tenant{t.brand ? <span className="text-fg-3">· {t.brand}</span> : null}
        </span>
      }
      description="Provision a white-label broker on the Ezymex platform. Nothing goes live until DNS is verified and the setup invoice is paid."
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="k-num hidden text-[12.5px] text-fg-3 sm:block">
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => go(step - 1)}>
                <ArrowLeft /> Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button
                variant="ember"
                size="sm"
                disabled={!canNext}
                onClick={() => {
                  if (step === 1 && dns !== "verified") toast.message("DNS not verified yet", { description: "You can continue — the tenant stays in onboarding until records resolve." });
                  go(step + 1);
                }}
              >
                Next <ArrowRight />
              </Button>
            ) : (
              <Button
                variant="ember"
                size="sm"
                shimmer
                onClick={() => {
                  onCreate(t);
                  onOpenChange(false);
                  toast.success(`${t.brand} created`, { description: `Tenant provisioned on ${BRK_PLANS.find((p) => p.key === t.plan)!.name}. Setup invoice sent to ${t.billingEmail}.` });
                }}
              >
                <Sparkles /> Create tenant
              </Button>
            )}
          </div>
        </div>
      }
    >
      <Stepper steps={STEPS} current={step} className="mb-6" />
      <div className="relative min-h-[440px]">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -24 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === 0 && <CompanyStep t={t} set={set} />}
            {step === 1 && <DomainsStep t={t} set={set} dns={dns} setDns={setDns} />}
            {step === 2 && <BrandingStep t={t} set={set} />}
            {step === 3 && <ModulesStep t={t} setT={setT} />}
            {step === 4 && <LimitsStep t={t} set={set} />}
            {step === 5 && <ReviewStep t={t} dns={dns} go={go} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </Dialog>
  );
}

type Setter = <K extends keyof NewTenant>(k: K, v: NewTenant[K]) => void;

/* ------------------------------------------------------------------ */

function CompanyStep({ t, set }: { t: NewTenant; set: Setter }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <div>
          <SectionLabel>Legal entity</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Legal name" error={t.legalName.trim() ? undefined : "Required"}>
              <Input value={t.legalName} onChange={(e) => set("legalName", e.target.value)} leading={<Building2 />} />
            </Field>
            <Field label="Brand / trading name">
              <Input value={t.brand} onChange={(e) => set("brand", e.target.value)} leading={<Sparkles />} />
            </Field>
            <Field label="Registration no.">
              <Input value={t.regNo} onChange={(e) => set("regNo", e.target.value)} inputClassName="font-mono" />
            </Field>
            <Field label="Country of incorporation">
              <Select value={t.country} onChange={(v) => set("country", v)} options={BRK_COUNTRIES.map(([v, l]) => ({ value: v, label: l }))} leading={<Flag country={t.country} className="size-4" />} />
            </Field>
          </div>
        </div>
        <div>
          <SectionLabel>Licence</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Regulator">
              <Select value={t.regulator} onChange={(v) => set("regulator", v)} options={BRK_REGULATORS} leading={<ShieldCheck />} />
            </Field>
            <Field label="Licence number" hint="Shown in client footer">
              <Input value={t.licenceNo} onChange={(e) => set("licenceNo", e.target.value)} inputClassName="font-mono" />
            </Field>
          </div>
        </div>
        <div>
          <SectionLabel>Primary contact</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Full name">
              <Input value={t.contactName} onChange={(e) => set("contactName", e.target.value)} leading={<User />} />
            </Field>
            <Field label="Email" error={t.contactEmail.includes("@") ? undefined : "Enter a valid email"}>
              <Input value={t.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} leading={<Mail />} />
            </Field>
            <Field label="Phone">
              <Input value={t.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} leading={<Phone />} />
            </Field>
          </div>
        </div>
      </div>
      <aside className="k-row flex flex-col gap-3 p-5">
        <span className="k-label">Onboarding checklist</span>
        {[
          ["Signed white-label agreement", true],
          ["Licence copy uploaded", true],
          ["UBO / director KYC", true],
          ["AML policy reviewed", false],
          ["PSP & bank letters", false],
        ].map(([l, ok]) => (
          <div key={l as string} className="flex items-center gap-2.5 text-[13px]">
            <span className={cn("grid size-5 place-items-center rounded-full border", ok ? "border-up/40 bg-up-soft text-up" : "border-line text-fg-3")}>{ok ? <Check className="size-3" /> : null}</span>
            <span className={ok ? "text-fg" : "text-fg-3"}>{l as string}</span>
          </div>
        ))}
        <p className="mt-auto border-t border-line pt-3 text-[12px] leading-relaxed text-fg-3">Compliance can finish the remaining items while the tenant is in onboarding. Trading stays locked until all are complete.</p>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DomainsStep({ t, set, dns, setDns }: { t: NewTenant; set: Setter; dns: DnsState; setDns: (d: DnsState) => void }) {
  const root = t.domain.trim() || "yourbroker.com";
  const records = [
    ...SUBS.filter((s) => t.subs[s.key]).map((s) => ({ type: "CNAME", host: `${s.label}.${root}`, value: `${s.key === "api" ? "api" : "edge"}.tenants.ezymex.net`, ttl: 3600 })),
    { type: "TXT", host: `_ezymex-verify.${root}`, value: `ezymex-site-verification=7f3c9a41e2b8d05c6a1f`, ttl: 300 },
    { type: "TXT", host: root, value: "v=spf1 include:mail.ezymex.net ~all", ttl: 3600 },
  ];
  const verify = () => {
    setDns("checking");
    setTimeout(() => {
      setDns("verified");
      toast.success("DNS verified", { description: `${records.length} records resolved · SSL certificates issued for ${root}` });
    }, 1400);
  };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Custom root domain" hint="Tenant must own this domain">
          <Input
            value={t.domain}
            onChange={(e) => {
              set("domain", e.target.value.toLowerCase().replace(/\s/g, ""));
              setDns("pending");
            }}
            leading={<Globe2 />}
            inputClassName="font-mono"
            trailing={<Chip size="sm" tone="up"><Lock className="size-3" /> Auto SSL</Chip>}
          />
        </Field>
        <Button variant="surface" onClick={() => toast.success("Tenant emailed", { description: `DNS instructions sent to ${t.contactEmail}` })}>
          <Mail /> Email records to tenant
        </Button>
      </div>

      <div>
        <SectionLabel>Subdomains</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SUBS.map((s) => (
            <div key={s.key} className={cn("k-row flex items-center justify-between gap-3 p-4 transition-colors", t.subs[s.key] && "border-ember/30")}>
              <div className="min-w-0">
                <div className="truncate font-mono text-[13px] text-fg">
                  <span className="text-ember">{s.label}.</span>
                  {root}
                </div>
                <div className="mt-0.5 text-[12px] text-fg-3">{s.purpose}</div>
              </div>
              <Toggle checked={t.subs[s.key]} onChange={(v) => set("subs", { ...t.subs, [s.key]: v })} label={s.purpose} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel
          action={
            <div className="flex items-center gap-2">
              {dns === "verified" ? (
                <Chip tone="up" dot>
                  All records verified
                </Chip>
              ) : (
                <Chip tone="warn" dot>
                  Awaiting propagation
                </Chip>
              )}
              <Button size="xs" variant={dns === "verified" ? "surface" : "ember"} onClick={verify} disabled={dns === "checking"}>
                {dns === "checking" ? <Loader2 className="animate-spin" /> : <RefreshCw />} {dns === "checking" ? "Checking…" : dns === "verified" ? "Re-check" : "Verify DNS"}
              </Button>
            </div>
          }
        >
          DNS records
        </SectionLabel>
        <div className="overflow-x-auto rounded-[14px] border border-line">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="bg-surface-2 text-left text-[11px] uppercase tracking-[0.05em] text-fg-3">
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Host</th>
                <th className="px-4 py-2.5 font-medium">Value</th>
                <th className="px-4 py-2.5 text-right font-medium">TTL</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.host + r.type} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Chip size="sm" tone={r.type === "CNAME" ? "info" : "gold"}>
                      {r.type}
                    </Chip>
                  </td>
                  <td className="px-4 py-3 font-mono text-fg">{r.host}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex max-w-[300px] items-center gap-1 font-mono text-fg-2">
                      <span className="truncate">{r.value}</span>
                      <CopyButton value={r.value} label="Record value" />
                    </span>
                  </td>
                  <td className="k-num px-4 py-3 text-right text-fg-3">{r.ttl}</td>
                  <td className="px-4 py-3 text-right">
                    {dns === "checking" ? (
                      <Loader2 className="ml-auto size-4 animate-spin text-fg-3" />
                    ) : dns === "verified" ? (
                      <Chip size="sm" tone="up">
                        <Check className="size-3" /> Verified
                      </Chip>
                    ) : (
                      <Chip size="sm" tone="warn">
                        Pending
                      </Chip>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ColorPicker({ label, value, onChange, swatches }: { label: string; value: string; onChange: (v: string) => void; swatches: string[] }) {
  const valid = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-wrap items-center gap-2">
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={c}
            className={cn("size-8 rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110", value.toLowerCase() === c && "ring-2 ring-fg")}
            style={{ background: c, boxShadow: `0 4px 14px -6px ${c}` }}
          />
        ))}
      </div>
      <Input
        className="mt-3"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        leading={<span className="size-4 rounded-md ring-1 ring-white/20" style={{ background: valid ? value : "transparent" }} />}
        inputClassName="font-mono uppercase"
        trailing={!valid && <span className="text-xs text-down">Invalid hex</span>}
      />
    </div>
  );
}

function BrandingStep({ t, set }: { t: NewTenant; set: Setter }) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const primary = /^#[0-9a-f]{6}$/i.test(t.primary) ? t.primary : "#ff5a1f";
  const accent = /^#[0-9a-f]{6}$/i.test(t.accent) ? t.accent : "#e9b949";
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div>
          <SectionLabel>Logo</SectionLabel>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="grid h-28 w-full max-w-[260px] place-items-center rounded-[16px] border border-dashed border-line bg-surface-2 transition-colors hover:border-ember/50 hover:bg-surface-3"
            >
              {t.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.logo} alt="Logo preview" className="max-h-20 max-w-[200px] object-contain" />
              ) : (
                <span className="flex flex-col items-center gap-1.5 text-[13px] text-fg-3">
                  <ImageUp className="size-6 text-fg-2" />
                  Upload SVG or PNG
                  <span className="text-[11px]">512×512 min · transparent bg</span>
                </span>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                set("logo", URL.createObjectURL(f));
                toast.success("Logo uploaded", { description: `${f.name} · ${(f.size / 1024).toFixed(0)} KB` });
              }}
            />
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <TenantLogo color={primary} mark={(t.brand || "N")[0]!.toUpperCase()} src={t.logo} size={44} />
                <TenantLogo color={primary} mark={(t.brand || "N")[0]!.toUpperCase()} src={t.logo} size={30} />
                <TenantLogo color={primary} mark={(t.brand || "N")[0]!.toUpperCase()} src={t.logo} size={20} />
              </div>
              <span className="text-[12px] text-fg-3">Favicon & app-icon sizes generated automatically</span>
              {t.logo && (
                <Button size="xs" variant="ghost" className="self-start" onClick={() => set("logo", undefined)}>
                  Remove logo
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <ColorPicker label="Primary colour" value={t.primary} onChange={(v) => set("primary", v)} swatches={PRIMARY_SWATCHES} />
          <ColorPicker label="Accent colour" value={t.accent} onChange={(v) => set("accent", v)} swatches={ACCENT_SWATCHES} />
        </div>
        <p className="text-[12.5px] text-fg-3">Contrast check: text on primary <span className="text-up">passes AA</span>. Colours apply to CTAs, active nav, charts and emails.</p>
      </div>

      {/* Live preview */}
      <div>
        <SectionLabel>Live preview · Client Area</SectionLabel>
        <div className="relative overflow-hidden rounded-[22px] border border-line bg-bg p-4">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 h-48 opacity-70" style={{ background: `radial-gradient(60% 100% at 50% 0%, ${primary}88, transparent 70%)` }} />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TenantLogo color={primary} mark={(t.brand || "N")[0]!.toUpperCase()} src={t.logo} size={24} />
              <span className="text-[13px] font-semibold tracking-tight">{t.brand || "Your brand"}</span>
            </div>
            <span className="rounded-full px-2.5 py-1 text-[10.5px] font-medium text-white" style={{ background: primary }}>
              Deposit
            </span>
          </div>
          <div className="k-card relative mt-4 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.06em] text-fg-3">Total balance</span>
              <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium" style={{ color: primary, borderColor: `${primary}55`, background: `${primary}1f` }}>
                LIVE · Pro
              </span>
            </div>
            <div className="k-num mt-2 text-[26px] font-semibold tracking-tight">
              $24,318<span className="opacity-40">.62</span>
            </div>
            <div className="mt-1 text-[11px] text-up">+2.41% today</div>
            <svg viewBox="0 0 300 70" className="mt-3 h-16 w-full">
              <defs>
                <linearGradient id="brk-prev" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={accent} stopOpacity=".35" />
                  <stop offset="1" stopColor={accent} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,55 C30,50 45,58 70,46 S120,30 145,36 S200,18 230,22 S275,8 300,10 L300,70 L0,70 Z" fill="url(#brk-prev)" />
              <path d="M0,55 C30,50 45,58 70,46 S120,30 145,36 S200,18 230,22 S275,8 300,10" fill="none" stroke={accent} strokeWidth="2" />
            </svg>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <span className="rounded-full py-1.5 text-center text-[11px] font-medium text-white" style={{ background: `linear-gradient(135deg, ${primary}, color-mix(in oklab, ${primary} 70%, #000))`, boxShadow: `0 6px 16px -8px ${primary}` }}>
                Trade
              </span>
              <span className="rounded-full border border-line bg-surface-2 py-1.5 text-center text-[11px]">Deposit</span>
              <span className="rounded-full border border-line bg-surface-2 py-1.5 text-center text-[11px]">Withdraw</span>
            </div>
          </div>
          <div className="relative mt-3 flex items-center gap-2 font-mono text-[10.5px] text-fg-3">
            <Lock className="size-3" /> app.{t.domain || "yourbroker.com"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ModulesStep({ t, setT }: { t: NewTenant; setT: React.Dispatch<React.SetStateAction<NewTenant>> }) {
  const addOns = BRK_MODULES.filter((m) => t.modules.includes(m.key) && !m.plans[t.plan]);
  const addOnTotal = addOns.reduce((s, m) => s + m.addOn, 0);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[13px] text-fg-2">Plan preset</div>
          <div className="text-[12px] text-fg-3">Switching plan resets modules and limits to the plan defaults.</div>
        </div>
        <Segmented
          value={t.plan}
          onChange={(p) => setT((prev) => ({ ...prev, ...planDefaults(p) }))}
          options={BRK_PLANS.map((p) => ({ value: p.key, label: p.name }))}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BRK_MODULES.map((m) => {
          const on = t.modules.includes(m.key);
          const Icon = MODULE_ICON[m.key];
          const included = m.plans[t.plan];
          return (
            <div key={m.key} className={cn("k-row flex items-start gap-3 p-4 transition-all", on && "border-ember/30 bg-[linear-gradient(180deg,rgba(255,90,31,.06),transparent)]")}>
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl border", on ? "border-ember/30 bg-ember-soft text-ember" : "border-line bg-surface-3 text-fg-3")}>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13.5px] font-medium">{m.name}</span>
                  {m.core ? (
                    <Chip size="sm">Core</Chip>
                  ) : included ? (
                    <Chip size="sm" tone="up">
                      Included
                    </Chip>
                  ) : (
                    <Chip size="sm" tone="gold">
                      +${formatNumber(m.addOn, 0)}/mo
                    </Chip>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-fg-3">{m.description}</p>
              </div>
              <Toggle
                checked={on}
                label={m.name}
                onChange={(v) => {
                  if (m.core) return toast.message(`${m.name} is a core module`, { description: "Core modules can't be disabled." });
                  setT((prev) => ({ ...prev, modules: v ? [...prev.modules, m.key] : prev.modules.filter((k) => k !== m.key) }));
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[13px]">
        <span className="text-fg-2">
          <span className="k-num text-fg">{t.modules.length}</span> modules enabled · <span className="k-num text-fg">{addOns.length}</span> paid add-ons
        </span>
        <span className="k-num text-fg">
          Add-ons <span className="text-gold">+${formatNumber(addOnTotal, 0)}</span>/mo
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function NumField({ label, value, onChange, prefix, suffix, hint }: { label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <Input
        value={formatNumber(value, 0)}
        onChange={(e) => onChange(Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)}
        leading={prefix ? <span className="text-[13px] text-fg-3">{prefix}</span> : undefined}
        trailing={suffix ? <span className="text-[12px]">{suffix}</span> : undefined}
        inputClassName="k-num"
      />
    </Field>
  );
}

function LimitsStep({ t, set }: { t: NewTenant; set: Setter }) {
  const def = BRK_PLANS.find((p) => p.key === t.plan)!;
  const addOns = BRK_MODULES.filter((m) => t.modules.includes(m.key) && !m.plans[t.plan]).reduce((s, m) => s + m.addOn, 0);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <div>
          <SectionLabel>Limits</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumField label="Max clients" value={t.maxClients} onChange={(v) => set("maxClients", v)} hint={`Plan ${formatNumber(def.maxClients, 0)}`} />
            <NumField label="Max staff seats" value={t.maxStaff} onChange={(v) => set("maxStaff", v)} hint={`Plan ${def.maxStaff}`} />
            <NumField label="Max symbols" value={t.maxSymbols} onChange={(v) => set("maxSymbols", v)} hint={`Plan ${def.maxSymbols}`} />
          </div>
        </div>
        <div>
          <SectionLabel>Billing</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumField label="Setup fee" value={t.setupFee} onChange={(v) => set("setupFee", v)} prefix="$" suffix="one-off" />
            <NumField label="Monthly licence" value={t.licence} onChange={(v) => set("licence", v)} prefix="$" suffix="/ month" />
            <NumField label="Revenue share" value={t.revShare} onChange={(v) => set("revShare", Math.min(60, v))} suffix="% of net" />
            <Field label="Billing email" className="sm:col-span-2">
              <Input value={t.billingEmail} onChange={(e) => set("billingEmail", e.target.value)} leading={<AtSign />} />
            </Field>
            <Field label="Payment terms">
              <Select value={t.terms} onChange={(v) => set("terms", v)} options={["Net 7", "Net 15", "Net 30"]} />
            </Field>
          </div>
        </div>
        <div className="k-row flex items-center justify-between gap-4 p-4">
          <div>
            <div className="text-[13.5px] font-medium">Auto-suspend on non-payment</div>
            <div className="text-[12px] text-fg-3">Suspend Client Area logins 14 days after an invoice becomes overdue. Open positions are never force-closed.</div>
          </div>
          <Toggle checked={t.autoSuspend} onChange={(v) => set("autoSuspend", v)} label="Auto-suspend" />
        </div>
      </div>
      <aside className="k-row flex flex-col gap-3 p-5">
        <span className="k-label">First invoice estimate</span>
        {[
          ["Setup fee", t.setupFee],
          ["Licence (month 1)", t.licence],
          ["Module add-ons", addOns],
        ].map(([l, v]) => (
          <div key={l as string} className="flex items-center justify-between text-[13px]">
            <span className="text-fg-3">{l as string}</span>
            <span className="k-num">${formatNumber(v as number, 0)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="text-[13px] text-fg-2">Total due</span>
          <span className="k-num text-xl font-semibold">${formatNumber(t.setupFee + t.licence + addOns, 0)}</span>
        </div>
        <div className="mt-2 rounded-xl border border-gold/25 bg-gold-soft px-3 py-2.5 text-[12px] text-gold">
          + {t.revShare}% of monthly net broker revenue, billed in arrears
        </div>
        <p className="mt-auto text-[11.5px] leading-relaxed text-fg-3">Invoices are payable in USDT (TRC20) or wire. Issued on the 1st of each month at 09:00 GMT+3.</p>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ReviewStep({ t, dns, go }: { t: NewTenant; dns: DnsState; go: (n: number) => void }) {
  const country = BRK_COUNTRIES.find(([c]) => c === t.country)?.[1] ?? t.country;
  const Section = ({ title, step, rows }: { title: string; step: number; rows: [string, React.ReactNode][] }) => (
    <div className="k-row p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="k-label">{title}</span>
        <button type="button" onClick={() => go(step)} className="inline-flex items-center gap-1 text-[12px] text-fg-3 hover:text-ember">
          <Pencil className="size-3" /> Edit
        </button>
      </div>
      <dl className="space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 text-[13px]">
            <dt className="text-fg-3">{k}</dt>
            <dd className="min-w-0 truncate text-right text-fg">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-[18px] border border-line p-5" style={{ background: `linear-gradient(120deg, ${t.primary}26, transparent 60%)` }}>
        <div className="flex flex-wrap items-center gap-4">
          <TenantLogo color={t.primary} mark={(t.brand || "N")[0]!.toUpperCase()} src={t.logo} size={56} />
          <div className="min-w-0 flex-1">
            <div className="text-xl font-medium tracking-tight">{t.brand}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-fg-3">
              <Flag country={t.country} className="size-4" /> {t.legalName} · <span className="font-mono">{t.regNo}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip tone="gold">{BRK_PLANS.find((p) => p.key === t.plan)!.name}</Chip>
            <Chip tone="info" dot>
              Onboarding
            </Chip>
            {dns === "verified" ? (
              <Chip tone="up">
                <BadgeCheck className="size-3.5" /> DNS verified
              </Chip>
            ) : (
              <Chip tone="warn">DNS pending</Chip>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Section title="Company" step={0} rows={[["Country", country], ["Regulator", t.regulator], ["Licence", <span key="l" className="font-mono">{t.licenceNo}</span>], ["Contact", t.contactName], ["Email", t.contactEmail]]} />
        <Section
          title="Domains"
          step={1}
          rows={[
            ["Root", <span key="r" className="font-mono">{t.domain}</span>],
            ...SUBS.filter((s) => t.subs[s.key]).map((s) => [s.purpose, <span key={s.key} className="font-mono text-fg-2">{`${s.label}.${t.domain}`}</span>] as [string, React.ReactNode]),
          ]}
        />
        <Section
          title="Branding"
          step={2}
          rows={[
            ["Logo", t.logo ? "Uploaded" : "Monogram"],
            ["Primary", <span key="p" className="inline-flex items-center gap-2 font-mono uppercase"><span className="size-3 rounded" style={{ background: t.primary }} />{t.primary}</span>],
            ["Accent", <span key="a" className="inline-flex items-center gap-2 font-mono uppercase"><span className="size-3 rounded" style={{ background: t.accent }} />{t.accent}</span>],
          ]}
        />
        <div className="k-row p-4 md:col-span-2">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="k-label">Modules · {t.modules.length}</span>
            <button type="button" onClick={() => go(3)} className="inline-flex items-center gap-1 text-[12px] text-fg-3 hover:text-ember">
              <Pencil className="size-3" /> Edit
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BRK_MODULES.filter((m) => t.modules.includes(m.key)).map((m) => (
              <Chip key={m.key} tone={m.plans[t.plan] ? "neutral" : "gold"}>
                {m.name}
              </Chip>
            ))}
          </div>
        </div>
        <Section
          title="Limits & billing"
          step={4}
          rows={[
            ["Max clients", <span key="c" className="k-num">{formatNumber(t.maxClients, 0)}</span>],
            ["Staff / symbols", <span key="s" className="k-num">{t.maxStaff} / {formatNumber(t.maxSymbols, 0)}</span>],
            ["Setup + licence", <span key="f" className="k-num">${formatNumber(t.setupFee, 0)} + ${formatNumber(t.licence, 0)}/mo</span>],
            ["Revenue share", <span key="rs" className="k-num text-gold">{t.revShare}%</span>],
            ["Billing", t.billingEmail],
          ]}
        />
      </div>
    </div>
  );
}
