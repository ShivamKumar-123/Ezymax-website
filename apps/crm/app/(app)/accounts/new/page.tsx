"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, CandlestickChart, Check, Info, Lock, Moon, Server, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Trans, useT } from "@kalks/i18n/react";
import { Button, Card, CardHeader, Chip, Field, Icon3D, Input, KeyValue, PageHeader, Reveal, Starfield, Stepper, Toggle, cn } from "@kalks/ui";
import { ACCOUNT_GROUPS } from "@kalks/mock";
import { DEMO_RULES } from "@kalks/mock/accounts-extra";
import { GroupCard } from "@/components/accounts/group-card";
import { CredentialField, PasswordInput, PasswordStrength, generatePassword, isPasswordValid } from "@/components/accounts/security";
import { IS_DEMO as DEMO_BUILD } from "@kalks/mock/mode";
import { LiveOpenAccount } from "@/components/trading/open-account";

const STEPS = ["accounts.wizard.step.account", "accounts.wizard.step.type", "accounts.wizard.step.configure", "accounts.wizard.step.password", "accounts.wizard.step.done"] as const;
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
  const t = useT();
  const live = kind === "live";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[20px] border p-6 text-start transition-all duration-300",
        selected ? (live ? "k-hot-card border-ember/60 shadow-[0_0_0_4px_rgba(255,90,31,0.12)]" : "border-gold/60 bg-surface shadow-[0_0_0_4px_rgba(233,185,73,0.12)]") : "k-card hover:-translate-y-0.5 hover:border-[var(--k-border-top)]",
      )}
    >
      {selected && live && <Starfield density={36} />}
      <div className="relative flex items-start justify-between">
        <Chip tone={live ? "ember" : "gold"} className="font-semibold tracking-wider">
          {live ? t("accounts.badge.live") : t("accounts.badge.demo")}
        </Chip>
        <span className={cn("grid size-6 place-items-center rounded-full border transition-colors", selected ? (live ? "border-ember bg-ember text-white" : "border-gold bg-gold text-black") : "border-line")}>
          {selected && <Check className="size-3.5" />}
        </span>
      </div>
      <div className="relative mt-4">
        <Icon3D name={live ? "money_bag" : "rocket"} size={96} />
      </div>
      <div className="relative mt-4 text-[22px] font-semibold tracking-tight">{live ? t("accounts.kind.liveTitle") : t("accounts.kind.demoTitle")}</div>
      <p className="relative mt-1 text-[13.5px] text-fg-2">{live ? t("accounts.kind.liveTextMock") : t("accounts.kind.demoTextMock")}</p>
      <ul className="relative mt-4 space-y-2 text-[13px] text-fg-2">
        {(live
          ? [t("accounts.kind.live.mock1"), t("accounts.kind.live.mock2"), t("accounts.kind.live.mock3")]
          : [t("accounts.kind.demo.mockStart"), t("accounts.kind.demo.refill", { count: DEMO_RULES.refillsPerDay }), t("accounts.kind.demo.mockExpires", { days: DEMO_RULES.expiryDays })]
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
  const t = useT();
  const g = ACCOUNT_GROUPS.find((x) => x.id === cfg.group)!;
  return (
    <Card className="overflow-hidden">
      <div className="relative h-28 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={g.photo} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--k-surface)] to-black/20" />
        <div className="absolute bottom-3 start-5 flex items-center gap-2">
          <Chip tone={cfg.kind === "live" ? "ember" : "gold"} className="font-semibold tracking-wider">
            {cfg.kind === "live" ? t("accounts.badge.live") : t("accounts.badge.demo")}
          </Chip>
          <span className="text-[17px] font-semibold text-white">
            {g.name} · {t(cfg.mode === "hedging" ? "accounts.mode.hedging" : "accounts.mode.netting")}
          </span>
        </div>
      </div>
      <div className="px-6 pb-5">
        <KeyValue
          rows={[
            [t("accounts.label.server"), <span key="s" className="font-mono">{cfg.kind === "live" ? (g.cent ? "Kalks-Live02" : "Kalks-Live01") : "Kalks-Demo"}</span>],
            [t("common.currency"), g.cent ? t("accounts.currency.uscCent") : "USD"],
            [t("accounts.label.leverage"), `1:${cfg.leverage.toLocaleString()}`],
            [t("accounts.label.spreadFrom"), t("accounts.unit.pips", { value: g.spreadFrom })],
            [t("accounts.label.commission"), g.commission],
            [t("accounts.label.swapFree"), cfg.swapFree ? t("accounts.summary.yesIslamic") : t("common.no")],
            cfg.kind === "demo" ? [t("accounts.label.startBalance"), `${g.cent ? "USC " : "$"}${(cfg.demoBalance * (g.cent ? 100 : 1)).toLocaleString()}`] : [t("accounts.label.minFirstDeposit"), `$${g.minDeposit}`],
            [t("accounts.label.nickname"), cfg.nickname || <span key="n" className="text-fg-3">—</span>],
          ]}
        />
        <div className="mt-3 flex items-center gap-2 text-[12px] text-fg-3">
          <Lock className="size-3.5" /> {t("accounts.summary.stepOfMock", { step: Math.min(step + 1, 5) })}
        </div>
      </div>
    </Card>
  );
}

function Wizard() {
  const t = useT();
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
      toast.success(t(cfg.kind === "live" ? "accounts.wizard.createdLive" : "accounts.wizard.createdDemo", { login }), { description: `${g.name} · ${t(cfg.mode === "hedging" ? "accounts.mode.hedging" : "accounts.mode.netting")} · 1:${cfg.leverage}` });
    }, 900);
  };

  const server = cfg.kind === "live" ? (g.cent ? "Kalks-Live02" : "Kalks-Live01") : "Kalks-Demo";

  return (
    <div className="pb-16">
      <PageHeader
        title={t("accounts.wizard.title")}
        subtitle={t("accounts.wizard.subtitleMock")}
        actions={
          <Link href="/accounts">
            <Button variant="surface">
              <ArrowLeft className="rtl:-scale-x-100" /> {t("accounts.list.myAccounts")}
            </Button>
          </Link>
        }
      />

      <Reveal>
        <Card className="mb-4 px-5 py-4 sm:px-6">
          <Stepper steps={STEPS.map((k) => t(k))} current={step} />
        </Card>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className={cn(step === 4 ? "xl:col-span-12" : "xl:col-span-8")}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={step} initial={{ opacity: 0, x: dir * 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -28 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
              {step === 0 && (
                <Card>
                  <CardHeader title={t("accounts.wizard.chooseTitle")} subtitle={t("accounts.wizard.chooseSubtitleMock")} />
                  <div className="grid grid-cols-1 gap-4 px-4 pb-6 pt-4 sm:grid-cols-2 sm:px-6">
                    <KindCard kind="live" selected={cfg.kind === "live"} onSelect={() => set("kind", "live")} />
                    <KindCard kind="demo" selected={cfg.kind === "demo"} onSelect={() => set("kind", "demo")} />
                  </div>
                </Card>
              )}

              {step === 1 && (
                <Card>
                  <CardHeader title={t("accounts.wizard.pickTitle")} subtitle={t("accounts.wizard.pickSubtitleMock")} />
                  <div className="grid grid-cols-1 gap-4 px-4 pb-6 pt-4 sm:grid-cols-2 sm:px-6 2xl:grid-cols-4">
                    {ACCOUNT_GROUPS.map((x) => (
                      <GroupCard key={x.id} g={x} selected={cfg.group === x.id} onSelect={() => pickGroup(x.id)} />
                    ))}
                  </div>
                </Card>
              )}

              {step === 2 && (
                <Card>
                  <CardHeader title={t("accounts.wizard.configureTitle")} subtitle={`${g.name} · ${cfg.kind === "live" ? t("common.live") : t("common.demo")}`} />
                  <div className="space-y-6 px-4 pb-6 pt-5 sm:px-6">
                    <div>
                      <div className="mb-2 text-[12.5px] font-medium text-fg-2">{t("accounts.label.positionMode")}</div>
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
                              className={cn("k-row flex items-start gap-3 p-4 text-start transition-all", on && "border-ember/50 bg-ember-soft", disabled && "cursor-not-allowed opacity-45", !on && !disabled && "hover:border-[var(--k-border-top)]")}
                            >
                              <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border", on ? "border-ember bg-ember" : "border-line")}>{on && <span className="size-2 rounded-full bg-white" />}</span>
                              <span>
                                <span className="flex items-center gap-2 text-[14px] font-medium">
                                  {t(m === "hedging" ? "accounts.mode.hedging" : "accounts.mode.netting")}
                                  {disabled && <Chip size="sm">{t("accounts.wizard.notOnCent")}</Chip>}
                                </span>
                                <span className="mt-0.5 block text-[12.5px] text-fg-3">{m === "hedging" ? t("accounts.mode.hedgingDesc") : t("accounts.mode.nettingDesc")}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
                        {t("accounts.label.leverage")}
                        <span className="font-normal text-fg-3">{t("accounts.wizard.leverageHintMock")}</span>
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
                          <Info className="size-3.5" /> {t("accounts.wizard.highLeverage")}
                        </div>
                      )}
                    </div>

                    {cfg.kind === "demo" && (
                      <div>
                        <div className="mb-2 text-[12.5px] font-medium text-fg-2">{t("accounts.wizard.startingBalance")}</div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {DEMO_RULES.startBalances.map((b) => (
                            <button
                              key={b}
                              type="button"
                              onClick={() => set("demoBalance", b)}
                              className={cn("k-row flex flex-col items-start px-4 py-3 text-start transition-all", cfg.demoBalance === b ? "border-gold/60 bg-gold-soft" : "hover:border-[var(--k-border-top)]")}
                            >
                              <span className={cn("k-num text-[18px] font-semibold", cfg.demoBalance === b ? "text-gold" : "text-fg")}>{g.cent ? `USC ${(b * 100).toLocaleString()}` : `$${b >= 1000 ? `${b / 1000}k` : b}`}</span>
                              <span className="text-[11.5px] text-fg-3">{t("accounts.wizard.virtualFunds")}</span>
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 text-[12px] text-fg-3">
                          {t("accounts.wizard.refillNoteMock", { count: DEMO_RULES.refillsPerDay, days: DEMO_RULES.expiryDays })}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label={t("accounts.label.nickname")} hint={t("common.optional")}>
                        <Input value={cfg.nickname} maxLength={24} onChange={(e) => set("nickname", e.target.value)} placeholder={t("accounts.wizard.nicknamePlaceholder")} />
                      </Field>
                      <Field label={t("accounts.label.accountCurrency")}>
                        <Input value={g.cent ? t("accounts.currency.uscShort") : t("accounts.currency.usdLong")} readOnly leading={<Wallet />} className="opacity-80" />
                      </Field>
                    </div>

                    <div className="k-row flex items-center gap-4 p-4">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-gold">
                        <Moon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-medium">{t("accounts.wizard.swapFreeTitle")}</div>
                        <div className="text-[12.5px] text-fg-3">{t("accounts.wizard.swapFreeText")}</div>
                      </div>
                      <Toggle checked={cfg.swapFree} onChange={(v) => set("swapFree", v)} label={t("accounts.label.swapFree")} />
                    </div>
                  </div>
                </Card>
              )}

              {step === 3 && (
                <Card>
                  <CardHeader title={t("accounts.wizard.setPasswordTitle")} subtitle={t("accounts.wizard.setPasswordSubtitle")} icon={<ShieldCheck />} />
                  <div className="space-y-5 px-4 pb-6 pt-5 sm:px-6">
                    <Field label={t("accounts.label.tradingPassword")}>
                      <PasswordInput value={cfg.password} onChange={(v) => set("password", v)} generate />
                    </Field>
                    <PasswordStrength password={cfg.password} />
                    <Field label={t("accounts.label.confirmPassword")} error={cfg.confirm && cfg.confirm !== cfg.password ? t("accounts.wizard.passwordsMismatch") : undefined}>
                      <PasswordInput value={cfg.confirm} onChange={(v) => set("confirm", v)} placeholder={t("accounts.wizard.repeatPassword")} />
                    </Field>
                    <label className="flex cursor-pointer items-start gap-3 text-[13px] text-fg-2">
                      <input type="checkbox" checked={cfg.agree} onChange={(e) => set("agree", e.target.checked)} className="mt-0.5 size-4 accent-[var(--k-ember)]" />
                      <span>
                        <Trans
                          k="accounts.wizard.agreeMock"
                          tags={{
                            client: (c) => <a className="text-ember hover:underline" href="#" onClick={(e) => { e.preventDefault(); toast(t("accounts.wizard.clientAgreementOpened")); }}>{c}</a>,
                            risk: (c) => <a className="text-ember hover:underline" href="#" onClick={(e) => { e.preventDefault(); toast(t("accounts.wizard.riskDisclosureOpened")); }}>{c}</a>,
                          }}
                        />
                      </span>
                    </label>
                  </div>
                </Card>
              )}

              {step === 4 && created && (
                <Card hot className="overflow-hidden">
                  <Starfield density={60} />
                  <div className="relative grid grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-2 lg:items-center">
                    <div className="text-center lg:text-start">
                      <div className="lg:mx-0 lg:flex lg:justify-start">
                        <SuccessCheck />
                      </div>
                      <h2 className="mt-5 text-[26px] font-semibold tracking-tight">{t("accounts.created.title")}</h2>
                      <p className="mt-2 text-[14px] text-fg-2">
                        {cfg.kind === "live" ? t("accounts.created.liveTextMock") : t("accounts.created.demoTextMock", { amount: `${g.cent ? "USC " : "$"}${(cfg.demoBalance * (g.cent ? 100 : 1)).toLocaleString()}`, days: DEMO_RULES.expiryDays })}
                      </p>
                      <div className="mt-3 flex flex-wrap justify-center gap-2 lg:justify-start">
                        <Chip tone={cfg.kind === "live" ? "ember" : "gold"}>{cfg.kind === "live" ? t("accounts.badge.live") : t("accounts.badge.demo")}</Chip>
                        <Chip>
                          {g.name} · {t(cfg.mode === "hedging" ? "accounts.mode.hedging" : "accounts.mode.netting")}
                        </Chip>
                        <Chip>1:{cfg.leverage.toLocaleString()}</Chip>
                        {cfg.swapFree && <Chip tone="info">{t("accounts.label.swapFree")}</Chip>}
                      </div>
                      <div className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start">
                        {cfg.kind === "live" ? (
                          <Link href={`/wallet/transfer?to=${created.login}`}>
                            <Button variant="ember" size="lg" shimmer>
                              <Wallet /> {t("accounts.fund.button")}
                            </Button>
                          </Link>
                        ) : (
                          <Link href={`/accounts/${created.login}`}>
                            <Button variant="gold" size="lg">
                              {t("accounts.created.viewAccount")}
                            </Button>
                          </Link>
                        )}
                        <Link target="_blank" rel="noopener" href={`/trade?account=${created.login}`}>
                          <Button variant="surface" size="lg">
                            <CandlestickChart /> {t("accounts.created.openTerminal")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-line bg-surface/80 p-5 backdrop-blur">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="text-[15px] font-medium">{t("accounts.created.mt5Credentials")}</div>
                        <Chip size="sm" tone="warn">
                          {t("accounts.created.saveNow")}
                        </Chip>
                      </div>
                      <div className="space-y-3">
                        <CredentialField label={t("accounts.label.login")} value={created.login} />
                        <CredentialField label={t("accounts.label.server")} value={server} hint={<span className="inline-flex items-center gap-1"><Server className="size-3" /> GMT+3</span>} />
                        <CredentialField label={t("accounts.label.tradingPassword")} value={cfg.password} secret hint={t("accounts.hint.masterFull")} />
                        <CredentialField label={t("accounts.label.investorPassword")} value={created.investor} secret hint={t("accounts.hint.readOnly")} />
                      </div>
                      <p className="mt-4 text-[12px] text-fg-3">{t("accounts.created.emailNote")}</p>
                    </div>
                  </div>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>

          {step < 4 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => go(-1)} disabled={step === 0}>
                <ArrowLeft className="rtl:-scale-x-100" /> {t("common.back")}
              </Button>
              {step < 3 ? (
                <Button variant="ember" size="lg" onClick={() => go(1)}>
                  {t("common.continue")} <ArrowRight className="rtl:-scale-x-100" />
                </Button>
              ) : (
                <Button variant="ember" size="lg" disabled={!canNext || busy} onClick={create} shimmer>
                  {busy ? t("accounts.wizard.creating") : cfg.kind === "live" ? t("accounts.wizard.createLive") : t("accounts.wizard.createDemo")} {!busy && <Check />}
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

function DemoNewAccountPage() {
  return (
    <React.Suspense fallback={null}>
      <Wizard />
    </React.Suspense>
  );
}

/** Live builds: real accounts from the trading engine (via /api/trading). Demo builds: mock data. */
export default function NewAccountPage() {
  return DEMO_BUILD ? <DemoNewAccountPage /> : <LiveOpenAccount />;
}
