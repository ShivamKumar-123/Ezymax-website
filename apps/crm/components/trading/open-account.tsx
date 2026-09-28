"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Copy, Info, KeyRound, Lock, RotateCw, TriangleAlert, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, EmptyState, Field, Icon3D, Input, KeyValue, PageHeader, Reveal, Skeleton, Stepper, Toggle, cn } from "@kalks/ui";
import { PasswordInput } from "@/components/accounts/security";
import { ApiError, modeLabel, serverOf, tradingApi, useAccounts, useGroups, type AccountKind, type EngineAccount, type EngineGroup, type OpenResult } from "./api";
import { EngineGroupCard, commissionText, groupPhoto, spreadType } from "./group-card";
import { FundButton, PasswordRules, SecretField, TradeButton, livePasswordOk } from "./ui";

const STEPS = ["Account", "Type", "Configure", "Confirm", "Done"];
const DEMO_BALANCES = [1000, 5000, 10000, 25000, 50000, 100000];

interface Cfg {
  kind: AccountKind;
  group: string;
  leverage: number;
  nickname: string;
  demoBalance: number;
  ownPassword: boolean;
  password: string;
  confirm: string;
  agree: boolean;
}

const offers = (g: EngineGroup, kind: AccountKind) => g.enabled && (g.accountTypes === "both" || g.accountTypes === kind);
const usedIn = (accounts: EngineAccount[], g: EngineGroup, kind: AccountKind) => accounts.filter((a) => a.group === g.code && a.type === kind).length;
const money = (v: number, cent: boolean) => (cent ? `USC ${(v * 100).toLocaleString("en-US")}` : `$${v.toLocaleString("en-US")}`);

function KindCard({ kind, selected, onSelect, demoGroup }: { kind: AccountKind; selected: boolean; onSelect: () => void; demoGroup?: EngineGroup }) {
  const live = kind === "live";
  const points = live
    ? ["Real execution on Kalks-Live", "Starts at a zero balance; funded from your wallet", "Login and passwords issued instantly"]
    : [
        `Virtual funds (default ${demoGroup ? `$${demoGroup.demoInitialBalance.toLocaleString("en-US")}` : "$10,000"})`,
        `Refill up to ${demoGroup?.demoRefillsPerDay ?? 3}× per day`,
        `Expires after ${demoGroup?.demoExpiryDays ?? 10} days without a terminal login`,
      ];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-[20px] border p-6 text-left transition-colors duration-200",
        selected ? (live ? "border-ember/60 bg-surface shadow-[0_0_0_4px_rgba(255,90,31,0.12)]" : "border-gold/60 bg-surface shadow-[0_0_0_4px_rgba(233,185,73,0.12)]") : "k-card hover:border-[var(--k-border-top)]",
      )}
    >
      <div className="flex items-start justify-between">
        <Chip tone={live ? "ember" : "gold"} className="font-semibold tracking-wider">
          {live ? "LIVE" : "DEMO"}
        </Chip>
        <span className={cn("grid size-6 place-items-center rounded-full border transition-colors", selected ? (live ? "border-ember bg-ember text-white" : "border-gold bg-gold text-black") : "border-line")}>
          {selected && <Check className="size-3.5" />}
        </span>
      </div>
      <div className="mt-4">
        <Icon3D name={live ? "money_bag" : "rocket"} size={64} />
      </div>
      <div className="mt-4 text-[22px] font-semibold tracking-tight">{live ? "Live account" : "Demo account"}</div>
      <p className="mt-1 text-[13.5px] text-fg-2">{live ? "Trade real markets with real money." : "Practise risk-free on real-time prices."}</p>
      <ul className="mt-4 space-y-2 text-[13px] text-fg-2">
        {points.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <Check className={cn("size-3.5 shrink-0", live ? "text-ember" : "text-gold")} /> {f}
          </li>
        ))}
      </ul>
    </button>
  );
}

