#!/usr/bin/env node
// Drives assets/chart/tv-chart.html with a stubbed TradingView: every message the app can send over the
// bridge goes in, and this checks that each one is handled and that nothing throws. No browser, so it tests
// the logic rather than the drawing - but the page is one <script> in an asset that nothing else compiles,
// so without this a typo in it ships silently and the chart is simply blank on the phone. That is exactly
// what happened once: a stray semicolon in the datafeed, found here and not on a handset.
//
//   node apps/mobile/tool/check-tv-chart.mjs     (from the repo root)
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../assets/chart/tv-chart.html", import.meta.url), "utf8");
const src = /<script>\n([\s\S]*?)\n<\/script>/.exec(html)[1];

const posted = [];
const calls = [];
const made = [];

const orderLine = () => {
  const o = {};
  for (const m of ["setPrice", "setText", "setQuantity", "setLineColor", "setBodyBorderColor", "setBodyTextColor",
    "setQuantityBackgroundColor", "setQuantityBorderColor", "setBodyBackgroundColor", "setLineStyle",
    "setEditable", "setLineWidth", "setCancelTooltip", "onMoving", "onMove", "onCancel", "onModify"]) o[m] = () => o;
  o.getPrice = () => 1.2345;
  o.remove = () => calls.push("line.remove");
  made.push(o);
  return o;
};

// the one horizontal_line shape the page creates for the Buy price, and where it was last moved to
const shapes = new Map();
let shapeSeq = 0;
let onReadyCb = null;
const chart = {
  getVisibleRange: () => ({ from: 1_699_990_000, to: 1_700_000_600 }),
  createShape: (point, opts) => {
    const id = `shape-${++shapeSeq}`;
    shapes.set(id, { price: point.price, props: { ...opts.overrides }, shape: opts.shape, showPrice: opts.overrides.showPrice });
    calls.push(`createShape:${opts.shape}`);
    return Promise.resolve(id);
  },
  getShapeById: (id) => {
    const s = shapes.get(id);
    if (!s) throw new Error("no such shape");
    return {
      getPoints: () => [{ price: s.price, time: 1_700_000_600 }],
      setPoints: (pts) => { s.price = pts[0].price; calls.push("shape.setPoints"); },
      setProperties: (p) => Object.assign(s.props, p),
    };
  },
  setChartType: (t) => calls.push(`setChartType:${t}`),
  resetData: () => calls.push("resetData"),
  createOrderLine: orderLine,
  createStudy: (n) => { calls.push(`study:${n}`); return Promise.resolve(`id-${n}`); },
  removeEntity: (id) => calls.push(`removeEntity:${id}`),
};
const widget = {
  onChartReady: (cb) => { onReadyCb = cb; },
  activeChart: () => chart,
  changeTheme: (t) => { calls.push(`theme:${t}`); return Promise.resolve(); },
  applyOverrides: () => calls.push("applyOverrides"),
};

const el = { style: {} };
const ctx = {
  console,
  setTimeout,
  // the datafeed the page hands the library is kept, so the test can play the library's side of it
  TradingView: { widget: function (opts) { calls.push("widget()"); ctx.__datafeed = opts.datafeed; ctx.__opts = opts; return widget; } },
  document: { getElementById: () => el },
  window: { EzymexChart: { postMessage: (s) => posted.push(JSON.parse(s)) } },
};
ctx.window.window = ctx.window;
vm.createContext(ctx);
vm.runInContext(src, ctx);

const K = ctx.window.K;
// A bar exactly as chart_bridge.dart `_bar` sends it: the ARRAY [t, o, h, l, c, v], t in seconds. The first
// version of this check invented an object shape instead of reading the Dart, passed, and shipped a page that
// threw every real bar away. The fixture is the contract now.
const bar = (t, c) => [t, c, c + 1, c - 1, c, 10];

// The handshake comes first. The app sends nothing until the page has said ready - not even the init that
// builds the chart - so ready has to be posted by the time the script has run, before anything is received.
// (A version that waited for the chart to be built before saying ready shipped a blank pane: each side was
// waiting for the other. This is the line that would have caught it.)
const readyFirst = posted.length === 1 && posted[0].type === "ready";

// lines and a quote that arrive before the library has started must still be drawn once it has
K.recv({ type: "lines", lines: [{ id: "early:1", kind: "alert", price: 1.5, label: "early" }] });
K.recv({ type: "quote", bid: 1.49, ask: 1.51 });

