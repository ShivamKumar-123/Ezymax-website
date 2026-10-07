"use client";

import * as React from "react";
import { toast } from "@/lib/notify";
import { Bot, CirclePause, CirclePlay, CircleStop, Lock, OctagonX, Trash2 } from "lucide-react";
import { priceFeed } from "@kalks/mock";
import { SymbolAvatar, cn } from "@kalks/ui";
import { journalTime, useTerminal } from "@/lib/store";
import { useMarketClock } from "@/lib/market";
import { accCcy, accMoney, fmtPrice, fmtVol, profitAt } from "@/lib/trading";
import { Td, Th } from "@/components/ui/panel";
import { Badge, Check, Empty, TButton, TDialog, TSelect } from "@/components/ui/primitives";
import { aiTrader, inSession, marketClosedReason, serverHHMM, type AiSnapshot, type LogKind, type RunMode, type StrategyRecord } from "@/lib/ai-trader/runtime";
import { validateSpec, type ParseResult, type StrategySpec } from "@/lib/ai-trader/schema";
import { EXAMPLE_PROMPTS, parseLocal } from "@/lib/ai-trader/parser";
import { describeSide } from "@/lib/ai-trader/describe";
import { SpecSummary, StrategyCard } from "./ai-trader-card";
import { guestNotice, openRegister } from "@/lib/guest";
import { aiDeniedText, aiHeaders } from "@/lib/ai-client";
import { useT } from "@kalks/i18n/react";
import type { T as Tr } from "@kalks/i18n";

const EMPTY: AiSnapshot = { login: null, records: [], attached: false };
export function useAi() {
  return React.useSyncExternalStore(aiTrader.subscribe, aiTrader.getSnapshot, () => EMPTY);
}

const STATUS_TONE = { draft: "neutral", active: "up", paused: "warn", stopped: "down" } as const;

/* ------------------------------------------------------------------ */
/* Tab                                                                 */
/* ------------------------------------------------------------------ */

