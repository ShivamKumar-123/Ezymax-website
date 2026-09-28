//! Real-time rule evaluator (D148).
//!
//! **Data path and latency.** The engine has no server-to-server account stream yet (the terminal stream
//! needs a trader session; the dealing stream carries per-position P&L but not account equity), so the
//! evaluator polls `GET /v1/admin/accounts/{login}` for every active prop account every `PROP_POLL_MS`
//! (default 1000 ms, up to `PROP_POLL_CONCURRENCY` requests in parallel). That call returns the engine's live
//! equity (marked to the current quote), balance, open positions and the event version. Closing deals are
//! fetched only when the version changed. A breach is therefore detected at most one poll interval plus one
//! request after the equity crossed the limit (≈ 1–1.2 s locally); close-all follows immediately. Equity
//! peaks between two polls are not seen, which only ever favours the trader for trailing drawdown.

use chrono::{DateTime, Duration, NaiveDate, Utc};
use futures_util::StreamExt;
use serde_json::{Value, json};
use sqlx::Row;
use std::collections::{BTreeMap, BTreeSet};

use crate::engine::{AccountSnap, Deal};
use crate::heuristics::{self, OpenEvent, Trade};
use crate::money::{D, ZERO, num};
use crate::ops::{self, App, R_RULE};
use crate::rules::{self, NewsEvent, Obs, Terms, Verdict};
use crate::store::{self, Actor, PhaseAccount};
use crate::time::{in_weekend_window, next_reset, server_date};

pub async fn run(app: App) {
    let mut tick = tokio::time::interval(std::time::Duration::from_millis(app.cfg.poll_ms));
    tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    let mut last_cross = Utc::now() - Duration::minutes(5);
    let mut last_reconcile = Utc::now() - Duration::minutes(5);
    loop {
        tick.tick().await;
        let accounts = match store::active_phases(&app.pool).await {
            Ok(a) => a,
            Err(e) => {
                tracing::warn!(error = %e, "evaluator: loading accounts failed");
                continue;
            }
        };
        let news = load_news(&app).await;
        let started = std::time::Instant::now();
        futures_util::stream::iter(accounts.iter().map(|a| a.id))
            .for_each_concurrent(app.cfg.poll_concurrency, |id| {
                let app = app.clone();
                let news = news.clone();
                async move {
                    if let Err(e) = evaluate_account(&app, id, &news).await {
                        tracing::debug!(account = id, error = %e, "evaluation skipped");
                    }
                }
            })
            .await;
        let ms = started.elapsed().as_millis() as u64;
        if ms > app.cfg.poll_ms {
            tracing::warn!(accounts = accounts.len(), ms, "evaluator pass slower than the poll interval");
        }
        let now = Utc::now();
        if now - last_cross > Duration::seconds(30) {
            last_cross = now;
            cross_account(&app).await;
        }
        if now - last_reconcile > Duration::seconds(20) {
            last_reconcile = now;
            ops::reconcile(&app).await;
        }
    }
}

async fn load_news(app: &App) -> Vec<(String, NewsEvent)> {
    sqlx::query("SELECT id, tenant, at, title, currency, symbols FROM news_events WHERE at BETWEEN now() - interval '8 days' AND now() + interval '1 day'")
        .fetch_all(&app.pool)
        .await
        .unwrap_or_default()
        .iter()
        .map(|r| (r.get("tenant"), NewsEvent { id: r.get("id"), at: r.get("at"), title: r.get("title"), currency: r.get("currency"), symbols: r.get("symbols") }))
        .collect()
}

/// Trading statistics from the phase's deals + open positions.
pub struct TradeStats {
    pub trading_days: BTreeSet<NaiveDate>,
    pub day_profits: BTreeMap<NaiveDate, D>,
    pub json: Value,
    pub trades: Vec<Trade>,
}

