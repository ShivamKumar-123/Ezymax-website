"use client";

// Live strategy builder (/developer/strategies): visual rules or code, validated on the server, saved as
// immutable versions, backtested and deployed 24/7 on the user's accounts. AI assistant on the right.

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Archive, Code2, FlaskConical, LayoutGrid, Loader2, Play, Plus, Rocket, Save, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Menu, PageHeader, Reveal, Segmented, Skeleton, SymbolAvatar, cn } from "@/components/kit";
import { MoreHorizontal } from "lucide-react";
import { tr, useT } from "@ezymex/i18n/react";
import { AiAssistant } from "./ai-chat";
import { useModule } from "@/components/tenant-config";
import { SettingsEditor, SymbolPicker, VisualEditor, NumInput } from "./builder";
import { CodeEditor, DslReference } from "./code-editor";
import {
  DEP_TONE,
  SIGNAL_LABEL,
  ago,
  algoApi,
  algoError,
  defaultSpec,
  fmtPct,
  operand,
  useAlgo,
  useMeta,
  type Built,
  type StrategyDetail,
  type StrategyItem,
  type StrategySpec,
  type TradingAccount,
} from "./api";

type Mode = "visual" | "code";

type TplKey = "ema" | "rsi" | "breakout" | "macd";
const TEMPLATES: { id: TplKey; name: `developer.tpl.${TplKey}.name`; text: `developer.tpl.${TplKey}.text`; make: () => StrategySpec }[] = [
  {
    id: "ema",
    name: "developer.tpl.ema.name",
    text: "developer.tpl.ema.text",
    make: () => ({
      ...defaultSpec("EURUSD", "H1"),
      name: tr("developer.tpl.ema.name"),
      long: { logic: "all", groups: [{ logic: "all", conditions: [{ left: operand({ kind: "indicator", indicator: "ema", period: 20 }), op: "crosses_above", right: operand({ kind: "indicator", indicator: "ema", period: 50 }), timeframe: "same" }] }] },
      short: { logic: "all", groups: [{ logic: "all", conditions: [{ left: operand({ kind: "indicator", indicator: "ema", period: 20 }), op: "crosses_below", right: operand({ kind: "indicator", indicator: "ema", period: 50 }), timeframe: "same" }] }] },
      sl: { mode: "atr", value: 2, atrPeriod: 14 },
      tp: { mode: "rr", value: 2, atrPeriod: 14 },
    }),
  },
  {
    id: "rsi",
    name: "developer.tpl.rsi.name",
    text: "developer.tpl.rsi.text",
    make: () => ({
      ...defaultSpec("EURUSD", "M15"),
      name: tr("developer.tpl.rsi.name"),
      long: { logic: "all", groups: [{ logic: "all", conditions: [
        { left: operand({ kind: "indicator", indicator: "rsi", period: 14 }), op: "crosses_above", right: operand({ kind: "value", value: 30 }), timeframe: "same" },
        { left: operand({ kind: "price", field: "close" }), op: "gt", right: operand({ kind: "indicator", indicator: "sma", period: 200 }), timeframe: "same" },
      ] }] },
      short: { logic: "all", groups: [{ logic: "all", conditions: [
        { left: operand({ kind: "indicator", indicator: "rsi", period: 14 }), op: "crosses_below", right: operand({ kind: "value", value: 70 }), timeframe: "same" },
        { left: operand({ kind: "price", field: "close" }), op: "lt", right: operand({ kind: "indicator", indicator: "sma", period: 200 }), timeframe: "same" },
      ] }] },
      sl: { mode: "pips", value: 15, atrPeriod: 14 },
      tp: { mode: "pips", value: 25, atrPeriod: 14 },
      maxTradesPerDay: 3,
    }),
  },
  {
    id: "breakout",
    name: "developer.tpl.breakout.name",
    text: "developer.tpl.breakout.text",
    make: () => ({
      ...defaultSpec("XAUUSD", "H1"),
      name: tr("developer.tpl.breakout.name"),
      long: { logic: "all", groups: [{ logic: "all", conditions: [{ left: operand({ kind: "price", field: "close" }), op: "crosses_above", right: operand({ kind: "indicator", indicator: "highest", period: 20 }), timeframe: "same" }] }] },
      short: { logic: "all", groups: [{ logic: "all", conditions: [{ left: operand({ kind: "price", field: "close" }), op: "crosses_below", right: operand({ kind: "indicator", indicator: "lowest", period: 20 }), timeframe: "same" }] }] },
      sizing: { mode: "lots", lots: 0.05, riskPct: 1 },
      maxLots: 0.05,
      sl: { mode: "atr", value: 1.5, atrPeriod: 14 },
      tp: { mode: "none", value: 0, atrPeriod: 14 },
      trailing: { mode: "atr", value: 2, atrPeriod: 14, breakevenTrigger: 0, breakevenOffset: 0 },
    }),
  },
  {
    id: "macd",
    name: "developer.tpl.macd.name",
    text: "developer.tpl.macd.text",
    make: () => ({
      ...defaultSpec("GBPUSD", "H1"),
      name: tr("developer.tpl.macd.name"),
      long: { logic: "all", groups: [{ logic: "all", conditions: [
        { left: operand({ kind: "indicator", indicator: "macd", period: 12, period2: 26, period3: 9 }), op: "crosses_above", right: operand({ kind: "indicator", indicator: "macd_signal", period: 12, period2: 26, period3: 9 }), timeframe: "same" },
        { left: operand({ kind: "price", field: "close" }), op: "gt", right: operand({ kind: "indicator", indicator: "ema", period: 50 }), timeframe: "H4" },
      ] }] },
      short: { logic: "all", groups: [{ logic: "all", conditions: [
        { left: operand({ kind: "indicator", indicator: "macd", period: 12, period2: 26, period3: 9 }), op: "crosses_below", right: operand({ kind: "indicator", indicator: "macd_signal", period: 12, period2: 26, period3: 9 }), timeframe: "same" },
        { left: operand({ kind: "price", field: "close" }), op: "lt", right: operand({ kind: "indicator", indicator: "ema", period: 50 }), timeframe: "H4" },
      ] }] },
      sl: { mode: "pips", value: 30, atrPeriod: 14 },
      tp: { mode: "rr", value: 1.5, atrPeriod: 14 },
      trailing: { mode: "none", value: 0, atrPeriod: 14, breakevenTrigger: 200, breakevenOffset: 10 },
    }),
  },
];

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = React.useState(v);
  React.useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function Summary({ built }: { built: Built | null }) {
  const t = useT();
  if (!built) return <Skeleton className="h-10 w-full" />;
  const entries = Object.entries(built.summary);
  return (
    <div className="space-y-1">
      {entries.length === 0 && <div className="text-[12.5px] text-fg-3">{t("developer.strat.noSignal")}</div>}
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-3 text-[12.5px]">
          <span className={cn("w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wide", k === "buy" ? "text-up" : k === "sell" ? "text-down" : "text-gold")}>{SIGNAL_LABEL[k] ? t(SIGNAL_LABEL[k]) : k}</span>
          <code className="min-w-0 break-words font-mono text-[12px] text-fg-2">{v}</code>
        </div>
      ))}
    </div>
  );
}

