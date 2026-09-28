"use client";

// Live API keys (/developer): per trading account keys with read / trade scopes, IP whitelist and expiry (D78),
// usage, activity, and the quickstart for the REST API.

import * as React from "react";
import Link from "next/link";
import { Activity, AlertCircle, BookOpen, Gauge as GaugeIcon, KeyRound, Loader2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, CopyButton, DataTable, Dialog, KpiCard, MiniBars, PageHeader, Reveal, type Column } from "@kalks/ui";
import { algoApi, algoError, ago, fmtDateTime, useAlgo, type TradingAccount } from "./api";

interface Key {
  id: number;
  name: string;
  keyId: string;
  login: number;
  accountType: string;
  scopes: string[];
  ipWhitelist: string[];
  ratePerMin: number | null;
  expiresAt: string | null;
  status: "active" | "revoked" | "expired";
  createdAt: string;
  lastUsedAt: string | null;
  lastIp: string | null;
}
interface KeysResp {
  items: Key[];
  usage: { requests24h: number; errors24h: number; rateLimited24h: number; p50: number; p99: number; writes24h: number; hourly: { t: string; n: number }[] };
  baseUrl: string;
}

function CreateKeyDialog({ open, onOpenChange, accounts, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; accounts: TradingAccount[]; onCreated: (k: { keyId: string; secret: string; name: string }) => void }) {
  const [name, setName] = React.useState("Trading bot");
  const [login, setLogin] = React.useState<number | null>(null);
  const [trade, setTrade] = React.useState(true);
  const [ips, setIps] = React.useState("");
  const [days, setDays] = React.useState(90);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open && login === null && accounts.length) setLogin((accounts.find((a) => a.type === "demo") ?? accounts[0]!).login);
  }, [open, accounts, login]);
  const acct = accounts.find((a) => a.login === login);
  const create = async () => {
    setBusy(true);
    try {
      const r = await algoApi<{ keyId: string; secret: string; name: string }>("keys", {
        body: { name, login, scopes: trade ? ["read", "trade"] : ["read"], ipWhitelist: ips.split(/[\s,]+/).filter(Boolean), expiresInDays: days || undefined },
      });
      onCreated(r);
      onOpenChange(false);
    } catch (e) {
      algoError("Couldn't create the key", e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create API key"
      description="A key works on one trading account. Withdrawals are never possible through the API."
      width={560}
      footer={
        <>
          <Button variant="surface" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="ember" disabled={busy || !login} onClick={create}>
            {busy ? <Loader2 className="animate-spin" /> : <KeyRound />} Create key
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-[13px]">
        <label className="block">
          <span className="text-fg-3">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-10 w-full rounded-[12px] border border-line bg-surface-2 px-3 text-fg outline-none focus:border-ember/50" />
        </label>
        <div>
          <div className="text-fg-3">Trading account</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {accounts.map((a) => (
              <button key={a.login} type="button" onClick={() => setLogin(a.login)} className={`h-8 rounded-full border px-3 text-[12px] ${login === a.login ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-2"}`}>
                {a.type === "live" ? "Live" : "Demo"} #{a.login}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-fg-3">Scopes</div>
          <div className="mt-1 flex gap-2">
            <Chip tone="up">read</Chip>
            <button type="button" onClick={() => setTrade(!trade)} aria-pressed={trade}>
              <Chip tone={trade ? "ember" : "neutral"}>{trade ? "trade" : "+ trade"}</Chip>
            </button>
          </div>
        </div>
        <label className="block">
          <span className="text-fg-3">IP whitelist {acct?.type === "live" && trade ? <span className="text-warn">(required for live trading keys)</span> : "(optional)"}</span>
          <textarea value={ips} onChange={(e) => setIps(e.target.value)} rows={2} placeholder="203.0.113.10, 198.51.100.0/24" className="mt-1 w-full rounded-[12px] border border-line bg-surface-2 px-3 py-2 font-mono text-[12.5px] text-fg outline-none focus:border-ember/50" />
        </label>
        <div>
          <div className="text-fg-3">Expires</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {[
              [30, "30 days"],
              [90, "90 days"],
              [365, "1 year"],
              [0, "Never"],
            ].map(([d, l]) => (
              <button key={l} type="button" onClick={() => setDays(d as number)} className={`h-8 rounded-full border px-3 text-[12px] ${days === d ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-2"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function Activity24({ keyId, open, onOpenChange }: { keyId: number | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const a = useAlgo<{ items: { at: string; method: string; path: string; status: number; ip: string | null; ms: number }[] }>(open && keyId ? `keys/${keyId}/activity` : null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Key activity" description="The last 200 requests" side="right">
      <div className="space-y-1 font-mono text-[11.5px]">
        {(a.data?.items ?? []).map((r, i) => (
          <div key={i} className="flex gap-3 border-b border-line/60 py-1.5">
            <span className="text-fg-3">{fmtDateTime(r.at)}</span>
            <span className={r.status >= 400 ? "text-down" : "text-up"}>{r.status}</span>
            <span className="text-fg-2">{r.method}</span>
            <span className="min-w-0 flex-1 truncate text-fg">{r.path}</span>
            <span className="text-fg-3">{r.ms}ms</span>
          </div>
        ))}
        {a.data && a.data.items.length === 0 && <div className="py-8 text-center text-fg-3">No requests yet</div>}
      </div>
    </Dialog>
  );
}

export function LiveKeysPage() {
  const keys = useAlgo<KeysResp>("keys", 10000);
  const accounts = useAlgo<{ items: TradingAccount[] }>("accounts");
  const [creating, setCreating] = React.useState(false);
  const [secret, setSecret] = React.useState<{ keyId: string; secret: string; name: string } | null>(null);
  const [activity, setActivity] = React.useState<number | null>(null);
  const items = keys.data?.items ?? [];
  const u = keys.data?.usage;
  const base = keys.data?.baseUrl ?? "";
  const active = items.filter((k) => k.status === "active").length;

  const revoke = async (k: Key) => {
    if (!window.confirm(`Revoke “${k.name}”? Requests with it fail at once.`)) return;
    try {
      await algoApi(`keys/${k.id}/revoke`, { body: {} });
      toast.success("Key revoked");
      keys.reload();
    } catch (e) {
      algoError("Couldn't revoke the key", e);
    }
  };

  const cols: Column<Key>[] = [
    { key: "name", header: "Key", cell: (k) => <div><div className="font-medium text-fg">{k.name}</div><div className="font-mono text-[11.5px] text-fg-3">{k.keyId}</div></div>, sort: (k) => k.name },
    { key: "acct", header: "Account", cell: (k) => <span className="font-mono text-fg-2">{k.accountType === "live" ? "Live" : "Demo"} #{k.login}</span>, sort: (k) => k.login },
    { key: "scopes", header: "Scopes", cell: (k) => <div className="flex gap-1">{k.scopes.map((s) => <Chip key={s} size="sm" tone={s === "trade" ? "ember" : "up"}>{s}</Chip>)}</div> },
    { key: "ips", header: "IP whitelist", cell: (k) => <span className="text-[12px] text-fg-3">{k.ipWhitelist.length ? k.ipWhitelist.join(", ") : "any IP"}</span>, hideOn: "lg" },
    { key: "exp", header: "Expires", cell: (k) => <span className="text-[12px] text-fg-3">{k.expiresAt ? fmtDateTime(k.expiresAt).slice(0, 10) : "never"}</span>, hideOn: "md" },
    { key: "used", header: "Last used", cell: (k) => <span className="text-[12px] text-fg-3">{ago(k.lastUsedAt)}{k.lastIp ? ` · ${k.lastIp}` : ""}</span>, sort: (k) => k.lastUsedAt ?? "" },
    { key: "status", header: "Status", cell: (k) => <Chip size="sm" tone={k.status === "active" ? "up" : "neutral"} dot={k.status === "active"}>{k.status}</Chip>, sort: (k) => k.status },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (k) => (
        <div className="flex justify-end gap-1.5">
          <Button size="xs" variant="ghost" onClick={() => setActivity(k.id)}>
            Activity
          </Button>
          {k.status === "active" && (
            <Button size="xs" variant="down-outline" onClick={() => revoke(k)}>
              Revoke
            </Button>
          )}
        </div>
      ),
    },
  ];

  const curl = secret
    ? `curl ${base}/account \\\n  -H "Authorization: Bearer ${secret.keyId}:${secret.secret}"\n\ncurl -X POST ${base}/orders \\\n  -H "Authorization: Bearer ${secret.keyId}:${secret.secret}" \\\n  -H "content-type: application/json" \\\n  -d '{"symbol":"EURUSD","side":"buy","volume":0.01,"sl":null}'`
    : "";

  return (
    <div className="pb-24">
      <PageHeader
        title="API & Algo"
        subtitle="REST access to your trading accounts: scoped keys, IP-locked, rate-limited, every order tagged “api”."
        actions={
          <>
            <Link href="/developer/docs">
              <Button variant="surface" size="lg">
                <BookOpen /> API docs
              </Button>
            </Link>
            <Button variant="ember" size="lg" onClick={() => setCreating(true)} disabled={!accounts.data?.items.length}>
              <Plus /> Create API key
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Requests · 24h" icon={<Activity />} value={<span className="k-num">{(u?.requests24h ?? 0).toLocaleString("en-US")}</span>} footer={<div className="flex w-full items-center justify-between gap-3"><Chip>{u?.writes24h ?? 0} orders / closes</Chip><MiniBars data={(u?.hourly ?? []).map((h) => h.n)} className="h-6" /></div>} />
        <KpiCard label="Errors · 24h" icon={<AlertCircle />} value={<span className="k-num">{u?.errors24h ?? 0}</span>} chip={`${u?.rateLimited24h ?? 0} rate-limited`} delay={0.05} />
        <KpiCard label="Latency p50" icon={<GaugeIcon />} value={<span className="k-num">{Math.round(u?.p50 ?? 0)}<span className="text-[20px] text-fg-3"> ms</span></span>} chip={`p99 ${Math.round(u?.p99 ?? 0)} ms`} delay={0.1} />
        <KpiCard label="Active keys" icon={<KeyRound />} hot value={<span className="k-num">{active}<span className="text-fg-3">/{items.length}</span></span>} chip="max 20" delay={0.15} />
      </div>
      {secret && (
        <Reveal className="mt-4">
          <Card className="border-ember/40">
            <CardHeader icon={<ShieldCheck />} title={`“${secret.name}” created`} subtitle="Copy the secret now: it is shown once and never stored in readable form." />
            <div className="space-y-3 px-6 pb-5 pt-4">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="flex items-center gap-2 rounded-[12px] bg-black/30 px-3 py-2">
                  <span className="text-[11px] uppercase text-fg-3">Key ID</span>
                  <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg" data-testid="key-id">{secret.keyId}</code>
                  <CopyButton value={secret.keyId} label="Key ID" />
                </div>
                <div className="flex items-center gap-2 rounded-[12px] bg-black/30 px-3 py-2">
                  <span className="text-[11px] uppercase text-fg-3">Secret</span>
                  <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ember" data-testid="key-secret">{secret.secret}</code>
                  <CopyButton value={secret.secret} label="Secret" />
                </div>
              </div>
              <pre className="overflow-x-auto rounded-[12px] bg-black/30 p-3 font-mono text-[11.5px] leading-[17px] text-fg-2">{curl}</pre>
              <Button size="sm" variant="surface" onClick={() => setSecret(null)}>
                I stored it
              </Button>
            </div>
          </Card>
        </Reveal>
      )}
      <Reveal delay={0.05} className="mt-4">
        <Card>
          <CardHeader title="API keys" subtitle="One key per account and purpose. Revoke a key the moment it may have leaked." />
          <div className="px-6 pb-6 pt-4">
            <DataTable columns={cols} rows={items} pageSize={10} rowKey={(k) => String(k.id)} empty={<div className="py-8 text-center text-fg-3">No API keys yet</div>} />
          </div>
        </Card>
      </Reveal>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Quickstart" subtitle={base} />
          <pre className="mx-6 mb-6 mt-4 overflow-x-auto rounded-[12px] bg-black/30 p-3 font-mono text-[11.5px] leading-[17px] text-fg-2">{`# read the account
curl ${base}/account -H "Authorization: Bearer $KEY_ID:$SECRET"

# market order with stop and target (scope: trade)
curl -X POST ${base}/orders -H "Authorization: Bearer $KEY_ID:$SECRET" \\
  -H "content-type: application/json" \\
  -d '{"symbol":"XAUUSD","side":"sell","volume":0.1,"sl":2710,"tp":2650}'

# close a position
curl -X POST ${base}/positions/1000123/close -H "Authorization: Bearer $KEY_ID:$SECRET"`}</pre>
        </Card>
        <Card>
          <CardHeader title="Safety" subtitle="Applied to every request" />
          <div className="space-y-2 px-6 pb-6 pt-4 text-[13px] text-fg-2">
            {[
              "Scopes: read, or read + trade. Withdrawals and transfers are never possible through the API.",
              "IP whitelist per key (exact IPs or IPv4 ranges); required for trading keys on live accounts.",
              "Rate limit per key (60 requests a minute by default); 429 with Retry-After when exceeded.",
              "HMAC signing option: a timestamp within 30 s, each signature accepted once.",
              "Every order carries source “api” on your account and statements.",
            ].map((t) => (
              <div key={t} className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-up" /> {t}
              </div>
            ))}
            <p className="pt-2 text-[12.5px] text-fg-3">
              Need to stop everything at once? Use the kill switch on <Link href="/developer/deployments" className="text-ember hover:underline">Running strategies</Link>: it blocks API and webhook orders and stops every strategy.
            </p>
          </div>
        </Card>
      </div>
      <CreateKeyDialog open={creating} onOpenChange={setCreating} accounts={(accounts.data?.items ?? []).filter((a) => a.status === "active")} onCreated={(k) => (setSecret(k), keys.reload())} />
      <Activity24 keyId={activity} open={activity !== null} onOpenChange={(o) => !o && setActivity(null)} />
    </div>
  );
}