pub fn trade_stats(deals: &[Deal], snap: &AccountSnap, since: DateTime<Utc>) -> TradeStats {
    let mut days = BTreeSet::new();
    let mut profits: BTreeMap<NaiveDate, D> = BTreeMap::new();
    let (mut wins, mut losses, mut gross_win, mut gross_loss, mut lots) = (0u32, 0u32, ZERO, ZERO, ZERO);
    let mut trades = vec![];
    for d in deals {
        if d.open_time >= since {
            days.insert(server_date(d.open_time));
        }
        *profits.entry(server_date(d.close_time)).or_default() += d.profit;
        if d.profit > ZERO {
            wins += 1;
            gross_win += d.profit;
        } else if d.profit < ZERO {
            losses += 1;
            gross_loss += -d.profit;
        }
        lots += d.volume;
        trades.push(Trade { ticket: d.ticket.clone(), symbol: d.symbol.clone(), side: d.side.clone(), open_time: d.open_time, close_time: Some(d.close_time), profit: Some(d.profit) });
    }
    for p in &snap.positions {
        if p.open_time >= since {
            days.insert(server_date(p.open_time));
        }
        lots += p.volume;
        trades.push(Trade { ticket: p.ticket.clone(), symbol: p.symbol.clone(), side: p.side.clone(), open_time: p.open_time, close_time: None, profit: None });
    }
    let closed = wins + losses;
    let avg = |sum: D, n: u32| if n == 0 { ZERO } else { (sum / D::from(n)).round_dp(2) };
    let best = profits.iter().max_by_key(|(_, p)| **p).map(|(d, p)| json!({"day": d, "profit": num(*p)}));
    let recent_opens: Vec<Value> = trades
        .iter()
        .filter(|t| t.open_time > Utc::now() - Duration::days(3))
        .rev()
        .take(500)
        .map(|t| json!({"ticket": t.ticket, "symbol": t.symbol, "side": t.side, "at": t.open_time}))
        .collect();
    let json = json!({
        "trades": closed, "open": snap.positions.len(), "wins": wins, "losses": losses,
        "winRate": if closed == 0 { json!(null) } else { num((D::from(wins) * D::from(100) / D::from(closed)).round_dp(1)) },
        "avgWin": num(avg(gross_win, wins)), "avgLoss": num(-avg(gross_loss, losses)),
        "profitFactor": if gross_loss.is_zero() { json!(null) } else { num((gross_win / gross_loss).round_dp(2)) },
        "lots": num(lots.round_dp(2)),
        "bestDay": best,
        "days": days.iter().collect::<Vec<_>>(),
        "dayProfits": profits.iter().map(|(d, p)| json!({"day": d, "profit": num(*p)})).collect::<Vec<_>>(),
        "opens": recent_opens,
    });
    TradeStats { trading_days: days, day_profits: profits, json, trades }
}

fn stats_from_json(v: &Value) -> (u32, Vec<(NaiveDate, D)>) {
    let days = v["days"].as_array().map(|a| a.len() as u32).unwrap_or(0);
    let profits = v["dayProfits"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|x| Some((x["day"].as_str()?.parse::<NaiveDate>().ok()?, crate::money::dec_of(&x["profit"])?)))
                .collect()
        })
        .unwrap_or_default();
    (days, profits)
}