function DeployCard({ strategy, onDeployed }: { strategy: StrategyDetail | null; onDeployed: () => void }) {
  const t = useT();
  const accounts = useAlgo<{ items: TradingAccount[] }>("accounts");
  const [login, setLogin] = React.useState<number | null>(null);
  const [mult, setMult] = React.useState(1);
  const [maxOpen, setMaxOpen] = React.useState(0);
  const [maxLoss, setMaxLoss] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const list = (accounts.data?.items ?? []).filter((a) => a.status === "active");
  React.useEffect(() => {
    if (login === null && list.length) setLogin((list.find((a) => a.type === "demo") ?? list[0]!).login);
  }, [list, login]);
  const acct = list.find((a) => a.login === login);
  const valid = !!strategy?.current.valid;
  const deploy = async () => {
    if (!strategy || !login) return;
    setBusy(true);
    try {
      const risk: Record<string, number> = {};
      if (mult !== 1) risk.lotMultiplier = mult;
      if (maxOpen > 0) risk.maxOpenPositions = maxOpen;
      if (maxLoss > 0) risk.maxDailyLoss = maxLoss;
      const r = await algoApi<{ id: number }>("deployments", { body: { strategyId: strategy.id, versionId: strategy.current.id, login, risk } });
      toast.success(t("developer.strat.runningOn", { version: strategy.current.version, login }), { description: t("developer.strat.runningText") });
      onDeployed();
      void r;
    } catch (e) {
      algoError(t("developer.strat.deployFailed"), e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card id="deploy">
      <CardHeader icon={<Rocket />} title={t("developer.strat.deployTitle")} subtitle={t("developer.strat.deploySub")} />
      <div className="space-y-3 px-5 pb-5 pt-4">
        {accounts.loading ? (
          <Skeleton className="h-10" />
        ) : list.length === 0 ? (
          <div className="text-[12.5px] text-fg-3">
            {t("developer.strat.openAccountFirst")} <Link href="/accounts/new" className="text-ember hover:underline">{t("developer.strat.openAccount")}</Link>
          </div>
        ) : (
          <Menu
            align="start"
            width={300}
            trigger={
              <button type="button" aria-label={t("common.account")} className="flex w-full items-center gap-2 rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-start text-[13px]">
                {acct && <Chip size="sm" tone={acct.type === "live" ? "ember" : "gold"}>{(acct.type === "live" ? t("common.live") : t("common.demo")).toUpperCase()}</Chip>}
                <span className="font-mono">#{acct?.login}</span>
                <span className="truncate text-fg-3">{acct?.groupName}</span>
                <span className="ms-auto k-num tabular-nums text-fg-2">{acct ? `$${acct.equity.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : ""}</span>
              </button>
            }
            items={list.map((a) => ({ label: `${a.type === "live" ? t("common.live") : t("common.demo")} #${a.login} · ${a.groupName}`, hint: `$${a.equity.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, onSelect: () => setLogin(a.login) }))}
          />
        )}
        <div className="grid grid-cols-3 gap-2 text-[11.5px] text-fg-3">
          <label className="rounded-[10px] bg-surface-2/60 px-2.5 py-2">
            {t("developer.strat.lotX")}
            <div className="mt-1 text-fg">
              <NumInput label={t("developer.dep.lotMultiplier")} value={mult} step={0.1} min={0.01} onChange={setMult} />
            </div>
          </label>
          <label className="rounded-[10px] bg-surface-2/60 px-2.5 py-2">
            {t("developer.strat.maxOpen")}
            <div className="mt-1 text-fg">
              <NumInput label={t("developer.dep.maxOpenPositions")} value={maxOpen} min={0} onChange={(v) => setMaxOpen(Math.round(v))} />
            </div>
          </label>
          <label className="rounded-[10px] bg-surface-2/60 px-2.5 py-2">
            {t("developer.strat.dayLoss")}
            <div className="mt-1 text-fg">
              <NumInput label={t("developer.builder.maxDailyLoss")} value={maxLoss} min={0} onChange={setMaxLoss} />
            </div>
          </label>
        </div>
        {acct?.type === "live" && <div className="flex items-start gap-2 rounded-[10px] border border-warn/30 bg-warn-soft px-3 py-2 text-[12px] text-warn"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {t("developer.strat.liveWarning")}</div>}
        <Button variant="ember" className="w-full" disabled={!strategy || !valid || !login || busy} onClick={deploy}>
          {busy ? <Loader2 className="animate-spin" /> : <Play />} {strategy ? t("developer.strat.deployVersion", { version: strategy.current.version }) : t("developer.strat.saveFirst")}
        </Button>
        {strategy && !valid && <p className="text-[11.5px] text-down">{t("developer.strat.fixBeforeDeploy")}</p>}
        {strategy && strategy.deployments.length > 0 && (
          <div className="space-y-1.5 border-t border-line pt-3">
            {strategy.deployments.slice(0, 5).map((d) => (
              <Link key={d.id} href={`/developer/deployments?id=${d.id}`} className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-[12.5px] hover:bg-surface-2">
                <Chip size="sm" tone={DEP_TONE[d.status]} dot>
                  {t.dyn(`developer.depStatus.${d.status}`, d.status)}
                </Chip>
                <span className="font-mono text-fg-2">#{d.login}</span>
                <span className="text-fg-3">v{d.version}</span>
                <span className="ms-auto k-num tabular-nums text-fg-2">{t("developer.market.nTrades", { count: d.stats.trades ?? 0 })}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export function LiveStrategiesPage() {
  const t = useT();
  // the AI assistant chat follows the broker's AI assistant switch (its BFF route does too, lib/modules.ts)
  const aiOn = useModule("ai_assistant");
  const router = useRouter();
  const params = useSearchParams();
  const meta = useMeta();
  const list = useAlgo<{ items: StrategyItem[] }>("strategies");
  const idParam = params.get("id");
  const [selected, setSelected] = React.useState<number | "new">(idParam ? Number(idParam) : "new");
  const [detail, setDetail] = React.useState<StrategyDetail | null>(null);
  const [mode, setMode] = React.useState<Mode>("visual");
  const [spec, setSpec] = React.useState<StrategySpec>(() => TEMPLATES[0]!.make());
  const [code, setCode] = React.useState<string>("");
  const [codeEdited, setCodeEdited] = React.useState(false);
  const [name, setName] = React.useState(() => t("developer.tpl.ema.name"));
  const [built, setBuilt] = React.useState<Built | null>(null);
  const [validating, setValidating] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [prompt, setPrompt] = React.useState<string | null>(null);
  const [origin, setOrigin] = React.useState<"manual" | "ai" | "template">("template");

  // first load only: open the newest strategy when no id is given
  const autoPicked = React.useRef(false);
  React.useEffect(() => {
    if (autoPicked.current || !list.data) return;
    autoPicked.current = true;
    if (idParam || selected !== "new" || !list.data.items.length) return;
    setSelected(list.data.items[0]!.id);
  }, [list.data, idParam, selected]);

  const load = React.useCallback(async (id: number) => {
    try {
      const d = await algoApi<StrategyDetail>(`strategies/${id}`);
      setDetail(d);
      setName(d.name);
      if (d.current.kind === "code") {
        setMode("code");
        setCode(d.current.source ?? d.current.code);
        setCodeEdited(true);
      } else {
        setMode("visual");
        setSpec(d.current.spec);
        setCode(d.current.code);
        setCodeEdited(false);
      }
      setBuilt(d.current);
      setDirty(false);
      setPrompt(null);
    } catch (e) {
      algoError(t("developer.strat.openFailed"), e);
    }
  }, []);

  React.useEffect(() => {
    if (typeof selected === "number") void load(selected);
  }, [selected, load]);

  // server-side validation (debounced)
  const payload = React.useMemo(() => (mode === "code" ? { kind: "code", source: code, symbol: spec.symbol, timeframe: spec.timeframe } : { kind: "visual", spec: { ...spec, name } }), [mode, code, spec, name]);
  const debounced = useDebounced(payload, 350);
  React.useEffect(() => {
    let cancel = false;
    setValidating(true);
    algoApi<Built>("validate", { body: debounced })
      .then((b) => {
        if (cancel) return;
        setBuilt(b);
        if (mode === "visual" && !codeEdited) setCode(b.code);
        if (mode === "code" && /\bname\(/.test(code)) setName(b.spec.name);
      })
      .catch(() => undefined)
      .finally(() => !cancel && setValidating(false));
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const editSpec = (s: StrategySpec) => {
    setSpec(s);
    setDirty(true);
  };
  const editCode = (c: string) => {
    setCode(c);
    setCodeEdited(true);
    setDirty(true);
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    if (m === "code") {
      setCode(built?.code ?? code);
      setMode("code");
      return;
    }
    if (codeEdited && detail?.current.kind === "code") return toast.error(t("developer.strat.codeStays"), { description: t("developer.strat.codeStaysText") });
    if (codeEdited) {
      toast(t("developer.strat.codeDiscarded"), { description: t("developer.strat.codeDiscardedText") });
      setCodeEdited(false);
    }
    setMode("visual");
  };

  const newFrom = (tpl: (typeof TEMPLATES)[number] | null) => {
    const s = tpl ? tpl.make() : { ...defaultSpec(spec.symbol, spec.timeframe), name: t("developer.strat.untitled") };
    setSelected("new");
    setDetail(null);
    setSpec(s);
    setName(s.name);
    setMode("visual");
    setCodeEdited(false);
    setDirty(true);
    setOrigin(tpl ? "template" : "manual");
    setPrompt(null);
    router.replace("/developer/strategies");
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...payload, name, note: dirty ? undefined : "resave", origin, prompt: prompt ?? undefined };
      const r = detail ? await algoApi<{ id: number; version: number; valid: boolean }>(`strategies/${detail.id}/versions`, { body }) : await algoApi<{ id: number; version: number; valid: boolean }>("strategies", { body });
      toast.success(detail ? t("developer.strat.savedAs", { version: r.version }) : t("developer.strat.saved", { name }), { description: r.valid ? t("developer.strat.readyText") : t("developer.strat.draftText") });
      setDirty(false);
      list.reload();
      router.replace(`/developer/strategies?id=${r.id}`);
      setSelected(r.id);
      await load(r.id);
    } catch (e) {
      algoError(t("developer.strat.saveFailed"), e);
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!detail) return;
    try {
      await algoApi(`strategies/${detail.id}`, { method: "PATCH", body: { status: "archived" } });
      toast.success(t("developer.strat.archived", { name: detail.name }));
      list.reload();
      newFrom(TEMPLATES[0]!);
    } catch (e) {
      algoError(t("developer.strat.archiveFailed"), e);
    }
  };

  const applyAi = (b: Built, p: string) => {
    setPrompt(p);
    setOrigin("ai");
    if (b.kind === "code") {
      setMode("code");
      setCode(b.source ?? b.code);
      setCodeEdited(true);
      setSpec((s) => ({ ...s, symbol: b.spec.symbol, timeframe: b.spec.timeframe }));
    } else {
      setMode("visual");
      setSpec(b.spec);
      setCodeEdited(false);
    }
    setName(b.spec.name);
    setDirty(true);
    toast.success(t("developer.strat.applied"), { description: t("developer.strat.appliedText") });
  };

  const items = list.data?.items ?? [];
  const errors = built?.errors ?? [];

  return (
    <>
      <PageHeader
        title={t("developer.bt.strategyBuilder")}
        subtitle={t("developer.strat.subtitle")}
        actions={
          <>
            <Link href="/developer/deployments">
              <Button variant="surface">
                <Workflow /> {t("developer.dep.title")}
              </Button>
            </Link>
            <Link href={detail ? `/developer/backtests?strategy=${detail.id}` : "/developer/backtests"}>
              <Button variant="surface">
                <FlaskConical /> {t("developer.strat.backtest")}
              </Button>
            </Link>
            <Button variant="ember" onClick={() => newFrom(null)}>
              <Plus /> {t("developer.strat.new")}
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[264px_minmax(0,1fr)] xl:grid-cols-[264px_minmax(0,1fr)_360px]">
        <Reveal className="order-2 space-y-5 lg:order-1">
          <Card>
            <CardHeader title={t("developer.strat.mine")} subtitle={t("developer.strat.nSaved", { count: items.length })} />
            <div className="space-y-1 px-3 pb-4 pt-3">
              {list.loading && <Skeleton className="h-24" />}
              {!list.loading && items.length === 0 && <p className="px-2 text-[12.5px] text-fg-3">{t("developer.strat.none")}</p>}
              {items.map((s) => (
                <button key={s.id} type="button" onClick={() => (router.replace(`/developer/strategies?id=${s.id}`), setSelected(s.id))} className={cn("w-full rounded-[12px] px-3 py-2 text-start transition", selected === s.id ? "bg-surface-3" : "hover:bg-surface-2")}>
                  <div className="flex items-center gap-2">
                    <SymbolAvatar symbol={s.symbol} size={16} />
                    <span className="truncate text-[13px] font-medium text-fg">{s.name}</span>
                    {s.running > 0 && <span className="ms-auto size-1.5 shrink-0 rounded-full bg-ember" title={t("developer.bt.running")} />}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 ps-6 text-[11px] text-fg-3">
                    <span className="font-mono" dir="ltr">
                      {s.symbol} · {s.timeframe}
                    </span>
                    <span>· v{s.version}</span>
                    {s.kind === "code" && <Code2 className="size-3" />}
                    {!s.valid && <span className="text-down">· {t("developer.draft")}</span>}
                    {s.lastBacktest && <span className={cn("ms-auto k-num tabular-nums", s.lastBacktest.returnPct >= 0 ? "text-up" : "text-down")}>{fmtPct(s.lastBacktest.returnPct)}</span>}
                  </div>
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title={t("developer.strat.templates")} subtitle={t("developer.strat.templatesSub")} />
            <div className="space-y-1 px-3 pb-4 pt-3">
              {TEMPLATES.map((tpl) => (
                <button key={tpl.id} type="button" onClick={() => newFrom(tpl)} className="w-full rounded-[12px] px-3 py-2 text-start transition hover:bg-surface-2">
                  <div className="text-[13px] font-medium text-fg">{t(tpl.name)}</div>
                  <div className="text-[11.5px] text-fg-3">{t(tpl.text)}</div>
                </button>
              ))}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.05} className="order-1 min-w-0 lg:order-2">
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 px-4 pt-5 sm:px-6 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <input
                  value={name}
                  onChange={(e) => (setName(e.target.value.slice(0, 60)), setDirty(true))}
                  aria-label={t("developer.strat.nameAria")}
                  className="w-full min-w-0 rounded-lg bg-transparent py-0.5 text-[20px] font-medium tracking-tight text-fg outline-none transition focus:bg-surface-2 focus:px-2"
                />
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-fg-3">
                  {detail ? <Chip size="sm">v{detail.current.version}{dirty ? ` · ${t("developer.strat.edited")}` : ""}</Chip> : <Chip size="sm" tone="gold">{t("common.new")}</Chip>}
                  {built && (built.valid ? <Chip size="sm" tone="up">{t("developer.strat.valid")}</Chip> : <Chip size="sm" tone="down">{t("developer.code.errors", { count: built.errors.length })}</Chip>)}
                  {detail?.deployments.some((d) => d.status === "running") && (
                    <Chip size="sm" tone="ember" dot>
                      {t("developer.bt.running")}
                    </Chip>
                  )}
                  {detail && <span>{t("developer.strat.savedAgo", { ago: ago(detail.current.createdAt) })}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Segmented size="sm" value={mode} onChange={switchMode} options={[{ value: "visual", label: <><LayoutGrid className="size-3.5" /> {t("developer.strat.visual")}</> }, { value: "code", label: <><Code2 className="size-3.5" /> {t("developer.mode.code")}</> }]} />
                {detail && (
                  <Menu
                    trigger={
                      <button type="button" aria-label={t("common.more")} className="grid size-8 place-items-center rounded-full border border-line text-fg-2 hover:bg-surface-3">
                        <MoreHorizontal className="size-4" />
                      </button>
                    }
                    items={[{ label: t("developer.strat.archive"), icon: <Archive />, danger: true, onSelect: archive }]}
                  />
                )}
                <Button variant="ember" size="sm" disabled={saving || (!dirty && !!detail)} onClick={save}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save />} {detail ? t("developer.strat.saveVersion") : t("common.save")}
                </Button>
              </div>
            </div>
            {meta ? (
              <div className="px-4 pb-5 pt-4 sm:px-6">
                {mode === "visual" && (
                  <div className="mb-3">
                    <SymbolPicker spec={spec} onChange={editSpec} meta={meta} />
                  </div>
                )}
                <div className="mb-4 rounded-[14px] border border-line bg-surface-2/50 px-4 py-3">
                  <Summary built={built} />
                </div>
                {mode === "visual" ? (
                  <>
                    <VisualEditor spec={spec} onChange={editSpec} meta={meta} />
                    {errors.length > 0 && (
                      <div className="mt-3 space-y-1 rounded-[12px] border border-down/30 bg-down-soft px-3 py-2 text-[12px] text-down">
                        {errors.map((e, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {e.message}
                          </div>
                        ))}
                      </div>
                    )}
                    {(built?.warnings.length ?? 0) > 0 && <div className="mt-2 text-[11.5px] text-warn">{built!.warnings.join(" · ")}</div>}
                    <div className="mt-5">
                      <div className="k-label mb-1">{t("developer.strat.riskSession")}</div>
                      <SettingsEditor spec={spec} onChange={editSpec} meta={meta} />
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <CodeEditor value={code} onChange={editCode} errors={errors} warnings={built?.warnings ?? []} validating={validating} />
                    <DslReference functions={meta.dsl.functions} settings={meta.dsl.settings} limits={meta.dsl.limits} />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 p-6">
                <Skeleton className="h-10" />
                <Skeleton className="h-40" />
              </div>
            )}
          </Card>
        </Reveal>

        <Reveal delay={0.1} className="order-3 grid grid-cols-1 content-start gap-5 md:grid-cols-2 lg:col-span-2 xl:col-span-1 xl:grid-cols-1">
          {aiOn && <AiAssistant configured={!!meta?.ai.configured} mode={mode} symbol={spec.symbol} timeframe={spec.timeframe} current={mode === "code" ? code : { ...spec, name }} onApply={applyAi} />}
          <DeployCard strategy={dirty ? null : detail} onDeployed={() => detail && load(detail.id)} />
          {detail && detail.backtests.length > 0 && (
            <Card>
              <CardHeader icon={<FlaskConical />} title={t("developer.strat.recentBacktests")} />
              <div className="space-y-1 px-3 pb-4 pt-3">
                {detail.backtests.slice(0, 4).map((b) => (
                  <Link key={b.id} href={`/developer/backtests?id=${b.id}`} className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-[12.5px] hover:bg-surface-2">
                    <span className="font-mono text-fg-3">#{b.id}</span>
                    <span className="text-fg-2">{t.dyn(`developer.btStatus.${b.status}`, b.status)}</span>
                    {b.summary && <span className={cn("ms-auto k-num tabular-nums", b.summary.returnPct >= 0 ? "text-up" : "text-down")}>{fmtPct(b.summary.returnPct)}</span>}
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </Reveal>
      </div>
    </>
  );
}
