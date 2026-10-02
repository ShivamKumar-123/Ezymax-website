"use client";

// Kalks FX Options page (Client Area /options): what the product is, the 3-step onboarding (identity, risk
// disclosure, knowledge quiz) and the way into Kalks Trader in options mode. Rendered by the live page (gateway
// suitability via /api/suitability) and the demo page (local state) through the same OptionsController.

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpenCheck,
  CalendarClock,
  CandlestickChart,
  Check,
  ChevronDown,
  CircleCheck,
  Coins,
  FileCheck2,
  GraduationCap,
  Layers2,
  ListChecks,
  Loader2,
  Lock,
  OctagonAlert,
  RotateCcw,
  Scale,
  ScrollText,
  ShieldAlert,
  Timer,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { Button, Card, CardHeader, Chip, Dialog, Menu, PageHeader, Progress, Reveal, Skeleton, SymbolAvatar, cn } from "@kalks/ui";
import { INSTRUMENT_MAP } from "@kalks/mock";
import { IS_DEMO } from "@kalks/mock/mode";
import type { MessageKey } from "@kalks/i18n";
import { useFormat, useT } from "@kalks/i18n/react";
import { Markdown } from "@/components/academy/live/markdown";
import { LETTERS, OptionButton } from "@/components/academy/live/quiz";
import type { QuizOutcome, QuizQuestion, Step, Suitability } from "./api";

/** The Academy course on options (content/academy/en/phase-9, slug `phase-9`); demo builds have the mock Academy. */
export const OPTIONS_COURSE_HREF = IS_DEMO ? "/academy" : "/academy/phase/phase-9";

export type TradeAccount = { login: number; type: "live" | "demo"; name: string };

/** What a page variant (live / demo) provides. Write methods resolve to null / false after showing their own toast. */
export type OptionsController = {
  data: Suitability | null;
  error: string | null;
  reload: () => void;
  accept: (version: number) => Promise<boolean>;
  submitQuiz: (answers: Record<string, number>) => Promise<QuizOutcome | null>;
  /** Accounts options can be traded on; null while loading. */
  accounts: TradeAccount[] | null;
  /** Plain Kalks Trader link (options mode) when the accounts can't be listed: the terminal signs in by itself. */
  traderHref?: string | null;
  openTrader: (a: TradeAccount) => void | Promise<void>;
  /** View-only login or staff session: can read, never attest. */
  readOnly: boolean;
  demo?: boolean;
};

/* ------------------------------------------------------------------ */
/* Underlyings                                                         */
/* ------------------------------------------------------------------ */

