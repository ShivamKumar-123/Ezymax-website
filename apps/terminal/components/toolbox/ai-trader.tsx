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
import { GUEST_TITLE, guestNotice, openRegister } from "@/lib/guest";

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
  const ai = useAi();
  useMarketClock(); // 1s refresh for P&L / engine info
  const [sel, setSel] = React.useState<string | null>(null);
  const [activating, setActivating] = React.useState<{ id: string; mode: RunMode } | null>(null);
  const [killOpen, setKillOpen] = React.useState(false);
  const selected = ai.records.find((r) => r.id === sel) ?? ai.records[0] ?? null;
  const running = ai.records.filter((r) => r.status === "active" || r.status === "paused");
  const aiPositions = T.positions.filter((p) => p.source === "ai");
  // guest: strategy cards can be built and reviewed; activation needs a trading account
  const activate = (id: string, mode: RunMode) => (T.guest ? guestNotice("Activating an AI strategy") : setActivating({ id, mode }));

  return (
    <div className="flex h-full min-h-0">
      <Composer onCreated={(id) => setSel(id)} />

      {/* strategies */}
      <div className="flex min-w-0 flex-1 flex-col border-r border-line">
        <div className="flex h-8 shrink-0 items-center gap-3 border-b border-line px-2.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-fg-2">Strategies</span>
          <span className={cn("font-mono text-[11px] text-fg-3", T.guest && "hidden")}>
            {running.length} running · {aiPositions.length} AI position{aiPositions.length === 1 ? "" : "s"}
          </span>
          {T.guest ? (
            <span className="ml-auto flex min-w-0 items-center gap-1.5 truncate text-[11px] text-fg-3">
              <Lock className="size-3 shrink-0" />
              <span className="truncate">Preview · activation opens with trading accounts</span>
              <button onClick={openRegister} className="shrink-0 text-ember hover:underline">
                Open account
              </button>
            </span>
          ) : (
          <TButton size="xs" variant="outline" className="ml-auto border-down/40 text-down hover:border-down hover:text-down" disabled={T.readOnly || (!running.length && !aiPositions.length)} onClick={() => setKillOpen(true)}>
            <OctagonX /> Stop all AI + close AI positions
          </TButton>
          )}
        </div>
        <div className="t-scroll min-h-0 flex-1 overflow-auto">
          {ai.records.length === 0 ? (
            <Empty icon={<Bot />} title="No AI strategies yet" sub={T.guest ? "Describe entry and exit conditions on the left. The AI turns them into a strategy card you can review now and activate once trading accounts open." : "Describe entry and exit conditions on the left. The AI turns them into a strategy card you review and activate."} />
          ) : (
            <table className="w-full min-w-[640px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <Th className="pl-3">Strategy</Th>
                  <Th>Symbol</Th>
                  <Th>Side</Th>
                  <Th>Status</Th>
                  <Th right>Today</Th>
                  <Th right>Open</Th>
                  <Th right>P&amp;L</Th>
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
        title="Stop all AI trading"
        icon={<OctagonX />}
        width={440}
        footer={
          <>
            <TButton variant="ghost" onClick={() => setKillOpen(false)}>
              Cancel
            </TButton>
            <TButton
              variant="sell"
              onClick={() => {
                const r = aiTrader.killAll();
                setKillOpen(false);
                const desc = `${r.strategies} strateg${r.strategies === 1 ? "y" : "ies"} stopped · ${r.positions} AI position${r.positions === 1 ? "" : "s"} closed`;
                if (r.blocked) toast.warning("AI trading stopped", { description: `${desc} · ${r.blocked} left open, market closed (see Journal)` });
                else toast.success("AI trading stopped", { description: desc });
              }}
            >
              Stop all and close
            </TButton>
          </>
        }
      >
        <div className="space-y-2 p-4 text-[12.5px] text-fg-2">
          <p>
            This stops <span className="text-fg">{running.length}</span> running strateg{running.length === 1 ? "y" : "ies"} and closes <span className="text-fg">{aiPositions.length}</span> AI position{aiPositions.length === 1 ? "" : "s"} at market on account <span className="font-mono text-fg">{T.account.login}</span>. Paper positions are closed too.
          </p>
          <p className="text-fg-3">Manual, copy and API positions are not touched.</p>
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
    toast(res.status === "ok" ? "Strategy draft ready" : "Draft needs answers", { description: `Local parser${why ? " (AI not configured)" : ""} · review the card before activating` });
  };

  const build = async () => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    if (claude === false) return local(prompt, "AI not configured: parsed with the local rule parser. Set ANTHROPIC_API_KEY to use Claude.");
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/ai-trader", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, ...ctx }) });
      const data = (await res.json()) as { configured?: boolean; error?: string; result?: ParseResult };
      if (data.configured === false) {
        setClaude(false);
        return local(prompt, data.error ?? "AI not configured: parsed with the local rule parser.");
      }
      if (!res.ok || !data.result) {
        setNote(`${data.error ?? "Conversion failed"}. You can use the local parser instead.`);
        toast.error("AI conversion failed", { description: data.error, action: { label: "Parse locally", onClick: () => local(prompt) } });
        return;
      }
      const id = aiTrader.createDraft(data.result, prompt, "claude");
      onCreated(id);
      toast.success(data.result.status === "ok" ? "Strategy draft ready" : "Draft needs answers", { description: "Claude · review the card before activating" });
    } catch {
      setNote("Could not reach the AI service. Parsed locally instead.");
      local(prompt, "Could not reach the AI service. Parsed locally instead.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-[300px] shrink-0 flex-col border-r border-line 2xl:w-[340px]">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-2.5">
        <Bot className="size-3.5 text-ember" />
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-fg-2">Describe a strategy</span>
        <span className="ml-auto">{claude === null ? <Badge>Checking</Badge> : claude ? <Badge tone="ember">Claude</Badge> : <Badge tone="warn">Local parser</Badge>}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2.5">
        <textarea
          aria-label="Strategy instructions"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void build();
            }
            e.stopPropagation();
          }}
          placeholder={`e.g. Buy ${T.activeTab.symbol} 0.10 lot on ${T.activeTab.tf} when RSI(14) crosses above 30 and price is above EMA 200, SL 150 points, TP 300 points, trailing 100 points, only 08:00-17:00, max 3 trades/day`}
          className="t-scroll min-h-[64px] w-full flex-1 resize-none rounded-[6px] border border-line bg-surface-2 p-2 text-[12px] leading-[18px] text-fg outline-none placeholder:text-fg-3 focus:border-ember/60"
        />
        {note && <div className="rounded-[5px] border border-warn/25 bg-warn-soft px-2 py-1 text-[11px] leading-[15px] text-warn">{note}</div>}
        <div className="flex items-center gap-1.5">
          <TSelect
            ariaLabel="Example prompts"
            value=""
            onChange={(v) => v && setText(v)}
            options={[{ value: "", label: "Examples…" }, ...EXAMPLE_PROMPTS.map((p) => ({ value: p, label: p.slice(0, 60) + "…" }))]}
            className="h-7 min-w-0 flex-1 text-[11.5px]"
          />
          <TButton variant="ember" disabled={!text.trim() || busy} onClick={() => void build()}>
            {busy ? "Converting…" : "Build strategy"}
          </TButton>
        </div>
        <div className="text-[10.5px] leading-[14px] text-fg-3">{T.guest ? `Preview: build and review strategy cards on live market data. ${GUEST_TITLE}; activation unlocks then.` : "Nothing trades until you review the card and activate it. First activation runs in Paper mode (signals only)."}</div>
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
  const pnl = strategyPnl(r);
  const side = describeSide(r.spec);
  return (
    <tr onClick={onSelect} className={cn("group cursor-default", selected ? "bg-ember-soft/50" : "hover:bg-surface-2/70")}>
      <Td className={cn("max-w-[220px] pl-3", selected && "shadow-[inset_2px_0_0_var(--k-ember)]")}>
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
        <span className={side === "Buy" ? "text-up" : side === "Sell" ? "text-down" : "text-gold"}>{side}</span>
      </Td>
      <Td>
        <span className="flex items-center gap-1">
          <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
          {r.status !== "draft" && <Badge tone={r.mode === "live" ? "ember" : "info"}>{r.mode}</Badge>}
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
      <Td className="w-[92px] pr-2">
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
  return (
    <>
      {r.status === "active" && (
        <IconBtn label="Pause" onClick={() => (aiTrader.pause(r.id), toast(`Paused ${r.spec.name}`, { description: "No new entries; stops still managed" }))}>
          <CirclePause />
        </IconBtn>
      )}
      {r.status === "paused" && (
        <IconBtn label="Resume" onClick={() => (aiTrader.resume(r.id), toast.success(`Resumed ${r.spec.name}`))}>
          <CirclePlay />
        </IconBtn>
      )}
      {(r.status === "draft" || r.status === "stopped") && (
        <IconBtn label="Activate" onClick={() => onActivate("paper")}>
          <CirclePlay />
        </IconBtn>
      )}
      {(r.status === "active" || r.status === "paused") && (
        <IconBtn label="Stop (keep positions)" disabled={T.readOnly && r.mode === "live"} onClick={() => (aiTrader.stop(r.id, false), toast(`Stopped ${r.spec.name}`, { description: "Open positions keep their SL/TP" }))}>
          <CircleStop />
        </IconBtn>
      )}
      <IconBtn
        label="Delete"
        tone="down"
        disabled={r.status === "active" || r.status === "paused"}
        onClick={() => {
          aiTrader.remove(r.id);
          toast(`Deleted ${r.spec.name}`);
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
  const [tab, setTab] = React.useState<"card" | "log">(r.status === "draft" ? "card" : "log");
  const [draft, setDraft] = React.useState<StrategySpec>(r.spec);
  React.useEffect(() => setDraft(r.spec), [r.spec]);
  const editable = r.status === "draft" || r.status === "stopped";
  const dirty = JSON.stringify(draft) !== JSON.stringify(r.spec);
  const v = React.useMemo(() => validateSpec(draft), [draft]);
  const info = aiTrader.engineInfo(r.id);
  const closed = marketClosedReason(r.spec.symbol);

  const save = () => {
    if (v.errors.length) return void toast.error("Fix the strategy first", { description: v.errors[0] });
    aiTrader.updateSpec(r.id, v.spec);
    toast.success("Strategy saved");
  };

  return (
    <div className="flex w-[460px] shrink-0 flex-col 2xl:w-[520px]">
      <div className="flex h-8 shrink-0 items-stretch border-b border-line pl-1 pr-1.5">
        {(["card", "log"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={cn("relative px-2.5 text-[11.5px] font-medium", tab === k ? "text-fg" : "text-fg-3 hover:text-fg-2")}>
            {k === "card" ? "Strategy card" : `Log (${r.log.length})`}
            {tab === k && <span className="absolute inset-x-1.5 bottom-0 h-[2px] rounded-full bg-ember" />}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1">
          {editable && dirty && (
            <>
              <TButton size="xs" variant="ghost" onClick={() => setDraft(r.spec)}>
                Revert
              </TButton>
              <TButton size="xs" variant="surface" onClick={save}>
                Save
              </TButton>
            </>
          )}
          {editable && (
            <TButton size="xs" variant={T.guest ? "surface" : "ember"} disabled={dirty || v.errors.length > 0} title={dirty ? "Save changes first" : (v.errors[0] ?? (T.guest ? GUEST_TITLE : undefined))} onClick={() => onActivate("paper")}>
              {T.guest && <Lock />}
              Activate…
            </TButton>
          )}
          {r.status === "active" && r.mode === "paper" && (
            <TButton size="xs" variant="ember" disabled={T.readOnly} title={T.readOnly ? "Investor session: live trading disabled" : undefined} onClick={() => onActivate("live")}>
              Go live…
            </TButton>
          )}
          {r.status === "active" && r.mode === "live" && (
            <TButton size="xs" variant="outline" onClick={() => (aiTrader.activate(r.id, "paper"), toast("Switched to paper mode"))}>
              Switch to paper
            </TButton>
          )}
          {(r.status === "active" || r.status === "paused") && openCount(r) > 0 && (
            <TButton size="xs" variant="outline" disabled={T.readOnly && r.mode === "live"} onClick={() => (aiTrader.stop(r.id, true), toast(`Stopped ${r.spec.name} and closed its positions`))}>
              Stop + close
            </TButton>
          )}
        </span>
      </div>

      {/* status strip */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-line bg-panel-2/60 px-3 py-1 font-mono text-[10.5px] text-fg-3">
        <span>
          <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> {r.status !== "draft" && <Badge tone={r.mode === "live" ? "ember" : "info"}>{r.mode}</Badge>}
        </span>
        <span>{r.origin === "claude" ? "Built by Claude" : r.origin === "local" ? "Local parser" : "Manual"}</span>
        {info && (
          <span>
            {info.status === "loading" ? "Loading history…" : `${info.bars} ${r.spec.timeframe} bars (${info.source})`}
            {info.nextClose ? ` · next close ${serverHHMM(info.nextClose)}` : ""}
          </span>
        )}
        {r.status === "active" && !inSession(r.spec) && <span className="text-warn">outside window</span>}
        {r.status !== "draft" && closed && <span className="text-warn">{closed}</span>}
        <span>
          W/L {r.wins}/{r.trades - r.wins} · realised <span className={r.realized >= 0 ? "text-up" : "text-down"}>{accMoney(T.account, r.realized, { signed: true })}</span> {accCcy(T.account)}
        </span>
      </div>

      {tab === "card" ? (
        <div className="t-scroll min-h-0 flex-1 overflow-y-auto">
          {(r.questions.length > 0 || v.errors.length > 0 || v.warnings.length > 0 || r.assumptions.length > 0) && (
            <div className="space-y-1 border-b border-line/70 px-3 py-2 text-[11.5px] leading-[16px]">
              {v.errors.map((e) => (
                <div key={`e${e}`} className="text-down">
                  Error: {e}
                </div>
              ))}
              {editable &&
                r.questions
                  .filter((q) => !v.errors.includes(q))
                  .map((q) => (
                    <div key={`q${q}`} className="text-warn">
                      Question: {q}
                    </div>
                  ))}
              {v.warnings.map((w) => (
                <div key={`w${w}`} className="text-fg-2">
                  Note: {w}
                </div>
              ))}
              {r.assumptions.map((a) => (
                <div key={`a${a}`} className="text-fg-3">
                  Assumed: {a}
                </div>
              ))}
            </div>
          )}
          <StrategyCard spec={draft} onChange={setDraft} editable={editable} />
          {r.prompt && (
            <div className="px-3 py-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-fg-3">Original instructions</div>
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
  const q = priceFeed().snapshot(r.spec.symbol);
  return (
    <div className="border-t border-line/70 px-3 py-2">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-fg-3">Paper positions</div>
      {r.paper.map((p) => {
        const px = q ? (p.side === "buy" ? q.bid : q.ask) : p.open;
        const pr = profitAt({ symbol: r.spec.symbol, side: p.side, volume: p.volume, openPrice: p.open }, px);
        return (
          <div key={p.id} className="flex gap-3 font-mono text-[11px] text-fg-2">
            <span className={p.side === "buy" ? "text-up" : "text-down"}>{p.side}</span>
            <span>{fmtVol(p.volume)}</span>
            <span>@ {fmtPrice(r.spec.symbol, p.open)}</span>
            <span>SL {p.sl !== undefined ? fmtPrice(r.spec.symbol, p.sl) : "—"}</span>
            <span>TP {p.tp !== undefined ? fmtPrice(r.spec.symbol, p.tp) : "—"}</span>
            <span className={cn("ml-auto", pr >= 0 ? "text-up" : "text-down")}>{accMoney(T.account, pr, { signed: true })}</span>
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
            ["all", "All"],
            ["trades", "Signals & orders"],
            ["eval", "Evaluations"],
            ["error", "Errors"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={cn("h-5 rounded-[4px] px-1.5 text-[10.5px]", filter === k ? "bg-surface-3 text-fg" : "text-fg-3 hover:text-fg-2")}>
            {l}
          </button>
        ))}
        <button onClick={() => aiTrader.clearLog(r.id)} className="ml-auto h-5 rounded-[4px] px-1.5 text-[10.5px] text-fg-3 hover:text-fg">
          Clear
        </button>
      </div>
      <div ref={ref} className="t-scroll min-h-0 flex-1 overflow-auto py-1 font-mono text-[11px] leading-[17px]">
        {lines.map((l, i) => (
          <div key={`${l.ts}-${i}`} className="flex gap-2 px-3 hover:bg-surface-2/60">
            <span className="shrink-0 text-fg-3">{journalTime(l.ts).slice(11, 19)}</span>
            <span className={cn("w-[52px] shrink-0 uppercase", KIND_CLS[l.kind])}>{l.kind}</span>
            <span className={cn("min-w-0 break-words", l.kind === "eval" ? "text-fg-3" : l.kind === "error" ? "text-down" : "text-fg-2")}>{l.text}</span>
          </div>
        ))}
        {!lines.length && <div className="px-3 py-2 text-fg-3">No entries yet. Activate the strategy to start evaluating closed bars.</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Activation confirmation                                             */
/* ------------------------------------------------------------------ */

function ActivateDialog({ id, initialMode, onClose }: { id: string; initialMode: RunMode; onClose: () => void }) {
  const T = useTerminal();
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
      title={mode === "live" ? "Activate live AI trading" : "Activate in paper mode"}
      subtitle={`${r.id} · ${r.spec.name}`}
      icon={<Bot />}
      width={560}
      footer={
        <>
          <TButton variant="ghost" onClick={onClose}>
            Cancel
          </TButton>
          <TButton
            variant={mode === "live" ? "ember" : "surface"}
            disabled={!canGo}
            onClick={() => {
              aiTrader.activate(r.id, mode);
              onClose();
              toast.success(mode === "live" ? "AI strategy is live" : "AI strategy running in paper mode", { description: `${r.spec.symbol} ${r.spec.timeframe} · evaluates on each closed bar` });
            }}
          >
            {mode === "live" ? `Send real orders on ${a.login}` : "Start paper run"}
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
              className={cn("rounded-[7px] border px-3 py-2 text-left disabled:opacity-40", mode === m ? "border-ember/60 bg-ember-soft" : "border-line bg-surface-2 hover:border-fg-3/40")}
            >
              <div className="text-[12.5px] font-medium text-fg">{m === "paper" ? "Paper (dry-run)" : "Live orders"}</div>
              <div className="text-[11px] leading-[15px] text-fg-3">{m === "paper" ? "Logs signals and simulates fills. No orders are sent." : liveBlocked ? "Disabled: investor (read-only) session." : `Market orders on ${a.type} account ${a.login} (${a.mode}).`}</div>
            </button>
          ))}
        </div>
        <div className="rounded-[7px] border border-line bg-surface-2/60 p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] text-fg-3">
            Account <span className="font-mono text-fg">{a.login}</span> · {a.type} · {a.mode} · {a.group} · 1:{a.leverage}
          </div>
          <SpecSummary spec={r.spec} />
        </div>
        {errors.length > 0 && <div className="text-[12px] text-down">Cannot activate: {errors.join("; ")}</div>}
        {mode === "live" && !liveBlocked && (
          <div className="space-y-2">
            {r.paperRuns === 0 && <div className="rounded-[6px] border border-warn/30 bg-warn-soft px-2.5 py-1.5 text-[11.5px] text-warn">This strategy has not run in paper mode yet. A paper run first is recommended.</div>}
            {a.type === "live" && <div className="rounded-[6px] border border-down/30 bg-down-soft px-2.5 py-1.5 text-[11.5px] text-down">This is a real-money account. Orders are executed immediately at market.</div>}
            <Check checked={ack} onChange={setAck} label={`I understand the AI will send orders of up to ${r.spec.maxLots.toFixed(2)} lot on ${r.spec.symbol} from this browser tab while the terminal is open.`} className="items-start text-[12px] leading-[16px]" />
          </div>
        )}
        <div className="text-[11px] leading-[15px] text-fg-3">SL, TP and trailing stops are attached to each order and handled by the trading engine. The rule engine runs in this browser tab; closing the terminal pauses entries. Every evaluation and order is written to the strategy log and the Journal (Experts).</div>
      </div>
    </TDialog>
  );
}
