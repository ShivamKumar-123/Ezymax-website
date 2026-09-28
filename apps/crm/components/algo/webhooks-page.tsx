"use client";

// Live webhooks (/developer/webhooks): secret alert URLs for TradingView-style JSON alerts, fanned out to several
// of the user's accounts with per-account sizing (D85). Activity log with per-account results.

import * as React from "react";
import { Loader2, Plus, RefreshCcw, Send, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, CopyButton, Dialog, EmptyState, Menu, PageHeader, Reveal, Skeleton, Toggle, cn } from "@kalks/ui";
import { MoreHorizontal } from "lucide-react";
import { NumInput } from "./builder";
import { algoApi, algoError, ago, fmtDateTime, useAlgo, type TradingAccount } from "./api";

interface Hook {
  id: number;
  name: string;
  status: "active" | "disabled";
  tokenHint: string;
  passphrase: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  routes?: number | Route[];
  events24h?: number;
}
interface Route {
  id?: number;
  login: number;
  accountType?: string;
  sizing: { mode: "fixed" | "alert" | "multiplier" | "risk"; value: number; maxLots?: number };
  symbolMap?: Record<string, string>;
  enabled: boolean;
}
interface HookEvent {
  id: number;
  webhookId: number;
  receivedAt: string;
  ip: string | null;
  payload: Record<string, unknown> | null;
  status: string;
  error: string | null;
  results: { login: number; symbol?: string; status: string; ticket?: number; volume?: number; error?: string; closed?: unknown[] }[];
}

const SIZING: { value: Route["sizing"]["mode"]; label: string; unit: string }[] = [
  { value: "fixed", label: "Fixed lots", unit: "lot" },
  { value: "alert", label: "Alert volume", unit: "" },
  { value: "multiplier", label: "Alert volume ×", unit: "×" },
  { value: "risk", label: "Risk % (needs SL)", unit: "%" },
];

const SAMPLE = `{
  "passphrase": "your-passphrase",
  "action": "{{strategy.order.action}}",
  "symbol": "{{ticker}}",
  "volume": {{strategy.order.contracts}},
  "sl_pips": 20,
  "tp_pips": 40,
  "id": "{{strategy.order.id}}-{{timenow}}",
  "timestamp": "{{timenow}}"
}`;

function RoutesEditor({ routes, onChange, accounts }: { routes: Route[]; onChange: (r: Route[]) => void; accounts: TradingAccount[] }) {
  const free = accounts.filter((a) => !routes.some((r) => r.login === a.login) && a.status === "active");
  return (
    <div className="space-y-2">
      {routes.map((r, i) => {
        const a = accounts.find((x) => x.login === r.login);
        const set = (p: Partial<Route>) => onChange(routes.map((x, j) => (j === i ? { ...x, ...p } : x)));
        return (
          <div key={r.login} className="flex flex-wrap items-center gap-2 rounded-[12px] border border-line bg-surface-2/50 px-3 py-2 text-[12.5px]">
            <Chip size="sm" tone={a?.type === "live" ? "ember" : "gold"}>{(a?.type ?? r.accountType ?? "demo").toUpperCase()}</Chip>
            <span className="font-mono text-fg">#{r.login}</span>
            <Menu
              align="start"
              width={200}
              trigger={
                <button type="button" aria-label="Sizing" className="rounded-[8px] border border-line px-2 py-1 text-fg-2 hover:text-fg">
                  {SIZING.find((s) => s.value === r.sizing.mode)?.label}
                </button>
              }
              items={SIZING.map((s) => ({ label: s.label, onSelect: () => set({ sizing: { ...r.sizing, mode: s.value, value: s.value === "fixed" ? 0.01 : s.value === "risk" ? 1 : s.value === "multiplier" ? 1 : 0 } }) }))}
            />
            {r.sizing.mode !== "alert" && <NumInput label="Sizing value" value={r.sizing.value} step={r.sizing.mode === "fixed" ? 0.01 : 0.1} min={0} onChange={(value) => set({ sizing: { ...r.sizing, value } })} suffix={SIZING.find((s) => s.value === r.sizing.mode)?.unit} />}
            <span className="text-fg-3">max</span>
            <NumInput label="Max lots" value={r.sizing.maxLots ?? 0} step={0.01} min={0} onChange={(maxLots) => set({ sizing: { ...r.sizing, maxLots: maxLots || undefined } })} suffix="lot" />
            <span className="ml-auto flex items-center gap-2">
              <Toggle checked={r.enabled} onChange={(enabled) => set({ enabled })} label="Enabled" />
              <button type="button" aria-label="Remove account" onClick={() => onChange(routes.filter((_, j) => j !== i))} className="text-fg-3 hover:text-down">
                <Trash2 className="size-3.5" />
              </button>
            </span>
          </div>
        );
      })}
      {free.length > 0 && routes.length < 10 && (
        <Menu
          align="start"
          width={280}
          trigger={
            <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-line px-3 text-[12px] text-fg-2 hover:border-ember/50 hover:text-ember">
              <Plus className="size-3.5" /> Add account
            </button>
          }
          items={free.map((a) => ({ label: `${a.type === "live" ? "Live" : "Demo"} #${a.login}`, hint: a.groupName, onSelect: () => onChange([...routes, { login: a.login, sizing: { mode: "fixed", value: 0.01 }, enabled: true }]) }))}
        />
      )}
    </div>
  );
}