export function AiTraderTab() {
  const T = useTerminal();
  const t = useT();
  const ai = useAi();
  useMarketClock(); // 1s refresh for P&L / engine info
  const [sel, setSel] = React.useState<string | null>(null);
  const [activating, setActivating] = React.useState<{ id: string; mode: RunMode } | null>(null);
  const [killOpen, setKillOpen] = React.useState(false);
  const selected = ai.records.find((r) => r.id === sel) ?? ai.records[0] ?? null;
  const running = ai.records.filter((r) => r.status === "active" || r.status === "paused");
  const aiPositions = T.positions.filter((p) => p.source === "ai");
  // guest: strategy cards can be built and reviewed; activation needs a trading account
  const activate = (id: string, mode: RunMode) => (T.guest ? guestNotice(t("aiTrader.activatingWhat")) : setActivating({ id, mode }));

  return (
    <div className="flex h-full min-h-0">
      <Composer onCreated={(id) => setSel(id)} />

      {/* strategies */}
      <div className="flex min-w-0 flex-1 flex-col border-r border-line">
        <div className="flex h-8 shrink-0 items-center gap-3 border-b border-line px-2.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-fg-2">{t("aiTrader.strategies")}</span>
          <span className={cn("font-mono text-[11px] text-fg-3", T.guest && "hidden")}>
            {t("aiTrader.running", { count: running.length })} · {t("aiTrader.aiPositions", { count: aiPositions.length })}
          </span>
          {T.guest ? (
            <span className="ms-auto flex min-w-0 items-center gap-1.5 truncate text-[11px] text-fg-3">
              <Lock className="size-3 shrink-0" />
              <span className="truncate">{t("aiTrader.guestPreview")}</span>
              <button onClick={openRegister} className="shrink-0 text-ember hover:underline">
                {t("aiTrader.openAccount")}
              </button>
            </span>
          ) : (
          <TButton size="xs" variant="outline" className="ms-auto border-down/40 text-down hover:border-down hover:text-down" disabled={T.readOnly || (!running.length && !aiPositions.length)} onClick={() => setKillOpen(true)}>
            <OctagonX /> {t("aiTrader.stopAll")}
          </TButton>
          )}
        </div>
        <div className="t-scroll min-h-0 flex-1 overflow-auto">
          {ai.records.length === 0 ? (
            <Empty icon={<Bot />} title={t("aiTrader.emptyTitle")} sub={T.guest ? t("aiTrader.emptyTextGuest") : t("aiTrader.emptyText")} />
          ) : (
            <table className="w-full min-w-[640px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <Th className="ps-3">{t("aiTrader.col.strategy")}</Th>
                  <Th>{t("aiTrader.col.symbol")}</Th>
                  <Th>{t("aiTrader.col.side")}</Th>
                  <Th>{t("aiTrader.col.status")}</Th>
                  <Th right>{t("aiTrader.col.today")}</Th>
                  <Th right>{t("aiTrader.col.open")}</Th>
                  <Th right>{t("aiTrader.col.pnl")}</Th>
                  <Th className="pr-2" />
                </tr>
              </thead>
              <tbody>
                {ai.records.map((r) => (
                  <StrategyRow key={r.id} r={r} selected={selected?.id === r.id} onSelect={() => setSel(r.id)} onActivate={(mode) => activate(r.id, mode)} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* detail */}
      {selected ? <Detail key={selected.id} r={selected} onActivate={(mode) => activate(selected.id, mode)} /> : <div className="hidden w-[460px] shrink-0 xl:block" />}

      {activating && <ActivateDialog id={activating.id} initialMode={activating.mode} onClose={() => setActivating(null)} />}
      <TDialog
        open={killOpen}
        onClose={() => setKillOpen(false)}
        title={t("aiTrader.kill.title")}
        icon={<OctagonX />}
        width={440}
        footer={
          <>
            <TButton variant="ghost" onClick={() => setKillOpen(false)}>
              {t("aiTrader.kill.cancel")}
            </TButton>
            <TButton
              variant="sell"
              onClick={async () => {
                setKillOpen(false);
                const r = await aiTrader.killAll();
                const desc = t("aiTrader.kill.summary", { strategies: r.strategies, positions: r.positions });
                if (r.blocked) toast.warning(t("aiTrader.kill.done"), { description: t("aiTrader.kill.blocked", { summary: desc, count: r.blocked }) });
                else toast.success(t("aiTrader.kill.done"), { description: desc });
              }}
            >
              {t("aiTrader.kill.confirm")}
            </TButton>
          </>
        }
      >
        <div className="space-y-2 p-4 text-[12.5px] text-fg-2">
          <p>{t("aiTrader.kill.text", { strategies: running.length, positions: aiPositions.length, login: T.account.login })}</p>
          <p className="text-fg-3">{t("aiTrader.kill.note")}</p>
        </div>
      </TDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Composer                                                            */
/* ------------------------------------------------------------------ */

function Composer({ onCreated }: { onCreated: (id: string) => void }) {
  const T = useTerminal();
  const t = useT();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [claude, setClaude] = React.useState<boolean | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/ai-trader")
      .then((r) => r.json() as Promise<{ configured: boolean }>)
      .then((d) => alive && setClaude(!!d.configured))
      .catch(() => alive && setClaude(false));
    return () => {
      alive = false;
    };
  }, []);

  const ctx = { symbol: T.activeTab.symbol, timeframe: T.activeTab.tf };
  const local = (prompt: string, why?: string) => {
    const res = parseLocal(prompt, ctx);
    const id = aiTrader.createDraft(res, prompt, "local");
    onCreated(id);
    setNote(why ?? null);
    toast(res.status === "ok" ? t("aiTrader.composer.draftReady") : t("aiTrader.composer.needsAnswers"), { description: why ? t("aiTrader.composer.byLocalNoAi") : t("aiTrader.composer.byLocal") });
  };

  const build = async () => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    if (claude === false) return local(prompt, t("aiTrader.composer.notConfigured"));
    // AI calls need a signed-in session (lib/ai-guard.ts); guests get the local parser
    if (T.guest) return local(prompt, t("desk.ai.signin"));
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/ai-trader", { method: "POST", headers: aiHeaders(T.account.login), body: JSON.stringify({ prompt, ...ctx }) });
      const data = (await res.json()) as { configured?: boolean; error?: string; code?: string; result?: ParseResult };
      if (data.configured === false) {
        setClaude(false);
        return local(prompt, t("aiTrader.composer.notConfigured"));
      }
      const denied = aiDeniedText(t, data.code);
      if (denied) return local(prompt, denied);
      if (!res.ok || !data.result) {
        setNote(t("aiTrader.composer.failedNote", { error: data.error ?? t("aiTrader.composer.failed") }));
        toast.error(t("aiTrader.composer.failedToast"), { description: data.error, action: { label: t("aiTrader.composer.parseLocally"), onClick: () => local(prompt) } });
        return;
      }
      const id = aiTrader.createDraft(data.result, prompt, "claude");
      onCreated(id);
      toast.success(data.result.status === "ok" ? t("aiTrader.composer.draftReady") : t("aiTrader.composer.needsAnswers"), { description: t("aiTrader.composer.byClaude") });
    } catch {
      setNote(t("aiTrader.composer.unreachable"));
      local(prompt, t("aiTrader.composer.unreachable"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-[300px] shrink-0 flex-col border-r border-line 2xl:w-[340px]">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-2.5">
        <Bot className="size-3.5 text-ember" />
        <span className="min-w-0 truncate text-[10.5px] font-semibold uppercase tracking-[0.09em] text-fg-2">{t("aiTrader.composer.title")}</span>
        <span className="ms-auto shrink-0 whitespace-nowrap">{T.guest && claude ? <Badge tone="warn">{t("desk.ai.signin")}</Badge> : claude === null ? <Badge>{t("aiTrader.composer.checking")}</Badge> : claude ? <Badge tone="ember">{t("aiTrader.composer.claude")}</Badge> : <Badge tone="warn">{t("aiTrader.composer.local")}</Badge>}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2.5">
        <textarea
          aria-label={t("aiTrader.composer.inputAria")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void build();
            }
            e.stopPropagation();
          }}
          placeholder={t("aiTrader.composer.placeholder", { symbol: T.activeTab.symbol, tf: T.activeTab.tf })}
          className="t-scroll min-h-[64px] w-full flex-1 resize-none rounded-[6px] border border-line bg-surface-2 p-2 text-[12px] leading-[18px] text-fg outline-none placeholder:text-fg-3 focus:border-ember/60"
        />
        {note && <div className="rounded-[5px] border border-warn/25 bg-warn-soft px-2 py-1 text-[11px] leading-[15px] text-warn">{note}</div>}
        <div className="flex items-center gap-1.5">
          <TSelect
            ariaLabel={t("aiTrader.composer.examplesAria")}
            value=""
            onChange={(v) => v && setText(v)}
            options={[{ value: "", label: t("aiTrader.composer.examples") }, ...EXAMPLE_PROMPTS.map((p) => ({ value: p, label: p.slice(0, 60) + "…" }))]}
            className="h-7 min-w-0 flex-1 text-[11.5px]"
          />
          <TButton variant="ember" disabled={!text.trim() || busy} onClick={() => void build()}>
            {busy ? t("aiTrader.composer.converting") : t("aiTrader.composer.build")}
          </TButton>
        </div>
        <div className="text-[10.5px] leading-[14px] text-fg-3">{T.guest ? t("aiTrader.composer.hintGuest") : t("aiTrader.composer.hint")}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

function strategyPnl(r: StrategyRecord) {
  return r.realized + aiTrader.floating(r.id);
}
function openCount(r: StrategyRecord) {
  return r.mode === "paper" ? r.paper.length : r.openTickets.length;
}

function StrategyRow({ r, selected, onSelect, onActivate }: { r: StrategyRecord; selected: boolean; onSelect: () => void; onActivate: (m: RunMode) => void }) {
  const T = useTerminal();
  const t = useT();
  const pnl = strategyPnl(r);
  const side = describeSide(r.spec);
  return (
    <tr onClick={onSelect} className={cn("group cursor-default", selected ? "bg-ember-soft/50" : "hover:bg-surface-2/70")}>
      <Td className={cn("max-w-[220px] ps-3", selected && "shadow-[inset_2px_0_0_var(--k-ember)] rtl:shadow-[inset_-2px_0_0_var(--k-ember)]")}>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="font-mono text-[10.5px] text-fg-3">{r.id}</span>
          <span className="truncate font-medium text-fg">{r.spec.name}</span>
        </span>
      </Td>
      <Td>
        <span className="flex items-center gap-1.5 text-fg-2">
          <SymbolAvatar symbol={r.spec.symbol} size={13} />
          {r.spec.symbol}
          <span className="font-mono text-[10.5px] text-fg-3">{r.spec.timeframe}</span>
        </span>
      </Td>
      <Td>
        <span className={side === "Buy" ? "text-up" : side === "Sell" ? "text-down" : "text-gold"}>{t(side === "Buy" ? "aiTrader.side.buy" : side === "Sell" ? "aiTrader.side.sell" : "aiTrader.side.both")}</span>
      </Td>
      <Td>
        <span className="flex items-center gap-1">
          <Badge tone={STATUS_TONE[r.status]}>{t(`aiTrader.status.${r.status}`)}</Badge>
          {r.status !== "draft" && <Badge tone={r.mode === "live" ? "ember" : "info"}>{t(`aiTrader.mode.${r.mode}`)}</Badge>}
        </span>
      </Td>
      <Td right mono className="text-fg-2">
        {r.tradesToday}
        {r.spec.maxTradesPerDay ? <span className="text-fg-3">/{r.spec.maxTradesPerDay}</span> : null}
      </Td>
      <Td right mono className="text-fg-2">
        {openCount(r)}
      </Td>
      <Td right mono className={pnl > 0 ? "text-up" : pnl < 0 ? "text-down" : "text-fg-3"}>
        {accMoney(T.account, pnl, { signed: true })}
      </Td>
      <Td className="w-[92px] pe-2">
        <span className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <RowActions r={r} onActivate={onActivate} />
        </span>
      </Td>
    </tr>
  );
}

function IconBtn({ label, onClick, children, tone, disabled }: { label: string; onClick: () => void; children: React.ReactNode; tone?: "down"; disabled?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn("grid size-5 place-items-center rounded-[4px] text-fg-3 disabled:opacity-35 [&_svg]:size-3.5", tone === "down" ? "hover:bg-down-soft hover:text-down" : "hover:bg-surface-3 hover:text-fg")}
    >
      {children}
    </button>
  );
}

function RowActions({ r, onActivate }: { r: StrategyRecord; onActivate: (m: RunMode) => void }) {
  const T = useTerminal();
  const t = useT();
  return (
    <>
      {r.status === "active" && (
        <IconBtn label={t("aiTrader.action.pause")} onClick={() => (aiTrader.pause(r.id), toast(t("aiTrader.toast.paused", { name: r.spec.name }), { description: t("aiTrader.toast.pausedText") }))}>
          <CirclePause />
        </IconBtn>
      )}
      {r.status === "paused" && (
        <IconBtn label={t("aiTrader.action.resume")} onClick={() => (aiTrader.resume(r.id), toast.success(t("aiTrader.toast.resumed", { name: r.spec.name })))}>
          <CirclePlay />
        </IconBtn>
      )}
      {(r.status === "draft" || r.status === "stopped") && (
        <IconBtn label={t("aiTrader.action.activate")} onClick={() => onActivate("paper")}>
          <CirclePlay />
        </IconBtn>
      )}
      {(r.status === "active" || r.status === "paused") && (
        <IconBtn label={t("aiTrader.action.stopKeep")} disabled={T.readOnly && r.mode === "live"} onClick={() => (aiTrader.stop(r.id, false), toast(t("aiTrader.toast.stopped", { name: r.spec.name }), { description: t("aiTrader.toast.stoppedText") }))}>
          <CircleStop />
        </IconBtn>
      )}
      <IconBtn
        label={t("aiTrader.action.delete")}
        tone="down"
        disabled={r.status === "active" || r.status === "paused"}
        onClick={() => {
          aiTrader.remove(r.id);
          toast(t("aiTrader.toast.deleted", { name: r.spec.name }));
        }}
      >
        <Trash2 />
      </IconBtn>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Detail: card + log                                                  */
/* ------------------------------------------------------------------ */

function Detail({ r, onActivate }: { r: StrategyRecord; onActivate: (m: RunMode) => void }) {
  const T = useTerminal();
  const t = useT();
  const [tab, setTab] = React.useState<"card" | "log">(r.status === "draft" ? "card" : "log");
  const [draft, setDraft] = React.useState<StrategySpec>(r.spec);
  React.useEffect(() => {
    setDraft(r.spec);
  }, [r.spec]);
  const editable = r.status === "draft" || r.status === "stopped";
  const dirty = JSON.stringify(draft) !== JSON.stringify(r.spec);
  const v = React.useMemo(() => validateSpec(draft), [draft]);
  const info = aiTrader.engineInfo(r.id);
  const closed = marketClosedReason(r.spec.symbol);

  const save = () => {
    if (v.errors.length) return void toast.error(t("aiTrader.toast.fixFirst"), { description: v.errors[0] });
    aiTrader.updateSpec(r.id, v.spec);
    toast.success(t("aiTrader.toast.saved"));
  };

  return (
    <div className="flex w-[460px] shrink-0 flex-col 2xl:w-[520px]">
      <div className="flex h-8 shrink-0 items-stretch border-b border-line ps-1 pe-1.5">
        {(["card", "log"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={cn("relative px-2.5 text-[11.5px] font-medium", tab === k ? "text-fg" : "text-fg-3 hover:text-fg-2")}>
            {k === "card" ? t("aiTrader.detail.card") : t("aiTrader.detail.log", { count: r.log.length })}
            {tab === k && <span className="absolute inset-x-1.5 bottom-0 h-[2px] rounded-full bg-ember" />}
          </button>
        ))}
        <span className="ms-auto flex items-center gap-1">
          {editable && dirty && (
            <>
              <TButton size="xs" variant="ghost" onClick={() => setDraft(r.spec)}>
                {t("aiTrader.detail.revert")}
              </TButton>
              <TButton size="xs" variant="surface" onClick={save}>
                {t("aiTrader.detail.save")}
              </TButton>
            </>
          )}
          {editable && (
            <TButton size="xs" variant={T.guest ? "surface" : "ember"} disabled={dirty || v.errors.length > 0} title={dirty ? t("aiTrader.detail.saveFirst") : (v.errors[0] ?? (T.guest ? t("trader.guest.title") : undefined))} onClick={() => onActivate("paper")}>
              {T.guest && <Lock />}
              {t("aiTrader.detail.activate")}
            </TButton>
          )}
          {r.status === "active" && r.mode === "paper" && (
            <TButton size="xs" variant="ember" disabled={T.readOnly} title={T.readOnly ? t("aiTrader.detail.investorNoLive") : undefined} onClick={() => onActivate("live")}>
              {t("aiTrader.detail.goLive")}
            </TButton>
          )}
          {r.status === "active" && r.mode === "live" && (
            <TButton size="xs" variant="outline" onClick={() => (aiTrader.activate(r.id, "paper"), toast(t("aiTrader.toast.toPaper")))}>
              {t("aiTrader.detail.switchToPaper")}
            </TButton>
          )}
          {(r.status === "active" || r.status === "paused") && openCount(r) > 0 && (
            <TButton size="xs" variant="outline" disabled={T.readOnly && r.mode === "live"} onClick={() => (aiTrader.stop(r.id, true), toast(t("aiTrader.toast.stoppedClosed", { name: r.spec.name })))}>
              {t("aiTrader.detail.stopClose")}
            </TButton>
          )}
        </span>
      </div>

      {/* status strip */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-line bg-panel-2/60 px-3 py-1 font-mono text-[10.5px] text-fg-3">
        <span>
          <Badge tone={STATUS_TONE[r.status]}>{t(`aiTrader.status.${r.status}`)}</Badge> {r.status !== "draft" && <Badge tone={r.mode === "live" ? "ember" : "info"}>{t(`aiTrader.mode.${r.mode}`)}</Badge>}
        </span>
        <span>{t(r.origin === "claude" ? "aiTrader.detail.byClaude" : r.origin === "local" ? "aiTrader.detail.byLocal" : "aiTrader.detail.byManual")}</span>
        {info && (
          <span>
            {info.status === "loading" ? t("aiTrader.detail.loadingHistory") : t("aiTrader.detail.bars", { count: info.bars, tf: r.spec.timeframe, source: info.source })}
            {info.nextClose ? ` · ${t("aiTrader.detail.nextClose", { time: serverHHMM(info.nextClose) })}` : ""}
          </span>
        )}
        {r.status === "active" && !inSession(r.spec) && <span className="text-warn">{t("aiTrader.detail.outsideWindow")}</span>}
        {r.status !== "draft" && closed && <span className="text-warn">{closed}</span>}
        <span>
          {t("aiTrader.detail.winLoss", { wins: r.wins, losses: r.trades - r.wins })} · {t("aiTrader.detail.realised")} <span className={r.realized >= 0 ? "text-up" : "text-down"}>{accMoney(T.account, r.realized, { signed: true })}</span> {accCcy(T.account)}
        </span>
      </div>

      {tab === "card" ? (
        <div className="t-scroll min-h-0 flex-1 overflow-y-auto">
          {(r.questions.length > 0 || v.errors.length > 0 || v.warnings.length > 0 || r.assumptions.length > 0) && (
            <div className="space-y-1 border-b border-line/70 px-3 py-2 text-[11.5px] leading-[16px]">
              {v.errors.map((e) => (
                <div key={`e${e}`} className="text-down">
                  {t("aiTrader.detail.error", { text: e })}
                </div>
              ))}
              {editable &&
                r.questions
                  .filter((q) => !v.errors.includes(q))
                  .map((q) => (
                    <div key={`q${q}`} className="text-warn">
                      {t("aiTrader.detail.question", { text: q })}
                    </div>
                  ))}
              {v.warnings.map((w) => (
                <div key={`w${w}`} className="text-fg-2">
                  {t("aiTrader.detail.note", { text: w })}
                </div>
              ))}
              {r.assumptions.map((a) => (
                <div key={`a${a}`} className="text-fg-3">
                  {t("aiTrader.detail.assumed", { text: a })}
                </div>
              ))}
            </div>
          )}
          <StrategyCard spec={draft} onChange={setDraft} editable={editable} />
          {r.prompt && (
            <div className="px-3 py-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-fg-3">{t("aiTrader.detail.prompt")}</div>
              <div className="text-[11.5px] leading-[16px] text-fg-2">{r.prompt}</div>
            </div>
          )}
          {r.mode === "paper" && r.paper.length > 0 && <PaperTable r={r} />}
        </div>
      ) : (
        <LogView r={r} />
      )}
    </div>
  );
}

function PaperTable({ r }: { r: StrategyRecord }) {
  const T = useTerminal();
  const t = useT();
  const q = priceFeed().snapshot(r.spec.symbol);
  return (
    <div className="border-t border-line/70 px-3 py-2">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-fg-3">{t("aiTrader.detail.paperPositions")}</div>
      {r.paper.map((p) => {
        const px = q ? (p.side === "buy" ? q.bid : q.ask) : p.open;
        const pr = profitAt({ symbol: r.spec.symbol, side: p.side, volume: p.volume, openPrice: p.open }, px);
        return (
          <div key={p.id} className="flex gap-3 font-mono text-[11px] text-fg-2">
            <span className={p.side === "buy" ? "text-up" : "text-down"}>{t(p.side === "buy" ? "aiTrader.side.buy" : "aiTrader.side.sell")}</span>
            <span>{fmtVol(p.volume)}</span>
            <span>@ {fmtPrice(r.spec.symbol, p.open)}</span>
            <span>SL {p.sl !== undefined ? fmtPrice(r.spec.symbol, p.sl) : "—"}</span>
            <span>TP {p.tp !== undefined ? fmtPrice(r.spec.symbol, p.tp) : "—"}</span>
            <span className={cn("ms-auto", pr >= 0 ? "text-up" : "text-down")}>{accMoney(T.account, pr, { signed: true })}</span>
          </div>
        );
      })}
    </div>
  );
}

const KIND_CLS: Record<LogKind, string> = {
  eval: "text-fg-3",
  signal: "text-fg",
  order: "text-ember",
  manage: "text-gold",
  close: "text-info",
  error: "text-down",
  info: "text-fg-2",
};

function LogView({ r }: { r: StrategyRecord }) {
  const t = useT();
  const [filter, setFilter] = React.useState<"all" | "trades" | "eval" | "error">("all");
  const ref = React.useRef<HTMLDivElement>(null);
  const lines = r.log.filter((l) => filter === "all" || (filter === "trades" ? ["signal", "order", "manage", "close"].includes(l.kind) : filter === "eval" ? l.kind === "eval" : l.kind === "error"));
  React.useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines.length]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-7 shrink-0 items-center gap-0.5 border-b border-line/70 px-2">
        {(
          [
            ["all", t("aiTrader.log.all")],
            ["trades", t("aiTrader.log.trades")],
            ["eval", t("aiTrader.log.eval")],
            ["error", t("aiTrader.log.errors")],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={cn("h-5 rounded-[4px] px-1.5 text-[10.5px]", filter === k ? "bg-surface-3 text-fg" : "text-fg-3 hover:text-fg-2")}>
            {l}
          </button>
        ))}
        <button onClick={() => aiTrader.clearLog(r.id)} className="ms-auto h-5 rounded-[4px] px-1.5 text-[10.5px] text-fg-3 hover:text-fg">
          {t("aiTrader.log.clear")}
        </button>
      </div>
      <div ref={ref} className="t-scroll min-h-0 flex-1 overflow-auto py-1 font-mono text-[11px] leading-[17px]">
        {lines.map((l, i) => (
          <div key={`${l.ts}-${i}`} className="flex gap-2 px-3 hover:bg-surface-2/60">
            <span className="shrink-0 text-fg-3">{journalTime(l.ts).slice(11, 19)}</span>
            <span className={cn("w-[52px] shrink-0 uppercase", KIND_CLS[l.kind])}>{t(`aiTrader.log.kind.${l.kind}`)}</span>
            <span className={cn("min-w-0 break-words", l.kind === "eval" ? "text-fg-3" : l.kind === "error" ? "text-down" : "text-fg-2")}>{l.text}</span>
          </div>
        ))}
        {!lines.length && <div className="px-3 py-2 text-fg-3">{t("aiTrader.log.empty")}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Activation confirmation                                             */
/* ------------------------------------------------------------------ */

function ActivateDialog({ id, initialMode, onClose }: { id: string; initialMode: RunMode; onClose: () => void }) {
  const T = useTerminal();
  const t = useT();
  const ai = useAi();
  const r = ai.records.find((x) => x.id === id);
  const [mode, setMode] = React.useState<RunMode>(T.readOnly ? "paper" : initialMode);
  const [ack, setAck] = React.useState(false);
  if (!r) return null;
  const { errors } = validateSpec(r.spec);
  const a = T.account;
  const liveBlocked = T.readOnly;
  const canGo = !errors.length && (mode === "paper" || (ack && !liveBlocked));
  return (
    <TDialog
      open
      onClose={onClose}
      title={mode === "live" ? t("aiTrader.activate.titleLive") : t("aiTrader.activate.titlePaper")}
      subtitle={`${r.id} · ${r.spec.name}`}
      icon={<Bot />}
      width={560}
      footer={
        <>
          <TButton variant="ghost" onClick={onClose}>
            {t("aiTrader.activate.cancel")}
          </TButton>
          <TButton
            variant={mode === "live" ? "ember" : "surface"}
            disabled={!canGo}
            onClick={() => {
              aiTrader.activate(r.id, mode);
              onClose();
              toast.success(mode === "live" ? t("aiTrader.activate.liveToast") : t("aiTrader.activate.paperToast"), { description: t("aiTrader.activate.toastText", { symbol: r.spec.symbol, tf: r.spec.timeframe }) });
            }}
          >
            {mode === "live" ? t("aiTrader.activate.sendLive", { login: a.login }) : t("aiTrader.activate.startPaper")}
          </TButton>
        </>
      }
    >
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-1.5">
          {(["paper", "live"] as const).map((m) => (
            <button
              key={m}
              disabled={m === "live" && liveBlocked}
              onClick={() => setMode(m)}
              className={cn("rounded-[7px] border px-3 py-2 text-start disabled:opacity-40", mode === m ? "border-ember/60 bg-ember-soft" : "border-line bg-surface-2 hover:border-fg-3/40")}
            >
              <div className="text-[12.5px] font-medium text-fg">{m === "paper" ? t("aiTrader.activate.paper") : t("aiTrader.activate.live")}</div>
              <div className="text-[11px] leading-[15px] text-fg-3">{m === "paper" ? t("aiTrader.activate.paperText") : liveBlocked ? t("aiTrader.activate.liveBlocked") : t("aiTrader.activate.liveText", { type: accType(t, a.type), login: a.login, mode: accMode(t, a.mode) })}</div>
            </button>
          ))}
        </div>
        <div className="rounded-[7px] border border-line bg-surface-2/60 p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] text-fg-3">
            {t("aiTrader.activate.account")} <span className="font-mono text-fg">{a.login}</span> · {accType(t, a.type)} · {accMode(t, a.mode)} · {a.group} · 1:{a.leverage}
          </div>
          <SpecSummary spec={r.spec} />
        </div>
        {errors.length > 0 && <div className="text-[12px] text-down">{t("aiTrader.activate.cannot", { errors: errors.join("; ") })}</div>}
        {mode === "live" && !liveBlocked && (
          <div className="space-y-2">
            {r.paperRuns === 0 && <div className="rounded-[6px] border border-warn/30 bg-warn-soft px-2.5 py-1.5 text-[11.5px] text-warn">{t("aiTrader.activate.noPaperRun")}</div>}
            {a.type === "live" && <div className="rounded-[6px] border border-down/30 bg-down-soft px-2.5 py-1.5 text-[11.5px] text-down">{t("aiTrader.activate.realMoney")}</div>}
            <Check checked={ack} onChange={setAck} label={t("aiTrader.activate.ack", { lots: r.spec.maxLots.toFixed(2), symbol: r.spec.symbol })} className="items-start text-[12px] leading-[16px]" />
          </div>
        )}
        <div className="text-[11px] leading-[15px] text-fg-3">{t("aiTrader.activate.footer")}</div>
      </div>
    </TDialog>
  );
}

/** Account type / mode words, translated where the catalog has them. */
function accType(t: Tr, v: string) {
  return t.dyn(`market.nav.accountType.${v}`, v);
}
function accMode(t: Tr, v: string) {
  return t.dyn(`order.mode.${v}`, v);
}