const UNDERLYINGS: { cls: "forex" | "metals" | "energies"; symbols: string[] }[] = [
  { cls: "forex", symbols: ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD", "EURJPY", "GBPJPY"] },
  { cls: "metals", symbols: ["XAUUSD", "XAGUSD"] },
  { cls: "energies", symbols: ["USOIL", "UKOIL"] },
];

const CCY_FLAG: Record<string, string> = { EUR: "eu", GBP: "gb", USD: "us", JPY: "jp", AUD: "au", CAD: "ca", CHF: "ch", NZD: "nz" };

/** Symbol avatar, with a two-flag fallback for pairs the instrument list doesn't carry (e.g. NZDUSD). */
function UnderlyingAvatar({ symbol, size = 22 }: { symbol: string; size?: number }) {
  if (INSTRUMENT_MAP[symbol]) return <SymbolAvatar symbol={symbol} size={size} />;
  const base = CCY_FLAG[symbol.slice(0, 3)];
  const quote = CCY_FLAG[symbol.slice(3, 6)];
  if (!base || !quote) return <span className="inline-block shrink-0 rounded-full bg-surface-3" style={{ width: size, height: size }} />;
  return (
    <span className="relative inline-block shrink-0" style={{ width: size * 1.45, height: size }}>
      <span className={cn("fi fis absolute left-0 top-0 rounded-full ring-2 ring-surface", `fi-${base}`)} style={{ width: size, height: size }} />
      <span className={cn("fi fis absolute right-0 top-0 rounded-full ring-2 ring-surface", `fi-${quote}`)} style={{ width: size, height: size }} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

/** Payoff at expiry of a call: bought (loss capped at the premium) or sold (loss keeps growing). */
function PayoffSketch({ side }: { side: "buy" | "sell" }) {
  const buy = side === "buy";
  // zero line at y=34; strike at x=70; premium = 10 units
  const pts = buy ? "4,44 70,44 156,4" : "4,24 70,24 156,64";
  return (
    <svg viewBox="0 0 160 68" className="h-[60px] w-full" aria-hidden>
      <line x1="4" y1="34" x2="156" y2="34" className="stroke-fg-3/50" strokeWidth="1" strokeDasharray="3 4" />
      <line x1="70" y1="6" x2="70" y2="62" className="stroke-fg-3/30" strokeWidth="1" />
      <polyline points={pts} fill="none" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" className={buy ? "stroke-up" : "stroke-down"} />
      {buy ? <rect x="4" y="34" width="66" height="10" className="fill-down/15" /> : <rect x="4" y="24" width="66" height="10" className="fill-up/15" />}
    </svg>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-[16px] border border-line bg-surface/60 px-4 py-3.5 backdrop-blur-sm">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember [&_svg]:size-4">{icon}</span>
        <div className="text-[14px] font-medium text-fg">{title}</div>
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-fg-2">{text}</p>
    </div>
  );
}

function Hero({ ctl, onStart }: { ctl: OptionsController; onStart: () => void }) {
  const t = useT();
  const eligible = !!ctl.data?.eligible;
  return (
    <Card hot className="overflow-hidden">
      <div className="grid grid-cols-1 gap-6 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[1.25fr_1fr]">
        <div className="min-w-0">
          <Chip tone="ember" size="sm" className="font-semibold uppercase tracking-wider">
            {t("options.hero.eyebrow")}
          </Chip>
          <h2 className="mt-3 max-w-[560px] text-[24px] font-medium leading-[1.15] tracking-[-0.02em] text-fg sm:text-[30px]">{t("options.hero.title")}</h2>
          <p className="mt-3 max-w-[560px] text-[14.5px] leading-relaxed text-fg-2">{t("options.hero.text")}</p>
          <div className="mt-5 grid max-w-[560px] grid-cols-1 gap-3 sm:grid-cols-2">
            {(["buy", "sell"] as const).map((side) => (
              <div key={side} className="rounded-[16px] border border-line bg-surface/60 px-3.5 pb-3 pt-2.5">
                <div className="flex items-center gap-2 text-[12px] font-medium text-fg-2">
                  {side === "buy" ? <TrendingUp className="size-3.5 text-up" /> : <TrendingDown className="size-3.5 text-down" />}
                  {t(side === "buy" ? "options.hero.buyerNote" : "options.hero.sellerNote")}
                </div>
                <PayoffSketch side={side} />
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {eligible ? (
              <TradeButton ctl={ctl} size="lg" />
            ) : (
              <Button variant="ember" size="lg" onClick={onStart} data-testid="options-start">
                {t("options.hero.start")} <ArrowRight className="rtl:-scale-x-100" />
              </Button>
            )}
            <Link href={OPTIONS_COURSE_HREF}>
              <Button variant="surface" size="lg">
                <GraduationCap /> {t("options.page.learnCourse")}
              </Button>
            </Link>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          {UNDERLYINGS.map((g) => (
            <div key={g.cls} className="rounded-[16px] border border-line bg-surface/60 px-4 py-3">
              <div className="k-label mb-2.5">{t(`options.hero.class.${g.cls}` as MessageKey)}</div>
              <div className="flex flex-wrap gap-2">
                {g.symbols.map((s) => (
                  <span key={s} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 py-1 pe-3 ps-1.5 text-[12.5px] font-medium text-fg">
                    <UnderlyingAvatar symbol={s} size={20} />
                    <span className="font-mono">{s}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 border-t border-line/70 px-5 py-5 sm:grid-cols-2 sm:px-7 xl:grid-cols-4">
        <Feature icon={<Layers2 />} title={t("options.hero.feature.underlyings.title")} text={t("options.hero.feature.underlyings.text")} />
        <Feature icon={<CalendarClock />} title={t("options.hero.feature.expiries.title")} text={t("options.hero.feature.expiries.text")} />
        <Feature icon={<Coins />} title={t("options.hero.feature.settlement.title")} text={t("options.hero.feature.settlement.text")} />
        <Feature icon={<Scale />} title={t("options.hero.feature.sides.title")} text={t("options.hero.feature.sides.text")} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Trade button (Kalks Trader in options mode)                         */
/* ------------------------------------------------------------------ */

function TradeButton({ ctl, size = "md", className }: { ctl: OptionsController; size?: "md" | "lg"; className?: string }) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const accounts = ctl.accounts;
  const open = async (a: TradeAccount) => {
    setBusy(true);
    try {
      await ctl.openTrader(a);
    } finally {
      setBusy(false);
    }
  };
  const label = (
    <>
      {busy ? <Loader2 className="animate-spin" /> : <CandlestickChart />} {t("options.trade.cta")}
    </>
  );
  if (!accounts && ctl.traderHref) {
    return (
      <a href={ctl.traderHref} target="_blank" rel="noopener" className={className}>
        <Button variant="ember" size={size} className="w-full">
          <CandlestickChart /> {t("options.trade.cta")} <ArrowUpRight className="rtl:-scale-x-100" />
        </Button>
      </a>
    );
  }
  if (!accounts) {
    return (
      <Button variant="ember" size={size} disabled className={className}>
        <Loader2 className="animate-spin" /> {t("options.trade.cta")}
      </Button>
    );
  }
  if (accounts.length === 0) {
    return (
      <Link href="/accounts/new" className={className}>
        <Button variant="ember" size={size} className="w-full">
          {t("options.trade.openAccount")} <ArrowRight className="rtl:-scale-x-100" />
        </Button>
      </Link>
    );
  }
  if (accounts.length === 1) {
    return (
      <Button variant="ember" size={size} disabled={busy} onClick={() => open(accounts[0]!)} className={className} data-testid="options-trade">
        {label}
      </Button>
    );
  }
  return (
    <Menu
      align="start"
      width={300}
      header={<div className="k-label">{t("options.trade.chooseAccount")}</div>}
      items={accounts.map((a) => ({
        label: (
          <span className="flex min-w-0 items-center gap-2">
            <span className="font-mono text-fg">#{a.login}</span>
            <span className="truncate text-fg-3">{a.name}</span>
          </span>
        ),
        icon: <CandlestickChart />,
        hint: (
          <Chip size="sm" tone={a.type === "live" ? "ember" : "gold"}>
            {t(a.type === "live" ? "options.trade.live" : "options.trade.demo")}
          </Chip>
        ),
        onSelect: () => void open(a),
      }))}
      trigger={
        <Button variant="ember" size={size} disabled={busy} className={className} data-testid="options-trade">
          {label} <ChevronDown />
        </Button>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Onboarding steps                                                    */
/* ------------------------------------------------------------------ */

type StepState = "done" | "review" | "action" | "todo" | "locked";

const STATE_CHIP: Record<StepState, { tone: "up" | "warn" | "down" | "neutral"; key: MessageKey }> = {
  done: { tone: "up", key: "options.steps.done" },
  review: { tone: "warn", key: "options.steps.inReview" },
  action: { tone: "down", key: "options.steps.actionNeeded" },
  todo: { tone: "neutral", key: "options.steps.toDo" },
  locked: { tone: "neutral", key: "options.steps.locked" },
};

function StepRow({ n, state, icon, title, text, action, children, last }: { n: number; state: StepState; icon: React.ReactNode; title: string; text: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode; last?: boolean }) {
  const t = useT();
  const chip = STATE_CHIP[state];
  return (
    <li className="relative flex gap-4" data-testid={`options-step-${n}`} data-state={state}>
      {!last && <span className="absolute start-[17px] top-11 h-[calc(100%-36px)] w-px bg-line" aria-hidden />}
      <span
        className={cn(
          "k-num relative z-[1] grid size-9 shrink-0 place-items-center rounded-full border text-[13px] font-semibold",
          state === "done" ? "border-up/40 bg-up-soft text-up" : state === "locked" ? "border-line bg-surface-2 text-fg-3" : "border-ember/40 bg-ember-soft text-ember",
        )}
      >
        {state === "done" ? <Check className="size-4" /> : state === "locked" ? <Lock className="size-3.5" /> : n}
      </span>
      <div className={cn("min-w-0 flex-1", !last && "pb-6")}>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-fg-3 [&_svg]:size-4">{icon}</span>
              <h4 className="text-[15.5px] font-medium tracking-tight text-fg">{title}</h4>
              <Chip size="sm" tone={chip.tone} dot>
                {t(chip.key)}
              </Chip>
            </div>
            <div className="mt-1 text-[13px] leading-snug text-fg-2">{text}</div>
          </div>
          {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
        </div>
        {children}
      </div>
    </li>
  );
}

function StepsCard({ ctl, data }: { ctl: OptionsController; data: Suitability }) {
  const t = useT();
  const f = useFormat();
  const [disclosureOpen, setDisclosureOpen] = React.useState(false);
  // the quiz opens by itself once it's the next thing to do, and stays open (with its result) after a pass
  const autoQuiz = data.disclosureAccepted && !data.quizPassed && !ctl.readOnly;
  const [quizOpen, setQuizOpen] = React.useState(autoQuiz);
  React.useEffect(() => {
    if (autoQuiz) setQuizOpen(true);
  }, [autoQuiz]);
  const kycState: StepState = data.kycVerified ? "done" : data.kycStatus === "pending" ? "review" : data.kycStatus === "rejected" ? "action" : "todo";
  const discState: StepState = data.disclosureAccepted ? "done" : data.acceptedVersion ? "action" : "todo";
  const quizState: StepState = data.quizPassed ? "done" : data.disclosureAccepted ? "todo" : "locked";
  const done = [data.kycVerified, data.disclosureAccepted, data.quizPassed].filter(Boolean).length;
  const showQuiz = quizOpen && data.disclosureAccepted && !ctl.readOnly;

  return (
    <Card id="onboarding" className="scroll-mt-24">
      <CardHeader
        title={t("options.steps.title")}
        subtitle={t("options.steps.subtitle")}
        icon={<ListChecks />}
        action={
          <Chip tone={done === 3 ? "up" : "ember"} dot>
            {t("options.steps.progress", { done })}
          </Chip>
        }
      />
      <div className="px-4 pb-6 pt-4 sm:px-6">
        <Progress value={(done / 3) * 100} tone={done === 3 ? "up" : "ember"} className="mb-6" />
        {ctl.readOnly && (
          <div className="mb-5 flex items-start gap-2.5 rounded-[14px] border border-warn/30 bg-warn-soft px-4 py-3 text-[13px] text-fg-2">
            <Lock className="mt-0.5 size-4 shrink-0 text-warn" />
            {t("options.readOnly")}
          </div>
        )}
        <ol>
          <StepRow
            n={1}
            state={kycState}
            icon={<BadgeCheck />}
            title={t("options.steps.kyc.title")}
            text={t(data.kycVerified ? "options.steps.kyc.verified" : data.kycStatus === "pending" ? "options.steps.kyc.pending" : data.kycStatus === "rejected" ? "options.steps.kyc.rejected" : "options.steps.kyc.unverified")}
            action={
              !data.kycVerified && (
                <Link href="/profile/verification">
                  <Button size="sm" variant={data.kycStatus === "pending" ? "surface" : "ember"}>
                    {t(data.kycStatus === "unverified" ? "options.steps.kyc.cta" : "options.steps.kyc.open")} <ArrowRight className="rtl:-scale-x-100" />
                  </Button>
                </Link>
              )
            }
          />
          <StepRow
            n={2}
            state={discState}
            icon={<ScrollText />}
            title={t("options.steps.disclosure.title")}
            text={
              data.disclosureAccepted && data.acceptedAt
                ? t("options.steps.disclosure.accepted", { version: data.acceptedVersion, date: f.date(data.acceptedAt) })
                : data.acceptedVersion && data.disclosure
                  ? t("options.steps.disclosure.updated", { version: data.disclosure.version })
                  : t("options.steps.disclosure.text")
            }
            action={
              <Button size="sm" variant={data.disclosureAccepted ? "surface" : "ember"} onClick={() => setDisclosureOpen(true)} disabled={!data.disclosure} data-testid="options-disclosure-open">
                <FileCheck2 /> {t(data.disclosureAccepted ? "options.steps.disclosure.view" : "options.steps.disclosure.cta")}
              </Button>
            }
          />
          <StepRow
            n={3}
            last
            state={quizState}
            icon={<BookOpenCheck />}
            title={t("options.steps.quiz.title")}
            text={
              data.quizPassed && data.quizScore !== null
                ? t("options.steps.quiz.passed", { score: data.quizScore, total: data.quiz.total })
                : data.disclosureAccepted
                  ? t("options.steps.quiz.text", { total: data.quiz.total, passMark: data.quiz.passMark })
                  : t("options.steps.quiz.locked")
            }
            action={
              data.disclosureAccepted &&
              !ctl.readOnly &&
              (showQuiz ? (
                data.quizPassed && (
                  <Button size="sm" variant="ghost" onClick={() => setQuizOpen(false)}>
                    {t("options.quiz.hide")}
                  </Button>
                )
              ) : (
                <Button size="sm" variant={data.quizPassed ? "surface" : "ember"} onClick={() => setQuizOpen(true)}>
                  {data.quizPassed ? <RotateCcw /> : <BookOpenCheck />} {t(data.quizPassed ? "options.quiz.practice" : "options.steps.quiz.start")}
                </Button>
              ))
            }
          >
            {showQuiz && <QuizPanel ctl={ctl} data={data} />}
          </StepRow>
        </ol>
      </div>
      {data.disclosure && <DisclosureDialog ctl={ctl} data={data} open={disclosureOpen} onOpenChange={setDisclosureOpen} />}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Risk disclosure                                                     */
/* ------------------------------------------------------------------ */

const KEY_RISKS: { key: MessageKey; icon: React.ReactNode }[] = [
  { key: "options.disclosure.risk.premium", icon: <TrendingDown /> },
  { key: "options.disclosure.risk.seller", icon: <OctagonAlert /> },
  { key: "options.disclosure.risk.barrier", icon: <ShieldAlert /> },
  { key: "options.disclosure.risk.settlement", icon: <Timer /> },
  { key: "options.disclosure.risk.counterparty", icon: <Scale /> },
];

function DisclosureDialog({ ctl, data, open, onOpenChange }: { ctl: OptionsController; data: Suitability; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT();
  const f = useFormat();
  const d = data.disclosure!;
  const [checked, setChecked] = React.useState(false);
  const [atEnd, setAtEnd] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement | null>(null);
  const accepted = data.disclosureAccepted;

  React.useEffect(() => {
    if (!open) {
      setChecked(false);
      setAtEnd(false);
    }
  }, [open]);
  // acceptance waits until the end of the text has been on screen
  React.useEffect(() => {
    if (!open) return;
    let io: IntersectionObserver | null = null;
    const id = requestAnimationFrame(() => {
      const el = endRef.current;
      if (!el) return;
      io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setAtEnd(true), { threshold: 0.1 });
      io.observe(el);
    });
    return () => {
      cancelAnimationFrame(id);
      io?.disconnect();
    };
  }, [open]);

  const accept = async () => {
    setBusy(true);
    const ok = await ctl.accept(d.version);
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={760}
      title={t("options.disclosure.dialogTitle")}
      description={t("options.disclosure.version", { version: d.version, date: f.date(d.publishedAt) })}
      footer={
        accepted ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[13px] text-up">
              <CircleCheck className="size-4" /> {data.acceptedAt ? t("options.disclosure.acceptedOn", { date: f.date(data.acceptedAt) }) : t("options.steps.done")}
            </span>
            <Button variant="surface" onClick={() => onOpenChange(false)}>
              {t("options.disclosure.close")}
            </Button>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className={cn("flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-fg-2", (!atEnd || ctl.readOnly) && "cursor-not-allowed opacity-60")}>
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-[var(--k-ember)]"
                checked={checked}
                disabled={!atEnd || ctl.readOnly}
                onChange={(e) => setChecked(e.target.checked)}
                data-testid="options-disclosure-confirm"
              />
              <span>
                {t("options.disclosure.confirm")}
                {!atEnd && <span className="mt-0.5 block text-[12px] text-fg-3">{t("options.disclosure.scrollHint")}</span>}
              </span>
            </label>
            <Button variant="ember" disabled={!checked || busy || ctl.readOnly} onClick={accept} className="shrink-0" data-testid="options-disclosure-accept">
              {busy ? <Loader2 className="animate-spin" /> : <Check />} {t("options.disclosure.accept")}
            </Button>
          </div>
        )
      }
    >
      <div className="rounded-[16px] border border-down/25 bg-down-soft px-4 py-3.5">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-down">
          <TriangleAlert className="size-4" /> {t("options.disclosure.keyRisks")}
        </div>
        <ul className="space-y-2">
          {KEY_RISKS.map((r) => (
            <li key={r.key} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-fg">
              <span className="mt-0.5 shrink-0 text-down [&_svg]:size-4">{r.icon}</span>
              {t(r.key)}
            </li>
          ))}
        </ul>
      </div>
      <div className="mb-3 mt-6 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
        <h3 className="text-[16px] font-medium tracking-tight text-fg">{d.title}</h3>
        {t.locale !== "en" && <span className="text-[12px] text-fg-3">{t("options.disclosure.englishNote")}</span>}
      </div>
      <div dir="ltr" lang="en">
        <Markdown src={d.bodyMd} className="text-[14px] leading-[1.7] [&_h2]:mt-7 [&_h2]:text-[17px]" />
      </div>
      <div ref={endRef} className="h-2" aria-hidden />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Knowledge quiz                                                      */
/* ------------------------------------------------------------------ */

function QuizPanel({ ctl, data }: { ctl: OptionsController; data: Suitability }) {
  const t = useT();
  const qs = data.quiz.questions;
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [result, setResult] = React.useState<QuizOutcome | null>(null);
  const [busy, setBusy] = React.useState(false);
  const topRef = React.useRef<HTMLDivElement | null>(null);
  const answered = qs.filter((q) => answers[q.id] !== undefined).length;
  const wrong = React.useMemo(() => new Map(result?.wrong.map((w) => [w.id, w.explanation]) ?? []), [result]);

  // English shows the server's own text; other languages the translation of the same question id
  const en = t.locale === "en";
  const qText = (q: QuizQuestion) => (en && q.text ? q.text : t.dyn(`options.quiz.${q.id}.text`, q.text));
  const qOpt = (q: QuizQuestion, i: number) => (en && q.options[i] ? q.options[i]! : t.dyn(`options.quiz.${q.id}.o${i}`, q.options[i] ?? ""));
  const qWhy = (id: string, server: string) => (en && server ? server : t.dyn(`options.quiz.${id}.why`, server));

  const submit = async () => {
    setBusy(true);
    const r = await ctl.submitQuiz(answers);
    setBusy(false);
    if (!r) return;
    setResult(r);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const retry = () => {
    setResult(null);
    setAnswers({});
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div ref={topRef} className="mt-4 scroll-mt-24 rounded-[18px] border border-line bg-surface-2/50 p-3.5 sm:p-5" data-testid="options-quiz">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[15px] font-medium text-fg">{t("options.quiz.title")}</div>
          <div className="text-[12.5px] text-fg-3">{t("options.quiz.subtitle", { passMark: data.quiz.passMark, total: data.quiz.total })}</div>
        </div>
        {!result && (
          <Chip tone={answered === qs.length ? "up" : "neutral"} className="k-num">
            {t("options.quiz.answered", { count: answered, total: qs.length })}
          </Chip>
        )}
      </div>
      {data.quizPassed && !result && <p className="mt-3 rounded-[12px] border border-up/25 bg-up-soft px-3.5 py-2.5 text-[12.5px] text-fg-2">{t("options.quiz.alreadyPassed")}</p>}

      {result && (
        <div className={cn("mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border px-4 py-3.5", result.passed ? "border-up/30 bg-up-soft" : "border-down/30 bg-down-soft")} data-testid="options-quiz-result" data-passed={result.passed}>
          <div className="flex items-start gap-3">
            {result.passed ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-up" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-down" />}
            <div>
              <div className="k-num text-[15px] font-medium text-fg">{t(result.passed ? "options.quiz.passedTitle" : "options.quiz.failedTitle", { score: result.score, total: result.total })}</div>
              <div className="text-[12.5px] text-fg-2">{result.passed ? t("options.quiz.passedText") : t("options.quiz.failedText", { passMark: result.passMark })}</div>
            </div>
          </div>
          {!result.passed && (
            <Button size="sm" variant="surface" onClick={retry} data-testid="options-quiz-retry">
              <RotateCcw /> {t("options.quiz.retry")}
            </Button>
          )}
        </div>
      )}
      {result && !result.passed && result.wrong.length > 0 && <div className="mt-4 k-label">{t("options.quiz.wrongTitle")}</div>}

      <ol className={cn("space-y-3", !(result?.passed) && "mt-4")}>
        {qs.map((q, qi) => {
          const chosen = answers[q.id];
          const isWrong = !!result && wrong.has(q.id);
          // after an attempt only the mistakes stay open (none after a pass), so the review focuses on them
          if (result && !isWrong) return null;
          return (
            <li key={q.id} className="rounded-[16px] border border-line bg-surface px-3.5 py-3.5 sm:px-4" data-testid={`options-q-${q.id}`}>
              <div className="flex gap-2.5 text-[14px] font-medium leading-snug text-fg">
                <span className="k-num text-fg-3">{qi + 1}.</span>
                <span>{qText(q)}</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2">
                {q.options.map((_, oi) => (
                  <OptionButton
                    key={oi}
                    letter={LETTERS[oi] ?? String(oi + 1)}
                    label={qOpt(q, oi)}
                    state={chosen !== oi ? "idle" : !result ? "chosen" : isWrong ? "wrong" : "correct"}
                    disabled={!!result || busy}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                    testId={`options-q-${q.id}-${oi}`}
                  />
                ))}
              </div>
              {isWrong && (
                <div className="mt-3 rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-fg-2">
                  <span className="me-1.5 font-semibold text-fg">{t("options.quiz.why")}:</span>
                  {qWhy(q.id, wrong.get(q.id) ?? "")}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!result && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12.5px] text-fg-3">{answered < qs.length ? t("options.quiz.answerAll") : ""}</span>
          <Button variant="ember" disabled={answered < qs.length || busy} onClick={submit} data-testid="options-quiz-submit">
            {busy ? <Loader2 className="animate-spin" /> : <Check />} {t(busy ? "options.quiz.submitting" : "options.quiz.submit")}
          </Button>
        </div>
      )}
      {result && !result.passed && (
        <div className="mt-4 flex justify-end">
          <Button variant="ember" onClick={retry}>
            <RotateCcw /> {t("options.quiz.retry")}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Side cards                                                          */
/* ------------------------------------------------------------------ */

const MISSING_KEY: Record<Step, MessageKey> = { kyc: "options.trade.missing.kyc", disclosure: "options.trade.missing.disclosure", quiz: "options.trade.missing.quiz" };

function TradeCard({ ctl, data }: { ctl: OptionsController; data: Suitability }) {
  const t = useT();
  return (
    <Card hot={data.eligible} className={cn(data.eligible && "overflow-hidden")}>
      <CardHeader title={t("options.trade.title")} subtitle={t(data.eligible ? "options.trade.ready" : "options.trade.locked")} icon={<CandlestickChart />} />
      <div className="px-4 pb-5 pt-4 sm:px-6">
        {data.eligible ? (
          <>
            {ctl.accounts && ctl.accounts.length === 0 && <p className="mb-3 text-[13px] text-fg-2">{t("options.trade.noAccount")}</p>}
            <TradeButton ctl={ctl} className="w-full" />
          </>
        ) : (
          <>
            <div className="k-label mb-2">{t("options.trade.remaining")}</div>
            <ul className="space-y-1.5">
              {data.missing.map((m) => (
                <li key={m} className="flex items-center gap-2.5 rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-fg-2">
                  <Lock className="size-3.5 shrink-0 text-fg-3" /> {t(MISSING_KEY[m])}
                </li>
              ))}
            </ul>
            <Button variant="ember" disabled className="mt-4 w-full">
              <Lock /> {t("options.trade.cta")}
            </Button>
          </>
        )}
        <p className="mt-3 text-[12px] leading-snug text-fg-3">{t("options.trade.cashOnly")}</p>
      </div>
    </Card>
  );
}

const FACTS: { key: MessageKey; icon: React.ReactNode }[] = [
  { key: "options.facts.style", icon: <CalendarClock /> },
  { key: "options.facts.premium", icon: <Coins /> },
  { key: "options.facts.contracts", icon: <Layers2 /> },
  { key: "options.facts.close", icon: <ArrowUpRight /> },
  { key: "options.facts.cutoff", icon: <Timer /> },
  { key: "options.facts.margin", icon: <ShieldAlert /> },
];

function FactsCard() {
  const t = useT();
  return (
    <Card>
      <CardHeader title={t("options.facts.title")} icon={<Scale />} />
      <ul className="space-y-2.5 px-4 pb-5 pt-4 sm:px-6">
        {FACTS.map((x) => (
          <li key={x.key} className="flex items-start gap-3 text-[13px] leading-snug text-fg-2">
            <span className="mt-px grid size-6 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-3 [&_svg]:size-3.5">{x.icon}</span>
            <span>{t(x.key)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function LearnCard() {
  const t = useT();
  return (
    <Card>
      <div className="flex items-start gap-3.5 px-5 py-5 sm:px-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-gold/30 bg-gold-soft text-gold">
          <GraduationCap className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-fg">{t("options.learn.title")}</div>
          <p className="mt-1 text-[13px] leading-snug text-fg-2">{t("options.learn.text")}</p>
          <Link href={OPTIONS_COURSE_HREF} className="mt-3 inline-block">
            <Button size="sm" variant="surface">
              {t("options.learn.cta")} <ArrowRight className="rtl:-scale-x-100" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function StepsSkeleton() {
  return (
    <Card className="px-6 py-6">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="mt-2 h-4 w-72" />
      <Skeleton className="mt-6 h-1.5 w-full" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mt-6 flex gap-4">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="mt-2 h-3.5 w-full max-w-[420px]" />
          </div>
        </div>
      ))}
    </Card>
  );
}

export function OptionsPage({ ctl }: { ctl: OptionsController }) {
  const t = useT();
  const data = ctl.data;
  const done = data ? [data.kycVerified, data.disclosureAccepted, data.quizPassed].filter(Boolean).length : 0;
  const start = () => document.getElementById("onboarding")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <>
      <PageHeader
        title={t("options.page.title")}
        subtitle={t("options.page.subtitle")}
        actions={
          <>
            {ctl.demo && (
              <Chip tone="gold" size="sm">
                {t("options.demo.note")}
              </Chip>
            )}
            {data &&
              (data.eligible ? (
                <Chip tone="up" dot>
                  {t("options.page.statusReady")}
                </Chip>
              ) : (
                <Chip tone="ember" dot>
                  {t("options.page.statusSteps", { done })}
                </Chip>
              ))}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Reveal className="xl:col-span-3">
          <Hero ctl={ctl} onStart={start} />
        </Reveal>
        <Reveal delay={0.06} className="min-w-0 xl:col-span-2">
          {data ? (
            <StepsCard ctl={ctl} data={data} />
          ) : ctl.error ? (
            <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <TriangleAlert className="size-6 text-warn" />
              <div className="text-[14px] text-fg-2">{ctl.error}</div>
              <Button variant="surface" size="sm" onClick={ctl.reload}>
                <RotateCcw /> {t("options.error.retry")}
              </Button>
            </Card>
          ) : (
            <StepsSkeleton />
          )}
        </Reveal>
        <Reveal delay={0.1} className="min-w-0 space-y-4">
          {data ? <TradeCard ctl={ctl} data={data} /> : <Skeleton className="h-[220px] w-full rounded-[20px]" />}
          <FactsCard />
          <LearnCard />
        </Reveal>
      </div>
    </>
  );
}
