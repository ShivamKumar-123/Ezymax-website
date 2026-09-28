"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, CandlestickChart, Check, Info, Lock, Moon, Server, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Field, Icon3D, Input, KeyValue, PageHeader, Reveal, Starfield, Stepper, Toggle, cn } from "@kalks/ui";
import { ACCOUNT_GROUPS } from "@kalks/mock";
import { DEMO_RULES } from "@kalks/mock/accounts-extra";
import { GroupCard } from "@/components/accounts/group-card";
import { CredentialField, PasswordInput, PasswordStrength, generatePassword, isPasswordValid } from "@/components/accounts/security";

const STEPS = ["Account", "Type", "Configure", "Password", "Done"];
type Kind = "live" | "demo";

interface Cfg {
  kind: Kind;
  group: string;
  mode: "hedging" | "netting";
  leverage: number;
  nickname: string;
  swapFree: boolean;
  demoBalance: number;
  password: string;
  confirm: string;
  agree: boolean;
}

function KindCard({ kind, selected, onSelect }: { kind: Kind; selected: boolean; onSelect: () => void }) {
  const live = kind === "live";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[20px] border p-6 text-left transition-all duration-300",
        selected ? (live ? "k-hot-card border-ember/60 shadow-[0_0_0_4px_rgba(255,90,31,0.12)]" : "border-gold/60 bg-surface shadow-[0_0_0_4px_rgba(233,185,73,0.12)]") : "k-card hover:-translate-y-0.5 hover:border-[var(--k-border-top)]",
      )}
    >
      {selected && live && <Starfield density={36} />}
      <div className="relative flex items-start justify-between">
        <Chip tone={live ? "ember" : "gold"} className="font-semibold tracking-wider">
          {live ? "LIVE" : "DEMO"}
        </Chip>
        <span className={cn("grid size-6 place-items-center rounded-full border transition-colors", selected ? (live ? "border-ember bg-ember text-white" : "border-gold bg-gold text-black") : "border-line")}>
          {selected && <Check className="size-3.5" />}
        </span>
      </div>
      <div className="relative mt-4">
        <Icon3D name={live ? "money_bag" : "rocket"} size={96} />
      </div>
      <div className="relative mt-4 text-[22px] font-semibold tracking-tight">{live ? "Live account" : "Demo account"}</div>
      <p className="relative mt-1 text-[13.5px] text-fg-2">{live ? "Trade real markets with real money. Fund instantly from your USDT wallet." : "Practise risk-free with virtual funds on real-time prices."}</p>
      <ul className="relative mt-4 space-y-2 text-[13px] text-fg-2">
        {(live
          ? ["Real execution on Kalks-Live servers", "Instant USDT funding, 1:1 to USD", "Withdraw profits anytime (after KYC)"]
          : [`Start with $1k – $100k virtual balance`, `Refill up to ${DEMO_RULES.refillsPerDay}× per day`, `Expires after ${DEMO_RULES.expiryDays} days of use`]
        ).map((f) => (
          <li key={f} className="flex items-center gap-2">
            <Check className={cn("size-3.5", live ? "text-ember" : "text-gold")} /> {f}
          </li>
        ))}
      </ul>
    </button>
  );
}

function SuccessCheck() {
  return (
    <div className="relative mx-auto grid size-28 place-items-center">
      <motion.span className="absolute inset-0 rounded-full bg-up/20" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: [0.4, 1.35, 1], opacity: [0, 0.6, 0.25] }} transition={{ duration: 1.1 }} />
      <motion.span className="absolute inset-3 rounded-full bg-up/25 blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} />
      <svg viewBox="0 0 80 80" className="relative size-24">
        <motion.circle cx="40" cy="40" r="34" fill="none" stroke="var(--k-up)" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease: "easeOut" }} style={{ rotate: -90, transformOrigin: "50% 50%" }} />
        <motion.path d="M25 41 l10 10 l21 -22" fill="none" stroke="var(--k-up)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.55, ease: "easeOut" }} />
      </svg>
    </div>
  );
}

