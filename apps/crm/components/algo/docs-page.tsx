"use client";

// Live API documentation (/developer/docs): REST API with API keys, authentication (bearer / HMAC), endpoints,
// errors and limits, webhook alerts and the strategy language. Base URLs come from the service.

import * as React from "react";
import Link from "next/link";
import { BookOpen, KeyRound, Webhook, Workflow } from "lucide-react";
import { Button, Card, CardHeader, Chip, CopyButton, PageHeader, Reveal, Segmented, cn } from "@kalks/ui";
import { useMeta } from "./api";

const ENDPOINTS: { m: string; p: string; scope: string; text: string; body?: string }[] = [
  { m: "GET", p: "/account", scope: "read", text: "Balance, equity, margin, free margin, margin level" },
  { m: "GET", p: "/positions", scope: "read", text: "Open positions with current price, profit, swap, source" },
  { m: "GET", p: "/orders", scope: "read", text: "Pending orders" },
  { m: "GET", p: "/history?from=2026-09-01&to=2026-10-01&page=1&limit=100", scope: "read", text: "Closed deals and totals" },
  { m: "GET", p: "/quotes?symbols=EURUSD,XAUUSD", scope: "read", text: "Bid / ask with your account's spread" },
  { m: "POST", p: "/orders", scope: "trade", text: "Market, limit, stop or stop-limit order", body: `{"symbol":"EURUSD","side":"buy","type":"market","volume":0.1,"sl":1.0850,"tp":1.0950,"clientOrderId":"my-id-1"}` },
  { m: "PATCH", p: "/positions/{ticket}", scope: "trade", text: "Change SL / TP / trailing (null clears)", body: `{"sl":1.0880,"tp":null}` },
  { m: "POST", p: "/positions/{ticket}/close", scope: "trade", text: "Close fully, or partially with volume", body: `{"volume":0.05}` },
  { m: "DELETE", p: "/orders/{ticket}", scope: "trade", text: "Cancel a pending order" },
];

const ERRORS: [string, string, string][] = [
  ["401", "unauthorized", "Missing, wrong, revoked or expired key; bad or reused signature; timestamp outside 30 s"],
  ["403", "forbidden", "Scope missing (read / trade) or the IP is not on the key's whitelist"],
  ["409", "halted / requote", "Your kill switch or the platform's is on; price moved beyond deviationPoints"],
  ["422", "market_closed · no_money · invalid_volume · invalid_sl · max_lot · validation", "The trading engine refused the order (same checks as manual trading)"],
  ["429", "rate_limited", "Per-key limit (60 / min by default); wait Retry-After seconds"],
  ["503", "unavailable", "A service is briefly unavailable; retry with the same clientOrderId"],
];

function Code({ children, lang }: { children: string; lang?: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-[12px] border border-line bg-black/30 p-4 font-mono text-[12px] leading-[18px] text-fg-2">{children}</pre>
      <div className="absolute right-2 top-2 flex items-center gap-2">
        {lang && <span className="text-[10.5px] uppercase text-fg-3">{lang}</span>}
        <CopyButton value={children} label="Code" />
      </div>
    </div>
  );
}