function Summary({ cfg, g, step }: { cfg: Cfg; g: EngineGroup; step: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative h-24 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={groupPhoto(g)} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--k-surface)] to-black/20" />
        <div className="absolute bottom-3 left-5 flex items-center gap-2">
          <Chip tone={cfg.kind === "live" ? "ember" : "gold"} className="font-semibold tracking-wider">
            {cfg.kind.toUpperCase()}
          </Chip>
          <span className="text-[17px] font-semibold text-white">
            {g.name} · {modeLabel(g.mode)}
          </span>
        </div>
      </div>
      <div className="px-6 pb-5">
        <KeyValue
          rows={[
            ["Server", <span key="s" className="font-mono">{serverOf({ type: cfg.kind })}</span>],
            ["Currency", g.cent ? "USC (US cents)" : "USD"],
            ["Position mode", modeLabel(g.mode)],
            ["Leverage", `1:${cfg.leverage.toLocaleString("en-US")}`],
            ["Pricing", spreadType(g)],
            ["Commission", commissionText(g)],
            ["Margin call / stop out", `${g.marginCallPct}% / ${g.stopOutPct}%`],
            cfg.kind === "demo" ? ["Start balance", money(cfg.demoBalance, g.cent)] : ["Min. first deposit", g.minDeposit > 0 ? `$${g.minDeposit.toLocaleString("en-US")}` : "None"],
            ["Nickname", cfg.nickname || <span key="n" className="text-fg-3">—</span>],
          ]}
        />
        <div className="mt-3 flex items-center gap-2 text-[12px] text-fg-3">
          <Lock className="size-3.5 shrink-0" /> Step {Math.min(step + 1, 5)} of 5 · after opening only the leverage can be changed
        </div>
      </div>
    </Card>
  );
}

function Created({ res, cfg, g }: { res: OpenResult; cfg: Cfg; g: EngineGroup }) {
  const a = res.account;
  const c = res.credentials;
  const login = String(c.login);
  const server = serverOf(a);
  const copyAll = () => {
    const text = [`Login: ${login}`, `Server: ${server}`, c.password ? `Trading password: ${c.password}` : null, c.investorPassword ? `Investor password: ${c.investorPassword}` : null].filter(Boolean).join("\n");
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Credentials copied", { description: "Store them in a password manager." }),
      () => toast.error("Couldn't copy, please copy each field instead"),
    );
  };
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="grid size-14 place-items-center rounded-full border border-up/30 bg-up-soft text-up">
            <Check className="size-7" />
          </span>
          <h2 className="mt-5 text-[26px] font-semibold tracking-tight">Your account is ready</h2>
          <p className="mt-2 text-[14px] text-fg-2">
            {a.type === "live"
              ? "It starts at a zero balance. Deposits open with the Kalks wallet; meanwhile you can log in to Kalks Trader with these credentials."
              : `Loaded with ${a.cent ? "USC " : "$"}${a.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })} in virtual funds.${a.demo ? ` Expires after ${a.demo.expiryDays} days without a terminal login.` : ""}`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone={a.type === "live" ? "ember" : "gold"}>{a.type.toUpperCase()}</Chip>
            <Chip>
              {g.name} · {modeLabel(a.mode)}
            </Chip>
            <Chip>1:{a.leverage.toLocaleString("en-US")}</Chip>
            {a.cent && <Chip tone="gold">USC</Chip>}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <TradeButton a={a} size="lg" label="Open in Kalks Trader" />
            {a.type === "live" && <FundButton a={a} size="lg" />}
            <Link href={`/accounts/${a.login}`}>
              <Button variant="surface" size="lg">
                View account
              </Button>
            </Link>
          </div>
        </div>
        <div className="rounded-[20px] border border-line bg-surface-2/60 p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[15px] font-medium">
              <KeyRound className="size-4 text-fg-3" /> Login credentials
            </div>
            <Button size="xs" variant="surface" onClick={copyAll}>
              <Copy /> Copy all
            </Button>
          </div>
          <div className="space-y-3">
            <SecretField label="Login" value={login} />
            <SecretField label="Server" value={server} hint="GMT+3 / GMT+2" />
            {c.password && <SecretField label="Trading password" value={c.password} secret hint="Full access" />}
            {c.investorPassword && <SecretField label="Investor password" value={c.investorPassword} secret hint="Read-only" />}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-[14px] border border-warn/25 bg-warn-soft px-3.5 py-3 text-[12.5px] text-fg-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
            <span>
              These passwords are shown <b className="text-fg">only once</b> and are not stored by the Client Area. Save them now; you can set new ones anytime under the account&apos;s Credentials tab.
            </span>
          </div>
          {cfg.ownPassword && <p className="mt-3 text-[12px] text-fg-3">The trading password is the one you chose. The investor password was generated for you.</p>}
        </div>
      </div>
    </Card>
  );
}