function Summary({ cfg, step }: { cfg: Cfg; step: number }) {
  const g = ACCOUNT_GROUPS.find((x) => x.id === cfg.group)!;
  return (
    <Card className="overflow-hidden">
      <div className="relative h-28 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={g.photo} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--k-surface)] to-black/20" />
        <div className="absolute bottom-3 left-5 flex items-center gap-2">
          <Chip tone={cfg.kind === "live" ? "ember" : "gold"} className="font-semibold tracking-wider">
            {cfg.kind.toUpperCase()}
          </Chip>
          <span className="text-[17px] font-semibold text-white">
            {g.name} · {cfg.mode === "hedging" ? "Hedging" : "Netting"}
          </span>
        </div>
      </div>
      <div className="px-6 pb-5">
        <KeyValue
          rows={[
            ["Server", <span key="s" className="font-mono">{cfg.kind === "live" ? (g.cent ? "Kalks-Live02" : "Kalks-Live01") : "Kalks-Demo"}</span>],
            ["Currency", g.cent ? "USC (cent)" : "USD"],
            ["Leverage", `1:${cfg.leverage.toLocaleString()}`],
            ["Spread from", `${g.spreadFrom} pips`],
            ["Commission", g.commission],
            ["Swap-free", cfg.swapFree ? "Yes (Islamic)" : "No"],
            cfg.kind === "demo" ? ["Start balance", `${g.cent ? "USC " : "$"}${(cfg.demoBalance * (g.cent ? 100 : 1)).toLocaleString()}`] : ["Min. first deposit", `$${g.minDeposit}`],
            ["Nickname", cfg.nickname || <span key="n" className="text-fg-3">—</span>],
          ]}
        />
        <div className="mt-3 flex items-center gap-2 text-[12px] text-fg-3">
          <Lock className="size-3.5" /> Step {Math.min(step + 1, 5)} of 5 · settings can&apos;t be edited after creation except leverage and name
        </div>
      </div>
    </Card>
  );
}