enum Action {
    None,
    Fail { rule: &'static str, message: String, threshold: D },
    Pass,
}

/// One evaluation of one phase account (under its lock).
pub async fn evaluate_account(app: &App, id: i64, news: &[(String, NewsEvent)]) -> anyhow::Result<()> {
    let lock = app.lock(id);
    let _g = lock.lock().await;
    let Some(a) = store::phase(&app.pool, id).await? else { return Ok(()) };
    let (Some(login), true) = (a.login, a.status == "active") else { return Ok(()) };
    let c = store::challenge(&app.pool, a.challenge_id).await?.ok_or_else(|| anyhow::anyhow!("challenge missing"))?;
    let plan = &c.rules;
    let snap = app.engine.account(&a.tenant, login).await.map_err(|e| anyhow::anyhow!("{e}"))?;
    let now = Utc::now();
    let since = a.started_at.unwrap_or(now);

    // deals only when something happened on the account
    let mut trading = a.stats.get("trading").cloned().unwrap_or(Value::Null);
    let mut new_trades: Vec<Trade> = vec![];
    if snap.version != a.engine_version || trading.is_null() {
        let deals = app.engine.deals(&a.tenant, login, since - Duration::minutes(1)).await.map_err(|e| anyhow::anyhow!("{e}"))?;
        let st = trade_stats(&deals, &snap, since);
        trading = st.json.clone();
        new_trades = st.trades;
        // banned-strategy heuristics on the account's own trades
        for f in heuristics::account_flags(&new_trades) {
            if plan.bans(f.kind) {
                upsert_flag(app, &a, &f).await;
            }
        }
    }
    let (trading_days, day_profits) = stats_from_json(&trading);

    let terms = Terms { initial: a.initial_balance, target_pct: a.target_pct, min_days: a.min_days.max(0) as u32, time_limit_days: a.time_limit_days.max(0) as u32, started_at: since };
    let obs = Obs { at: now, balance: snap.balance, equity: snap.equity, open_positions: snap.positions.len(), trading_days, day_profits };
    let mut tracker = a.tracker();
    let eval = rules::evaluate(plan, &terms, &mut tracker, &obs);

    let mut action = match &eval.verdict {
        Verdict::Breach { rule, message, threshold } => Action::Fail { rule, message: message.clone(), threshold: *threshold },
        Verdict::Pass if !a.funded => Action::Pass,
        _ => Action::None,
    };

    // weekend holding (D148): positions must be flat from Friday 16:45 New York
    let weekend_window = in_weekend_window(now);
    if !plan.weekend_holding && weekend_window && !snap.positions.is_empty() && matches!(action, Action::None) {
        let day = server_date(now);
        if store::rule_event(&app.pool, &a, "weekend_holding", "violation", Some(snap.equity), Some(snap.balance), None, "Positions held into the weekend were closed", json!({"positions": snap.positions.len()}), Some(format!("weekend-{day}"))).await {
            store::notify(&app.pool, &a.tenant, a.user_id, Some(a.challenge_id), "violation", "Weekend holding isn't allowed", &format!("Open positions on #{login} were closed before the weekend close.")).await;
        }
        let _ = app.engine.close_all(&a.tenant, login, R_RULE, "Weekend holding not allowed on this plan").await;
    }

    // news windows (D148)
    if !plan.news_trading && plan.news_window > 0 {
        let window = plan.news_window as i64;
        let events: Vec<NewsEvent> = news.iter().filter(|(t, _)| *t == a.tenant).map(|(_, e)| e.clone()).collect();
        if !events.is_empty() {
            let mut checks: Vec<(String, String, DateTime<Utc>, bool)> = snap.positions.iter().map(|p| (p.ticket.clone(), p.symbol.clone(), p.open_time, true)).collect();
            for t in new_trades.iter().filter(|t| t.close_time.is_some()) {
                checks.push((t.ticket.clone(), t.symbol.clone(), t.open_time, false));
                checks.push((t.ticket.clone(), t.symbol.clone(), t.close_time.unwrap(), false));
            }
            for (ticket, symbol, at, open) in checks {
                if at < since {
                    continue;
                }
                if let Some(e) = rules::news_hit(&events, &symbol, at, window) {
                    let msg = format!("{symbol} traded at {} inside the ±{window} min window of {} ({})", at.format("%H:%M:%S UTC"), e.title, e.currency);
                    let fresh = store::rule_event(&app.pool, &a, "news_window", "violation", Some(snap.equity), Some(snap.balance), None, &msg, json!({"ticket": ticket, "event": e.id}), Some(format!("news-{ticket}"))).await;
                    if fresh {
                        store::notify(&app.pool, &a.tenant, a.user_id, Some(a.challenge_id), "violation", "News-window trade", &msg).await;
                        if plan.news_breach_fails && matches!(action, Action::None) {
                            action = Action::Fail { rule: "news_window", message: msg.clone(), threshold: ZERO };
                        } else if open {
                            let _ = app.engine.close_position(&a.tenant, &ticket, R_RULE, "Opened inside a news window").await;
                        }
                    }
                }
            }
        }
    }

    if let Some(level) = eval.warn {
        let day = eval.day;
        if store::rule_event(&app.pool, &a, "daily_loss", "warning", Some(snap.equity), Some(snap.balance), Some(eval.daily_floor), &format!("{level}% of today's loss limit used"), json!({"used": num(eval.daily_used), "limit": num(eval.daily_limit)}), Some(format!("warn-{day}-{level}"))).await {
            store::notify(&app.pool, &a.tenant, a.user_id, Some(a.challenge_id), "warning", &format!("{level}% of today's loss limit used"), &format!("Account #{login}: {} of {} used. At 100% the account fails and all positions close.", crate::certs::money_text(eval.daily_used), crate::certs::money_text(eval.daily_limit))).await;
        }
    }

    // persist the live state
    let mut rules_json = serde_json::to_value(&eval)?;
    rules_json["nextReset"] = json!(next_reset(now));
    rules_json["weekendWindow"] = json!(weekend_window);
    rules_json["equity"] = num(snap.equity);
    rules_json["balance"] = num(snap.balance);
    rules_json["at"] = json!(now);
    let stats = json!({"rules": rules_json, "trading": trading, "enforced": a.stats.get("enforced").cloned().unwrap_or(Value::Null)});
    store::save_tracker(&app.pool, a.id, &tracker).await?;
    sqlx::query(
        "UPDATE phase_accounts SET balance = $2, equity = $3, open_positions = $4, trading_days = $5, engine_version = $6, stats = $7, last_eval_at = $8 WHERE id = $1",
    )
    .bind(a.id)
    .bind(snap.balance)
    .bind(snap.equity)
    .bind(snap.positions.len() as i32)
    .bind(trading_days as i32)
    .bind(snap.version)
    .bind(sqlx::types::Json(&stats))
    .bind(now)
    .execute(&app.pool)
    .await?;
    let sample = a.last_eval_at.is_none() || !matches!(action, Action::None) || snap.version != a.engine_version;
    let last_point: Option<DateTime<Utc>> = sqlx::query_scalar("SELECT max(at) FROM equity_points WHERE account_id = $1").bind(a.id).fetch_one(&app.pool).await?;
    if sample || last_point.is_none_or(|t| now - t >= Duration::seconds(60)) {
        let _ = sqlx::query("INSERT INTO equity_points (account_id, tenant, at, balance, equity) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING")
            .bind(a.id)
            .bind(&a.tenant)
            .bind(now)
            .bind(snap.balance)
            .bind(snap.equity)
            .execute(&app.pool)
            .await;
    }

    let fresh = store::phase(&app.pool, a.id).await?.unwrap();
    match action {
        Action::Fail { rule, message, threshold } => {
            ops::fail(app, &fresh, rule, &message, &Actor::system(), Some(snap.equity), Some(threshold)).await.map_err(|e| anyhow::anyhow!("{e:?}"))?;
        }
        Action::Pass => {
            ops::pass(app, &fresh, &Actor::system()).await.map_err(|e| anyhow::anyhow!("{e:?}"))?;
        }
        Action::None => {}
    }
    Ok(())
}

async fn upsert_flag(app: &App, a: &PhaseAccount, f: &heuristics::Flag) {
    let r = sqlx::query(
        "INSERT INTO strategy_flags (tenant, account_id, challenge_id, user_id, login, kind, score, summary, evidence, related_login)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (account_id, kind, related_login) DO UPDATE SET score = EXCLUDED.score, summary = EXCLUDED.summary, evidence = EXCLUDED.evidence, updated_at = now()
           WHERE strategy_flags.status = 'open'
         RETURNING (xmax = 0) AS inserted",
    )
    .bind(&a.tenant)
    .bind(a.id)
    .bind(a.challenge_id)
    .bind(a.user_id)
    .bind(a.login)
    .bind(f.kind)
    .bind(f.score)
    .bind(&f.summary)
    .bind(sqlx::types::Json(&f.evidence))
    .bind(f.related_login.unwrap_or(0))
    .fetch_optional(&app.pool)
    .await;
    match r {
        Ok(Some(row)) if row.get::<bool, _>("inserted") => {
            tracing::info!(login = a.login, kind = f.kind, "banned-strategy flag raised");
            store::rule_event(&app.pool, a, "banned_strategy", "warning", a.equity, a.balance, None, &format!("Flagged for review: {}", f.summary), json!({"kind": f.kind}), Some(format!("flag-{}-{}", f.kind, f.related_login.unwrap_or(0)))).await;
        }
        Ok(_) => {}
        Err(e) => tracing::error!(error = %e, "flag upsert failed"),
    }
}

/// Cross-account copying / hedging over every active prop account (recent opens kept in stats).
pub async fn cross_account(app: &App) {
    let Ok(accounts) = store::active_phases(&app.pool).await else { return };
    let mut events = vec![];
    for a in &accounts {
        let Some(login) = a.login else { continue };
        for o in a.stats.pointer("/trading/opens").and_then(Value::as_array).into_iter().flatten() {
            let (Some(sym), Some(side), Some(at)) = (o["symbol"].as_str(), o["side"].as_str(), o["at"].as_str().and_then(|s| DateTime::parse_from_rfc3339(s).ok())) else { continue };
            events.push(OpenEvent { login, user_id: a.user_id, ticket: o["ticket"].as_str().unwrap_or("").to_string(), symbol: sym.to_string(), side: side.to_string(), at: at.with_timezone(&Utc) });
        }
    }
    for (login, f) in heuristics::cross_account_flags(&events) {
        if let Some(a) = accounts.iter().find(|a| a.login == Some(login)) {
            let plan_bans = store::challenge(&app.pool, a.challenge_id).await.ok().flatten().map(|c| c.rules.bans(f.kind)).unwrap_or(true);
            if plan_bans {
                upsert_flag(app, a, &f).await;
            }
        }
    }
}
