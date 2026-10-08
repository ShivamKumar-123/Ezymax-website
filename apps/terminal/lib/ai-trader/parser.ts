/**
 * Deterministic local parser: turns common plain-language strategy phrasings into a StrategySpec.
 * Used when Claude is not configured, and as an offline fallback. Anything it cannot read is
 * reported back as a clarifying question instead of being guessed.
 */
import { INSTRUMENTS, priceFeed } from "@ezymex/mock";
import { TIMEFRAMES, type Timeframe } from "../trading";
import {
  candle,
  defaultSpec,
  ind,
  operand,
  price,
  val,
  validateSpec,
  type CandlePattern,
  type Condition,
  type Distance,
  type IndicatorName,
  type Operand,
  type Operator,
  type ParseResult,
  type RuleSet,
  type StrategySpec,
} from "./schema";
import { describeCondition } from "./describe";

const ALIASES: [RegExp, string][] = [
  [/\bgold\b/, "XAUUSD"],
  [/\bsilver\b/, "XAGUSD"],
  [/\b(bitcoin|btc)\b/, "BTCUSD"],
  [/\b(ether(eum)?|eth)\b/, "ETHUSD"],
  [/\b(solana|sol)\b/, "SOLUSD"],
  [/\b(ripple|xrp)\b/, "XRPUSD"],
  [/\b(nasdaq|nas ?100|us ?100|ustec)\b/, "NAS100"],
  [/\b(dow( jones)?|us ?30)\b/, "US30"],
  [/\b(s&p ?500|spx|us ?500)\b/, "SPX500"],
  [/\b(dax|ger ?40|de ?40)\b/, "GER40"],
  [/\b(ftse|uk ?100)\b/, "UK100"],
  [/\b(nikkei|jp ?225)\b/, "JP225"],
  [/\b(wti|crude|us ?oil)\b/, "USOIL"],
  [/\b(brent|uk ?oil)\b/, "UKOIL"],
  [/\bcable\b/, "GBPUSD"],
  [/\bfiber\b/, "EURUSD"],
  [/\bapple\b/, "AAPL"],
  [/\btesla\b/, "TSLA"],
  [/\bnvidia\b/, "NVDA"],
];

const NUM = String.raw`(\d+(?:\.\d+)?)`;

/** Mutable working copy: extractors blank out what they consume so nothing is read twice. */
class Work {
  s: string;
  constructor(s: string) {
    this.s = s;
  }
  take(re: RegExp, fn: (m: RegExpExecArray) => void) {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m: RegExpExecArray | null;
    const hits: RegExpExecArray[] = [];
    while ((m = g.exec(this.s))) {
      hits.push(m);
      if (m[0].length === 0) g.lastIndex++;
    }
    for (const h of hits) {
      fn(h);
      this.s = this.s.slice(0, h.index) + " ".repeat(h[0].length) + this.s.slice(h.index + h[0].length);
    }
    return hits.length > 0;
  }
}

function unitMode(u: string | undefined, fallback: Distance["mode"] = "points"): Distance["mode"] {
  if (!u) return fallback;
  const x = u.replace(/\s/g, "");
  if (/atr/.test(x)) return "atr";
  if (/^pips?$/.test(x)) return "pips";
  if (/^(points?|pts?|p)$/.test(x)) return "points";
  if (/^(%|percent)$/.test(x)) return "percent";
  if (/^(\$|usd|dollars?)$/.test(x)) return "price";
  if (/^(r|rr|xr)$/.test(x)) return "rr";
  return fallback;
}

const TF_WORDS: [RegExp, Timeframe][] = [
  [/\b(m1|1\s*-?\s*min(ute)?s?|1m|one[- ]minute)\b/, "M1"],
  [/\b(m5|5\s*-?\s*min(ute)?s?|5m|five[- ]minute)\b/, "M5"],
  [/\b(m15|15\s*-?\s*min(ute)?s?|15m|fifteen[- ]minute)\b/, "M15"],
  [/\b(m30|30\s*-?\s*min(ute)?s?|30m|thirty[- ]minute|half[- ]hour(ly)?)\b/, "M30"],
  [/\b(h1|1\s*-?\s*h(ou)?r?s?|1h|hourly|one[- ]hour)\b/, "H1"],
  [/\b(h4|4\s*-?\s*h(ou)?r?s?|4h|four[- ]hour)\b/, "H4"],
  [/\b(d1|daily|1d)\b/, "D1"],
  [/\b(w1|weekly)\b/, "W1"],
];

