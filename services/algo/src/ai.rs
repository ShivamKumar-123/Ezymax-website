//! AI strategy assistant (D87): natural language → a visual strategy spec or DSL code, with Claude.
//!
//! Server-side port of the terminal route (`apps/terminal/app/api/ai-trader/route.ts`): the same system
//! prompt and schema-in-prompt approach (the schema is too large for constrained decoding), the reply is
//! validated like any other input, and code replies that do not compile get one repair round with the
//! compiler's errors. The key (ANTHROPIC_API_KEY) never leaves the server.

use std::time::{Duration, Instant};

use serde_json::{Value, json};

use crate::api::s;
use crate::error::ApiError;
use crate::spec::{DISTANCE_MODES, INDICATORS, OPERAND_KINDS, OPERATORS, PATTERNS, PRICE_FIELDS, TRAIL_MODES};
use crate::specs::TIMEFRAMES;
use crate::state::{AppState, User, settings};
use crate::strategy::build;

const API: &str = "https://api.anthropic.com/v1/messages";

fn senum(values: &[&str], d: &str) -> Value {
    json!({"type": "string", "enum": values, "description": d})
}
fn sobj(props: Vec<(&str, Value)>) -> Value {
    let keys: Vec<&str> = props.iter().map(|(k, _)| *k).collect();
    let map: serde_json::Map<String, Value> = props.into_iter().map(|(k, v)| (k.to_string(), v)).collect();
    json!({"type": "object", "properties": map, "required": keys, "additionalProperties": false})
}
fn snum(d: &str) -> Value {
    json!({"type": "number", "description": d})
}

/// JSON schema of the visual spec (port of STRATEGY_JSON_SCHEMA with the extended indicator list).
pub fn strategy_schema() -> Value {
    let operand = sobj(vec![
        ("kind", senum(&OPERAND_KINDS, "price = bar price field; indicator; value = constant; candle = pattern (1 when present, 0 otherwise)")),
        ("field", senum(&PRICE_FIELDS, "Price field for kind=price, or indicator source series (use close unless stated)")),
        ("indicator", senum(&[&INDICATORS[..], &["stddev"]].concat(), "Indicator for kind=indicator, else none")),
        ("period", snum("Main period; 0 = default (SMA/EMA/WMA 20, RSI 14, ATR 14, BB 20, Stoch 14, MACD fast 12, highest/lowest 20, CCI 20, ADX 14)")),
        ("period2", snum("MACD slow (26), Stoch %D (3) or ADX smoothing (14); 0 = default")),
        ("period3", snum("MACD signal (9); 0 = default")),
        ("mult", snum("Bollinger deviations; 0 = default 2")),
        ("value", snum("Constant for kind=value, else 0")),
        ("pattern", senum(&PATTERNS, "Candle pattern for kind=candle, else none")),
    ]);
    let mut tfs: Vec<&str> = TIMEFRAMES.to_vec();
    tfs.push("same");
    let ruleset = sobj(vec![
        ("logic", senum(&["all", "any"], "")),
        (
            "groups",
            json!({"type": "array", "items": sobj(vec![
                ("logic", senum(&["all", "any"], "")),
                ("conditions", json!({"type": "array", "items": sobj(vec![
                    ("left", operand.clone()),
                    ("op", senum(&OPERATORS, "")),
                    ("right", operand.clone()),
                    ("timeframe", senum(&tfs, "same = strategy timeframe; set another timeframe only for explicit higher-timeframe filters")),
                ])})),
            ])}),
        ),
    ]);
    let distance = sobj(vec![
        ("mode", senum(&DISTANCE_MODES, "points = MT5 points (1/10^digits); pips; price = distance in price units; percent of entry; atr = value x ATR(atrPeriod); level = absolute price; rr = take profit only, value x stop distance; none")),
        ("value", snum("")),
        ("atrPeriod", snum("ATR period when mode=atr, else 14")),
    ]);
    sobj(vec![
        ("name", json!({"type": "string", "description": "Short strategy name, max 40 chars"})),
        ("symbol", json!({"type": "string", "description": "Exact instrument symbol from the provided list"})),
        ("timeframe", senum(&TIMEFRAMES, "")),
        ("long", ruleset.clone()),
        ("short", ruleset.clone()),
        ("exitLong", ruleset.clone()),
        ("exitShort", ruleset),
        ("exitIntrabar", json!({"type": "boolean", "description": "always false (exits are checked on closed bars)"})),
        ("sizing", sobj(vec![("mode", senum(&["lots", "risk"], "")), ("lots", snum("lots when mode=lots, else 0")), ("riskPct", snum("% of balance risked per trade when mode=risk, else 0"))])),
        ("maxLots", snum("Hard cap per order; equal to lots unless the user gave a cap")),
        ("sl", distance.clone()),
        ("tp", distance),
        (
            "trailing",
            sobj(vec![
                ("mode", senum(&TRAIL_MODES, "")),
                ("value", snum("distance in points/pips, or ATR multiple")),
                ("atrPeriod", snum("")),
                ("breakevenTrigger", snum("points of profit that move SL to entry; 0 = off")),
                ("breakevenOffset", snum("points beyond entry for the breakeven stop; usually 0")),
            ]),
        ),
        ("sessions", json!({"type": "array", "items": sobj(vec![("start", json!({"type": "string", "description": "HH:MM server time"})), ("end", json!({"type": "string", "description": "HH:MM server time"}))]), "description": "Empty = trade all day"})),
        ("days", json!({"type": "array", "items": {"type": "integer"}, "description": "Server weekdays 0=Sun..6=Sat; empty = every day"})),
        ("closeOutsideSession", json!({"type": "boolean"})),
        ("maxTradesPerDay", snum("0 = unlimited")),
        ("maxDailyLoss", snum("Account currency; 0 = off")),
        ("oneAtATime", json!({"type": "boolean", "description": "Only one open position at a time (default true)"})),
    ])
}