function Wizard() {
  const sp = useSearchParams();
  const initGroup = ACCOUNT_GROUPS.some((g) => g.id === sp.get("group")) ? sp.get("group")! : "pro";
  const initKind: Kind = sp.get("type") === "demo" ? "demo" : "live";
  const [step, setStep] = React.useState(sp.get("group") ? 1 : 0);
  const [dir, setDir] = React.useState(1);
  const [cfg, setCfg] = React.useState<Cfg>(() => {
    const g = ACCOUNT_GROUPS.find((x) => x.id === initGroup)!;
    return { kind: initKind, group: initGroup, mode: g.cent ? "hedging" : "hedging", leverage: g.leverage.includes(500) ? 500 : g.leverage[1]!, nickname: "", swapFree: false, demoBalance: 10000, password: "", confirm: "", agree: false };
  });
  const [created, setCreated] = React.useState<{ login: string; investor: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const g = ACCOUNT_GROUPS.find((x) => x.id === cfg.group)!;
  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const pickGroup = (id: string) => {
    const ng = ACCOUNT_GROUPS.find((x) => x.id === id)!;
    setCfg((c) => ({ ...c, group: id, mode: ng.cent ? "hedging" : c.mode, leverage: ng.leverage.includes(c.leverage) ? c.leverage : ng.leverage.includes(500) ? 500 : ng.leverage[ng.leverage.length - 1]! }));
  };

  const canNext = step === 3 ? isPasswordValid(cfg.password) && cfg.password === cfg.confirm && cfg.agree : true;
  const go = (d: number) => {
    setDir(d);
    setStep((s) => Math.max(0, Math.min(4, s + d)));
  };
  const create = () => {
    setBusy(true);
    setTimeout(() => {
      const login = cfg.kind === "live" ? `8041${Math.floor(4000 + Math.random() * 5000)}` : `9002${Math.floor(3000 + Math.random() * 6000)}`;
      setCreated({ login, investor: generatePassword(10) });
      setBusy(false);
      go(1);
      toast.success(`${cfg.kind === "live" ? "Live" : "Demo"} account #${login} created`, { description: `${g.name} · ${cfg.mode === "hedging" ? "Hedging" : "Netting"} · 1:${cfg.leverage}` });
    }, 900);
  };

  const server = cfg.kind === "live" ? (g.cent ? "Kalks-Live02" : "Kalks-Live01") : "Kalks-Demo";

  return (
    <div className="pb-16">
      <PageHeader
        title="Open a trading account"
        subtitle="Takes under a minute. MT5-compatible login delivered instantly."
        actions={
          <Link href="/accounts">
            <Button variant="surface">
              <ArrowLeft /> My accounts
            </Button>
          </Link>
        }
      />

      <Reveal>
        <Card className="mb-4 px-5 py-4 sm:px-6">
          <Stepper steps={STEPS} current={step} />
        </Card>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className={cn(step === 4 ? "xl:col-span-12" : "xl:col-span-8")}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={step} initial={{ opacity: 0, x: dir * 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -28 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
              {step === 0 && (
                <Card>
                  <CardHeader title="Choose an account" subtitle="You can hold multiple live and demo accounts at the same time." />
                  <div className="grid grid-cols-1 gap-4 px-4 pb-6 pt-4 sm:grid-cols-2 sm:px-6">
                    <KindCard kind="live" selected={cfg.kind === "live"} onSelect={() => set("kind", "live")} />
                    <KindCard kind="demo" selected={cfg.kind === "demo"} onSelect={() => set("kind", "demo")} />
                  </div>
                </Card>
              )}

              {step === 1 && (
                <Card>
                  <CardHeader title="Pick an account type" subtitle="All types include 250+ instruments, MT5 access and negative balance protection." />
                  <div className="grid grid-cols-1 gap-4 px-4 pb-6 pt-4 sm:grid-cols-2 sm:px-6 2xl:grid-cols-4">
                    {ACCOUNT_GROUPS.map((x) => (
                      <GroupCard key={x.id} g={x} selected={cfg.group === x.id} onSelect={() => pickGroup(x.id)} />
                    ))}
                  </div>
                </Card>
              )}

              {step === 2 && (
                <Card>
                  <CardHeader title="Configure your account" subtitle={`${g.name} · ${cfg.kind === "live" ? "Live" : "Demo"}`} />
                  <div className="space-y-6 px-4 pb-6 pt-5 sm:px-6">
                    <div>
                      <div className="mb-2 text-[12.5px] font-medium text-fg-2">Position mode</div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {(["hedging", "netting"] as const).map((m) => {
                          const disabled = !g.modes.includes(m);
                          const on = cfg.mode === m;
                          return (
                            <button
                              key={m}
                              type="button"
                              disabled={disabled}
                              onClick={() => set("mode", m)}
                              className={cn("k-row flex items-start gap-3 p-4 text-left transition-all", on && "border-ember/50 bg-ember-soft", disabled && "cursor-not-allowed opacity-45", !on && !disabled && "hover:border-[var(--k-border-top)]")}
                            >
                              <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border", on ? "border-ember bg-ember" : "border-line")}>{on && <span className="size-2 rounded-full bg-white" />}</span>
                              <span>
                                <span className="flex items-center gap-2 text-[14px] font-medium">
                                  {m === "hedging" ? "Hedging" : "Netting"}
                                  {disabled && <Chip size="sm">Not on Cent</Chip>}
                                </span>
                                <span className="mt-0.5 block text-[12.5px] text-fg-3">{m === "hedging" ? "Hold multiple buy & sell positions on the same symbol." : "One net position per symbol — opposite orders reduce it."}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
                        Leverage
                        <span className="font-normal text-fg-3">Fixed per account · changeable only with no open positions</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {g.leverage.map((l) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => set("leverage", l)}
                            className={cn(
                              "k-num h-10 min-w-20 rounded-full border px-4 text-[13.5px] font-semibold transition-all",
                              cfg.leverage === l ? "border-ember/60 bg-ember-soft text-ember shadow-[0_0_20px_-6px_rgba(255,90,31,0.7)]" : "border-line bg-surface-2 text-fg-2 hover:text-fg",
                            )}
                          >
                            1:{l.toLocaleString()}
                          </button>
                        ))}
                      </div>
                      {cfg.leverage >= 1000 && (
                        <div className="mt-2 flex items-center gap-2 text-[12px] text-warn">
                          <Info className="size-3.5" /> High leverage magnifies both profits and losses.
                        </div>
                      )}
                    </div>

                    {cfg.kind === "demo" && (
                      <div>
                        <div className="mb-2 text-[12.5px] font-medium text-fg-2">Starting balance</div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {DEMO_RULES.startBalances.map((b) => (
                            <button
                              key={b}
                              type="button"
                              onClick={() => set("demoBalance", b)}
                              className={cn("k-row flex flex-col items-start px-4 py-3 text-left transition-all", cfg.demoBalance === b ? "border-gold/60 bg-gold-soft" : "hover:border-[var(--k-border-top)]")}
                            >
                              <span className={cn("k-num text-[18px] font-semibold", cfg.demoBalance === b ? "text-gold" : "text-fg")}>{g.cent ? `USC ${(b * 100).toLocaleString()}` : `$${b >= 1000 ? `${b / 1000}k` : b}`}</span>
                              <span className="text-[11.5px] text-fg-3">virtual funds</span>
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 text-[12px] text-fg-3">
                          Refill back to this balance up to {DEMO_RULES.refillsPerDay}× per day. Demo accounts expire after {DEMO_RULES.expiryDays} days.
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Nickname" hint="Optional">
                        <Input value={cfg.nickname} maxLength={24} onChange={(e) => set("nickname", e.target.value)} placeholder="e.g. Gold swing" />
                      </Field>
                      <Field label="Account currency">
                        <Input value={g.cent ? "USC — US cents (×100)" : "USD — US Dollar"} readOnly leading={<Wallet />} className="opacity-80" />
                      </Field>
                    </div>

                    <div className="k-row flex items-center gap-4 p-4">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-gold">
                        <Moon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-medium">Swap-free (Islamic) account</div>
                        <div className="text-[12.5px] text-fg-3">No overnight swaps. A fixed admin fee may apply after 5 nights on some instruments.</div>
                      </div>
                      <Toggle checked={cfg.swapFree} onChange={(v) => set("swapFree", v)} label="Swap-free" />
                    </div>
                  </div>
                </Card>
              )}

              {step === 3 && (
                <Card>
                  <CardHeader title="Set a trading password" subtitle="Your master password for MT5 and the Kalks terminal. An investor (read-only) password is generated for you." icon={<ShieldCheck />} />
                  <div className="space-y-5 px-4 pb-6 pt-5 sm:px-6">
                    <Field label="Trading password">
                      <PasswordInput value={cfg.password} onChange={(v) => set("password", v)} generate />
                    </Field>
                    <PasswordStrength password={cfg.password} />
                    <Field label="Confirm password" error={cfg.confirm && cfg.confirm !== cfg.password ? "Passwords don't match" : undefined}>
                      <PasswordInput value={cfg.confirm} onChange={(v) => set("confirm", v)} placeholder="Repeat password" />
                    </Field>
                    <label className="flex cursor-pointer items-start gap-3 text-[13px] text-fg-2">
                      <input type="checkbox" checked={cfg.agree} onChange={(e) => set("agree", e.target.checked)} className="mt-0.5 size-4 accent-[var(--k-ember)]" />
                      <span>
                        I agree to the <a className="text-ember hover:underline" href="#" onClick={(e) => { e.preventDefault(); toast("Client agreement opened"); }}>Client Agreement</a> and{" "}
                        <a className="text-ember hover:underline" href="#" onClick={(e) => { e.preventDefault(); toast("Risk disclosure opened"); }}>Risk Disclosure</a>, and understand that CFDs carry a high risk of losing money.
                      </span>
                    </label>
                  </div>
                </Card>
              )}

              {step === 4 && created && (
                <Card hot className="overflow-hidden">
                  <Starfield density={60} />
                  <div className="relative grid grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-2 lg:items-center">
                    <div className="text-center lg:text-left">
                      <div className="lg:mx-0 lg:flex lg:justify-start">
                        <SuccessCheck />
                      </div>
                      <h2 className="mt-5 text-[26px] font-semibold tracking-tight">Your account is ready</h2>
                      <p className="mt-2 text-[14px] text-fg-2">
                        {cfg.kind === "live" ? "Fund it from your USDT wallet and start trading in seconds." : `Loaded with ${g.cent ? "USC " : "$"}${(cfg.demoBalance * (g.cent ? 100 : 1)).toLocaleString()} in virtual funds. Expires in ${DEMO_RULES.expiryDays} days.`}
                      </p>
                      <div className="mt-3 flex flex-wrap justify-center gap-2 lg:justify-start">
                        <Chip tone={cfg.kind === "live" ? "ember" : "gold"}>{cfg.kind.toUpperCase()}</Chip>
                        <Chip>
                          {g.name} · {cfg.mode === "hedging" ? "Hedging" : "Netting"}
                        </Chip>
                        <Chip>1:{cfg.leverage.toLocaleString()}</Chip>
                        {cfg.swapFree && <Chip tone="info">Swap-free</Chip>}
                      </div>
                      <div className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start">
                        {cfg.kind === "live" ? (
                          <Link href={`/wallet/transfer?to=${created.login}`}>
                            <Button variant="ember" size="lg" shimmer>
                              <Wallet /> Fund account
                            </Button>
                          </Link>
                        ) : (
                          <Link href={`/accounts/${created.login}`}>
                            <Button variant="gold" size="lg">
                              View account
                            </Button>
                          </Link>
                        )}
                        <Link target="_blank" rel="noopener" href={`/trade?account=${created.login}`}>
                          <Button variant="surface" size="lg">
                            <CandlestickChart /> Open terminal
                          </Button>
                        </Link>
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-line bg-surface/80 p-5 backdrop-blur">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="text-[15px] font-medium">MT5 credentials</div>
                        <Chip size="sm" tone="warn">
                          Save these now
                        </Chip>
                      </div>
                      <div className="space-y-3">
                        <CredentialField label="Login" value={created.login} />
                        <CredentialField label="Server" value={server} hint={<span className="inline-flex items-center gap-1"><Server className="size-3" /> GMT+3</span>} />
                        <CredentialField label="Trading password" value={cfg.password} secret hint="Master · full access" />
                        <CredentialField label="Investor password" value={created.investor} secret hint="Read-only" />
                      </div>
                      <p className="mt-4 text-[12px] text-fg-3">We&apos;ve also emailed your login and server. Passwords are never sent by email — change them anytime under Credentials (email OTP required).</p>
                    </div>
                  </div>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>

          {step < 4 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => go(-1)} disabled={step === 0}>
                <ArrowLeft /> Back
              </Button>
              {step < 3 ? (
                <Button variant="ember" size="lg" onClick={() => go(1)}>
                  Continue <ArrowRight />
                </Button>
              ) : (
                <Button variant="ember" size="lg" disabled={!canNext || busy} onClick={create} shimmer>
                  {busy ? "Creating account…" : `Create ${cfg.kind} account`} {!busy && <Check />}
                </Button>
              )}
            </div>
          )}
        </div>

        {step < 4 && (
          <div className="hidden xl:col-span-4 xl:block">
            <div className="sticky top-24">
              <Summary cfg={cfg} step={step} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewAccountPage() {
  return (
    <React.Suspense fallback={null}>
      <Wizard />
    </React.Suspense>
  );
}

