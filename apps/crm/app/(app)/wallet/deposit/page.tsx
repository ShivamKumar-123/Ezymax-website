"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Blocks, Check, ChevronDown, Clock, Copy, ExternalLink, Radar, Share2, ShieldAlert, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, CoinIcon, PageHeader, Reveal, Starfield, cn, formatNumber, shortHash } from "@kalks/ui";
import { Trans, useT } from "@kalks/i18n/react";
import { WALLET } from "@kalks/mock";
import { DEPOSIT_FAQ, DEPOSIT_NETWORKS, INCOMING_DEPOSIT } from "@kalks/mock/wallet-extra";
import { AddressBox, AddressQr, tronscan } from "@/components/wallet/wallet-ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveDepositPage } from "@/components/wallet-live/deposit-page";

const CHAIN: Record<string, string> = { TRC20: "trx", ERC20: "eth", BEP20: "bnb" };

function NetworkSelector() {
  const t = useT();
  return (
    <Card>
      <CardHeader title={t("wallet.demo.assetNetwork")} subtitle={t("wallet.demo.chooseSending")} />
      <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
        {DEPOSIT_NETWORKS.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => (n.active ? toast(t("wallet.demo.selected")) : toast(t("wallet.demo.comingSoonAsset", { asset: n.asset, network: n.network }), { description: t("wallet.demo.notifyLive") }))}
            className={cn(
              "k-row flex w-full items-center gap-3 px-4 py-3 text-start transition-all",
              n.active ? "border-ember/50 bg-ember-soft shadow-[0_0_24px_-12px_rgba(255,90,31,0.8)]" : "opacity-60 hover:opacity-90",
            )}
          >
            <span className="relative">
              <CoinIcon coin={n.asset === "USDT" ? "usdt" : n.icon} size={32} />
              {CHAIN[n.short] && <CoinIcon coin={CHAIN[n.short]!} size={15} className="absolute -bottom-0.5 -end-1 ring-2 ring-surface-2" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[14px] font-medium">
                {n.asset}
                <span className="rounded-md bg-surface-3 px-1.5 py-px text-[10.5px] font-medium text-fg-2">{n.short}</span>
              </div>
              <div className="truncate text-[12px] text-fg-3">{n.network}</div>
            </div>
            {n.active ? (
              <span className="grid size-6 place-items-center rounded-full bg-ember text-white">
                <Check className="size-3.5" />
              </span>
            ) : (
              <Chip size="sm">{t("common.comingSoon")}</Chip>
            )}
          </button>
        ))}
      </div>
    </Card>
  );
}

