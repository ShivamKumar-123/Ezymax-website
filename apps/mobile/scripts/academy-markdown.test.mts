// Academy chapter markdown (src/features/academy/markdown/parse.ts) against the real course content
// (content/academy/en, the same files the Academy service seeds), plus the edge cases of the Client Area parser.
//   node --import ./apps/mobile/scripts/test-hooks.mjs --test apps/mobile/scripts/academy-markdown.test.mts
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { headingsOf, parseBlocks, parseCallout, parseInline, plainText, slugId, svgAspect, svgTitle, tableLayout } from "../src/features/academy/markdown/parse.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "content", "academy", "en");

function chapters(): { file: string; body: string }[] {
  const out: { file: string; body: string }[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith(".md")) {
        const raw = readFileSync(p, "utf8");
        // front matter is YAML between the first two --- lines; the body follows
        const m = /^---\n[\s\S]*?\n---\n([\s\S]*)$/.exec(raw);
        out.push({ file: p.slice(root.length + 1), body: m ? m[1]! : raw });
      }
    }
  };
  walk(root);
  return out;
}

test("every chapter of the course parses into known blocks (110 chapters)", () => {
  const all = chapters();
  assert.equal(all.length, 110);
  const kinds = new Map<string, number>();
  for (const { file, body } of all) {
    const blocks = parseBlocks(body);
    assert.ok(blocks.length > 5, `${file}: ${blocks.length} blocks`);
    for (const b of blocks) {
      kinds.set(b.t, (kinds.get(b.t) ?? 0) + 1);
      if (b.t === "code") assert.ok(b.lang === "text" || b.lang === "svg" || b.lang === "", `${file}: fence ${b.lang}`);
      if (b.t === "table") for (const r of b.rows) assert.ok(r.length <= b.head.length + 1, `${file}: row wider than its head`);
      if (b.t === "p") assert.ok(!b.text.startsWith("## ") && !b.text.startsWith("```"), `${file}: special line swallowed into a paragraph`);
    }
    // nothing is lost: every non-empty body line shows up in some block
    const joined = JSON.stringify(blocks);
    for (const line of body.split("\n")) {
      const tr = line.trim().replace(/^(#{2,3}|>|[-*]|\d+[.)])\s?/, "").trim();
      if (!tr || /^[-|:\s]+$/.test(tr) || tr.startsWith("```")) continue;
      const probe = tr.split("|")[0]!.trim().slice(0, 24);
      if (probe) assert.ok(joined.includes(JSON.stringify(probe).slice(1, -1)), `${file}: lost "${probe}"`);
    }
  }
  for (const k of ["h", "p", "ul", "table", "code", "quote"]) assert.ok((kinds.get(k) ?? 0) > 0, `no ${k} blocks in the course`);
});

test("svg diagrams: all 44 have a viewBox aspect and a readable title; nothing scriptable", () => {
  let n = 0;
  for (const { file, body } of chapters()) {
    for (const b of parseBlocks(body)) {
      if (b.t !== "code" || b.lang !== "svg") continue;
      n++;
      const a = svgAspect(b.text);
      assert.ok(a > 1 && a < 5, `${file}: aspect ${a}`);
      assert.ok(svgTitle(b.text), `${file}: diagram without a text label`);
      assert.ok(!/<script|foreignobject|javascript:|<image/i.test(b.text), `${file}: unsafe svg`);
    }
  }
  assert.equal(n, 44);
});

test("callouts: the course's labels map to known kinds", () => {
  const seen = new Set<string>();
  for (const { body } of chapters())
    for (const b of parseBlocks(body)) {
      if (b.t !== "quote") continue;
      const c = parseCallout(b.text);
      assert.ok(c, `unlabelled quote: ${b.text.slice(0, 40)}`);
      assert.ok(c.kind, `unknown callout label "${c.label}"`);
      assert.ok(c.body.length > 10);
      seen.add(c.kind);
    }
  for (const k of ["riskWarning", "example", "tip"]) assert.ok(seen.has(k), k);
  assert.deepEqual(parseCallout("**Risk warning:** Leverage cuts both ways."), { kind: "riskWarning", label: "Risk warning", body: "Leverage cuts both ways." });
  assert.deepEqual(parseCallout("**In Kalks Trader**: open the chart."), { kind: "inKalksTrader", label: "In Kalks Trader", body: "open the chart." });
  assert.equal(parseCallout("Just a quote."), null);
  assert.equal(parseCallout("**Custom:** text")?.kind, null);
});

test("inline markdown: code, bold (nesting code), italic, internal links only", () => {
  const n = parseInline("A **bold `x`** and *it* with `c` and [calendar](/calendar) but [evil](https://x.y) end");
  assert.deepEqual(n.map((x) => x.t), ["text", "bold", "text", "italic", "text", "code", "text", "link", "text", "link", "text"]);
  const bold = n[1] as { t: "bold"; children: { t: string }[] };
  assert.deepEqual(bold.children.map((x) => x.t), ["text", "code"]);
  assert.equal((n[7] as { href: string | null }).href, "/calendar");
  assert.equal((n[9] as { href: string | null }).href, null, "external links never become links");
  assert.equal(plainText(n), "A bold x and it with c and calendar but evil end");
  assert.deepEqual(parseInline("2 * 3 * 4"), [{ t: "text", text: "2 * 3 * 4" }], "a lone asterisk with spaces is not italic");
  assert.deepEqual(parseInline("//evil").length, 1);
});

test("the Client Area's block rules: numbered lists, continuation lines, rules, duplicate heading ids", () => {
  const b = parseBlocks("## Risk\n\n1. First\n   continues\n2) Second\n\n---\n\n## Risk\n\n- a\n* b\n\ntext\nmore\n| A | B |\n|---|---|\n| 1 | 2 |\n");
  assert.deepEqual(b.map((x) => x.t), ["h", "ol", "hr", "h", "ul", "p", "table"]);
  assert.deepEqual((b[1] as { items: string[] }).items, ["First continues", "Second"]);
  assert.equal((b[0] as { id: string }).id, "h-risk");
  assert.equal((b[3] as { id: string }).id, "h-risk-2");
  assert.equal((b[5] as { text: string }).text, "text more");
  assert.deepEqual(headingsOf(b).map((h) => [h.id, h.index]), [["h-risk", 0], ["h-risk-2", 3]]);
  assert.equal(slugId("What **moves** `prices`?"), "h-what-moves-prices");
  const ol = parseBlocks("3. Third\n4. Fourth");
  assert.equal((ol[0] as { start: number }).start, 3);
});

test("tables fit the phone when they can and scroll sideways when they can't", () => {
  const small = tableLayout(["Lot", "Units"], [["1", "100,000"], ["0.1", "10,000"]], 348);
  assert.equal(small.scroll, false);
  assert.ok(Math.abs(small.widths.reduce((a, b) => a + b, 0) - 348) < 0.01);
  const wide = tableLayout(["Move", "What happens", "Typical cause", "Typical FX reading"], [["Bull steepener", "Short yields fall faster than long", "Market pricing rate cuts", "Currency weakens as its rate advantage fades"]], 348);
  assert.equal(wide.scroll, true);
  assert.ok(wide.widths.every((w) => w >= 112));
  // every real table gets a layout with one width per column
  for (const { body } of chapters())
    for (const t of parseBlocks(body))
      if (t.t === "table") {
        const l = tableLayout(t.head, t.rows, 348);
        assert.equal(l.widths.length, Math.max(t.head.length, ...t.rows.map((r) => r.length)));
        assert.ok(l.widths.every((w) => Number.isFinite(w) && w > 40));
      }
});
