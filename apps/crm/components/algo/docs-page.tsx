"use client";

// Live API documentation (/developer/docs): REST API with API keys, authentication (bearer / HMAC), endpoints,
// errors and limits, webhook alerts and the strategy language. Base URLs come from the service.

import * as React from "react";
import Link from "next/link";
import { BookOpen, KeyRound, Webhook, Workflow } from "lucide-react";
import { Button, Card, CardHeader, Chip, CopyButton, PageHeader, Reveal, Segmented, cn } from "@kalks/ui";
import { Trans, useFormat, useT } from "@kalks/i18n/react";
import { useMeta } from "./api";

const ENDPOINTS: { m: string; p: string; scope: string; text: `developer.docs.ep.${string}`; body?: string }[] = [
  { m: "GET", p: "/account", scope: "read", text: "developer.docs.ep.account" },
  { m: "GET", p: "/positions", scope: "read", text: "developer.docs.ep.positions" },
  { m: "GET", p: "/orders", scope: "read", text: "developer.docs.ep.orders" },
  { m: "GET", p: "/history?from=2026-09-01&to=2026-10-01&page=1&limit=100", scope: "read", text: "developer.docs.ep.history" },
  { m: "GET", p: "/quotes?symbols=EURUSD,XAUUSD", scope: "read", text: "developer.docs.ep.quotes" },
  { m: "POST", p: "/orders", scope: "trade", text: "developer.docs.ep.placeOrder", body: `{"symbol":"EURUSD","side":"buy","type":"market","volume":0.1,"sl":1.0850,"tp":1.0950,"clientOrderId":"my-id-1"}` },
  { m: "PATCH", p: "/positions/{ticket}", scope: "trade", text: "developer.docs.ep.modify", body: `{"sl":1.0880,"tp":null}` },
  { m: "POST", p: "/positions/{ticket}/close", scope: "trade", text: "developer.docs.ep.close", body: `{"volume":0.05}` },
  { m: "DELETE", p: "/orders/{ticket}", scope: "trade", text: "developer.docs.ep.cancel" },
];

const ERRORS: [string, string, `developer.docs.err.${string}`][] = [
  ["401", "unauthorized", "developer.docs.err.401"],
  ["403", "forbidden", "developer.docs.err.403"],
  ["409", "halted / requote", "developer.docs.err.409"],
  ["422", "market_closed · no_money · invalid_volume · invalid_sl · max_lot · validation", "developer.docs.err.422"],
  ["429", "rate_limited", "developer.docs.err.429"],
  ["503", "unavailable", "developer.docs.err.503"],
];

function Code({ children, lang }: { children: string; lang?: string }) {
  const t = useT();
  return (
    <div className="relative" dir="ltr">
      <pre className="overflow-x-auto rounded-[12px] border border-line bg-black/30 p-4 font-mono text-[12px] leading-[18px] text-fg-2">{children}</pre>
      <div className="absolute right-2 top-2 flex items-center gap-2">
        {lang && <span className="text-[10.5px] uppercase text-fg-3">{lang}</span>}
        <CopyButton value={children} label={t("developer.docs.code")} />
      </div>
    </div>
  );
}