export function LiveDocsPage() {
  const meta = useMeta();
  const root = meta?.publicUrl ?? "https://api.kalkstrade.com/algo";
  const base = `${root}/public/v1`;
  const [lang, setLang] = React.useState<"curl" | "python" | "node">("curl");
  const sign = {
    curl: `KEY_ID=kk_xxxxxxxxxxxx
SECRET=ks_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TS=$(date +%s000)
BODY='{"symbol":"EURUSD","side":"buy","volume":0.1}'
SIG=$(printf '%s' "\${TS}POST/public/v1/orders\${BODY}" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')
curl -X POST ${base}/orders \\
  -H "X-Kalks-Key: $KEY_ID" -H "X-Kalks-Timestamp: $TS" -H "X-Kalks-Signature: $SIG" \\
  -H "content-type: application/json" -d "$BODY"`,
    python: `import hashlib, hmac, json, time, requests

KEY_ID, SECRET = "kk_xxxxxxxxxxxx", "ks_xxxxxxxxxxxx"
BASE = "${base}"

def call(method, path, body=None):
    data = json.dumps(body, separators=(",", ":")) if body is not None else ""
    ts = str(int(time.time() * 1000))
    sig = hmac.new(SECRET.encode(), f"{ts}{method}/public/v1{path}{data}".encode(), hashlib.sha256).hexdigest()
    h = {"X-Kalks-Key": KEY_ID, "X-Kalks-Timestamp": ts, "X-Kalks-Signature": sig, "content-type": "application/json"}
    r = requests.request(method, BASE + path, headers=h, data=data or None, timeout=10)
    r.raise_for_status()
    return r.json()

print(call("GET", "/account"))
print(call("POST", "/orders", {"symbol": "EURUSD", "side": "buy", "volume": 0.1}))`,
    node: `import crypto from "node:crypto";

const KEY_ID = "kk_xxxxxxxxxxxx", SECRET = "ks_xxxxxxxxxxxx";
const BASE = "${base}";

async function call(method, path, body) {
  const data = body === undefined ? "" : JSON.stringify(body);
  const ts = String(Date.now());
  const sig = crypto.createHmac("sha256", SECRET).update(ts + method + "/public/v1" + path + data).digest("hex");
  const r = await fetch(BASE + path, { method, body: data || undefined, headers: { "X-Kalks-Key": KEY_ID, "X-Kalks-Timestamp": ts, "X-Kalks-Signature": sig, "content-type": "application/json" } });
  if (!r.ok) throw new Error((await r.json()).error?.message);
  return r.json();
}

console.log(await call("GET", "/positions"));`,
  }[lang];
  return (
    <>
      <PageHeader
        title="API docs"
        subtitle="REST API for your trading accounts, webhook alerts and the strategy language."
        actions={
          <>
            <a href={`${base}/openapi.json`} target="_blank" rel="noopener">
              <Button variant="surface">
                <BookOpen /> OpenAPI
              </Button>
            </a>
            <Link href="/developer">
              <Button variant="ember">
                <KeyRound /> API keys
              </Button>
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="hidden xl:block">
          <div className="sticky top-24 space-y-1 text-[13px]">
            {[
              ["#auth", "Authentication"],
              ["#endpoints", "Endpoints"],
              ["#errors", "Errors and limits"],
              ["#webhooks", "Webhook alerts"],
              ["#strategies", "Strategy language"],
            ].map(([h, l]) => (
              <a key={h} href={h} className="block rounded-[10px] px-3 py-1.5 text-fg-2 hover:bg-surface-2 hover:text-fg">
                {l}
              </a>
            ))}
          </div>
        </nav>
        <div className="min-w-0 space-y-5">
          <Reveal>
            <Card id="auth">
              <CardHeader icon={<KeyRound />} title="Authentication" subtitle={base} />
              <div className="space-y-4 px-6 pb-6 pt-4 text-[13.5px] text-fg-2">
                <p>
                  Create a key under <Link href="/developer" className="text-ember hover:underline">API keys</Link>. Each key belongs to one trading account and has the <Chip size="sm" tone="up">read</Chip> and optionally the <Chip size="sm" tone="ember">trade</Chip> scope. The secret is shown once.
                </p>
                <div className="k-label">Bearer (simplest)</div>
                <Code lang="curl">{`curl ${base}/account -H "Authorization: Bearer $KEY_ID:$SECRET"`}</Code>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="k-label">HMAC signature (recommended for bots)</div>
                  <Segmented size="xs" value={lang} onChange={setLang} options={[{ value: "curl", label: "curl" }, { value: "python", label: "Python" }, { value: "node", label: "Node.js" }]} />
                </div>
                <p className="text-[12.5px] text-fg-3">
                  Signature = hex(HMAC-SHA256(secret, timestamp + METHOD + path with query + body)), sent with <code>X-Kalks-Key</code>, <code>X-Kalks-Timestamp</code> (unix ms, ±30 s) and <code>X-Kalks-Signature</code>. The path is signed as <code>/public/v1/…</code>. Each signature is accepted once.
                </p>
                <Code lang={lang}>{sign}</Code>
              </div>
            </Card>
          </Reveal>
          <Card id="endpoints">
            <CardHeader title="Endpoints" subtitle="JSON in and out. Every order carries source “api”; a repeated clientOrderId returns status duplicate." />
            <div className="space-y-3 px-6 pb-6 pt-4">
              {ENDPOINTS.map((e) => (
                <div key={e.m + e.p} className="rounded-[12px] border border-line px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("w-16 rounded-md py-0.5 text-center font-mono text-[11px] font-semibold", e.m === "GET" ? "bg-up-soft text-up" : e.m === "DELETE" ? "bg-down-soft text-down" : "bg-ember-soft text-ember")}>{e.m}</span>
                    <code className="font-mono text-[12.5px] text-fg">{e.p}</code>
                    <Chip size="sm" tone={e.scope === "trade" ? "ember" : "up"} className="ml-auto">
                      {e.scope}
                    </Chip>
                  </div>
                  <div className="mt-1 text-[12.5px] text-fg-3">{e.text}</div>
                  {e.body && <pre className="mt-2 overflow-x-auto rounded-[10px] bg-black/30 px-3 py-2 font-mono text-[11.5px] text-fg-2">{e.body}</pre>}
                </div>
              ))}
            </div>
          </Card>
          <Card id="errors">
            <CardHeader title="Errors and limits" subtitle={`Errors are {"error": {"code", "message"}}`} />
            <div className="overflow-x-auto px-6 pb-6 pt-4">
              <table className="w-full min-w-[640px] text-[12.5px]">
                <tbody>
                  {ERRORS.map(([s, c, t]) => (
                    <tr key={s} className="border-b border-line/60 align-top">
                      <td className="py-2 pr-3 font-mono text-fg">{s}</td>
                      <td className="py-2 pr-3 font-mono text-ember">{c}</td>
                      <td className="py-2 text-fg-2">{t}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card id="webhooks">
            <CardHeader icon={<Webhook />} title="Webhook alerts" subtitle={`POST ${root}/hooks/<your secret token>`} />
            <div className="space-y-3 px-6 pb-6 pt-4 text-[13px] text-fg-2">
              <p>
                Create a webhook under <Link href="/developer/webhooks" className="text-ember hover:underline">Webhooks</Link>, choose the accounts it trades and the size on each, then paste the URL into a TradingView alert with this message:
              </p>
              <Code lang="json">{`{"passphrase":"…","action":"{{strategy.order.action}}","symbol":"{{ticker}}","volume":{{strategy.order.contracts}},"sl_pips":20,"id":"{{strategy.order.id}}-{{timenow}}","timestamp":"{{timenow}}"}`}</Code>
              <p className="text-[12.5px] text-fg-3">
                action: buy · sell · close · close_buy · close_sell. Stops as prices (sl, tp), pips (sl_pips, tp_pips) or points (sl_points, tp_points). An id is accepted once; a timestamp must be within 5 minutes. Limit: 30 alerts a minute per URL.
              </p>
            </div>
          </Card>
          <Card id="strategies">
            <CardHeader icon={<Workflow />} title="Strategy language" subtitle="Python-like expressions, run on our servers on every closed bar" />
            <div className="space-y-3 px-6 pb-6 pt-4 text-[13px] text-fg-2">
              <Code lang="kst">{meta?.dsl.example ?? "…"}</Code>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {(meta?.dsl.functions ?? []).map((f) => (
                  <div key={f.syntax} className="rounded-[10px] bg-surface-2/50 px-3 py-2">
                    <code className="font-mono text-[11.5px] text-[#38bdf8]">{f.syntax}</code>
                    <div className="text-[11.5px] text-fg-3">{f.text}</div>
                  </div>
                ))}
              </div>
              <p className="text-[12.5px] text-fg-3">
                Sandbox: expressions only (no loops, functions, imports or I/O), at most {meta?.dsl.limits.sourceChars?.toLocaleString("en-US") ?? "20,000"} characters and {meta?.dsl.limits.nodes?.toLocaleString("en-US") ?? "4,000"} expression nodes, periods up to {meta?.dsl.limits.period ?? 1000}, with a time budget per bar.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