function findTimeframe(s: string): { tf: Timeframe; index: number; len: number } | null {
  let best: { tf: Timeframe; index: number; len: number } | null = null;
  for (const [re, tf] of TF_WORDS) {
    const m = re.exec(s);
    if (m && (!best || m.index < best.index)) best = { tf, index: m.index, len: m[0].length };
  }
  return best;
}

/* ------------------------------ operands ------------------------------ */

const IND_WORD = String.raw`(rsi|ema|sma|ma|moving average|exponential moving average|simple moving average|atr|stoch(?:astic)?(?:\s*%?\s*[kd])?|macd(?:\s*line)?|signal(?:\s*line)?|macd\s*signal(?:\s*line)?|macd\s*hist(?:ogram)?|histogram)`;

function indName(w: string): IndicatorName | null {
  const x = w.replace(/\s+/g, " ").trim();
  if (x === "rsi") return "rsi";
  if (x === "ema" || x === "exponential moving average") return "ema";
  if (x === "sma" || x === "ma" || x === "moving average" || x === "simple moving average") return "sma";
  if (x === "atr") return "atr";
  if (/^stoch/.test(x)) return /d$/.test(x) ? "stoch_d" : "stoch_k";
  if (/hist/.test(x)) return "macd_hist";
  if (/signal/.test(x)) return "macd_signal";
  if (/^macd/.test(x)) return "macd";
  return null;
}

function parseOperand(raw: string): Operand | null {
  const s = raw
    .replace(/\b(the|a|an|its|current|level|line of|period|value|reading)\b/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^-?\d+(\.\d+)?$/))) return val(+s);
  if (s === "zero") return val(0);
  if (/^(price|close|closing price|candle close|bar close|market|it)$/.test(s)) return price("close");
  if (/^(high|candle high|bar high)$/.test(s)) return price("high");
  if (/^(low|candle low|bar low)$/.test(s)) return price("low");
  if (/^(open|candle open)$/.test(s)) return price("open");
  // bollinger bands
  if ((m = s.match(/^(?:(upper|lower|middle|mid)\s+)?(?:bollinger|bb)(?:\s+bands?)?(?:\s+(upper|lower|middle|mid))?(?:\s*(\d+))?(?:\s*,?\s*(\d+(?:\.\d+)?))?(?:\s+band)?$/))) {
    const side = (m[1] ?? m[2] ?? "middle").replace("mid", "middle").replace("middledle", "middle");
    return ind(side === "upper" ? "bb_upper" : side === "lower" ? "bb_lower" : "bb_middle", m[3] ? +m[3] : 0, { mult: m[4] ? +m[4] : 0 });
  }
  if ((m = s.match(/^(upper|lower|middle) band$/))) return ind(m[1] === "upper" ? "bb_upper" : m[1] === "lower" ? "bb_lower" : "bb_middle");
  // N-bar high / low
  if ((m = s.match(/^(?:previous\s+|last\s+|prior\s+)?(\d+)\s*-?\s*(?:bar|candle|period|day)s?\s+(high|low|highest high|lowest low)$/))) return ind(m[2]!.includes("high") ? "highest" : "lowest", +m[1]!);
  if ((m = s.match(/^(highest high|lowest low)(?:\s+of)?(?:\s+(?:last\s+)?(\d+)(?:\s*(?:bars?|candles?))?)?$/))) return ind(m[1] === "highest high" ? "highest" : "lowest", m[2] ? +m[2] : 0);
  // "ema 200", "ema200", "200 ema", "200-period ema", "rsi 14", "macd 12,26,9"
  if ((m = s.match(new RegExp(String.raw`^${IND_WORD}\s*-?\s*(\d+)?(?:\s*[,/]\s*(\d+))?(?:\s*[,/]\s*(\d+))?$`)))) {
    const n = indName(m[1]!);
    if (!n) return null;
    if (n === "macd" || n === "macd_signal" || n === "macd_hist") return ind(n, m[2] ? +m[2] : 0, { period2: m[3] ? +m[3] : 0, period3: m[4] ? +m[4] : 0 });
    return ind(n, m[2] ? +m[2] : 0);
  }
  if ((m = s.match(new RegExp(String.raw`^(\d+)\s*-?\s*${IND_WORD}$`)))) {
    const n = indName(m[2]!);
    return n ? ind(n, +m[1]!) : null;
  }
  return null;
}