function CreateDialog({ open, onOpenChange, accounts, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; accounts: TradingAccount[]; onCreated: (url: string) => void }) {
  const [name, setName] = React.useState("TradingView alerts");
  const [pass, setPass] = React.useState("");
  const [routes, setRoutes] = React.useState<Route[]>([]);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open && routes.length === 0 && accounts.length) {
      const a = accounts.find((x) => x.type === "demo" && x.status === "active") ?? accounts[0]!;
      setRoutes([{ login: a.login, sizing: { mode: "fixed", value: 0.01 }, enabled: true }]);
    }
  }, [open, accounts, routes.length]);
  const create = async () => {
    setBusy(true);
    try {
      const r = await algoApi<{ url: string }>("webhooks", { body: { name, passphrase: pass || undefined, routes } });
      onCreated(r.url);
      onOpenChange(false);
      setPass("");
    } catch (e) {
      algoError("Couldn't create the webhook", e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New webhook"
      description="A secret URL for TradingView (or any tool that can POST JSON). Alerts trade the accounts you pick."
      width={620}
      footer={
        <>
          <Button variant="surface" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="ember" disabled={busy || !routes.length} onClick={create}>
            {busy ? <Loader2 className="animate-spin" /> : <Webhook />} Create webhook
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-[13px]">
        <label className="block">
          <span className="text-fg-3">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-10 w-full rounded-[12px] border border-line bg-surface-2 px-3 text-fg outline-none focus:border-ember/50" />
        </label>
        <label className="block">
          <span className="text-fg-3">Passphrase (recommended)</span>
          <input value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Sent as passphrase in every alert" className="mt-1 h-10 w-full rounded-[12px] border border-line bg-surface-2 px-3 text-fg outline-none focus:border-ember/50" />
        </label>
        <div>
          <div className="mb-1.5 text-fg-3">Accounts and sizing</div>
          <RoutesEditor routes={routes} onChange={setRoutes} accounts={accounts} />
        </div>
      </div>
    </Dialog>
  );
}

function StatusTone(s: string) {
  return s === "accepted" ? "up" : s === "partial" ? "warn" : s === "received" ? "neutral" : "down";
}

export function LiveWebhooksPage() {
  const list = useAlgo<{ items: Hook[]; events: HookEvent[]; baseUrl: string }>("webhooks", 5000);
  const accounts = useAlgo<{ items: TradingAccount[] }>("accounts");
  const [creating, setCreating] = React.useState(false);
  const [shown, setShown] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<number | null>(null);
  const hooks = list.data?.items ?? [];
  const sel = selected ?? hooks[0]?.id ?? null;
  const detail = useAlgo<Hook & { routes: Route[]; events: HookEvent[] }>(sel ? `webhooks/${sel}` : null, 5000);
  const [routes, setRoutes] = React.useState<Route[] | null>(null);
  const [testBody, setTestBody] = React.useState(`{"action": "buy", "symbol": "BTCUSD", "volume": 0.01}`);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setRoutes(null), [sel]);
  const d = detail.data;
  const editRoutes = routes ?? d?.routes ?? [];

  const saveRoutes = async () => {
    if (!sel) return;
    try {
      await algoApi(`webhooks/${sel}/routes`, { method: "PUT", body: { routes: editRoutes } });
      toast.success("Accounts saved");
      setRoutes(null);
      detail.reload();
    } catch (e) {
      algoError("Couldn't save the accounts", e);
    }
  };
  const patch = async (body: Record<string, unknown>) => {
    try {
      await algoApi(`webhooks/${sel}`, { method: "PATCH", body });
      detail.reload();
      list.reload();
    } catch (e) {
      algoError("Couldn't update the webhook", e);
    }
  };
  const rotate = async () => {
    try {
      const r = await algoApi<{ url: string }>(`webhooks/${sel}/rotate`, { body: {} });
      setShown(r.url);
      toast.success("New URL generated", { description: "The old URL stops working now." });
      list.reload();
    } catch (e) {
      algoError("Couldn't rotate the URL", e);
    }
  };
  const remove = async () => {
    try {
      await algoApi(`webhooks/${sel}`, { method: "DELETE" });
      toast.success("Webhook deleted");
      setSelected(null);
      list.reload();
    } catch (e) {
      algoError("Couldn't delete the webhook", e);
    }
  };
  const test = async () => {
    let payload: unknown;
    try {
      payload = JSON.parse(testBody);
    } catch {
      return toast.error("The test alert is not valid JSON");
    }
    setBusy(true);
    try {
      const r = await algoApi<{ status: string; results: HookEvent["results"] }>(`webhooks/${sel}/test`, { body: { payload } });
      toast.success(`Alert ${r.status}`, { description: r.results.map((x) => `#${x.login}: ${x.status}${x.ticket ? ` #${x.ticket}` : ""}${x.error ? ` (${x.error})` : ""}`).join(" · ") });
      detail.reload();
    } catch (e) {
      algoError("Test alert failed", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Webhooks"
        subtitle="Trade from TradingView alerts: one secret URL fans out to several of your accounts, each with its own size."
        actions={
          <Button variant="ember" onClick={() => setCreating(true)} disabled={!accounts.data?.items.length}>
            <Plus /> New webhook
          </Button>
        }
      />
      {shown && (
        <Card className="mb-5 border-ember/40">
          <div className="flex flex-wrap items-center gap-3 px-6 py-4">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-fg">Your webhook URL, shown once</div>
              <div className="text-[12px] text-fg-3">Paste it into the TradingView alert's Webhook URL. Anyone with it can send alerts: keep it secret.</div>
            </div>
            <code className="min-w-0 flex-1 truncate rounded-[10px] bg-black/30 px-3 py-2 font-mono text-[12px] text-ember" data-testid="webhook-url">
              {shown}
            </code>
            <CopyButton value={shown} label="Webhook URL" />
            <Button size="sm" variant="surface" onClick={() => setShown(null)}>
              Done
            </Button>
          </div>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Reveal className="space-y-5">
          <Card>
            <CardHeader icon={<Webhook />} title="Your webhooks" subtitle={`${hooks.length} of 20`} />
            <div className="space-y-1 px-3 pb-4 pt-3">
              {list.loading && <Skeleton className="h-20" />}
              {!list.loading && hooks.length === 0 && <p className="px-2 text-[12.5px] text-fg-3">No webhooks yet.</p>}
              {hooks.map((h) => (
                <button key={h.id} type="button" onClick={() => setSelected(h.id)} className={cn("w-full rounded-[12px] px-3 py-2 text-left transition", sel === h.id ? "bg-surface-3" : "hover:bg-surface-2")}>
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-fg">{h.name}</span>
                    <Chip size="sm" tone={h.status === "active" ? "up" : "neutral"} className="ml-auto">
                      {h.status}
                    </Chip>
                  </div>
                  <div className="mt-0.5 text-[11px] text-fg-3">
                    …{h.tokenHint} · {typeof h.routes === "number" ? h.routes : 0} account(s) · {h.events24h ?? 0} alerts today · used {ago(h.lastUsedAt)}
                  </div>
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Alert format" subtitle="TradingView message body (JSON)" />
            <div className="space-y-2 px-5 pb-5 pt-3 text-[12px] text-fg-3">
              <pre className="overflow-x-auto rounded-[12px] bg-black/30 p-3 font-mono text-[11.5px] leading-[17px] text-fg-2">{SAMPLE}</pre>
              <p>
                <b className="text-fg-2">action</b>: buy · sell · close · close_buy · close_sell. <b className="text-fg-2">symbol</b>: exchange prefixes and slashes are removed (OANDA:EUR/USD → EURUSD). Stops: <code>sl</code>/<code>tp</code> (price), <code>sl_pips</code>, <code>sl_points</code>.
              </p>
              <p>
                Replay protection: an <code>id</code> is accepted once; a <code>timestamp</code> must be within 5 minutes. Close actions only close positions this webhook opened.
              </p>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.05} className="min-w-0 space-y-5">
          {!sel ? (
            <Card className="grid min-h-[360px] place-items-center">
              <EmptyState title="Create your first webhook" text="Pick the accounts an alert should trade and how much on each. You get a secret URL to paste into TradingView." />
            </Card>
          ) : !d ? (
            <Skeleton className="h-[420px]" />
          ) : (
            <>
              <Card>
                <CardHeader
                  title={d.name}
                  subtitle={`URL ending …${d.tokenHint}${d.passphrase ? " · passphrase required" : " · no passphrase"} · created ${fmtDateTime(d.createdAt)}`}
                  action={
                    <>
                      <Toggle checked={d.status === "active"} onChange={(on) => patch({ status: on ? "active" : "disabled" })} label="Active" />
                      <Menu
                        trigger={
                          <button type="button" aria-label="Webhook actions" className="grid size-8 place-items-center rounded-full border border-line text-fg-2 hover:bg-surface-3">
                            <MoreHorizontal className="size-4" />
                          </button>
                        }
                        items={[
                          { label: "Generate a new URL", icon: <RefreshCcw />, onSelect: rotate },
                          { label: d.passphrase ? "Remove passphrase" : "Set passphrase", onSelect: () => (d.passphrase ? patch({ passphrase: null }) : patch({ passphrase: window.prompt("New passphrase") ?? undefined })) },
                          "sep",
                          { label: "Delete webhook", icon: <Trash2 />, danger: true, onSelect: remove },
                        ]}
                      />
                    </>
                  }
                />
                <div className="space-y-3 px-6 pb-5 pt-4">
                  <div className="text-[12px] text-fg-3">Accounts that trade each alert</div>
                  <RoutesEditor routes={editRoutes} onChange={setRoutes} accounts={accounts.data?.items ?? []} />
                  {routes && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ember" onClick={saveRoutes}>
                        Save accounts
                      </Button>
                      <Button size="sm" variant="surface" onClick={() => setRoutes(null)}>
                        Discard
                      </Button>
                    </div>
                  )}
                  <div className="rounded-[12px] border border-line bg-surface-2/40 p-3">
                    <div className="mb-1.5 flex items-center gap-2 text-[12px] text-fg-3">
                      Send a test alert <span className="text-warn">(real orders on the accounts above)</span>
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      <textarea value={testBody} onChange={(e) => setTestBody(e.target.value)} rows={2} aria-label="Test alert JSON" className="min-w-0 flex-1 resize-y rounded-[10px] border border-line bg-black/30 px-3 py-2 font-mono text-[12px] text-fg outline-none" />
                      <Button size="sm" variant="surface" disabled={busy} onClick={test}>
                        {busy ? <Loader2 className="animate-spin" /> : <Send />} Send test
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
              <Card>
                <CardHeader title="Activity" subtitle="Every alert received, with the result per account" />
                <div className="overflow-x-auto px-6 pb-5 pt-3">
                  <table className="w-full min-w-[640px] text-[12.5px]" data-testid="webhook-activity">
                    <thead className="text-fg-3">
                      <tr>
                        <th className="py-1.5 text-left font-medium">Time</th>
                        <th className="py-1.5 text-left font-medium">Alert</th>
                        <th className="py-1.5 text-left font-medium">Status</th>
                        <th className="py-1.5 text-left font-medium">Accounts</th>
                        <th className="py-1.5 text-left font-medium">From</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.events.map((e) => (
                        <tr key={e.id} className="border-t border-line/60 align-top">
                          <td className="py-2 font-mono text-fg-3">{fmtDateTime(e.receivedAt)}</td>
                          <td className="py-2 font-mono text-[11.5px] text-fg-2">
                            {String(e.payload?.action ?? "?")} {String(e.payload?.symbol ?? "")}
                            {e.payload?.volume !== undefined ? ` · ${String(e.payload.volume)}` : ""}
                          </td>
                          <td className="py-2">
                            <Chip size="sm" tone={StatusTone(e.status)}>
                              {e.status}
                            </Chip>
                            {e.error && <div className="mt-1 text-[11px] text-down">{e.error}</div>}
                          </td>
                          <td className="py-2 text-[11.5px]">
                            {e.results.map((r, i) => (
                              <div key={i} className={r.status === "rejected" ? "text-down" : "text-fg-2"}>
                                #{r.login} {r.status}
                                {r.ticket ? ` #${r.ticket}` : ""}
                                {r.volume ? ` ${r.volume} lot` : ""}
                                {r.error ? ` · ${r.error}` : ""}
                              </div>
                            ))}
                          </td>
                          <td className="py-2 font-mono text-[11px] text-fg-3">{e.ip}</td>
                        </tr>
                      ))}
                      {d.events.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-fg-3">
                            No alerts yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </Reveal>
      </div>
      <CreateDialog open={creating} onOpenChange={setCreating} accounts={(accounts.data?.items ?? []).filter((a) => a.status === "active")} onCreated={(url) => (setShown(url), list.reload())} />
    </>
  );
}
