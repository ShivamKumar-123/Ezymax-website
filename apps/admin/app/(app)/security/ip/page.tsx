"use client";

import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveIpAllowlist } from "@/components/rbac/ip";

import * as React from "react";
import { toast } from "sonner";
import { Copy, FlaskConical, Globe, MapPin, MoreHorizontal, Pencil, Plus, ShieldAlert, ShieldCheck, ShieldOff, Trash2, User, Users, Wifi } from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  DataTable,
  Flag,
  Icon3D,
  IconButton,
  Input,
  Menu,
  PageHeader,
  Reveal,
  Segmented,
  Starfield,
  Toggle,
  cn,
  type Column,
} from "@ezymex/ui";
import { PEOPLE } from "@ezymex/mock";
import { ORG_EMPLOYEES, SEC_BLOCKED_ATTEMPTS, SEC_CURRENT_IP, SEC_IP_RULES, type SecIpRule } from "@ezymex/mock/admin-platform-security";
import { IpRuleDialog, type RuleDraft } from "@/components/security/ip-rule-dialog";
import { cidrContains, cidrSize, isValidIp } from "@/components/security/cidr";
import { Mono, ago } from "@/components/security/shared";

type Mode = "enforce" | "grace" | "off";

function IpWhitelistPage() {
  const [rules, setRules] = React.useState<SecIpRule[]>(SEC_IP_RULES);
  const [mode, setMode] = React.useState<Mode>("enforce");
  const [dialog, setDialog] = React.useState<{ open: boolean; rule: SecIpRule | null; prefill?: string }>({ open: false, rule: null });
  const [testIp, setTestIp] = React.useState("154.160.2.11");

  const myRule = rules.find((r) => r.enabled && cidrContains(r.cidr, SEC_CURRENT_IP));
  const testMatches = isValidIp(testIp) ? rules.filter((r) => r.enabled && cidrContains(r.cidr, testIp.trim())) : [];

  const save = (d: RuleDraft) => {
    if (dialog.rule) {
      setRules((rs) => rs.map((r) => (r.id === dialog.rule!.id ? { ...r, ...d } : r)));
      toast.success("Whitelist entry updated", { description: `${d.cidr} · ${d.label}` });
    } else {
      const id = `ipr_${String(rules.length + 15).padStart(3, "0")}`;
      setRules((rs) => [{ id, ...d, addedBy: 4, added: "2026-09-24", lastHit: null, hits24h: 0, country: "ae" }, ...rs]);
      toast.success("Whitelist entry added", { description: `${d.cidr} · effective immediately · logged to audit` });
    }
  };

  const changeMode = (m: Mode) => {
    if (m === "enforce" && !myRule) {
      toast.error("Can't enforce", { description: `Your current IP ${SEC_CURRENT_IP} is not covered — you would lock yourself out.` });
      return;
    }
    setMode(m);
    toast.success(m === "enforce" ? "Whitelist enforced" : m === "grace" ? "Grace mode — violations are logged, not blocked" : "Whitelist disabled", {
      description: m === "off" ? "Staff can sign in from any IP. Recorded in audit log." : undefined,
    });
  };

  const columns: Column<SecIpRule>[] = [
    {
      key: "cidr",
      header: "Range",
      sort: (r) => r.cidr,
      cell: (r) => (
        <div className={cn(!r.enabled && "opacity-50")}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] text-fg">{r.cidr}</span>
            {cidrContains(r.cidr, SEC_CURRENT_IP) && (
              <Chip size="sm" tone="ember">
                You
              </Chip>
            )}
          </div>
          <div className="text-[11px] text-fg-3">{cidrSize(r.cidr)}</div>
        </div>
      ),
    },
    {
      key: "label",
      header: "Label · added by",
      cell: (r) => (
        <div className={cn("flex items-center gap-2.5", !r.enabled && "opacity-50")}>
          <Flag country={r.country} className="size-4" />
          <div className="min-w-0">
            <div className="truncate text-[13px]">{r.label}</div>
            <div className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-fg-3">
              <Avatar src={PEOPLE[r.addedBy]!.photo} name={PEOPLE[r.addedBy]!.name} size={14} />
              {PEOPLE[r.addedBy]!.name} · <span className="font-mono">{r.added}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "scope",
      header: "Scope",
      cell: (r) =>
        r.scope === "all" ? (
          <Chip size="sm" tone="info">
            <Globe className="size-3" /> All staff
          </Chip>
        ) : r.scope === "role" ? (
          <Chip size="sm" tone="gold">
            <Users className="size-3" /> {r.scopeValue}
          </Chip>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[12.5px]">
            <Avatar src={ORG_EMPLOYEES.find((e) => e.name === r.scopeValue)?.person.photo} name={r.scopeValue ?? ""} size={20} />
            {r.scopeValue}
          </span>
        ),
    },
    {
      key: "hit",
      header: "Last hit",
      width: "96px",
      sort: (r) => r.lastHit ?? "",
      cell: (r) => (r.lastHit ? <span className="whitespace-nowrap text-[12.5px] text-fg-2">{ago(r.lastHit)}</span> : <span className="text-[12px] text-fg-3">Never</span>),
    },
    { key: "hits", header: "Hits 24h", width: "90px", align: "right", sort: (r) => r.hits24h, cell: (r) => <span className="k-num text-[12.5px]">{r.hits24h.toLocaleString("en-US")}</span> },
    {
      key: "on",
      header: "Active",
      align: "center",
      cell: (r) => (
        <div className="flex justify-center">
          <Toggle
            checked={r.enabled}
            label={`Toggle ${r.cidr}`}
            onChange={(v) => {
              if (!v && mode === "enforce" && cidrContains(r.cidr, SEC_CURRENT_IP) && rules.filter((x) => x.enabled && cidrContains(x.cidr, SEC_CURRENT_IP)).length === 1) {
                toast.error("This entry covers your current IP", { description: "Disabling it would end your session. Switch to grace mode first." });
                return;
              }
              setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, enabled: v } : x)));
              toast.success(v ? `${r.cidr} enabled` : `${r.cidr} disabled`);
            }}
          />
        </div>
      ),
    },
    {
      key: "act",
      header: "",
      width: "48px",
      align: "right",
      cell: (r) => (
        <Menu
          trigger={
            <IconButton size="sm" aria-label="Entry actions">
              <MoreHorizontal />
            </IconButton>
          }
          items={[
            { label: "Edit entry", icon: <Pencil />, onSelect: () => setDialog({ open: true, rule: r }) },
            {
              label: "Copy CIDR",
              icon: <Copy />,
              onSelect: () => {
                navigator.clipboard?.writeText(r.cidr).catch(() => {});
                toast.success("CIDR copied", { description: r.cidr });
              },
            },
            "sep",
            {
              label: "Delete",
              icon: <Trash2 />,
              danger: true,
              onSelect: () => {
                if (cidrContains(r.cidr, SEC_CURRENT_IP) && mode === "enforce") {
                  toast.error("Can't delete the range you're connected from");
                  return;
                }
                setRules((rs) => rs.filter((x) => x.id !== r.id));
                toast.success("Entry deleted", { description: `${r.cidr} removed · logged to audit` });
              },
            },
          ]}
        />
      ),
    },
  ];

  const active = rules.filter((r) => r.enabled);
  const hits = rules.reduce((s, r) => s + r.hits24h, 0);

  return (
    <div className="pb-16">
      <PageHeader
        title="IP whitelist"
        subtitle="Restrict Back Office sign-in to trusted networks · per staff, role or everyone"
        actions={
          <Button variant="ember" onClick={() => setDialog({ open: true, rule: null, prefill: undefined })}>
            <Plus /> Add entry
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <Card hot className="h-full overflow-hidden">
            <Starfield density={30} />
            <div className="relative flex h-full flex-col gap-5 p-6 md:flex-row md:items-center">
              <Icon3D name="shield" size={84} className="hidden shrink-0 md:block" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={myRule ? "up" : "down"} dot>
                    {myRule ? "Your IP is whitelisted" : "Your IP is not covered"}
                  </Chip>
                  <Chip tone={mode === "enforce" ? "ember" : mode === "grace" ? "warn" : "neutral"}>{mode === "enforce" ? "Enforced" : mode === "grace" ? "Grace mode" : "Not enforced"}</Chip>
                </div>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[13px] text-fg-2">Your current IP</span>
                  <span className="font-mono text-[26px] font-medium tracking-tight">{SEC_CURRENT_IP}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-fg-3">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" /> Dubai, AE · Etisalat
                  </span>
                  {myRule && (
                    <span>
                      matched by <span className="font-mono text-fg-2">{myRule.cidr}</span> — {myRule.label}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 rounded-[16px] border border-white/10 bg-black/25 p-4">
                <div className="k-label mb-2">Enforcement</div>
                <Segmented
                  size="sm"
                  value={mode}
                  onChange={changeMode}
                  options={[
                    { value: "enforce", label: <><ShieldCheck className="size-3.5" /> Enforce</> },
                    { value: "grace", label: <><ShieldAlert className="size-3.5" /> Grace</> },
                    { value: "off", label: <><ShieldOff className="size-3.5" /> Off</> },
                  ]}
                />
                <p className="mt-2 max-w-[260px] text-[11.5px] leading-snug text-fg-3">
                  {mode === "enforce" ? "Sign-ins from other IPs are blocked and alerted." : mode === "grace" ? "Violations are allowed but logged and alerted to Security." : "Any IP can sign in. Not recommended."}
                </p>
              </div>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.05} className="xl:col-span-4">
          <div className="grid h-full grid-cols-3 gap-3 xl:grid-cols-1">
            {[
              { l: "Active entries", v: `${active.length}`, s: `${rules.length - active.length} disabled`, i: <Wifi /> },
              { l: "Matched sign-ins · 24h", v: hits.toLocaleString("en-US"), s: "99.94% of all requests", i: <ShieldCheck /> },
              { l: "Blocked · 24h", v: String(SEC_BLOCKED_ATTEMPTS.filter((b) => b.result === "blocked").length), s: `${SEC_BLOCKED_ATTEMPTS.filter((b) => b.result === "grace").length} allowed in grace`, i: <ShieldAlert /> },
            ].map((k) => (
              <Card key={k.l} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <span className="hidden size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 sm:grid [&_svg]:size-4">{k.i}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] uppercase tracking-wider text-fg-3">{k.l}</div>
                  <div className="k-num text-[20px] font-semibold leading-tight">{k.v}</div>
                </div>
                <span className="hidden text-right text-[11.5px] text-fg-3 sm:block">{k.s}</span>
              </Card>
            ))}
          </div>
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="min-w-0 xl:col-span-8">
          <Card>
            <CardHeader title="Whitelisted ranges" subtitle="IPv4 and IPv6 CIDR · most specific scope wins" />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <DataTable columns={columns} rows={rules} pageSize={10} dense rowKey={(r) => r.id} search={(r) => `${r.cidr} ${r.label} ${r.scopeValue ?? ""}`} searchPlaceholder="CIDR, label, user…" exportName="ip-whitelist" />
            </div>
          </Card>
        </Reveal>

        <div className="flex flex-col gap-4 xl:col-span-4">
          <Reveal delay={0.15}>
            <Card>
              <CardHeader title="Test an IP" subtitle="Which entries would match?" icon={<FlaskConical />} />
              <div className="px-5 pb-5 pt-4">
                <Input value={testIp} onChange={(e) => setTestIp(e.target.value)} inputClassName="font-mono" placeholder="e.g. 185.44.76.33" />
                <div className="mt-3">
                  {!isValidIp(testIp) ? (
                    <div className="text-[12px] text-fg-3">Enter a valid IPv4 address.</div>
                  ) : testMatches.length ? (
                    <div className="space-y-1.5">
                      {testMatches.map((r) => (
                        <div key={r.id} className="flex items-center gap-2 rounded-[12px] border border-up/25 bg-up-soft px-3 py-2 text-[12px]">
                          <ShieldCheck className="size-3.5 text-up" />
                          <span className="font-mono text-up">{r.cidr}</span>
                          <span className="truncate text-fg-2">{r.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-[12px] border border-down/25 bg-down-soft px-3 py-2 text-[12px] text-down">
                      <ShieldOff className="size-3.5" /> No match — sign-in would be {mode === "enforce" ? "blocked" : mode === "grace" ? "allowed and alerted" : "allowed"}
                    </div>
                  )}
                </div>
                {isValidIp(testIp) && !testMatches.length && (
                  <Button
                    size="xs"
                    variant="surface"
                    className="mt-3"
                    onClick={() => {
                      setDialog({ open: true, rule: null, prefill: `${testIp.trim()}/32` });
                    }}
                  >
                    <Plus /> Whitelist this IP
                  </Button>
                )}
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.2}>
            <Card>
              <CardHeader title="Rejected & grace sign-ins" subtitle="Last 24 hours" />
              <div className="mt-3 space-y-2 px-4 pb-5 sm:px-5">
                {SEC_BLOCKED_ATTEMPTS.map((b) => (
                  <div key={b.ip + b.time} className="k-row flex items-center gap-3 px-3 py-2.5">
                    <Avatar src={PEOPLE[b.staff]!.photo} name={PEOPLE[b.staff]!.name} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium">{PEOPLE[b.staff]!.name}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-fg-3">
                        <Flag country={b.country} className="size-3" />
                        <Mono className="text-[11px] text-fg-3">{b.ip}</Mono>
                      </div>
                    </div>
                    <div className="text-right">
                      <Chip size="sm" tone={b.result === "blocked" ? "down" : "warn"}>
                        {b.result === "blocked" ? "Blocked" : "Grace"}
                      </Chip>
                      <div className="mt-0.5 text-[10.5px] text-fg-3">{ago(b.time)}</div>
                    </div>
                  </div>
                ))}
                <Button size="xs" variant="ghost" className="w-full" onClick={() => toast.info("Opening audit log filtered to Security", { description: "Security & Audit → Admin audit log" })}>
                  <User /> View in audit log
                </Button>
              </div>
            </Card>
          </Reveal>
        </div>
      </div>

      <IpRuleDialog open={dialog.open} initial={dialog.rule} prefill={dialog.prefill} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} onSave={save} />
    </div>
  );
}

export default function Page() {
  return IS_DEMO ? <IpWhitelistPage /> : <LiveIpAllowlist />;
}
