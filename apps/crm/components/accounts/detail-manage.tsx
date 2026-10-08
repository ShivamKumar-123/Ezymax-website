"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, CandlestickChart, Download, Eye, Globe, Info, KeyRound, Lock, Monitor, Moon, Pencil, RefreshCcw, Smartphone, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Dialog, Field, Icon3D, Input, KeyValue, Money, Reveal, Toggle, cn } from "@/components/kit";
import { ACCOUNT_GROUPS, type TradingAccount } from "@ezymex/mock";
import { DEMO_RULES } from "@ezymex/mock/accounts-extra";
import { CredentialField, EmailOtp, PasswordInput, PasswordStrength, isPasswordValid } from "./security";
import { curOf } from "./detail-overview";
import { Trans, useFormat, useT } from "@ezymex/i18n/react";
import { traderHref } from "@/components/account-row";
import { productOf } from "@/components/trading/api";
import { ProductBadge } from "@/components/trading/ui";

/* ------------------------------------------------------------------ */
/* Change password dialog                                              */
/* ------------------------------------------------------------------ */

function ChangePasswordDialog({ a, kind, open, onOpenChange }: { a: TradingAccount; kind: "trading" | "investor"; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT();
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
      title={kind === "trading" ? t("accountDetail.pw.changeTitle.trading") : t("accountDetail.pw.changeTitle.investor")}
      description={
        kind === "trading" ? t("accountDetail.pw.descTradingDemo", { login: a.login }) : t("accountDetail.pw.descInvestorDemo", { login: a.login })
      }
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="ember"
            disabled={!ok || busy}
            onClick={() => {
              setBusy(true);
              setTimeout(() => {
                setBusy(false);
                onOpenChange(false);
                toast.success(kind === "trading" ? t("accountDetail.pw.updated.trading") : t("accountDetail.pw.updated.investor"), { description: `#${a.login} · ${a.server}` });
              }, 700);
            }}
          >
            {busy ? t("accountDetail.pw.updating") : t("accountDetail.pw.update")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t("accountDetail.pw.new")}>
          <PasswordInput value={pw} onChange={setPw} generate />
        </Field>
        <PasswordStrength password={pw} />
        <Field label={t("accountDetail.pw.confirmNew")} error={confirm && confirm !== pw ? t("accountDetail.pw.mismatch") : undefined}>
          <PasswordInput value={confirm} onChange={setConfirm} placeholder={t("accountDetail.pw.repeat")} />
        </Field>
        <EmailOtp code={code} onCode={setCode} purpose={t("accountDetail.pw.otpPurpose")} />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Credentials                                                         */
/* ------------------------------------------------------------------ */

export function CredentialsTab({ a }: { a: TradingAccount }) {
  const t = useT();
  const [dlg, setDlg] = React.useState<"trading" | "investor" | null>(null);
  const archived = a.balance === 0 && a.equity === 0;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Reveal className="xl:col-span-7">
        <Card className="h-full">
          <CardHeader title={t("accountDetail.creds.mt5Title")} subtitle={t("accountDetail.creds.mt5Subtitle")} icon={<KeyRound />} />
          <div className="grid grid-cols-1 gap-4 px-4 pb-6 pt-5 sm:grid-cols-2 sm:px-6">
            <CredentialField label={t("accountDetail.info.login")} value={a.login} />
            <CredentialField label={t("accountDetail.info.server")} value={a.server} hint="GMT+3" />
            <div className="sm:col-span-2">
              <div className="k-row flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
                  <Lock className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[14px] font-medium">
                    {t("accountDetail.pw.trading")} <Chip size="sm">{t("accountDetail.creds.master")}</Chip>
                  </div>
                  <div className="text-[12.5px] text-fg-3">{t("accountDetail.creds.tradingDescDemo")}</div>
                </div>
                <Button size="sm" variant="surface" disabled={archived} onClick={() => setDlg("trading")}>
                  <Pencil /> {t("accountDetail.creds.change")}
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
                    {t("accountDetail.pw.investor")} <Chip size="sm" tone="info">{t("accountDetail.creds.readOnly")}</Chip>
                  </div>
                  <div className="text-[12.5px] text-fg-3">{t("accountDetail.creds.investorDescDemo")}</div>
                </div>
                <Button size="sm" variant="surface" disabled={archived} onClick={() => setDlg("investor")}>
                  <Pencil /> {t("accountDetail.creds.change")}
                </Button>
              </div>
            </div>
            <div className="flex items-start gap-2 text-[12px] text-fg-3 sm:col-span-2">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" />
              {t("accountDetail.creds.securityNoteDemo")}
            </div>
          </div>
        </Card>
      </Reveal>
      <Reveal delay={0.05} className="xl:col-span-5">
        <Card className="h-full">
          <CardHeader title={t("accountDetail.platforms.title")} subtitle={t("accountDetail.platforms.subtitle")} />
          <div className="space-y-2 px-4 pb-6 pt-4 sm:px-6">
            {[
              { icon: <Globe />, name: "Ezymex WebTerminal", sub: t("accountDetail.platforms.webSub"), action: <Link target="_blank" rel="noopener" href={traderHref(a)}><Button size="sm" variant="ember">{t("accountDetail.platforms.launch")}</Button></Link> },
              { icon: <Monitor />, name: "MetaTrader 5 · Windows / macOS", sub: "ezymex5setup · 24.1 MB", action: <Button size="sm" variant="surface" onClick={() => toast.success(t("accountDetail.platforms.downloadStarted"), { description: "ezymex5setup.exe" })}><Download /> {t("accountDetail.platforms.get")}</Button> },
              { icon: <Smartphone />, name: "MetaTrader 5 · iOS / Android", sub: t("accountDetail.platforms.mobileSub", { server: a.server }), action: <Button size="sm" variant="surface" onClick={() => toast(t("accountDetail.platforms.storeLinksSent"))}>{t("accountDetail.platforms.sendLink")}</Button> },
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
              <p className="text-[12px] text-fg-3">{t("accountDetail.platforms.twoFaHint")}</p>
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
  const t = useT();
  const f = useFormat();
  // account types of the account's own product only (an Options account never becomes a CFD account, nor back)
  const options = productOf(a) === "options";
  const g = ACCOUNT_GROUPS.find((x) => x.name === a.group && productOf(x) === productOf(a)) ?? ACCOUNT_GROUPS.find((x) => productOf(x) === productOf(a))!;
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
        {options ? (
          // Options accounts have no leverage to change (option margin ignores it): what the account trades instead
          <Reveal>
            <Card>
              <CardHeader title={t("accounts.product.optionsTitle")} subtitle={t("accounts.product.optionsOnly")} action={<ProductBadge a={a} />} />
              <div className="px-4 pb-6 pt-4 sm:px-6">
                <div className="flex items-start gap-3 rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[13px] text-fg-2">
                  <Info className="mt-0.5 size-4 shrink-0 text-info" />
                  {t("accounts.wizard.optionsLeverage")}
                </div>
                <div className="mt-4 flex justify-end">
                  <Link target="_blank" rel="noopener" href={traderHref(a)}>
                    <Button size="sm" variant="ember">
                      <CandlestickChart /> {t("accounts.row.trade")}
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </Reveal>
        ) : (
          <Reveal>
            <Card>
              <CardHeader title={t("accountDetail.leverage.title")} subtitle={t("accountDetail.leverage.allowed", { group: g.name, list: g.leverage.map((l) => `1:${l}`).join(" · ") })} action={<Chip tone="ember">{t("accountDetail.leverage.current", { value: `1:${savedLev.toLocaleString()}` })}</Chip>} />
              <div className="px-4 pb-6 pt-4 sm:px-6">
                {locked && (
                  <div className="mb-4 flex items-start gap-3 rounded-[14px] border border-warn/25 bg-warn-soft px-4 py-3 text-[13px]">
                    <Lock className="mt-0.5 size-4 shrink-0 text-warn" />
                    <div>
                      <div className="font-medium text-warn">{t("accountDetail.leverage.lockedTitle")}</div>
                      <div className="mt-0.5 text-fg-2">
                        {t("accountDetail.leverage.lockedText", { count: openPositions })}
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
                  <span className="text-[12.5px] text-fg-3"><Trans k="accountDetail.leverage.marginRequired" vars={{ amount: `$${Math.round(108456 / lev).toLocaleString()}` }} tags={{ v: (c) => <span className="k-num text-fg-2">{c}</span> }} /></span>
                  <Button
                    size="sm"
                    variant="ember"
                    disabled={locked || lev === savedLev}
                    onClick={() => {
                      setSavedLev(lev);
                      toast.success(t("accountDetail.leverage.updated"), { description: t("accountDetail.leverage.nowDesc", { login: a.login, value: `1:${lev.toLocaleString()}` }) });
                    }}
                  >
                    {t("common.apply")}
                  </Button>
                </div>
              </div>
            </Card>
          </Reveal>
        )}

        <Reveal delay={0.05}>
          <Card>
            <CardHeader title={t("accountDetail.name.title")} subtitle={t("accountDetail.name.subtitle")} />
            <div className="flex flex-col gap-3 px-4 pb-6 pt-4 sm:flex-row sm:px-6">
              <Input className="flex-1" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder={`${a.group} · ${a.mode}`} leading={<Pencil />} trailing={<span className="k-num text-[11px]">{name.length}/24</span>} />
              <Button
                variant="surface"
                size="lg"
                disabled={name === (a.nickname ?? "")}
                onClick={() => {
                  onRename(name);
                  toast.success(t("accountDetail.name.renamed"), { description: name || t("accountDetail.name.removed") });
                }}
              >
                {t("common.save")}
              </Button>
            </div>
          </Card>
        </Reveal>

        {/* options have no swaps */}
        {!options && (
          <Reveal delay={0.1}>
            <Card>
              <CardHeader title={t("accountDetail.swapFree.title")} subtitle={t("accountDetail.swapFree.subtitle")} />
              <div className="flex items-center gap-4 px-4 pb-6 pt-4 sm:px-6">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-gold">
                  <Moon className="size-4" />
                </span>
                <div className="flex-1 text-[13px] text-fg-2">
                  {a.swapFree ? t("accountDetail.swapFree.isOn") : swapReq ? t("accountDetail.swapFree.requested") : t("accountDetail.swapFree.needsReview")}
                </div>
                <Toggle
                  checked={a.swapFree || swapReq}
                  onChange={(v) => {
                    if (a.swapFree) return toast(t("accountDetail.swapFree.contactSupport"));
                    setSwapReq(v);
                    toast[v ? "success" : "info"](v ? t("accountDetail.swapFree.requestSubmitted") : t("accountDetail.swapFree.requestWithdrawn"));
                  }}
                  label={t("accountDetail.header.swapFree")}
                />
              </div>
            </Card>
          </Reveal>
        )}
      </div>

      <div className="space-y-4 xl:col-span-5">
        {a.type === "demo" && (
          <Reveal>
            <Card hot className="overflow-hidden">
              <div className="relative px-6 pb-6 pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="k-label">{t("accountDetail.demoFunds.title")}</div>
                    <Money value={a.balance} currency={cur} className="mt-2 block text-[28px] font-semibold" />
                  </div>
                  <Icon3D name="hourglass_not_done" size={56} />
                </div>
                <div className="mt-4">
                  <div className="mb-2 text-[11.5px] uppercase tracking-wider text-fg-3">{t("accountDetail.demoFunds.expiresIn")}</div>
                  <div className="flex gap-2">
                    {cd
                      ? [
                          [cd.d, t("accountDetail.countdown.days")],
                          [cd.h, t("accountDetail.countdown.hrs")],
                          [cd.m, t("accountDetail.countdown.min")],
                          [cd.s, t("accountDetail.countdown.sec")],
                        ].map(([v, l]) => (
                          <div key={l as string} className="flex-1 rounded-[14px] border border-line bg-black/25 light:bg-white/70 py-2 text-center">
                            <div className="k-num font-mono text-[22px] font-semibold">{pad(v as number)}</div>
                            <div className="text-[11.5px] text-fg-3">{l}</div>
                          </div>
                        ))
                      : null}
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className="text-[12.5px] text-fg-2">
                    <Trans k="accountDetail.demoFunds.refillsLeft" vars={{ left: refills, total: DEMO_RULES.refillsPerDay }} tags={{ n: (c) => <span className="k-num font-semibold text-fg">{c}</span> }} />
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
                      toast.success(t("accountDetail.demoFunds.refilled"), { description: t("accountDetail.demoFunds.refilledDesc", { login: a.login, amount: `${cur}${a.balance.toLocaleString()}`, left: refills - 1 }) });
                    }}
                  >
                    <RefreshCcw /> {t("accountDetail.header.refill")}
                  </Button>
                </div>
              </div>
            </Card>
          </Reveal>
        )}

        <Reveal delay={0.05}>
          <Card>
            <CardHeader title={t("accountDetail.details.title")} />
            <div className="px-6 pb-4 pt-1">
              <KeyValue
                rows={[
                  [t("accountDetail.info.login"), <span key="l" className="font-mono">{a.login}</span>],
                  [t("accountDetail.info.group"), `${a.group} · ${a.mode === "hedging" ? t("accountDetail.info.hedging") : t("accountDetail.info.netting")}`],
                  [t("common.currency"), a.currency],
                  [t("accountDetail.info.marginCallStopOut"), "50% / 20%"],
                  [t("accountDetail.info.opened"), f.date(a.createdAt, { day: "2-digit", month: "short", year: "numeric" })],
                ]}
              />
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.1}>
          <Card className="border-down/25">
            <CardHeader title={t("accountDetail.archive.title")} subtitle={t("accountDetail.archive.subtitle")} />
            <div className="px-4 pb-6 pt-4 sm:px-6">
              <p className="text-[13px] text-fg-2">
                {a.type === "live" ? t("accountDetail.archive.liveNote") : t("accountDetail.archive.demoNote")}
              </p>
              <Button className="mt-4" variant="down-outline" onClick={() => setArchiveOpen(true)}>
                <Archive /> {t("accountDetail.archive.title")}
              </Button>
            </div>
          </Card>
        </Reveal>
      </div>

      <Dialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={t("accountDetail.archive.confirmTitle", { login: a.login })}
        description={`${a.group} · ${a.mode === "hedging" ? t("accountDetail.info.hedging") : t("accountDetail.info.netting")} · ${a.server}`}
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiveOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="sell"
              disabled={locked}
              onClick={() => {
                setArchiveOpen(false);
                toast.success(t("accountDetail.archive.done"), { description: t("accountDetail.archive.doneDesc", { login: a.login }) });
              }}
            >
              {t("accountDetail.archive.confirm")}
            </Button>
          </>
        }
      >
        {locked ? (
          <div className="flex items-start gap-3 rounded-[14px] border border-warn/25 bg-warn-soft px-4 py-3 text-[13px] text-fg-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
            {t("accountDetail.archive.closeFirst", { count: openPositions })}
          </div>
        ) : (
          <div className="space-y-3 text-[13px] text-fg-2">
            <p>{t("accountDetail.archive.disabledNote")}</p>
            {a.type === "live" && a.balance > 0 && (
              <div className="k-row flex items-center justify-between px-4 py-3">
                <span>{t("accountDetail.archive.remaining")}</span>
                <Link href={`/wallet/transfer?from=${a.login}`} className="font-medium text-ember hover:underline">
                  <Money value={a.balance} currency={cur} countUp={false} /> → {t("accountDetail.archive.moveToWallet")}
                </Link>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
