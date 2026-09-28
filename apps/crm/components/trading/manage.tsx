"use client";

import * as React from "react";
import { Eye, Globe, Lock, Pencil, RefreshCcw, TriangleAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Dialog, Field, KeyValue, Money, Reveal, cn } from "@kalks/ui";
import { PasswordInput } from "@/components/accounts/security";
import { STATUS_LABEL, curOf, errorToast, fmtDate, modeLabel, serverOf, tradingApi, type EngineAccount } from "./api";
import { PasswordRules, SecretField, TradeButton, demoTarget, livePasswordOk, refillsLeft, useRefill } from "./ui";

/* ------------------------------------------------------------------ */
/* Change password (D4, D90)                                           */
/* ------------------------------------------------------------------ */

function ChangePasswordDialog({ a, kind, open, onOpenChange }: { a: EngineAccount; kind: "trading" | "investor"; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [pw, setPw] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<{ password: string; revoked: number } | null>(null);
  React.useEffect(() => {
    if (!open) {
      setPw("");
      setConfirm("");
      setDone(null);
    }
  }, [open]);
  const ok = livePasswordOk(pw) && pw === confirm;
  const label = kind === "trading" ? "Trading password" : "Investor password";

  const submit = async () => {
    setBusy(true);
    try {
      const r = await tradingApi<{ sessionsRevoked: number }>(`accounts/${a.login}/passwords`, { body: { kind, password: pw } });
      setDone({ password: pw, revoked: r.sessionsRevoked ?? 0 });
      setPw("");
      setConfirm("");
      toast.success(`${label} changed`, { description: `#${a.login}${r.sessionsRevoked ? ` · ${r.sessionsRevoked} open session${r.sessionsRevoked === 1 ? "" : "s"} signed out` : ""}` });
    } catch (e) {
      errorToast(`Couldn't change the ${label.toLowerCase()}`, e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={kind === "trading" ? "Change trading password" : "Change investor password"}
      description={
        kind === "trading"
          ? `Full-access password for #${a.login}. Kalks Trader sessions signed in with the old password are signed out.`
          : `Read-only password for #${a.login}. Share it to let someone view the account without trading. Sessions using the old one are signed out.`
      }
      width={520}
      footer={
        done ? (
          <Button variant="ember" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="ember" disabled={!ok || busy} onClick={submit}>
              {busy ? "Saving…" : "Set new password"}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-4">
          <SecretField label={`New ${label.toLowerCase()}`} value={done.password} secret />
          <div className="flex items-start gap-2 rounded-[14px] border border-warn/25 bg-warn-soft px-3.5 py-3 text-[12.5px] text-fg-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
            Shown once. Copy it now; Kalks never displays or emails existing passwords.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="New password">
            <PasswordInput value={pw} onChange={setPw} generate />
          </Field>
          <PasswordRules password={pw} />
          <Field label="Confirm new password" error={confirm && confirm !== pw ? "Passwords don't match" : undefined}>
            <PasswordInput value={confirm} onChange={setConfirm} placeholder="Repeat password" />
          </Field>
          <p className="text-[12px] text-fg-3">The trading and investor passwords must be different.</p>
        </div>
      )}
    </Dialog>
  );
}

export function CredentialsPanel({ a }: { a: EngineAccount }) {
  const [dlg, setDlg] = React.useState<"trading" | "investor" | null>(null);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Reveal className="xl:col-span-7">
        <Card className="h-full">
          <CardHeader title="Login credentials" subtitle="Use these to sign in to Kalks Trader." icon={<Lock />} />
          <div className="grid grid-cols-1 gap-4 px-4 pb-6 pt-5 sm:grid-cols-2 sm:px-6">
            <SecretField label="Login" value={String(a.login)} />
            <SecretField label="Server" value={serverOf(a)} hint="GMT+3 / GMT+2" />
            <div className="sm:col-span-2">
              <div className="k-row flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
                  <Lock className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[14px] font-medium">
                    Trading password <Chip size="sm">Full access</Chip>
                  </div>
                  <div className="text-[12.5px] text-fg-3">Open, modify and close trades.</div>
                </div>
                <Button size="sm" variant="surface" onClick={() => setDlg("trading")}>
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
                  <div className="text-[12.5px] text-fg-3">View positions and history without being able to trade.</div>
                </div>
                <Button size="sm" variant="surface" onClick={() => setDlg("investor")}>
                  <Pencil /> Change
                </Button>
              </div>
            </div>
            <div className="flex items-start gap-2 text-[12px] text-fg-3 sm:col-span-2">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" />
              For your security, Kalks never displays or emails existing passwords. If you lose one, set a new one here.
            </div>
          </div>
        </Card>
      </Reveal>
      <Reveal delay={0.05} className="xl:col-span-5">
        <Card className="h-full">
          <CardHeader title="Investor access" subtitle="Let a coach, auditor or investor watch this account" icon={<Users />} />
          <div className="space-y-3 px-4 pb-6 pt-4 sm:px-6">
            <ol className="space-y-2.5 text-[13px] text-fg-2">
              {[
                "Set an investor password you are happy to share.",
                `Share the login ${a.login}, the server ${serverOf(a)} and that password.`,
                "They sign in to Kalks Trader with it and see live positions and history, read-only.",
                "Change the investor password anytime to revoke access; their session ends at once.",
              ].map((t, i) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="k-num grid size-6 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-[11.5px] text-fg-2">{i + 1}</span>
                  <span className="pt-0.5">{t}</span>
                </li>
              ))}
            </ol>
            <div className="k-row flex items-center gap-3 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg-2">
                <Globe className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium">Kalks Trader</div>
                <div className="text-[11.5px] text-fg-3">Web terminal · no download</div>
              </div>
              <TradeButton a={a} label="Open" />
            </div>
          </div>
        </Card>
      </Reveal>
      {dlg && <ChangePasswordDialog a={a} kind={dlg} open={!!dlg} onOpenChange={(o) => !o && setDlg(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings: leverage (D15), demo funds (D8), details                  */
/* ------------------------------------------------------------------ */

function LeverageCard({ a, onChanged }: { a: EngineAccount; onChanged: () => void }) {
  const [lev, setLev] = React.useState(a.leverage);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setLev(a.leverage), [a.leverage]);
  const locked = a.positions > 0;
  const apply = async () => {
    setBusy(true);
    try {
      const r = await tradingApi<{ from: number; leverage: number }>(`accounts/${a.login}/leverage`, { body: { leverage: lev } });
      toast.success("Leverage changed", { description: `#${a.login}: 1:${r.from.toLocaleString("en-US")} → 1:${r.leverage.toLocaleString("en-US")}` });
      onChanged();
    } catch (e) {
      errorToast("Couldn't change the leverage", e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader title="Leverage" subtitle={`Available on ${a.groupName}: ${a.leverages.map((l) => `1:${l.toLocaleString("en-US")}`).join(" · ")}`} action={<Chip tone="ember">Current 1:{a.leverage.toLocaleString("en-US")}</Chip>} />
      <div className="px-4 pb-6 pt-4 sm:px-6">
        {locked && (
          <div className="mb-4 flex items-start gap-3 rounded-[14px] border border-warn/25 bg-warn-soft px-4 py-3 text-[13px]">
            <Lock className="mt-0.5 size-4 shrink-0 text-warn" />
            <div>
              <div className="font-medium text-warn">Leverage is locked while positions are open</div>
              <div className="mt-0.5 text-fg-2">
                Close your {a.positions} open position{a.positions > 1 ? "s" : ""} in Kalks Trader to change leverage. This prevents sudden margin changes on running trades.
              </div>
            </div>
          </div>
        )}
        <div className={cn("flex flex-wrap gap-2", locked && "pointer-events-none opacity-45")}>
          {a.leverages.map((l) => (
            <button
              key={l}
              type="button"
              disabled={locked}
              aria-pressed={lev === l}
              onClick={() => setLev(l)}
              className={cn("k-num h-10 min-w-20 rounded-full border px-4 text-[13.5px] font-semibold transition-colors", lev === l ? "border-ember/60 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2 hover:text-fg")}
            >
              1:{l.toLocaleString("en-US")}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-fg-3">Higher leverage lowers the margin required per trade and increases risk.</span>
          <Button size="sm" variant="ember" disabled={locked || lev === a.leverage || busy} onClick={apply}>
            {busy ? "Applying…" : "Apply"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function DemoFundsCard({ a, onChanged }: { a: EngineAccount; onChanged: () => void }) {
  const cur = curOf(a);
  const { busy, run } = useRefill(a, onChanged);
  const left = refillsLeft(a);
  const target = demoTarget(a) ?? 0;
  const full = a.balance >= target;
  if (!a.demo) return null;
  return (
    <Card>
      <CardHeader title="Demo funds" subtitle={`Refill tops the balance back to ${cur}${target.toLocaleString("en-US")}`} />
      <div className="px-6 pb-6 pt-3">
        <Money value={a.balance} currency={cur} countUp={false} className="block text-[28px] font-semibold" />
        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="text-[12.5px] text-fg-2">
            <span className="k-num font-semibold text-fg">{left}</span> of {a.demo.refillsPerDay} refills left today
            <div className="mt-1.5 flex gap-1">
              {Array.from({ length: a.demo.refillsPerDay }, (_, i) => (
                <span key={i} className={cn("h-1.5 w-8 rounded-full", i < left ? "bg-gold" : "bg-surface-3")} />
              ))}
            </div>
          </div>
          <Button variant="gold" disabled={busy || left === 0 || full || a.status === "expired"} onClick={run}>
            <RefreshCcw /> Refill
          </Button>
        </div>
        <p className="mt-4 text-[12px] text-fg-3">
          {full ? "The balance is at its starting amount, so there is nothing to refill. " : ""}Refills reset at 00:00 server time. The account expires after {a.demo.expiryDays} days without a Kalks Trader login.
        </p>
      </div>
    </Card>
  );
}

export function SettingsPanel({ a, onChanged }: { a: EngineAccount; onChanged: () => void }) {
  const st = STATUS_LABEL[a.status];
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-7">
        <Reveal>
          <LeverageCard a={a} onChanged={onChanged} />
        </Reveal>
      </div>
      <div className="space-y-4 xl:col-span-5">
        {a.type === "demo" && (
          <Reveal>
            <DemoFundsCard a={a} onChanged={onChanged} />
          </Reveal>
        )}
        <Reveal delay={0.05}>
          <Card>
            <CardHeader title="Account details" />
            <div className="px-6 pb-4 pt-1">
              <KeyValue
                rows={[
                  ["Login", <span key="l" className="font-mono">{a.login}</span>],
                  ["Type", `${a.type === "live" ? "Live" : "Demo"} · ${a.groupName}`],
                  ["Position mode", modeLabel(a.mode)],
                  ["Currency", a.cent ? "USC (US cents)" : a.currency],
                  ["Margin call / stop out", `${a.marginCallLevel}% / ${a.stopOutLevel}%`],
                  ["Status", <Chip key="s" size="sm" tone={st.tone}>{st.label}</Chip>],
                  ["Opened", fmtDate(a.createdAt)],
                ]}
              />
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