const SYSTEM: &str = "You convert a trader's plain-language instructions into a strategy for the Ezymex strategy engine.
The strategy is shown to the trader, who reviews, backtests and explicitly deploys it; it can trade real or demo money, so never invent aggressive settings.

Engine semantics:
- Rules are evaluated on each CLOSED bar of the strategy timeframe; orders are sent at the next bar's open. A condition compares two operands with gt, lt, gte, lte, crosses_above (was <= on the previous bar and is > now) or crosses_below.
- Operands: price field of the bar; an indicator (sma, ema, wma, rsi, macd line, macd_signal, macd_hist, bb_upper/bb_middle/bb_lower, atr, stoch_k, stoch_d, highest = highest high of the N bars before the current bar, lowest = lowest low of the N bars before, cci, willr, adx, plus_di, minus_di, momentum, roc, stddev); a constant value; or a candle pattern (value 1 when present: write it as candle >= 1).
- \"Price above EMA 200\" means close gt ema(200). \"RSI(14) crosses above 30\" means rsi(14) crosses_above 30. \"MACD crosses above signal\" means macd crosses_above macd_signal with the same periods. \"Breaks the 20-bar high\" means close crosses_above highest(20).
- A condition's timeframe is \"same\" unless the trader explicitly asks for another (higher) timeframe for that condition (e.g. \"EMA 50 on H4\" inside an H1 strategy).
- long = buy entry rules, short = sell entry rules, exitLong/exitShort = rule-based exits (separate from SL/TP). Leave a rule set with an empty groups array when it does not apply. Use one group with logic \"all\" for simple AND lists; use several groups joined with logic \"any\" for OR.
- Points are MT5 points: 1 point = 1 / 10^digits of the symbol (XAUUSD 2 digits: 150 points = 1.50; EURUSD 5 digits: 10 points = 1 pip). Keep the unit the trader used (points, pips, ATR multiples, price distance, percent, absolute level, or R multiple for TP).
- Trailing moves the stop once the trade is that far in profit. Breakeven moves the stop to entry (+ offset points) once profit reaches breakevenTrigger points.
- sessions are server-time windows (HH:MM, broker server time GMT+2/GMT+3). days are server weekdays 0=Sunday..6=Saturday.
- sizing: fixed lots, or risk % of balance per trade (needs a stop loss, max 5%). maxLots is a hard cap per order: set it equal to the lot size unless the trader gave a cap; for risk sizing use the trader's cap or 1.
- maxTradesPerDay 0 means unlimited; maxDailyLoss 0 means off; oneAtATime defaults to true.