export function LiveDocsPage() {
  const t = useT();
  const f = useFormat();
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
        title={t("developer.docs.title")}
        subtitle={t("developer.docs.subtitle")}
        actions={
          <>
            <a href={`${base}/openapi.json`} target="_blank" rel="noopener">
              <Button variant="surface">
                <BookOpen /> OpenAPI
              </Button>
            </a>
            <Link href="/developer">
              <Button variant="ember">
                <KeyRound /> {t("developer.keys.title")}
              </Button>
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="hidden xl:block">
          <div className="sticky top-24 space-y-1 text-[13px]">
            {[
              ["#auth", t("developer.docs.auth")],
              ["#endpoints", t("developer.docs.endpoints")],
              ["#errors", t("developer.docs.errors")],
              ["#webhooks", t("developer.docs.webhooks")],
              ["#strategies", t("developer.docs.strategies")],
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
              <CardHeader icon={<KeyRound />} title={t("developer.docs.auth")} subtitle={base} />
              <div className="space-y-4 px-6 pb-6 pt-4 text-[13.5px] text-fg-2">
                <p>
                  <Trans
                    k="developer.docs.authIntro"
                    tags={{
                      link: (c) => <Link href="/developer" className="text-ember hover:underline">{c}</Link>,
                      read: (c) => <Chip size="sm" tone="up">{c}</Chip>,
                      trade: (c) => <Chip size="sm" tone="ember">{c}</Chip>,
                    }}
                  />
                </p>
                <div className="k-label">{t("developer.docs.bearer")}</div>
                <Code lang="curl">{`curl ${base}/account -H "Authorization: Bearer $KEY_ID:$SECRET"`}</Code>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="k-label">{t("developer.docs.hmac")}</div>
                  <Segmented size="xs" value={lang} onChange={setLang} options={[{ value: "curl", label: "curl" }, { value: "python", label: "Python" }, { value: "node", label: "Node.js" }]} />
                </div>
                <p className="text-[12.5px] text-fg-3">
                  <Trans k="developer.docs.signature" tags={{ code: (c) => <code>{c}</code> }} />
                </p>
                <Code lang={lang}>{sign}</Code>
              </div>
            </Card>
          </Reveal>
          <Card id="endpoints">
            <CardHeader title={t("developer.docs.endpoints")} subtitle={t("developer.docs.endpointsSub")} />
            <div className="space-y-3 px-6 pb-6 pt-4">
              {ENDPOINTS.map((e) => (
                <div key={e.m + e.p} className="rounded-[12px] border border-line px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("w-16 rounded-md py-0.5 text-center font-mono text-[11px] font-semibold", e.m === "GET" ? "bg-up-soft text-up" : e.m === "DELETE" ? "bg-down-soft text-down" : "bg-ember-soft text-ember")}>{e.m}</span>
                    <code className="font-mono text-[12.5px] text-fg" dir="ltr">{e.p}</code>
                    <Chip size="sm" tone={e.scope === "trade" ? "ember" : "up"} className="ms-auto">
                      {t.dyn(`developer.scope.${e.scope}`, e.scope)}
                    </Chip>
                  </div>
                  <div className="mt-1 text-[12.5px] text-fg-3">{t.dyn(e.text)}</div>
                  {e.body && <pre dir="ltr" className="mt-2 overflow-x-auto rounded-[10px] bg-black/30 px-3 py-2 font-mono text-[11.5px] text-fg-2">{e.body}</pre>}
                </div>
              ))}
            </div>
          </Card>
          <Card id="errors">
            <CardHeader title={t("developer.docs.errors")} subtitle={t("developer.docs.errorsSub", { shape: `{"error": {"code", "message"}}` })} />
            <div className="overflow-x-auto px-6 pb-6 pt-4">
              <table className="w-full min-w-[640px] text-[12.5px]">
                <tbody>
                  {ERRORS.map(([s, c, k]) => (
                    <tr key={s} className="border-b border-line/60 align-top">
                      <td className="py-2 pe-3 font-mono text-fg">{s}</td>
                      <td className="py-2 pe-3 font-mono text-ember" dir="ltr">{c}</td>
                      <td className="py-2 text-fg-2">{t.dyn(k)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card id="webhooks">
            <CardHeader icon={<Webhook />} title={t("developer.docs.webhooks")} subtitle={`POST ${root}/hooks/<${t("developer.docs.secretToken")}>`} />
            <div className="space-y-3 px-6 pb-6 pt-4 text-[13px] text-fg-2">
              <p>
                <Trans k="developer.docs.webhookIntro" tags={{ link: (c) => <Link href="/developer/webhooks" className="text-ember hover:underline">{c}</Link> }} />
              </p>
              <Code lang="json">{`{"passphrase":"…","action":"{{strategy.order.action}}","symbol":"{{ticker}}","volume":{{strategy.order.contracts}},"sl_pips":20,"id":"{{strategy.order.id}}-{{timenow}}","timestamp":"{{timenow}}"}`}</Code>
              <p className="text-[12.5px] text-fg-3">
                {t("developer.docs.webhookFields")}
              </p>
            </div>
          </Card>
          <Card id="strategies">
            <CardHeader icon={<Workflow />} title={t("developer.docs.strategies")} subtitle={t("developer.docs.strategiesSub")} />
            <div className="space-y-3 px-6 pb-6 pt-4 text-[13px] text-fg-2">
              <Code lang="kst">{meta?.dsl.example ?? "…"}</Code>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {(meta?.dsl.functions ?? []).map((fn) => (
                  <div key={fn.syntax} className="rounded-[10px] bg-surface-2/50 px-3 py-2">
                    <code className="font-mono text-[11.5px] text-[#38bdf8]">{fn.syntax}</code>
                    <div className="text-[11.5px] text-fg-3">{fn.text}</div>
                  </div>
                ))}
              </div>
              <p className="text-[12.5px] text-fg-3">
                {t("developer.docs.sandbox", { chars: f.number(meta?.dsl.limits.sourceChars ?? 20000, 0), nodes: f.number(meta?.dsl.limits.nodes ?? 4000, 0), period: meta?.dsl.limits.period ?? 1000 })}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