function HowItWorks() {
  const tt = useT();
  const steps = [
    { icon: <Copy />, t: tt("wallet.demo.how1Title"), d: tt("wallet.demo.how1Text") },
    { icon: <Radar />, t: tt("wallet.demo.how2Title"), d: tt("wallet.demo.how2Text") },
    { icon: <Blocks />, t: tt("wallet.demo.how3Title"), d: tt("wallet.demo.how3Text") },
    { icon: <Zap />, t: tt("wallet.demo.how4Title"), d: tt("wallet.demo.how4Text") },
  ];
  return (
    <Card>
      <CardHeader title={tt("wallet.howDepositsWork")} subtitle={tt("wallet.demo.howSubtitle")} />
      <ol className="px-6 pb-6 pt-5">
        {steps.map((s, i) => (
          <li key={s.t} className="relative flex gap-4 pb-5 last:pb-0">
            {i < steps.length - 1 && <span className="absolute start-[17px] top-10 h-[calc(100%-32px)] w-px bg-gradient-to-b from-ember/50 to-line" />}
            <span className="grid size-9 shrink-0 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember [&_svg]:size-4">{s.icon}</span>
            <div>
              <div className="text-[13.5px] font-medium">{s.t}</div>
              <div className="text-[12.5px] text-fg-3">{s.d}</div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Tracker() {
  const tt = useT();
  const d = INCOMING_DEPOSIT;
  const [conf, setConf] = React.useState(d.confirmations);
  React.useEffect(() => {
    if (conf >= d.required) {
      toast.success(tt("wallet.demo.creditedToast", { amount: formatNumber(d.amount) }), { description: tt("wallet.demo.confirmationsCount", { count: "20/20" }) });
      return;
    }
    const t = setTimeout(() => setConf((c) => c + 1), 6000);
    return () => clearTimeout(t);
  }, [conf, d.required, d.amount]);
  const done = conf >= d.required;
  const pct = (conf / d.required) * 100;
  return (
    <Card hot className="overflow-hidden">
      <Starfield density={40} />
      <div className="relative p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="relative grid size-11 place-items-center rounded-full border border-ember/40 bg-ember-soft">
              {!done && <span className="absolute inset-0 animate-ping rounded-full bg-ember/20" />}
              <CoinIcon coin="usdt" size={28} />
            </span>
            <div>
              <div className="flex items-center gap-2 text-[15px] font-medium">
                {tt("wallet.demo.incoming")}
                {done ? (
                  <Chip size="sm" tone="up" dot>
                    {tt("wallet.status.deposit.credited")}
                  </Chip>
                ) : (
                  <Chip size="sm" tone="ember" dot>
                    {tt("wallet.status.deposit.confirming")}
                  </Chip>
                )}
              </div>
              <div className="text-[12.5px] text-fg-3">{tt("wallet.demo.detected", { address: shortHash(d.from, 5, 4) })}</div>
            </div>
          </div>
          <div className="text-end">
            <div dir="ltr" className="k-num text-[26px] font-semibold leading-none">
              +{formatNumber(d.amount)} <span className="text-[14px] text-fg-3">USDT</span>
            </div>
            <div className="mt-1 text-[12px] text-fg-3">≈ ${formatNumber(d.amount)}</div>
          </div>
        </div>
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-[12.5px]">
            <span className="text-fg-2">
              <Trans k="wallet.demo.confProgress" vars={{ done: conf, required: d.required }} tags={{ num: (c) => <span className="k-num text-[15px] font-semibold text-fg">{c}</span> }} />
            </span>
            <span className="text-fg-3">{done ? tt("wallet.confirmations.complete") : tt("wallet.demo.secondsLeft", { seconds: (d.required - conf) * 3 })}</span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-black/35 light:bg-black/10">
            <motion.div className={cn("relative h-full overflow-hidden rounded-full", done ? "bg-up" : "bg-gradient-to-r from-[#ff7a2f] to-[#e8431a]")} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>
              {!done && <span className="absolute inset-y-0 start-0 w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />}
            </motion.div>
          </div>
          <div className="mt-2 grid grid-cols-[repeat(20,minmax(0,1fr))] gap-1">
            {Array.from({ length: d.required }, (_, i) => (
              <motion.span key={i} className={cn("h-1 rounded-full", i < conf ? (done ? "bg-up" : "bg-ember") : "bg-white/10")} initial={false} animate={{ opacity: i < conf ? 1 : 0.6 }} />
            ))}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-white/10 bg-black/25 light:border-black/5 light:bg-white/70 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">{tt("wallet.transactionHash")}</div>
            <a href={tronscan(d.hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-mono text-[13px] text-fg hover:text-ember">
              {shortHash(d.hash, 10, 8)} <ExternalLink className="size-3.5" />
            </a>
          </div>
          <a href={tronscan(d.hash)} target="_blank" rel="noreferrer">
            <Button size="sm" variant="surface">
              {tt("wallet.demo.viewTronscan")} <ExternalLink />
            </Button>
          </a>
        </div>
      </div>
    </Card>
  );
}

function Faq() {
  const t = useT();
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <Card>
      <CardHeader title={t("wallet.demo.faq")} />
      <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
        {DEPOSIT_FAQ.map((f, i) => {
          const on = open === i;
          return (
            <div key={f.q} className={cn("k-row overflow-hidden transition-colors", on && "border-[var(--k-border-top)]")}>
              <button type="button" onClick={() => setOpen(on ? null : i)} className="flex w-full items-center gap-3 px-4 py-3.5 text-start">
                <span className="flex-1 text-[14px] font-medium">{f.q}</span>
                <motion.span animate={{ rotate: on ? 180 : 0 }} className="text-fg-3">
                  <ChevronDown className="size-4" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {on && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                    <p className="px-4 pb-4 text-[13px] leading-relaxed text-fg-2">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function DemoDepositPage() {
  const t = useT();
  const net = DEPOSIT_NETWORKS[0]!;
  return (
    <div className="pb-16">
      <PageHeader
        title={t("wallet.depositUsdt")}
        subtitle={t("wallet.demo.depositSubtitle")}
        actions={
          <Link href="/wallet">
            <Button variant="surface">
              <ArrowLeft className="rtl:-scale-x-100" /> {t("wallet.wallet")}
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-4">
          <Reveal>
            <NetworkSelector />
          </Reveal>
          <Reveal delay={0.1}>
            <HowItWorks />
          </Reveal>
        </div>

        <div className="space-y-4 xl:col-span-8">
          <Reveal delay={0.05}>
            <Card>
              <CardHeader
                title={t("wallet.demo.yourAddress")}
                subtitle={WALLET.network}
                icon={<Wallet />}
                action={
                  <Chip tone="up" dot>
                    {t("wallet.demo.permanent")}
                  </Chip>
                }
              />
              <div className="grid grid-cols-1 gap-6 px-4 pb-6 pt-6 sm:px-6 md:grid-cols-[auto_1fr]">
                <div className="flex flex-col items-center">
                  <AddressQr size={208} />
                  <div className="mt-3 flex items-center gap-2 text-[12px] text-fg-3">
                    <CoinIcon coin="usdt" size={16} /> {t("wallet.demo.trc20Only")}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="k-label mb-2">{t("wallet.address")}</div>
                  <AddressBox className="py-4" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="ember"
                      onClick={() => {
                        navigator.clipboard?.writeText(WALLET.address).catch(() => {});
                        toast.success(t("wallet.demo.addressCopied"), { description: shortHash(WALLET.address, 8, 6) });
                      }}
                    >
                      <Copy /> {t("wallet.demo.copyAddress")}
                    </Button>
                    <Button variant="surface" onClick={() => toast.success(t("wallet.demo.addressShared"), { description: t("wallet.demo.linkCopied") })}>
                      <Share2 /> {t("wallet.demo.share")}
                    </Button>
                  </div>

                  <div className="mt-5 flex items-start gap-3 rounded-[14px] border border-down/30 bg-down-soft px-4 py-3">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0 text-down" />
                    <div className="text-[13px] text-fg-2">
                      <Trans k="wallet.demo.sendOnlyWarning" tags={{ b: (c) => <span className="font-medium text-fg">{c}</span> }} />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {[
                      [t("wallet.demo.minDeposit"), `${net.minDeposit} USDT`],
                      [t("wallet.demo.confirmations"), `${net.confirmations}`],
                      [t("wallet.demo.arrival"), net.eta],
                      [t("wallet.demo.kalksFee"), t("wallet.free")],
                    ].map(([k, v]) => (
                      <div key={k} className="k-row px-3 py-2.5">
                        <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{k}</div>
                        <div className="k-num mt-0.5 text-[13.5px] font-semibold">{v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[12px] text-fg-3">
                    <Clock className="size-3.5" /> {t("wallet.demo.noKycDeposit")}
                  </div>
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.1}>
            <Tracker />
          </Reveal>

          <Reveal delay={0.15}>
            <Faq />
          </Reveal>
        </div>
      </div>
    </div>
  );
}

/** Live builds: the real wallet (services/wallet). Demo builds: the mock showcase above. */
export default function DepositPage() {
  return IS_DEMO ? <DemoDepositPage /> : <LiveDepositPage />;
}