Rules for you:
- Use only symbols from the provided list (map \"gold\" to XAUUSD, \"bitcoin\" to BTCUSD, \"nasdaq\" to NAS100, and so on).
- If the symbol, the side/entry condition, or the size is missing or genuinely ambiguous, set status \"needs_clarification\" and ask short, specific questions. Still return your best draft (use the chart context for a missing symbol/timeframe) so the trader can edit it.
- A missing stop loss is allowed but must be raised as a question.
- List every default you filled in and every interpretation you made in assumptions.
- Never add conditions, limits or indicators the trader did not ask for.
- When a current strategy is given, apply the new instruction to it and keep everything else unchanged.";

const CODE_RULES: &str = "Write the strategy in the Ezymex strategy language (Python-like, expressions only):
- Settings are calls, one per line: name(\"…\"), symbol(\"EURUSD\"), timeframe(\"H1\"), lots(0.1) or risk(1.0), max_lots(n), stop_loss(pips=20 | points=… | price=… | percent=… | atr=2, period=14 | level=…), take_profit(same, or rr=2), trailing(pips=15 | points=… | atr=1.5, period=14), breakeven(trigger=150, offset=10) (points), session(\"08:00\", \"17:00\"), days(1, 2, 3, 4, 5), close_outside_session(true), max_trades_per_day(3), max_daily_loss(200), one_at_a_time(true).
- Signals are assignments: buy = …, sell = …, exit_buy = …, exit_sell = … (booleans, evaluated on each closed bar). Helper names can be assigned first (fast = ema(close, 20)); each name is assigned once and before use.
- Functions: sma/ema/wma/rma(src, n), rsi(src, n), macd(src, fast, slow, signal), macd_signal(…), macd_hist(…), bb_upper/bb_middle/bb_lower(src, n, dev), stddev(src, n), atr(n), adx(n), plus_di(n), minus_di(n), stoch_k(n, d), stoch_d(n, d), cci(n), willr(n), momentum(src, n), roc(src, n), change(src, n), highest(n) / lowest(n) (previous N bars), highest(src, n), crosses_above(a, b), crosses_below(a, b), crosses(a, b), abs, min, max, round, sqrt, nz, htf(\"H4\", expr) for a higher timeframe, candle patterns bullish(), bearish(), bullish_engulfing(), bearish_engulfing(), hammer(), shooting_star(), doji(), inside_bar().
- Fields: open high low close volume hl2 hlc3 ohlc4, hour minute weekday (server time). x[1] is the previous bar's value. Logic: and, or, not, a if cond else b. Comments start with #.
- No loops, functions, imports or attribute access exist. Periods are constant whole numbers 1–1000.";

fn parse_json(text: &str) -> Option<Value> {
    let a = text.find('{')?;
    let b = text.rfind('}')?;
    serde_json::from_str(&text[a..=b]).ok()
}

async fn call(st: &AppState, system: &str, messages: &[Value]) -> Result<(Vec<Value>, String, String), ApiError> {
    let http = reqwest::Client::builder().timeout(Duration::from_secs(180)).build().map_err(anyhow::Error::from)?;
    let body = json!({
        "model": st.cfg.ai_model,
        "max_tokens": 16000,
        "thinking": {"type": "adaptive"},
        "output_config": {"effort": "medium"},
        "fallbacks": "default",
        "system": system,
        "messages": messages,
    });
    let r = http
        .post(API)
        .header("x-api-key", &st.cfg.anthropic_key)
        .header("anthropic-version", "2023-06-01")
        .header("anthropic-beta", "server-side-fallback-2026-07-01")
        .json(&body)
        .send()
        .await
        .map_err(|_| ApiError::unavailable("Could not reach the Claude API."))?;
    let status = r.status();
    let v: Value = r.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        let msg = v.pointer("/error/message").and_then(Value::as_str).unwrap_or("error").to_string();
        return Err(match status.as_u16() {
            401 | 403 => ApiError::unavailable("The AI key was rejected. Check ANTHROPIC_API_KEY."),
            429 => ApiError::RateLimited(30),
            400 => ApiError::unprocessable("ai_rejected", format!("Request rejected: {msg}")),
            _ => ApiError::coded(axum::http::StatusCode::BAD_GATEWAY, "ai_error", format!("Claude API error {status}: {msg}")),
        });
    }
    match v.get("stop_reason").and_then(Value::as_str) {
        Some("refusal") => return Err(ApiError::unprocessable("ai_refused", "The model declined this request.")),
        Some("max_tokens") => return Err(ApiError::coded(axum::http::StatusCode::BAD_GATEWAY, "ai_truncated", "The model response was cut off. Shorten the prompt and try again.")),
        _ => {}
    }
    let content = v.get("content").and_then(Value::as_array).cloned().unwrap_or_default();
    let text: String = content.iter().filter(|b| b.get("type").and_then(Value::as_str) == Some("text")).filter_map(|b| b.get("text").and_then(Value::as_str)).collect();
    let model = v.get("model").and_then(Value::as_str).unwrap_or(&st.cfg.ai_model).to_string();
    Ok((content, text, model))
}

/// `POST /v1/ai/strategy {prompt, symbol?, timeframe?, target: "visual"|"code", current?}`.
pub async fn generate(st: &AppState, u: &User, v: &Value) -> Result<Value, ApiError> {
    let prompt = s(v, "prompt").unwrap_or("");
    if prompt.is_empty() {
        return Err(ApiError::validation("prompt", "Describe the strategy you want."));
    }
    if prompt.chars().count() > 4000 {
        return Err(ApiError::validation("prompt", "Prompt is too long (max 4000 characters)."));
    }
    if st.cfg.anthropic_key.is_empty() {
        return Err(ApiError::unavailable("The AI assistant is not configured (ANTHROPIC_API_KEY)."));
    }
    let per_hour = settings(&st.pool, &u.tenant).await.get("aiPerHour").and_then(Value::as_u64).unwrap_or(30) as usize;
    st.limiter.hit(&format!("ai:{}:{}", u.tenant, u.id), per_hour.max(1), Duration::from_secs(3600)).map_err(ApiError::RateLimited)?;
    let symbol = s(v, "symbol").unwrap_or("EURUSD").to_uppercase();
    let tf = s(v, "timeframe").filter(|t| TIMEFRAMES.contains(t)).unwrap_or("H1").to_string();
    let target = if s(v, "target") == Some("code") { "code" } else { "visual" };
    let symbols: Vec<String> = st.specs.all().map(|x| format!("{} ({}, {} digits)", x.symbol, x.asset_class, x.digits)).collect();
    let current = match v.get("current") {
        Some(Value::String(c)) if !c.trim().is_empty() => format!("\n\nCurrent strategy (code):\n{}", c.chars().take(20_000).collect::<String>()),
        Some(c @ Value::Object(_)) => format!("\n\nCurrent strategy (JSON):\n{c}"),
        _ => String::new(),
    };
    let user_msg = format!("Available symbols: {}\nActive chart: {symbol} {tf}{current}\n\nTrader's instructions:\n{prompt}", symbols.join("; "));
    let started = Instant::now();
    let result: Result<(Value, String), ApiError> = async {
        if target == "visual" {
            let schema = sobj(vec![
                ("status", senum(&["ok", "needs_clarification"], "")),
                ("questions", json!({"type": "array", "items": {"type": "string"}, "description": "Clarifying questions when something essential is missing or ambiguous"})),
                ("assumptions", json!({"type": "array", "items": {"type": "string"}, "description": "Every default you filled in or interpretation you made"})),
                ("strategy", strategy_schema()),
            ]);
            let system = format!("{SYSTEM}\n\nReply with a single JSON object only (no prose, no code fences) that matches this JSON Schema:\n{schema}");
            let (_, text, model) = call(st, &system, &[json!({"role": "user", "content": user_msg})]).await?;
            let raw = parse_json(&text).ok_or_else(|| ApiError::coded(axum::http::StatusCode::BAD_GATEWAY, "ai_invalid", "The model returned invalid JSON."))?;
            let strat = raw.get("strategy").cloned().unwrap_or(Value::Null);
            let built = build("visual", Some(&strat), None, &symbol, &tf, &st.specs).map_err(|m| ApiError::validation("strategy", m))?;
            let mut questions: Vec<String> = raw.get("questions").and_then(Value::as_array).map(|a| a.iter().filter_map(|q| q.as_str().map(str::to_string)).collect()).unwrap_or_default();
            for e in &built.errors {
                if let Some(m) = e.get("message").and_then(Value::as_str)
                    && !questions.iter().any(|q| q.contains(m))
                {
                    questions.push(m.to_string());
                }
            }
            let ok = raw.get("status").and_then(Value::as_str) == Some("ok") && built.valid();
            Ok((
                json!({"configured": true, "model": model, "target": "visual", "status": if ok { "ok" } else { "needs_clarification" }, "questions": questions,
                       "assumptions": raw.get("assumptions").cloned().unwrap_or(json!([])), "result": built.view()}),
                model,
            ))
        } else {
            let schema = sobj(vec![
                ("status", senum(&["ok", "needs_clarification"], "")),
                ("questions", json!({"type": "array", "items": {"type": "string"}})),
                ("assumptions", json!({"type": "array", "items": {"type": "string"}})),
                ("code", json!({"type": "string", "description": "The complete strategy program"})),
            ]);
            let system = format!("{SYSTEM}\n\n{CODE_RULES}\n\nReply with a single JSON object only (no prose, no code fences) that matches this JSON Schema:\n{schema}");
            let mut messages = vec![json!({"role": "user", "content": user_msg})];
            let mut last: Option<(Value, crate::strategy::Built, String)> = None;
            for round in 0..2 {
                let (content, text, model) = call(st, &system, &messages).await?;
                let raw = parse_json(&text).ok_or_else(|| ApiError::coded(axum::http::StatusCode::BAD_GATEWAY, "ai_invalid", "The model returned invalid JSON."))?;
                let code = raw.get("code").and_then(Value::as_str).unwrap_or("").to_string();
                let built = build("code", None, Some(&code), &symbol, &tf, &st.specs).map_err(|m| ApiError::validation("code", m))?;
                let errs: Vec<String> = built.errors.iter().map(|e| format!("line {}: {}", e.get("line").and_then(Value::as_u64).unwrap_or(0), e.get("message").and_then(Value::as_str).unwrap_or(""))).collect();
                let done = errs.is_empty() || round == 1;
                last = Some((raw, built, model));
                if done {
                    break;
                }
                // one repair round: the model sees the compiler's errors (thinking blocks are passed back unchanged)
                messages.push(json!({"role": "assistant", "content": content}));
                messages.push(json!({"role": "user", "content": format!("The program does not compile:\n{}\nReturn the corrected JSON object.", errs.join("\n"))}));
            }
            let (raw, built, model) = last.unwrap();
            let questions: Vec<String> = raw.get("questions").and_then(Value::as_array).map(|a| a.iter().filter_map(|q| q.as_str().map(str::to_string)).collect()).unwrap_or_default();
            let ok = raw.get("status").and_then(Value::as_str) == Some("ok") && built.valid();
            Ok((
                json!({"configured": true, "model": model, "target": "code", "status": if ok { "ok" } else { "needs_clarification" }, "questions": questions,
                       "assumptions": raw.get("assumptions").cloned().unwrap_or(json!([])), "result": built.view()}),
                model,
            ))
        }
    }
    .await;
    let (status, model) = match &result {
        Ok((v, m)) => (v.get("status").and_then(Value::as_str).unwrap_or("ok").to_string(), Some(m.clone())),
        Err(e) => (format!("error:{}", e.status().as_u16()), None),
    };
    let _ = sqlx::query("INSERT INTO ai_requests (tenant_id, user_id, target, prompt, status, model, ms) VALUES ($1,$2,$3,$4,$5,$6,$7)")
        .bind(&u.tenant)
        .bind(u.id)
        .bind(target)
        .bind(prompt.chars().take(2000).collect::<String>())
        .bind(status)
        .bind(model)
        .bind(started.elapsed().as_millis() as i32)
        .execute(&st.pool)
        .await;
    result.map(|(v, _)| v)
}

#[cfg(test)]
mod tests {
    #[test]
    fn schema_is_closed_and_complete() {
        let s = super::strategy_schema();
        assert_eq!(s["additionalProperties"], false);
        assert_eq!(s["required"].as_array().unwrap().len(), 19);
        let ind = &s["properties"]["long"]["properties"]["groups"]["items"]["properties"]["conditions"]["items"]["properties"]["left"]["properties"]["indicator"]["enum"];
        assert!(ind.as_array().unwrap().iter().any(|v| v == "adx"));
        assert_eq!(super::parse_json("sure:\n{\"a\": {\"b\": 1}} thanks").unwrap()["a"]["b"], 1);
    }
}
