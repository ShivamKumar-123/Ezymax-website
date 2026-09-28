"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Card, Chip, CopyButton, Segmented, cn } from "@kalks/ui";
import { API_BASE, type ApiEndpoint, type HttpMethod } from "@kalks/mock/developer";
import { CodeBlock, toJson, type CodeLang } from "./code-block";

export type SampleLang = "curl" | "python" | "js";
export const SAMPLE_LANGS = [
  { value: "curl" as const, label: "cURL" },
  { value: "python" as const, label: "Python" },
  { value: "js" as const, label: "JavaScript" },
];
export const SAMPLE_TO_CODE: Record<SampleLang, CodeLang> = { curl: "bash", python: "python", js: "js" };

/* Shared language preference across all samples on the page */
export const DocsLangContext = React.createContext<{ lang: SampleLang; setLang: (l: SampleLang) => void }>({ lang: "curl", setLang: () => {} });

export function useDocsLang() {
  return React.useContext(DocsLangContext);
}

/* ------------------------------------------------------------------ */

const METHOD_CLS: Record<HttpMethod, string> = {
  GET: "border-up/30 bg-up-soft text-up",
  POST: "border-ember/35 bg-ember-soft text-ember",
  PUT: "border-warn/30 bg-warn-soft text-warn",
  DELETE: "border-down/30 bg-down-soft text-down",
};

export function MethodBadge({ method, className }: { method: HttpMethod | "WS" | "FIX"; className?: string }) {
  const cls = method === "WS" || method === "FIX" ? "border-gold/30 bg-gold-soft text-gold" : METHOD_CLS[method];
  return <span className={cn("inline-flex h-6 min-w-[58px] items-center justify-center rounded-md border px-2 font-mono text-[11px] font-semibold tracking-wide", cls, className)}>{method}</span>;
}