const COMP = String.raw`(crosses?\s+(?:above|over|up\s+through|upward)|crosses?\s+(?:below|under|down\s+through|downward)|cross(?:es)?\s+up|cross(?:es)?\s+down|breaks?\s+(?:above|over|out\s+above)|breaks?\s+(?:below|under|out\s+below|down)|closes?\s+(?:above|over)|closes?\s+(?:below|under)|(?:is\s+|stays\s+|remains\s+|trades\s+)?(?:above|over|greater\s+than|higher\s+than|more\s+than)|(?:is\s+|stays\s+|remains\s+|trades\s+)?(?:below|under|less\s+than|lower\s+than)|>=|<=|>|<)`;

function opOf(w: string): { op: Operator; closeImplied: boolean } {
  const x = w.replace(/\s+/g, " ");
  const up = /(above|over|up|greater|higher|more|>)/.test(x);
  const cross = /cross|break/.test(x);
  if (x === ">=") return { op: "gte", closeImplied: false };
  if (x === "<=") return { op: "lte", closeImplied: false };
  return { op: cross ? (up ? "crosses_above" : "crosses_below") : up ? "gt" : "lt", closeImplied: /^closes?/.test(x) };
}

const PATTERNS: [RegExp, CandlePattern][] = [
  [/bullish engulfing/, "bullish_engulfing"],
  [/bearish engulfing/, "bearish_engulfing"],
  [/shooting star/, "shooting_star"],
  [/\bhammer\b/, "hammer"],
  [/\bdoji\b/, "doji"],
  [/inside (bar|candle)/, "inside_bar"],
  [/(bullish|green|up) (candle|bar|close)/, "bullish"],
  [/(bearish|red|down) (candle|bar|close)/, "bearish"],
];

/** One clause -> one or two conditions (null when not understood). */
function parseClause(raw: string): Condition[] | null {
  let s = raw.replace(/\s+/g, " ").trim();
  if (!s) return [];
  let timeframe: Condition["timeframe"] = "same";
  const tf = findTimeframe(s);
  if (tf) {
    timeframe = tf.tf;
    s = (s.slice(0, tf.index) + s.slice(tf.index + tf.len)).replace(/\b(on|the|timeframe|chart|tf)\b/g, " ").replace(/\s+/g, " ").trim();
  }
  s = s.replace(/^(the|a|an|when|if|once|and|then|also)\s+/g, "").trim();
  const C = (left: Operand, op: Operator, right: Operand): Condition => ({ left, op, right, timeframe });

  for (const [re, p] of PATTERNS) if (re.test(s)) return [C(candle(p), "gte", val(1))];

  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(golden|death) cross$/))) return [C(ind("sma", 50), m[1] === "golden" ? "crosses_above" : "crosses_below", ind("sma", 200))];
  if ((m = s.match(new RegExp(String.raw`^(rsi|stoch(?:astic)?)\s*\(?(\d+)?\)?\s*(?:is\s+)?(oversold|overbought)$`)))) {
    const n = m[1] === "rsi" ? "rsi" : "stoch_k";
    const over = m[3] === "overbought";
    const lvl = n === "rsi" ? (over ? 70 : 30) : over ? 80 : 20;
    return [C(ind(n, m[2] ? +m[2] : 0), over ? "gt" : "lt", val(lvl))];
  }
  if ((m = s.match(/^(rsi|stoch(?:astic)?)\s*\(?(\d+)?\)?\s*(?:exits?|leaves?|comes out of|rises out of|recovers from) oversold$/))) {
    const n = m[1] === "rsi" ? "rsi" : "stoch_k";
    return [C(ind(n, m[2] ? +m[2] : 0), "crosses_above", val(n === "rsi" ? 30 : 20))];
  }
  if ((m = s.match(/^(rsi|stoch(?:astic)?)\s*\(?(\d+)?\)?\s*(?:exits?|leaves?|comes out of|falls out of|drops from) overbought$/))) {
    const n = m[1] === "rsi" ? "rsi" : "stoch_k";
    return [C(ind(n, m[2] ? +m[2] : 0), "crosses_below", val(n === "rsi" ? 70 : 80))];
  }
  // "price between X and Y"
  if ((m = s.match(new RegExp(String.raw`^(.*?)\s*(?:is\s+)?between\s+${NUM}\s+and\s+${NUM}$`)))) {
    const left = parseOperand(m[1] || "price");
    if (left) return [C(left, "gte", val(Math.min(+m[2]!, +m[3]!))), C(left, "lte", val(Math.max(+m[2]!, +m[3]!)))];
  }

  const cm = s.match(new RegExp(String.raw`^(.*?)\s*${COMP}\s*(.*)$`));
  if (!cm) return null;
  const { op, closeImplied } = opOf(cm[2]!.trim());
  let leftTxt = cm[1]!.trim();
  const rightTxt = cm[3]!.trim();
  if (!leftTxt || closeImplied || /^(price|candle|bar|it)$/.test(leftTxt)) leftTxt = leftTxt && !/^(candle|bar|it)$/.test(leftTxt) ? leftTxt : "price";
  const left = parseOperand(leftTxt);
  let right = parseOperand(rightTxt);
  if (!left) return null;
  // "macd crosses above signal" -> same periods; "... above zero"
  if (!right && /^signal/.test(rightTxt) && left.indicator === "macd") right = ind("macd_signal");
  if (!right) return null;
  if (left.kind === "indicator" && right.kind === "indicator" && left.indicator.startsWith("macd") && right.indicator.startsWith("macd")) {
    right = { ...right, period: left.period || right.period, period2: left.period2 || right.period2, period3: left.period3 || right.period3 };
  }
  if (left.kind === "indicator" && left.indicator === "stoch_k" && right.kind === "indicator" && right.indicator === "stoch_d") right = { ...right, period: left.period, period2: left.period2 };
  return [C(left, op, right)];
}