// init builds the widget; the library only reports ready once it says so
K.recv({ type: "init", digits: 5, intraday: true, palette: { dark: true, bg: "#000", up: "#0f0", down: "#f04438", buy: "#4a7bff" }, symbol: "EURUSD", tf: "M5", step: 300, chartType: "candles", indicators: [{ uid: "u1", type: "rsi", params: { len: 14 }, visible: true }] });
onReadyCb();

// The library's first request lands before the app has sent its history. It must be parked, not answered
// "no data" (which the library would believe and never ask again), and answered once the bars arrive - with
// the bars decoded from the array form, time scaled from seconds to milliseconds.
let firstAnswer = null;
ctx.__datafeed.getBars("EURUSD", "5", { firstDataRequest: true }, (b, meta) => { firstAnswer = { b, meta }; }, () => { firstAnswer = "error"; });
const parked = firstAnswer === null;

K.recv({ type: "bars", bars: [bar(1_700_000_000, 1.1), bar(1_700_000_300, 1.2)] });
K.recv({ type: "bar", bar: bar(1_700_000_600, 1.3) });
K.recv({ type: "quote", bid: 1.2999, ask: 1.3001 });
K.recv({ type: "lines", lines: [{ id: "pos:1", kind: "pos", price: 1.25, label: "Buy 0.10", side: "buy", closable: true, note: "+12.40" }, { id: "sl:1", kind: "sl", price: 1.2, label: "SL", draggable: true }] });
K.recv({ type: "lines", lines: [{ id: "pos:1", kind: "pos", price: 1.25, label: "Buy 0.10", side: "buy", closable: true, note: "+12.40" }] });
K.recv({ type: "chartType", chartType: "line" });
K.recv({ type: "palette", palette: { dark: false, bg: "#fff" } });
K.recv({ type: "indicators", indicators: [] });
K.batch([{ type: "bar", bar: bar(1_700_000_600, 1.35) }, { type: "quote", bid: 1.34, ask: 1.36 }]);
// createShape resolves on a microtask; the quotes above landed while it was being created
await new Promise((r) => setTimeout(r, 0));
K.recv({ type: "quote", bid: 1.37, ask: 1.39 });

const fail = [];
const want = (cond, msg) => { if (!cond) fail.push(msg); };

want(readyFirst, "ready must be posted as soon as the script runs, before any message is received");
want(parked, "a first getBars before the bars message must be parked, not answered");
want(firstAnswer && firstAnswer !== "error" && firstAnswer.b.length === 2, "the parked first getBars was not answered with the two bars");
want(firstAnswer && firstAnswer.b[0].time === 1_700_000_000_000 && firstAnswer.b[0].open === 1.1 && firstAnswer.b[0].volume === 10, "a bar sent as [t,o,h,l,c,v] in seconds was not decoded to milliseconds");
want(firstAnswer && firstAnswer.meta && firstAnswer.meta.noData === false, "the first answer must not claim no data");
want(made.length >= 3, "a line sent before the chart was ready was never drawn after it was");
want(calls.includes("widget()"), "widget was never built");
// the web terminal's candles: rising in the buy blue, not the P&L green; the volume bars in the same two colours
const ov = (ctx.__opts || {}).overrides || {};
want(ov["mainSeriesProperties.candleStyle.upColor"] === "#4a7bff" && ov["mainSeriesProperties.candleStyle.wickDownColor"] === "#f04438", "candles are not in the web terminal's colours (buy blue / red)");
want(((ctx.__opts || {}).studies_overrides || {})["volume.volume.color.1"] === "rgba(74,123,255,0.32)", "volume bars are not in the candle colours");
want(calls.includes("study:Relative Strength Index"), "RSI study not created");
want(calls.filter((c) => c === "line.remove").length >= 1, "the removed SL line was not cleaned up");
want(calls.includes("setChartType:2"), "line chart type not applied");
want(calls.includes("theme:light"), "palette switch did not change the theme");
// the Buy price: one dotted blue line, no badge, moved to the latest ask rather than drawn again
const ask = [...shapes.values()].filter((s) => s.shape === "horizontal_line");
want(ask.length === 1, `expected one Buy line, found ${ask.length}`);
want(ask[0] && ask[0].price === 1.39, `the Buy line is at ${ask[0] && ask[0].price}, not the latest ask 1.39`);
want(ask[0] && ask[0].showPrice === false && ask[0].props.linestyle === 1 && ask[0].props.linecolor === "#4a7bff", "the Buy line is not a dotted blue line without a badge");

console.log("posted :", posted.map((p) => p.type).join(", "));
console.log("calls  :", [...new Set(calls)].join(", "));
console.log(fail.length ? "FAIL\n  " + fail.join("\n  ") : "PASS — every bridge message handled, nothing thrown");
process.exit(fail.length ? 1 : 0);