function Wizard() {
  const sp = useSearchParams();
  const groupsQ = useGroups();
  const accountsQ = useAccounts(0);
  const groups = React.useMemo(() => groupsQ.data?.groups ?? [], [groupsQ.data]);
  const accounts = accountsQ.data?.accounts ?? [];

  const [step, setStep] = React.useState(0);
  const [dir, setDir] = React.useState(1);
  const [cfg, setCfg] = React.useState<Cfg>({
    kind: sp.get("type") === "demo" ? "demo" : "live",
    group: sp.get("group") ?? "",
    leverage: 0,
    nickname: "",
    demoBalance: 10000,
    ownPassword: false,
    password: "",
    confirm: "",
    agree: false,
  });
  const [busy, setBusy] = React.useState(false);
  const [created, setCreated] = React.useState<OpenResult | null>(null);
  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const available = groups.filter((g) => offers(g, cfg.kind));
  const g = groups.find((x) => x.code === cfg.group && offers(x, cfg.kind)) ?? available[0];

  // once groups load: honour ?group= (jump to Configure), otherwise preselect the first group
  const [booted, setBooted] = React.useState(false);
  React.useEffect(() => {
    if (booted || !groups.length) return;
    setBooted(true);
    const want = groups.find((x) => x.code === sp.get("group"));
    const pick = want && offers(want, cfg.kind) ? want : groups.find((x) => offers(x, cfg.kind));
    if (!pick) return;
    setCfg((c) => ({ ...c, group: pick.code, leverage: pick.defaultLeverage, demoBalance: pick.demoInitialBalance }));
    if (want && want.code === pick.code) setStep(2);
  }, [booted, groups, sp, cfg.kind]);

  const pickGroup = (x: EngineGroup) =>
    setCfg((c) => ({
      ...c,
      group: x.code,
      leverage: x.leverages.includes(c.leverage) ? c.leverage : x.defaultLeverage,
      demoBalance: c.demoBalance || x.demoInitialBalance,
    }));

  // keep the chosen group valid for the chosen account kind
  React.useEffect(() => {
    if (booted && g && g.code !== cfg.group) pickGroup(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, g?.code, cfg.group]);

  const full = g ? usedIn(accounts, g, cfg.kind) >= g.maxAccountsPerUser : false;
  const pwOk = !cfg.ownPassword || (livePasswordOk(cfg.password) && cfg.password === cfg.confirm);
  const canNext = step === 1 ? !!g && !full : step === 2 ? !!g && g.leverages.includes(cfg.leverage) && pwOk : step === 3 ? cfg.agree && pwOk : true;

  const go = (d: number) => {
    setDir(d);
    setStep((s) => Math.max(0, Math.min(4, s + d)));
  };

  const create = async () => {
    if (!g) return;
    setBusy(true);
    try {
      const res = await tradingApi<OpenResult>("accounts", {
        body: {
          type: cfg.kind,
          group: g.code,
          leverage: cfg.leverage,
          name: cfg.nickname.trim() || undefined,
          password: cfg.ownPassword ? cfg.password : undefined,
          initialBalance: cfg.kind === "demo" ? cfg.demoBalance : undefined,
        },
      });
      setCreated(res);
      setCfg((c) => ({ ...c, password: "", confirm: "" }));
      go(1);
      toast.success(`${cfg.kind === "live" ? "Live" : "Demo"} account #${res.credentials.login} opened`, { description: `${g.name} · ${modeLabel(g.mode)} · 1:${cfg.leverage}` });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong. Please try again.";
      toast.error("Couldn't open the account", { description: msg });
      if (e instanceof ApiError && (e.field === "password" || e.field === "investorPassword")) go(-1);
    } finally {
      setBusy(false);
    }
  };

  if (groupsQ.error && !groupsQ.data)
    return (
      <div className="pb-16">
        <PageHeader title="Open a trading account" />
        <Card>
          <EmptyState
            illustration="satellite_antenna"
            title="Account opening is unavailable"
            text="We couldn't reach the trading service. Please try again in a moment."
            action={
              <Button variant="surface" onClick={groupsQ.reload}>
                <RotateCw /> Try again
              </Button>
            }
          />
        </Card>
      </div>
    );

  const demoRef = groups.find((x) => offers(x, "demo"));
  const balances = g ? [...new Set([...DEMO_BALANCES, g.demoInitialBalance])].sort((x, y) => x - y) : DEMO_BALANCES;

  return (
    <div className="pb-16">
      <PageHeader
        title="Open a trading account"
        subtitle="Takes under a minute. Your login and passwords are issued instantly."
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

      {!groupsQ.data ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Skeleton className="h-[420px] rounded-[20px] xl:col-span-8" />
          <Skeleton className="hidden h-[420px] rounded-[20px] xl:col-span-4 xl:block" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className={cn(step === 4 ? "xl:col-span-12" : "xl:col-span-8")}>
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div key={step} initial={{ opacity: 0, x: dir * 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -20 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                {step === 0 && (
                  <Card>
                    <CardHeader title="Choose an account" subtitle="You can hold live and demo accounts at the same time." />
                    <div className="grid grid-cols-1 gap-4 px-4 pb-6 pt-4 sm:grid-cols-2 sm:px-6">
                      <KindCard kind="live" selected={cfg.kind === "live"} onSelect={() => set("kind", "live")} />
                      <KindCard kind="demo" selected={cfg.kind === "demo"} onSelect={() => set("kind", "demo")} demoGroup={demoRef} />
                    </div>
                  </Card>
                )}

                {step === 1 && (
                  <Card>
                    <CardHeader title="Pick an account type" subtitle={`${available.length} types available for ${cfg.kind} accounts`} />
                    <div className="grid grid-cols-1 gap-4 px-4 pb-6 pt-4 sm:grid-cols-2 sm:px-6 2xl:grid-cols-3">
                      {available.map((x) => (
                        <EngineGroupCard key={x.code} g={x} kind={cfg.kind} used={usedIn(accounts, x, cfg.kind)} selected={g?.code === x.code} onSelect={() => pickGroup(x)} />
                      ))}
                    </div>
                  </Card>
                )}

                {step === 2 && g && (
                  <Card>
                    <CardHeader title="Configure your account" subtitle={`${g.name} · ${modeLabel(g.mode)} · ${cfg.kind === "live" ? "Live" : "Demo"}`} />
                    <div className="space-y-6 px-4 pb-6 pt-5 sm:px-6">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[12.5px] font-medium text-fg-2">
                          Leverage
                          <span className="font-normal text-fg-3">Changeable later, only with no open positions</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {g.leverages.map((l) => (
                            <button
                              key={l}
                              type="button"
                              onClick={() => set("leverage", l)}
                              aria-pressed={cfg.leverage === l}
                              className={cn(
                                "k-num h-10 min-w-20 rounded-full border px-4 text-[13.5px] font-semibold transition-colors",
                                cfg.leverage === l ? "border-ember/60 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2 hover:text-fg",
                              )}
                            >
                              1:{l.toLocaleString("en-US")}
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
                            {balances.map((b) => (
                              <button
                                key={b}
                                type="button"
                                onClick={() => set("demoBalance", b)}
                                aria-pressed={cfg.demoBalance === b}
                                className={cn("k-row flex flex-col items-start px-4 py-3 text-left transition-colors", cfg.demoBalance === b ? "border-gold/60 bg-gold-soft" : "hover:border-[var(--k-border-top)]")}
                              >
                                <span className={cn("k-num text-[17px] font-semibold", cfg.demoBalance === b ? "text-gold" : "text-fg")}>{money(b, g.cent)}</span>
                                <span className="text-[11.5px] text-fg-3">virtual funds</span>
                              </button>
                            ))}
                          </div>
                          <div className="mt-2 text-[12px] text-fg-3">
                            Refill back to this balance up to {g.demoRefillsPerDay}× per day. The account expires after {g.demoExpiryDays} days without a terminal login.
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Nickname" hint="Optional, only visible to you">
                          <Input value={cfg.nickname} maxLength={32} onChange={(e) => set("nickname", e.target.value)} placeholder="e.g. Gold swing" />
                        </Field>
                        <Field label="Account currency">
                          <Input value={g.cent ? "USC — US cents (USD × 100)" : "USD — US Dollar"} readOnly leading={<Wallet />} className="opacity-80" />
                        </Field>
                      </div>

                      <div className="k-row p-4">
                        <div className="flex items-center gap-4">
                          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg-2">
                            <KeyRound className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-medium">Choose my own trading password</div>
                            <div className="text-[12.5px] text-fg-3">Off: we generate strong trading and investor passwords and show them once.</div>
                          </div>
                          <Toggle checked={cfg.ownPassword} onChange={(v) => set("ownPassword", v)} label="Own password" />
                        </div>
                        {cfg.ownPassword && (
                          <div className="mt-4 space-y-3">
                            <Field label="Trading password">
                              <PasswordInput value={cfg.password} onChange={(v) => set("password", v)} generate />
                            </Field>
                            <PasswordRules password={cfg.password} />
                            <Field label="Confirm password" error={cfg.confirm && cfg.confirm !== cfg.password ? "Passwords don't match" : undefined}>
                              <PasswordInput value={cfg.confirm} onChange={(v) => set("confirm", v)} placeholder="Repeat password" />
                            </Field>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )}

                {step === 3 && g && (
                  <Card>
                    <CardHeader title="Review and confirm" subtitle="Check the details, then open the account." />
                    <div className="space-y-5 px-4 pb-6 pt-4 sm:px-6">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          ["Account", cfg.kind === "live" ? "Live" : "Demo"],
                          ["Type", `${g.name}`],
                          ["Leverage", `1:${cfg.leverage.toLocaleString("en-US")}`],
                          ["Start balance", cfg.kind === "demo" ? money(cfg.demoBalance, g.cent) : g.cent ? "USC 0.00" : "$0.00"],
                        ].map(([k, v]) => (
                          <div key={k} className="k-row px-4 py-3">
                            <div className="text-[11px] uppercase tracking-wider text-fg-3">{k}</div>
                            <div className="k-num mt-1 truncate text-[15px] font-semibold">{v}</div>
                          </div>
                        ))}
                      </div>
                      <ul className="space-y-1.5 text-[13px] text-fg-2">
                        <li className="flex items-start gap-2">
                          <Check className="mt-0.5 size-3.5 shrink-0 text-up" /> {cfg.ownPassword ? "Your trading password is set; an investor (read-only) password is generated." : "Trading and investor passwords are generated and shown once on the next screen."}
                        </li>
                        {cfg.kind === "live" && (
                          <li className="flex items-start gap-2">
                            <Check className="mt-0.5 size-3.5 shrink-0 text-up" /> The account opens at a zero balance. {g.minDeposit > 0 ? `A first deposit of at least $${g.minDeposit.toLocaleString("en-US")} applies once wallet funding opens.` : ""}
                          </li>
                        )}
                        <li className="flex items-start gap-2">
                          <Check className="mt-0.5 size-3.5 shrink-0 text-up" /> Position mode ({modeLabel(g.mode)}) and currency ({g.cent ? "USC" : "USD"}) can&apos;t be changed after opening.
                        </li>
                      </ul>
                      <label className="flex cursor-pointer items-start gap-3 text-[13px] text-fg-2">
                        <input type="checkbox" checked={cfg.agree} onChange={(e) => set("agree", e.target.checked)} className="mt-0.5 size-4 accent-[var(--k-ember)]" />
                        <span>
                          {cfg.kind === "live"
                            ? "I understand that CFDs are complex instruments and carry a high risk of losing money rapidly due to leverage."
                            : "I understand that demo results use virtual funds and don't guarantee live results."}
                        </span>
                      </label>
                    </div>
                  </Card>
                )}

                {step === 4 && created && g && <Created res={created} cfg={cfg} g={g} />}
              </motion.div>
            </AnimatePresence>

            {step < 4 && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => go(-1)} disabled={step === 0 || busy}>
                  <ArrowLeft /> Back
                </Button>
                {step < 3 ? (
                  <Button variant="ember" size="lg" onClick={() => go(1)} disabled={!canNext}>
                    Continue <ArrowRight />
                  </Button>
                ) : (
                  <Button variant="ember" size="lg" disabled={!canNext || busy} onClick={create}>
                    {busy ? "Opening account…" : `Open ${cfg.kind} account`} {!busy && <Check />}
                  </Button>
                )}
              </div>
            )}
          </div>

          {step < 4 && g && (
            <div className="hidden xl:col-span-4 xl:block">
              <div className="sticky top-24">
                <Summary cfg={cfg} g={g} step={step} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LiveOpenAccount() {
  return (
    <React.Suspense fallback={null}>
      <Wizard />
    </React.Suspense>
  );
}