function parseConditions(text: string, unparsed: string[]): RuleSet {
  const cleaned = text
    .replace(/[,;]+/g, " and ")
    .replace(/\b(and also|as well as|plus|&)\b/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return { logic: "all", groups: [] };
  const orParts = cleaned.split(/\bor\b/);
  const groups = orParts
    .map((part) => {
      const conditions: Condition[] = [];
      // do not split "between X and Y"
      const protectedPart = part.replace(new RegExp(String.raw`between\s+${NUM}\s+and\s+${NUM}`, "g"), (x) => x.replace(" and ", " __AND__ "));
      for (const c0 of protectedPart.split(/\band\b/)) {
        const c = c0.replace(/__AND__/g, "and").trim();
        if (!c || /^(then|also|only)$/.test(c)) continue;
        const parsed = parseClause(c);
        if (parsed === null) unparsed.push(c);
        else conditions.push(...parsed);
      }
      return { logic: "all" as const, conditions };
    })
    .filter((g) => g.conditions.length);
  return { logic: groups.length > 1 ? "any" : "all", groups };
}

/* ------------------------------ entry point ------------------------------ */

export function parseLocal(prompt: string, ctx: { symbol: string; timeframe: Timeframe }): ParseResult {
  const questions: string[] = [];
  const assumptions: string[] = [];
  const unparsed: string[] = [];
  const original = prompt.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  const w = new Work(" " + original.toLowerCase() + " ");

  // symbol
  let symbol: string | null = null;
  let symAt = Infinity;
  const upper = w.s.toUpperCase().replace(/\b([A-Z]{3})\/([A-Z]{3})\b/g, "$1$2 ");
  for (const i of INSTRUMENTS) {
    const m = new RegExp(String.raw`\b${i.symbol.replace(".", "\\.")}\b`).exec(upper);
    if (m && m.index < symAt) {
      symbol = i.symbol;
      symAt = m.index;
    }
  }
  w.s = w.s.replace(/\b([a-z]{3})\/([a-z]{3})\b/g, (x, a: string, b: string) => (INSTRUMENTS.some((i) => i.symbol === (a + b).toUpperCase()) ? `${a}${b} ` : x));
  if (symbol) w.take(new RegExp(String.raw`\b${symbol.toLowerCase()}\b`), () => {});
  if (!symbol)
    for (const [re, s] of ALIASES) {
      const m = re.exec(w.s);
      if (m && m.index < symAt) {
        symbol = s;
        symAt = m.index;
      }
    }
  if (!symbol) {
    symbol = ctx.symbol;
    questions.push(`Which symbol should it trade? Using the active chart (${ctx.symbol}) for now.`);
  }
  for (const [re, s] of ALIASES) if (s === symbol) w.take(re, () => {});

  const spec: StrategySpec = defaultSpec(symbol);

  // time windows (before numbers are read)
  const hm = (h: string, m?: string, ap?: string) => {
    let hh = +h;
    if (ap === "pm" && hh < 12) hh += 12;
    if (ap === "am" && hh === 12) hh = 0;
    return `${String(Math.min(hh, 23)).padStart(2, "0")}:${m ?? "00"}`;
  };
  w.take(/(?:only\s+)?(?:between|from|during)?\s*(\d{1,2}):(\d{2})\s*(?:-|to|until|till|and)\s*(\d{1,2}):(\d{2})(?:\s*(?:server(?:\s*time)?|gmt\s*\+\s*3|broker time))?/, (m) => spec.sessions.push({ start: hm(m[1]!, m[2]), end: hm(m[3]!, m[4]) }));
  w.take(/(?:only\s+)?(?:between|from)\s+(\d{1,2})\s*(am|pm)?\s*(?:-|to|until|and)\s*(\d{1,2})\s*(am|pm)(?:\s*server(?:\s*time)?)?/, (m) => spec.sessions.push({ start: hm(m[1]!, undefined, m[2] ?? m[4]), end: hm(m[3]!, undefined, m[4]) }));
  const named: [RegExp, string, string, string][] = [
    [/\b(?:during\s+|in\s+|only\s+)?(?:the\s+)?london(?:\s+session|\s+hours|\s+open)?\b/, "10:00", "19:00", "London session"],
    [/\b(?:during\s+|in\s+|only\s+)?(?:the\s+)?(?:new york|ny|us)(?:\s+session|\s+hours|\s+open)\b/, "15:00", "23:59", "New York session"],
    [/\b(?:during\s+|in\s+|only\s+)?(?:the\s+)?(?:asian|asia|tokyo)(?:\s+session|\s+hours)?\b/, "02:00", "10:00", "Asian session"],
  ];
  for (const [re, a, b, label] of named)
    w.take(re, () => {
      spec.sessions.push({ start: a, end: b });
      assumptions.push(`${label} taken as ${a}–${b} server time`);
    });
  w.take(/\b(?:server time|server|gmt\s*\+\s*3)\b/, () => {});
  if (w.take(/\b(weekdays|mon(?:day)?\s*(?:-|to)\s*fri(?:day)?|monday through friday|no weekends?)\b/, () => {})) spec.days = [1, 2, 3, 4, 5];

  // limits
  w.take(new RegExp(String.raw`(?:max(?:imum)?|at most|up to|no more than|limit(?:\s+of)?)\s*(\d+)\s*(?:trades?|entries|positions|orders)\s*(?:per|a|\/|each)\s*day`), (m) => (spec.maxTradesPerDay = +m[1]!));
  w.take(/(\d+)\s*(?:trades?|entries)\s*(?:per|a|\/)\s*day(?:\s*max(?:imum)?)?/, (m) => (spec.maxTradesPerDay = +m[1]!));
  w.take(new RegExp(String.raw`(?:max(?:imum)?\s*)?daily\s*(?:loss|drawdown)\s*(?:limit\s*)?(?:of\s*|=\s*|:\s*)?\$?\s*${NUM}\s*(?:usd|\$|dollars?)?`), (m) => (spec.maxDailyLoss = +m[1]!));
  w.take(new RegExp(String.raw`stop\s+(?:trading\s+)?(?:for\s+the\s+day\s+)?(?:after|if|when)\s+(?:losing|loss\s+of|down|i\s+lose)\s+\$?\s*${NUM}\s*(?:usd|\$|dollars?)?`), (m) => (spec.maxDailyLoss = +m[1]!));
  let cap = 0;
  w.take(new RegExp(String.raw`(?:max(?:imum)?|cap(?:ped)?(?:\s+at)?)\s*(?:volume|lots?|lot\s*size|size|position\s*size)\s*(?:of|at|=|:)?\s*${NUM}\s*(?:lots?)?`), (m) => (cap = +m[1]!));
  if (w.take(/\b(one|1|single)\s+(?:open\s+)?(?:position|trade)\s+at\s+a\s+time\b|\bonly\s+one\s+(?:open\s+)?(?:position|trade)\b|\bsingle\s+position\b/, () => {})) spec.oneAtATime = true;
  if (w.take(/\b(allow\s+multiple\s+positions|multiple\s+positions|pyramid(?:ing)?|stack\s+positions)\b/, () => {})) spec.oneAtATime = false;
  if (w.take(/\b(intra-?bar|immediately|on\s+every\s+tick|tick\s+by\s+tick)\b/, () => {})) spec.exitIntrabar = true;
  if (w.take(/\bclose\s+(?:all\s+)?(?:positions?\s+|trades?\s+)?(?:outside|after)\s+(?:the\s+)?(?:session|window|hours)\b/, () => {})) spec.closeOutsideSession = true;

  // sizing
  let sized = false;
  w.take(new RegExp(String.raw`risk(?:ing)?\s*${NUM}\s*%(?:\s*(?:of\s+)?(?:balance|equity|account))?(?:\s*per\s*trade)?`), (m) => {
    spec.sizing = { mode: "risk", lots: 0, riskPct: +m[1]! };
    sized = true;
  });
  w.take(new RegExp(String.raw`${NUM}\s*%\s*risk(?:\s*per\s*trade)?`), (m) => {
    spec.sizing = { mode: "risk", lots: 0, riskPct: +m[1]! };
    sized = true;
  });
  w.take(new RegExp(String.raw`${NUM}\s*(?:standard\s+|mini\s+|micro\s+)?lots?\b`), (m) => {
    if (sized) return;
    spec.sizing = { mode: "lots", lots: +m[1]!, riskPct: 0 };
    sized = true;
  });
  w.take(new RegExp(String.raw`\b(?:volume|size|lot\s*size)\s*(?:of|=|:)?\s*${NUM}`), (m) => {
    if (sized) return;
    spec.sizing = { mode: "lots", lots: +m[1]!, riskPct: 0 };
    sized = true;
  });
  if (!sized) assumptions.push("No volume given: using 0.01 lot");
  spec.maxLots = cap > 0 ? cap : spec.sizing.mode === "lots" ? spec.sizing.lots : 1;
  if (cap <= 0 && spec.sizing.mode === "risk") assumptions.push("Max volume per order capped at 1.00 lot");

  // breakeven (before trailing / stop, which it also contains)
  w.take(
    new RegExp(
      String.raw`(?:move\s+(?:the\s+)?(?:sl|stop(?:\s*loss)?)\s+to\s+)?(?:break\s*-?\s*even|\bbe\b)\s*(?:at|after|when|once|on|@)?\s*(?:\+|profit\s*(?:of\s*)?|in\s+profit\s+)?${NUM}\s*(points?|pts?|pips?)?(?:\s*(?:in\s+profit|profit))?(?:\s*(?:\+|plus|lock(?:ing)?(?:\s+in)?)\s*${NUM}\s*(?:points?|pts?|pips?)?)?`,
    ),
    (m) => {
      const pip = unitMode(m[2]) === "pips" ? pipFactor(symbol!) : 1;
      spec.trailing.breakevenTrigger = +m[1]! * pip;
      spec.trailing.breakevenOffset = m[3] ? +m[3] * pip : 0;
    },
  );
  // trailing
  w.take(new RegExp(String.raw`trail(?:ing)?(?:\s*(?:stop|sl))?(?:\s*loss)?\s*(?:of|at|by|=|:)?\s*${NUM}\s*(x\s*atr|atr|points?|pts?|pips?)?(?:\s*\(?\s*(\d+)\s*\)?)?`), (m) => {
    const mode = unitMode(m[2]);
    spec.trailing.mode = mode === "atr" ? "atr" : mode === "pips" ? "pips" : "points";
    spec.trailing.value = +m[1]!;
    if (mode === "atr" && m[3]) spec.trailing.atrPeriod = +m[3];
  });
  // stop loss / take profit
  const dist = (m: RegExpExecArray, allowRR: boolean): Distance => {
    const v = +m[2]!;
    let mode = unitMode(m[3]);
    if (!m[3]) {
      const q = priceFeed().snapshot(symbol!);
      const mid = q ? (q.bid + q.ask) / 2 : INSTRUMENTS.find((i) => i.symbol === symbol)!.price;
      if (/\bat\b/.test(m[1] ?? "") && v > mid * 0.5 && v < mid * 1.5) mode = "level";
      else assumptions.push(`${allowRR ? "Take profit" : "Stop loss"} ${v} read as points`);
    }
    if (mode === "rr" && !allowRR) mode = "points";
    return { mode, value: v, atrPeriod: m[4] ? +m[4] : 14 };
  };
  const UNIT = String.raw`(x\s*atr|atr|points?|pts?|pips?|%|percent|\$|usd|dollars?)`;
  w.take(new RegExp(String.raw`(?:\bsl\b|stop\s*-?\s*loss|\bstop\b)(\s*(?:of|at|=|:|is|@)?)\s*\$?${NUM}\s*${UNIT}?(?:\s*\(\s*(\d+)\s*\))?`), (m) => (spec.sl = dist(m, false)));
  w.take(/(?:(?:take\s*-?\s*profit|\btp\b|target)\s*(?:of|at|=|:)?\s*)?(?:(?:risk\s*(?:to|:|\/)\s*reward|\brr\b|\br:r\b)\s*(?:of\s*)?)?\b1\s*[:/]\s*(\d+(?:\.\d+)?)(?:\s*(?:rr|r:r|risk\s*(?:to|:|\/)\s*reward))?/, (m) => (spec.tp = { mode: "rr", value: +m[1]!, atrPeriod: 14 }));
  w.take(new RegExp(String.raw`(?:\btp\b|take\s*-?\s*profit|\btarget\b|profit\s+target)(\s*(?:of|at|=|:|is|@)?)\s*\$?${NUM}\s*(r\b|rr\b|x\s*atr|atr|points?|pts?|pips?|%|percent|\$|usd|dollars?)?(?:\s*\(\s*(\d+)\s*\))?`), (m) => (spec.tp = dist(m, true)));
  if (spec.sl.mode === "none") questions.push("No stop loss was given. Add one (for example \"SL 150 points\") or confirm trading without a stop.");

  // exits: "close/exit (the position) when ..."
  const segEnd = String.raw`(?=[.;]|\b(?:buy|sell|long|short|go long|go short)\b|$)`;
  const exitTexts: { side: "long" | "short" | "both"; text: string }[] = [];
  w.take(new RegExp(String.raw`\b(?:close|exit)\s*(?:the\s+)?(longs?|shorts?|buys?|sells?|positions?|trades?|it)?\s*(?:early\s+)?(?:when|if|once|as soon as)\s+(.+?)${segEnd}`), (m) => {
    const who = m[1] ?? "";
    exitTexts.push({ side: /long|buy/.test(who) ? "long" : /short|sell/.test(who) ? "short" : "both", text: m[2]! });
  });

  // timeframe: first mention outside the conditions
  const segments: { side: "long" | "short"; text: string }[] = [];
  const sideRe = /\b(buy|long|go long|sell|short|go short)\b/g;
  const marks: { side: "long" | "short"; index: number; len: number }[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = sideRe.exec(w.s))) marks.push({ side: /buy|long/.test(sm[1]!) ? "long" : "short", index: sm.index, len: sm[0].length });
  for (let i = 0; i < marks.length; i++) {
    const seg = w.s.slice(marks[i]!.index + marks[i]!.len, marks[i + 1]?.index ?? w.s.length);
    const cm = seg.match(/\b(?:when|whenever|if|once|as soon as)\b\s+(.*)$/);
    const text = cm ? cm[1]! : seg;
    if (/[a-z]/.test(text)) segments.push({ side: marks[i]!.side, text });
  }
  // primary timeframe: search text outside condition segments first
  let outside = w.s;
  for (const s of segments) outside = outside.replace(s.text, " ");
  const tfOut = findTimeframe(outside.replace(/\b(on|timeframe|chart)\b/g, " "));
  if (tfOut) {
    spec.timeframe = tfOut.tf;
    const re = TF_WORDS.find(([, t]) => t === tfOut.tf)![0];
    for (const s of segments) s.text = s.text.replace(new RegExp(String.raw`\b(?:on\s+(?:the\s+)?)?(?:${re.source.slice(2, -2)})(?:\s+(?:chart|timeframe|candles?|bars?))?\b`), " ");
  } else {
    const inSeg = segments.map((s) => findTimeframe(s.text)).find(Boolean);
    spec.timeframe = inSeg?.tf ?? ctx.timeframe;
    if (inSeg) for (const s of segments) s.text = s.text.slice(0, inSeg.index) + " ".repeat(inSeg.len) + s.text.slice(inSeg.index + inSeg.len);
    if (!inSeg) assumptions.push(`No timeframe given: using the active chart timeframe ${ctx.timeframe}`);
  }

  const clean = (t: string) =>
    t
      .replace(/\b(on|with|using|the|chart|only|then|enter|a trade|trade|position|forms?|appears?|prints?|timeframe)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  for (const s of segments) {
    const rs = parseConditions(clean(s.text), unparsed);
    const target = s.side === "long" ? spec.long : spec.short;
    target.groups.push(...rs.groups);
    if (rs.logic === "any") target.logic = "any";
  }
  for (const e of exitTexts) {
    const rs = parseConditions(clean(e.text), unparsed);
    if (e.side !== "short") spec.exitLong.groups.push(...rs.groups);
    if (e.side !== "long") spec.exitShort.groups.push(...rs.groups);
  }
  // "exit" rules only apply to sides that trade
  if (!spec.long.groups.length) spec.exitLong.groups = [];
  if (!spec.short.groups.length) spec.exitShort.groups = [];

  if (!spec.long.groups.length && !spec.short.groups.length) {
    if (marks.length) questions.push('I could not read an entry condition. Phrase it like "Buy when RSI(14) crosses above 30 and price is above EMA 200".');
    else questions.push('Should it buy or sell, and when? For example "Buy when RSI(14) crosses above 30".');
  }
  for (const u of unparsed) questions.push(`I could not understand "${u.trim()}". Rephrase it or remove it.`);

  const { spec: clean2, errors } = validateSpec(spec);
  const first = clean2.long.groups[0]?.conditions[0] ?? clean2.short.groups[0]?.conditions[0];
  const side = clean2.long.groups.length && clean2.short.groups.length ? "Long/Short" : clean2.short.groups.length ? "Short" : "Long";
  clean2.name = `${clean2.symbol} ${clean2.timeframe} ${side}${first ? ` · ${describeCondition(first)}` : ""}`.slice(0, 48);
  for (const e of errors) if (!questions.some((q) => q.includes(e))) questions.push(e);
  return { status: questions.length ? "needs_clarification" : "ok", questions, assumptions, strategy: clean2 };
}

function pipFactor(symbol: string) {
  // points per pip: forex 5/3-digit quotes have 10 points per pip
  const i = INSTRUMENTS.find((x) => x.symbol === symbol)!;
  return i.assetClass === "forex" && (i.digits === 5 || i.digits === 3) ? 10 : 1;
}

export const EXAMPLE_PROMPTS = [
  "Buy XAUUSD 0.5 lot on M15 when RSI(14) crosses above 30 and price is above EMA 200, SL 150 points, TP 300 points, trailing 100 points, only 08:00-17:00 server time, max 3 trades/day",
  "Sell EURUSD 0.2 lot on H1 when EMA 9 crosses below EMA 21 and RSI 14 below 50, SL 25 pips, TP 2R, breakeven at 150 points, max 2 trades per day, max daily loss $300",
  "Buy BTCUSD 0.01 lot on M1 when close crosses above EMA 20, SL 8000 points, TP 12000 points, trailing 5000 points, max 5 trades per day",
  "Buy NAS100 risk 0.5% on M5 when a bullish engulfing candle forms and price is above EMA 50 on H1, SL 1.5 ATR, TP 3 ATR, close when RSI crosses below 70",
];

void TIMEFRAMES;