export function PathText({ path }: { path: string }) {
  const parts = path.split(/(\{[^}]+\})/);
  return (
    <span className="font-mono text-[13.5px]">
      {parts.map((p, i) =>
        p.startsWith("{") ? (
          <span key={i} className="text-gold">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}

const SAMPLE_PARAMS: Record<string, string> = { login: "80412337", id: "ord_8f21c0", ticket: "51298844" };

function resolvePath(e: ApiEndpoint) {
  let p = e.path.replace(/\{(\w+)\}/g, (_, k: string) => SAMPLE_PARAMS[k] ?? k);
  const q = e.params.filter((x) => x.in === "query");
  if (e.method === "GET" && q.length) p += `?${q[0]!.name}=${q[0]!.name === "type" ? "live" : q[0]!.name === "symbol" ? "XAUUSD" : "80412337"}`;
  return p;
}

function pyValue(v: unknown): string {
  if (typeof v === "string") return `"${v}"`;
  if (typeof v === "boolean") return v ? "True" : "False";
  if (v === null) return "None";
  return String(v);
}

export function sampleFor(e: ApiEndpoint, lang: SampleLang) {
  const path = resolvePath(e);
  const body = e.body;
  if (lang === "curl") {
    const lines = [`curl -X ${e.method} "${API_BASE}${path}" \\`, `  -H "X-KALKS-KEY: kk_live_EXAMPLE1" \\`, `  -H "X-KALKS-TIMESTAMP: 1790261892184" \\`, `  -H "X-KALKS-SIGNATURE: $SIG"${body ? " \\" : ""}`];
    if (body) lines.push(`  -H "Content-Type: application/json" \\`, `  -d '${JSON.stringify(body)}'`);
    return lines.join("\n");
  }
  if (lang === "python") {
    const fn = e.method.toLowerCase();
    const head = [`from kalks import Client`, ``, `client = Client(key="kk_live_EXAMPLE1", secret=os.environ["KALKS_SECRET"])`, ``];
    if (body) {
      const kv = Object.entries(body).map(([k, v]) => `    "${k}": ${pyValue(v)},`);
      return [...head, `resp = client.${fn}("${path}", json={`, ...kv, `})`, `print(resp.status_code, resp.json())`].join("\n");
    }
    return [...head, `resp = client.${fn}("${path}")`, `print(resp.json())  # ${e.title.toLowerCase()}`].join("\n");
  }
  const fn = e.method === "DELETE" ? "del" : e.method.toLowerCase();
  const head = [`import { Kalks } from "@kalks/sdk";`, ``, `const kalks = new Kalks({ key: "kk_live_EXAMPLE1", secret: process.env.KALKS_SECRET });`, ``];
  if (body) {
    const kv = Object.entries(body).map(([k, v]) => `  ${k}: ${typeof v === "string" ? `"${v}"` : String(v)},`);
    return [...head, `const res = await kalks.${fn}("${path}", {`, ...kv, `});`, `console.log(res.status, res.data);`].join("\n");
  }
  return [...head, `const res = await kalks.${fn}("${path}");`, `console.log(res.data); // ${e.title.toLowerCase()}`].join("\n");
}

/** Code sample with the page-wide language tabs. */
export function SampleBlock({ code, title }: { code: Record<SampleLang, string>; title?: string }) {
  const { lang, setLang } = useDocsLang();
  return (
    <CodeBlock
      code={code[lang]}
      lang={SAMPLE_TO_CODE[lang]}
      title={title ?? "Request"}
      tabs={<Segmented size="xs" value={lang} onChange={setLang} options={SAMPLE_LANGS} />}
    />
  );
}

export function EndpointCard({ e }: { e: ApiEndpoint }) {
  const code = { curl: sampleFor(e, "curl"), python: sampleFor(e, "python"), js: sampleFor(e, "js") };
  return (
    <Card id={`ep-${e.id}`} className="scroll-mt-28 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface-2/40 px-5 py-3.5">
        <MethodBadge method={e.method} />
        <PathText path={e.path} />
        <CopyButton value={`${API_BASE}${e.path}`} label="Endpoint URL" />
        <div className="ml-auto flex items-center gap-2">
          <Chip size="sm" tone={e.scope === "trade" ? "ember" : "info"}>
            scope: {e.scope}
          </Chip>
        </div>
      </div>
      <div className="px-5 pb-5 pt-4">
        <h4 className="text-[15px] font-medium">{e.title}</h4>
        <p className="mt-1 max-w-3xl text-[13.5px] leading-relaxed text-fg-2">{e.desc}</p>
        {e.params.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] border-separate border-spacing-0 text-[12.5px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wider text-fg-3">
                  {["Parameter", "In", "Type", "Description"].map((h, i) => (
                    <th key={h} className={cn("border-y border-line bg-surface-2 px-3 py-2 font-medium", i === 0 && "rounded-l-[10px] border-l", i === 3 && "rounded-r-[10px] border-r")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {e.params.map((p) => (
                  <tr key={p.name}>
                    <td className="border-b border-line px-3 py-2.5 align-top">
                      <span className="font-mono text-fg">{p.name}</span>
                      {p.required && <span className="ml-1.5 text-[10px] font-medium uppercase text-ember">required</span>}
                    </td>
                    <td className="border-b border-line px-3 py-2.5 align-top text-fg-3">{p.in}</td>
                    <td className="border-b border-line px-3 py-2.5 align-top font-mono text-gold/90">{p.type}</td>
                    <td className="border-b border-line px-3 py-2.5 align-top text-fg-2">{p.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <SampleBlock code={code} />
          <CodeBlock code={toJson(e.response)} lang="json" title={`200 OK · application/json`} />
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Section wrapper + scroll-spy nav                                     */
/* ------------------------------------------------------------------ */

export function DocSection({ id, title, kicker, intro, children }: { id: string; title: string; kicker?: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} data-doc-section className="scroll-mt-28">
      <div className="mb-4">
        {kicker && <div className="k-label text-ember">{kicker}</div>}
        <h2 className="mt-1 text-[22px] font-medium tracking-tight">{title}</h2>
        {intro && <div className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-fg-2">{intro}</div>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function useScrollSpy(ids: string[]) {
  const [active, setActive] = React.useState(ids[0]!);
  React.useEffect(() => {
    const onScroll = () => {
      const y = window.innerHeight * 0.3;
      let cur = ids[0]!;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - y <= 0) cur = id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = ids[ids.length - 1]!;
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [ids]);
  return active;
}

export function DocsNav({ items, active }: { items: { id: string; label: string; icon: React.ReactNode; count?: number }[]; active: string }) {
  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
  };
  return (
    <>
      {/* Desktop sticky rail */}
      <nav className="sticky top-24 hidden lg:block">
        <div className="k-card p-2">
          <div className="px-3 pb-2 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">Reference</div>
          {items.map((it) => {
            const on = it.id === active;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => go(it.id)}
                className={cn("relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition-colors [&_svg]:size-4", on ? "text-fg" : "text-fg-3 hover:bg-surface-2 hover:text-fg-2")}
              >
                {on && <motion.span layoutId="docs-nav" className="absolute inset-0 rounded-xl border border-ember/25 bg-ember-soft" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
                <span className={cn("relative", on && "text-ember")}>{it.icon}</span>
                <span className="relative flex-1">{it.label}</span>
                {it.count !== undefined && <span className="relative font-mono text-[10.5px] text-fg-3">{it.count}</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-3 rounded-[16px] border border-line px-4 py-3 text-[12px]">
          <div className="text-fg-3">Base URL</div>
          <div className="mt-1 flex items-center gap-1 font-mono text-[11.5px] text-fg">
            <span className="truncate">{API_BASE}</span>
            <CopyButton value={API_BASE} label="Base URL" />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-fg-3">
            <span className="size-1.5 animate-pulse rounded-full bg-up" /> All systems operational
          </div>
        </div>
      </nav>
      {/* Mobile chip bar */}
      <div className="sticky top-[72px] z-20 -mx-4 mb-4 overflow-x-auto border-b border-line bg-bg/85 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:hidden">
        <div className="flex gap-1.5">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => go(it.id)}
              className={cn("h-8 shrink-0 rounded-full border px-3 text-[12px] font-medium", it.id === active ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2")}
            >
              {it.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Simple doc table                                                    */
/* ------------------------------------------------------------------ */

export function DocTable({ head, rows, mono = [] }: { head: string[]; rows: React.ReactNode[][]; mono?: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr className="text-left text-[10.5px] uppercase tracking-wider text-fg-3">
            {head.map((h, i) => (
              <th key={h} className={cn("border-y border-line bg-surface-2 px-4 py-2.5 font-medium", i === 0 && "rounded-l-[12px] border-l", i === head.length - 1 && "rounded-r-[12px] border-r")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="transition-colors hover:bg-surface-2/50">
              {r.map((c, j) => (
                <td key={j} className={cn("border-b border-line px-4 py-3 align-top", mono.includes(j) ? "font-mono text-[12.5px]" : "text-fg-2", j === 0 && "text-fg")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
