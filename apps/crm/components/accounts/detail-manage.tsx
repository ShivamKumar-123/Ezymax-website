"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, Download, Eye, Globe, KeyRound, Lock, Monitor, Moon, Pencil, RefreshCcw, Smartphone, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Dialog, Field, Icon3D, Input, KeyValue, Money, Reveal, Toggle, cn } from "@kalks/ui";
import { ACCOUNT_GROUPS, type TradingAccount } from "@kalks/mock";
import { DEMO_RULES } from "@kalks/mock/accounts-extra";
import { CredentialField, EmailOtp, PasswordInput, PasswordStrength, isPasswordValid } from "./security";
import { curOf } from "./detail-overview";

/* ------------------------------------------------------------------ */
/* Change password dialog                                              */
/* ------------------------------------------------------------------ */

function ChangePasswordDialog({ a, kind, open, onOpenChange }: { a: TradingAccount; kind: "trading" | "investor"; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [pw, setPw] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!open) {
      setPw("");
      setConfirm("");
      setCode("");
    }
  }, [open]);
  const ok = isPasswordValid(pw) && pw === confirm && code.length === 6;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={kind === "trading" ? "Change trading password" : "Change investor password"}
      description={
        kind === "trading" ? `Master password for #${a.login}. Open terminal sessions will be logged out.` : `Read-only access for #${a.login} — share it with a coach or investor to let them view, not trade.`
      }
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="ember"
            disabled={!ok || busy}
            onClick={() => {
              setBusy(true);
              setTimeout(() => {
                setBusy(false);
                onOpenChange(false);
                toast.success(`${kind === "trading" ? "Trading" : "Investor"} password updated`, { description: `#${a.login} · ${a.server}` });
              }, 700);
            }}
          >
            {busy ? "Updating…" : "Update password"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="New password">
          <PasswordInput value={pw} onChange={setPw} generate />
        </Field>
        <PasswordStrength password={pw} />
        <Field label="Confirm new password" error={confirm && confirm !== pw ? "Passwords don't match" : undefined}>
          <PasswordInput value={confirm} onChange={setConfirm} placeholder="Repeat password" />
        </Field>
        <EmailOtp code={code} onCode={setCode} purpose="confirm the password change" />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Credentials                                                         */
/* ------------------------------------------------------------------ */

export function CredentialsTab({ a }: { a: TradingAccount }) {
  const [dlg, setDlg] = React.useState<"trading" | "investor" | null>(null);
  const archived = a.balance === 0 && a.equity === 0;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Reveal className="xl:col-span-7">
        <Card className="h-full">
          <CardHeader title="MT5 credentials" subtitle="Use these to log in to the Kalks terminal or any MetaTrader 5 app." icon={<KeyRound />} />
          <div className="grid grid-cols-1 gap-4 px-4 pb-6 pt-5 sm:grid-cols-2 sm:px-6">
            <CredentialField label="Login" value={a.login} />
            <CredentialField label="Server" value={a.server} hint="GMT+3" />
            <div className="sm:col-span-2">
              <div className="k-row flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
                  <Lock className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[14px] font-medium">
                    Trading password <Chip size="sm">Master</Chip>
                  </div>
                  <div className="text-[12.5px] text-fg-3">Full access — open, modify and close trades. Last changed 12 Feb 2026.</div>
                </div>
                <Button size="sm" variant="surface" disabled={archived} onClick={() => setDlg("trading")}>
                  <Pencil /> Change
                </Button>
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="k-row flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg-2">
                  <Eye className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[14px] font-medium">
                    Investor password <Chip size="sm" tone="info">Read-only</Chip>
                  </div>
                  <div className="text-[12.5px] text-fg-3">View-only access for coaches, auditors and investors. Cannot place trades.</div>
                </div>
                <Button size="sm" variant="surface" disabled={archived} onClick={() => setDlg("investor")}>
                  <Pencil /> Change
                </Button>
              </div>
            </div>
            <div className="flex items-start gap-2 text-[12px] text-fg-3 sm:col-span-2">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" />
              For your security, Kalks never displays or emails existing passwords. Changing either password requires a one-time code sent to your email.
            </div>
          </div>
        </Card>
      </Reveal>
      <Reveal delay={0.05} className="xl:col-span-5">
        <Card className="h-full">
          <CardHeader title="Connect a platform" subtitle="Same login works everywhere" />
          <div className="space-y-2 px-4 pb-6 pt-4 sm:px-6">
            {[
              { icon: <Globe />, name: "Kalks WebTerminal", sub: "No download · any browser", action: <Link target="_blank" rel="noopener" href={`/trade?account=${a.login}`}><Button size="sm" variant="ember">Launch</Button></Link> },
              { icon: <Monitor />, name: "MetaTrader 5 · Windows / macOS", sub: "kalks5setup · 24.1 MB", action: <Button size="sm" variant="surface" onClick={() => toast.success("Download started", { description: "kalks5setup.exe" })}><Download /> Get</Button> },
              { icon: <Smartphone />, name: "MetaTrader 5 · iOS / Android", sub: `Search server “${a.server}”`, action: <Button size="sm" variant="surface" onClick={() => toast("Store links sent to your email")}>Send link</Button> },
            ].map((p) => (
              <div key={p.name} className="k-row flex items-center gap-3 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg-2 [&_svg]:size-4">{p.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium">{p.name}</div>
                  <div className="truncate text-[11.5px] text-fg-3">{p.sub}</div>
                </div>
                {p.action}
              </div>
            ))}
            <div className="flex items-center gap-3 pt-3">
              <Icon3D name="locked" size={40} />
              <p className="text-[12px] text-fg-3">Enable 2FA on your Kalks profile to protect withdrawals and credential changes.</p>
            </div>
          </div>
        </Card>
      </Reveal>
      {dlg && <ChangePasswordDialog a={a} kind={dlg} open={!!dlg} onOpenChange={(o) => !o && setDlg(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

function useCountdown(to?: string) {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!to || now === null) return null;
  const ms = Math.max(0, Date.parse(to + "T21:00:00Z") - now);
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { d, h, m, s, ms };
}

export function SettingsTab({ a, openPositions, onRename }: { a: TradingAccount; openPositions: number; onRename: (n: string) => void }) {
  const g = ACCOUNT_GROUPS.find((x) => x.name === a.group)!;
  const [lev, setLev] = React.useState(a.leverage);
  const [savedLev, setSavedLev] = React.useState(a.leverage);
  const [name, setName] = React.useState(a.nickname ?? "");
  const [refills, setRefills] = React.useState(a.refillsLeft ?? 0);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [swapReq, setSwapReq] = React.useState(false);
  const cd = useCountdown(a.expiresAt);
  const locked = openPositions > 0;
  const cur = curOf(a);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-7">
        <Reveal>
          <Card>
            <CardHeader title="Leverage" subtitle={`Allowed on ${g.name}: ${g.leverage.map((l) => `1:${l}`).join(" · ")}`} action={<Chip tone="ember">Current 1:{savedLev.toLocaleString()}</Chip>} />
            <div className="px-4 pb-6 pt-4 sm:px-6">
              {locked && (
                <div className="mb-4 flex items-start gap-3 rounded-[14px] border border-warn/25 bg-warn-soft px-4 py-3 text-[13px]">
                  <Lock className="mt-0.5 size-4 shrink-0 text-warn" />
                  <div>
                    <div className="font-medium text-warn">Leverage is locked while positions are open</div>
                    <div className="mt-0.5 text-fg-2">
                      Close your {openPositions} open position{openPositions > 1 ? "s" : ""} to change leverage. This prevents sudden margin changes on running trades.
                    </div>
                  </div>
                </div>
              )}
              <div className={cn("flex flex-wrap gap-2", locked && "pointer-events-none opacity-45")}>
                {g.leverage.map((l) => (
                  <button
                    key={l}
                    type="button"
                    disabled={locked}
                    onClick={() => setLev(l)}
                    className={cn("k-num h-10 min-w-20 rounded-full border px-4 text-[13.5px] font-semibold transition-all", lev === l ? "border-ember/60 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2 hover:text-fg")}
                  >
                    1:{l.toLocaleString()}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-[12.5px] text-fg-3">Margin required on 1 lot EURUSD: <span className="k-num text-fg-2">${Math.round(108456 / lev).toLocaleString()}</span></span>
                <Button
                  size="sm"
                  variant="ember"
                  disabled={locked || lev === savedLev}
                  onClick={() => {
                    setSavedLev(lev);
                    toast.success("Leverage updated", { description: `#${a.login} is now 1:${lev.toLocaleString()}` });
                  }}
                >
                  Apply
                </Button>
              </div>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.05}>
          <Card>
            <CardHeader title="Account name" subtitle="Only visible to you" />
            <div className="flex flex-col gap-3 px-4 pb-6 pt-4 sm:flex-row sm:px-6">
              <Input className="flex-1" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder={`${a.group} · ${a.mode}`} leading={<Pencil />} trailing={<span className="k-num text-[11px]">{name.length}/24</span>} />
              <Button
                variant="surface"
                size="lg"
                disabled={name === (a.nickname ?? "")}
                onClick={() => {
                  onRename(name);
                  toast.success("Account renamed", { description: name || "Nickname removed" });
                }}
              >
                Save
              </Button>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.1}>
          <Card>
            <CardHeader title="Swap-free (Islamic)" subtitle="No overnight swap charges; admin fee may apply after 5 nights" />
            <div className="flex items-center gap-4 px-4 pb-6 pt-4 sm:px-6">
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-gold">
                <Moon className="size-4" />
              </span>
              <div className="flex-1 text-[13px] text-fg-2">
                {a.swapFree ? "This account is swap-free." : swapReq ? "Request submitted — compliance usually responds within 24 hours." : "Switching requires a quick compliance review."}
              </div>
              <Toggle
                checked={a.swapFree || swapReq}
                onChange={(v) => {
                  if (a.swapFree) return toast("Contact support to switch off swap-free status");
                  setSwapReq(v);
                  toast[v ? "success" : "info"](v ? "Swap-free request submitted" : "Request withdrawn");
                }}
                label="Swap-free"
              />
            </div>
          </Card>
        </Reveal>
      </div>

      <div className="space-y-4 xl:col-span-5">
        {a.type === "demo" && (
          <Reveal>
            <Card hot className="overflow-hidden">
              <div className="relative px-6 pb-6 pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="k-label">Demo funds</div>
                    <Money value={a.balance} currency={cur} className="mt-2 block text-[28px] font-semibold" />
                  </div>
                  <Icon3D name="hourglass_not_done" size={56} />
                </div>
                <div className="mt-4">
                  <div className="mb-2 text-[11.5px] uppercase tracking-wider text-fg-3">Expires in</div>
                  <div className="flex gap-2">
                    {cd
                      ? [
                          [cd.d, "days"],
                          [cd.h, "hrs"],
                          [cd.m, "min"],
                          [cd.s, "sec"],
                        ].map(([v, l]) => (
                          <div key={l as string} className="flex-1 rounded-[14px] border border-line bg-black/25 light:bg-white/70 py-2 text-center">
                            <div className="k-num font-mono text-[22px] font-semibold">{pad(v as number)}</div>
                            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{l}</div>
                          </div>
                        ))
                      : null}
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className="text-[12.5px] text-fg-2">
                    <span className="k-num font-semibold text-fg">{refills}</span> of {DEMO_RULES.refillsPerDay} refills left today
                    <div className="mt-1.5 flex gap-1">
                      {Array.from({ length: DEMO_RULES.refillsPerDay }, (_, i) => (
                        <span key={i} className={cn("h-1.5 w-8 rounded-full", i < refills ? "bg-gold" : "bg-surface-3")} />
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="gold"
                    disabled={refills === 0}
                    onClick={() => {
                      setRefills((r) => r - 1);
                      toast.success("Demo balance refilled", { description: `#${a.login} reset to ${cur}${a.balance.toLocaleString()} · ${refills - 1} left today` });
                    }}
                  >
                    <RefreshCcw /> Refill
                  </Button>
                </div>
              </div>
            </Card>
          </Reveal>
        )}

        <Reveal delay={0.05}>
          <Card>
            <CardHeader title="Account details" />
            <div className="px-6 pb-4 pt-1">
              <KeyValue
                rows={[
                  ["Login", <span key="l" className="font-mono">{a.login}</span>],
                  ["Group", `${a.group} · ${a.mode === "hedging" ? "Hedging" : "Netting"}`],
                  ["Currency", a.currency],
                  ["Margin call / stop out", "50% / 20%"],
                  ["Opened", new Date(a.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })],
                ]}
              />
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.1}>
          <Card className="border-down/25">
            <CardHeader title="Archive account" subtitle="Hide it from your list and disable trading" />
            <div className="px-4 pb-6 pt-4 sm:px-6">
              <p className="text-[13px] text-fg-2">
                {a.type === "live" ? "Archiving requires no open positions. Move any remaining balance to your wallet first — you can restore a live account later." : "Archived demo accounts can’t be restored."}
              </p>
              <Button className="mt-4" variant="down-outline" onClick={() => setArchiveOpen(true)}>
                <Archive /> Archive account
              </Button>
            </div>
          </Card>
        </Reveal>
      </div>

      <Dialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Archive #${a.login}?`}
        description={`${a.group} · ${a.mode === "hedging" ? "Hedging" : "Netting"} · ${a.server}`}
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiveOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="sell"
              disabled={locked}
              onClick={() => {
                setArchiveOpen(false);
                toast.success("Account archived", { description: `#${a.login} moved to Archived` });
              }}
            >
              Archive
            </Button>
          </>
        }
      >
        {locked ? (
          <div className="flex items-start gap-3 rounded-[14px] border border-warn/25 bg-warn-soft px-4 py-3 text-[13px] text-fg-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
            Close all {openPositions} open positions before archiving this account.
          </div>
        ) : (
          <div className="space-y-3 text-[13px] text-fg-2">
            <p>Trading will be disabled and the account will move to your Archived tab.</p>
            {a.type === "live" && a.balance > 0 && (
              <div className="k-row flex items-center justify-between px-4 py-3">
                <span>Remaining balance</span>
                <Link href={`/wallet/transfer?from=${a.login}`} className="font-medium text-ember hover:underline">
                  <Money value={a.balance} currency={cur} countUp={false} /> → Move to wallet
                </Link>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
