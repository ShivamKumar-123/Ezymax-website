//! Statistics behind the leaderboard and master profiles (D72): daily snapshots of master and fund accounts,
//! the time-weighted return index, returns, drawdown, volatility, risk score, delayed trade history.

use chrono::{DateTime, Duration, NaiveDate, Utc};
use rust_decimal::prelude::ToPrimitive;
use serde_json::{Value, json};
use sqlx::Row;
use std::collections::HashMap;

use super::math::{self, DayPoint};
use super::{Master, Social};
use crate::money::{D, ZERO, num, r2};
use crate::specs::{server_date, server_midnight};

fn f(d: D) -> f64 {
    d.to_f64().unwrap_or(0.0)
}

fn round2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

/// Figures for one master account.
#[derive(Clone, Debug, Default)]
pub struct MasterStats {
    pub return_1m: f64,
    pub return_3m: f64,
    pub return_1y: f64,
    pub return_all: f64,
    pub max_dd: f64,
    pub current_dd: f64,
    pub volatility: f64,
    pub risk: u8,
    pub equity: f64,
    pub series: Vec<(NaiveDate, f64)>,
    pub points: Vec<DayPoint>,
}

impl Social {
    /// Upserts today's snapshot (server day) for every live master account and every fund account.
    pub async fn snapshot_all(&self) -> usize {
        let (masters, funds): (Vec<(i64, i64, i64)>, Vec<(i64, i64, i64)>) = {
            let reg = self.reg.read().unwrap();
            (
                reg.masters.values().filter(|m| m.live()).map(|m| (m.login, m.tenant_id, m.id)).collect(),
                reg.funds.values().filter(|f| f.status != "closed").map(|f| (f.login, f.tenant_id, f.id)).collect(),
            )
        };
        let mut n = 0;
        for (login, tenant, id) in masters {
            let (followers, aum) = self.master_audience(id);
            if self.snapshot(login, tenant, None, followers, aum).await {
                n += 1;
            }
        }
        for (login, tenant, id) in funds {
            let nav = self.fund(id).map(|f| f.nav_now());
            if self.snapshot(login, tenant, nav, 0, ZERO).await {
                n += 1;
            }
        }
        n
    }

    async fn snapshot(&self, login: i64, tenant: i64, nav: Option<D>, followers: i64, aum: D) -> bool {
        let Some(b) = self.account_brief(login).await else { return false };
        let now = Utc::now();
        let day = server_date(now);
        let flow = self.flows(login, server_midnight(day), now + Duration::seconds(1)).await;
        let r = sqlx::query(
            "INSERT INTO social_snapshots (login, day, tenant_id, equity, flow, nav, followers, aum) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (login, day) DO UPDATE SET equity = EXCLUDED.equity, flow = EXCLUDED.flow, nav = EXCLUDED.nav, followers = EXCLUDED.followers, aum = EXCLUDED.aum, updated_at = now()",
        )
        .bind(login)
        .bind(day)
        .bind(tenant)
        .bind(r2(b.equity))
        .bind(r2(flow))
        .bind(nav)
        .bind(followers as i32)
        .bind(r2(aum))
        .execute(&self.pool)
        .await;
        r.is_ok()
    }

    /// Rebuilds past days of an account from its ledger (end-of-day balance + that day's flows), so a newly
    /// approved master shows the track record it applied with. Past floating P&L is not known; the balance is
    /// used. Existing snapshot rows are kept.
    pub async fn backfill(&self, login: i64, tenant: i64) -> anyhow::Result<usize> {
        let rows = sqlx::query(
            "SELECT t.created_at AS at, p.amount, t.kind FROM ledger_txns t JOIN ledger_postings p ON p.txn_id = t.id
             WHERE t.login = $1 AND p.account_code = $2 ORDER BY t.created_at, t.id",
        )
        .bind(login)
        .bind(crate::model::acct_code(login, "balance"))
        .fetch_all(&self.pool)
        .await?;
        if rows.is_empty() {
            return Ok(0);
        }
        let cent = self.hub.meta(login).map(|m| m.group == "cent").unwrap_or(false);
        let factor = if cent { D::ONE_HUNDRED } else { D::ONE };
        let mut by_day: std::collections::BTreeMap<NaiveDate, (D, D)> = Default::default(); // day → (balance change, flow)
        for r in &rows {
            let at: DateTime<Utc> = r.get("at");
            let amt: D = r.get::<D, _>("amount") / factor;
            let kind: String = r.get("kind");
            let e = by_day.entry(server_date(at)).or_insert((ZERO, ZERO));
            e.0 += amt;
            if matches!(kind.as_str(), "transfer_in" | "transfer_out" | "deposit" | "withdrawal" | "demo_initial" | "demo_refill") {
                e.1 += amt;
            }
        }
        let today = server_date(Utc::now());
        let first = *by_day.keys().next().unwrap();
        let mut bal = ZERO;
        let mut n = 0;
        let mut d = first;
        while d < today {
            let (chg, flow) = by_day.get(&d).copied().unwrap_or((ZERO, ZERO));
            bal += chg;
            let r = sqlx::query("INSERT INTO social_snapshots (login, day, tenant_id, equity, flow) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (login, day) DO NOTHING")
                .bind(login)
                .bind(d)
                .bind(tenant)
                .bind(r2(bal))
                .bind(r2(flow))
                .execute(&self.pool)
                .await?;
            n += r.rows_affected() as usize;
            d = d.succ_opt().unwrap();
        }
        Ok(n)
    }

    /// Followers (active subscriptions) and AUM (followers' equity + investors' share of funds) of a master.
    pub fn master_audience(&self, master_id: i64) -> (i64, D) {
        let reg = self.reg.read().unwrap();
        let subs = reg.subs_of(master_id);
        let followers = subs.iter().filter(|s| s.status != "stopped").count() as i64;
        let mut aum: D = subs.iter().map(|s| s.last_equity.unwrap_or(s.net_deposits).max(ZERO)).sum();
        for fnd in reg.funds.values().filter(|x| x.master_id == master_id && x.status != "closed") {
            aum += fnd.last_equity.unwrap_or(ZERO);
        }
        (followers, aum)
    }

    /// Snapshots of several logins (ordered by day).
    pub async fn points(&self, logins: &[i64]) -> HashMap<i64, Vec<DayPoint>> {
        let mut out: HashMap<i64, Vec<DayPoint>> = HashMap::new();
        if logins.is_empty() {
            return out;
        }
        let rows = sqlx::query("SELECT login, day, equity, flow FROM social_snapshots WHERE login = ANY($1) ORDER BY login, day").bind(logins).fetch_all(&self.pool).await.unwrap_or_default();
        for r in rows {
            out.entry(r.get("login")).or_default().push(DayPoint { day: r.get("day"), equity: f(r.get("equity")), flow: f(r.get("flow")) });
        }
        out
    }

    /// Stats for an account from its snapshots plus the live equity as today's point.
    pub async fn stats_for(&self, login: i64, mut points: Vec<DayPoint>) -> MasterStats {
        let now = Utc::now();
        let today = server_date(now);
        if let Some(b) = self.account_brief(login).await {
            let flow = f(self.flows(login, server_midnight(today), now + Duration::seconds(1)).await);
            points.retain(|p| p.day != today);
            if points.is_empty() && flow > 0.0 {
                // first day of the track record: start the index from the day's funding, so today's result
                // shows before the first end-of-day snapshot exists
                points.push(DayPoint { day: today.pred_opt().unwrap_or(today), equity: flow, flow });
                points.push(DayPoint { day: today, equity: f(b.equity), flow: 0.0 });
            } else {
                points.push(DayPoint { day: today, equity: f(b.equity), flow });
            }
        }
        let series = math::index_series(&points);
        let at = |days: i64| Some(today - Duration::days(days));
        let (max_dd, cur_dd) = math::drawdowns(&series);
        let vol = math::volatility(&series);
        MasterStats {
            return_1m: round2(math::period_return(&series, at(30))),
            return_3m: round2(math::period_return(&series, at(91))),
            return_1y: round2(math::period_return(&series, at(365))),
            return_all: round2(math::period_return(&series, None)),
            max_dd: round2(max_dd * 100.0),
            current_dd: round2(cur_dd * 100.0),
            volatility: round2(vol * 100.0),
            risk: math::risk_score(max_dd, vol),
            equity: points.last().map(|p| p.equity).unwrap_or(0.0),
            series,
            points,
        }
    }

    /// Closed trades count and win rate (%).
    pub async fn trade_counts(&self, login: i64) -> (i64, f64) {
        let r = sqlx::query("SELECT count(*) AS n, count(*) FILTER (WHERE profit + swap > 0) AS w FROM deals WHERE login = $1 AND entry <> 'in' AND NOT reversed").bind(login).fetch_one(&self.pool).await;
        match r {
            Ok(r) => {
                let (n, w): (i64, i64) = (r.get("n"), r.get("w"));
                (n, if n > 0 { round2(w as f64 / n as f64 * 100.0) } else { 0.0 })
            }
            Err(_) => (0, 0.0),
        }
    }

    /// MasterView (README). `private` adds the owner / admin fields.
    pub async fn master_view(&self, m: &Master, st: Option<&MasterStats>, private: bool) -> Value {
        let (followers, aum) = self.master_audience(m.id);
        let investors: i64 = sqlx::query_scalar("SELECT count(*) FROM pamm_investors i JOIN pamm_funds f ON f.id = i.fund_id WHERE f.master_id = $1 AND i.units > 0 AND NOT i.is_master").bind(m.id).fetch_one(&self.pool).await.unwrap_or(0);
        let (trades, win) = self.trade_counts(m.login).await;
        let created = self.account_brief(m.login).await.map(|b| b.created_at).unwrap_or(m.created_at);
        let fund = {
            let reg = self.reg.read().unwrap();
            reg.funds.values().filter(|f| f.master_id == m.id && f.status != "closed").max_by_key(|f| f.id).cloned()
        };
        let stats = st.map(|s| {
            let spark: Vec<f64> = s.series.iter().rev().take(30).rev().map(|(_, v)| (v * 10000.0).round() / 10000.0).collect();
            json!({"return1m": s.return_1m, "return3m": s.return_3m, "return1y": s.return_1y, "returnAll": s.return_all, "maxDd": s.max_dd, "currentDd": s.current_dd,
                   "volatility": s.volatility, "riskScore": s.risk, "equity": round2(s.equity), "aum": num(r2(aum)), "followers": followers, "investors": investors,
                   "trades": trades, "winRate": win, "spark": spark})
        });
        let mut v = json!({
            "id": m.id, "nickname": m.nickname, "strategy": m.strategy, "description": m.description, "program": m.program,
            "perfFeePct": num(m.perf_fee_pct), "feePeriod": m.fee_period, "minAllocation": num(m.min_allocation), "status": m.status, "hidden": m.hidden, "frozen": m.frozen,
            "since": m.approved_at, "ageDays": (Utc::now() - created).num_days(),
            "stats": stats.unwrap_or_else(|| json!({"aum": num(r2(aum)), "followers": followers, "investors": investors, "trades": trades, "winRate": win})),
            "fund": fund.map(|f| json!({"id": f.id, "name": f.name, "nav": num(crate::money::rdp(f.nav_now(), 6)), "period": f.period, "perfFeePct": num(f.perf_fee_pct),
                                         "lockInDays": f.lock_in_days, "minInvestment": num(f.min_investment), "status": f.status})),
        });
        if private {
            v["login"] = json!(m.login);
            v["userId"] = json!(m.user_id);
            v["kycVerified"] = json!(m.kyc_verified);
            v["checks"] = m.checks.clone();
            v["reviewNote"] = json!(m.review_note);
            v["reviewedBy"] = json!(m.reviewed_by);
            v["createdAt"] = json!(m.created_at);
        }
        v
    }

    /// Closed master trades older than the tenant's delay (D72 delayed history).
    pub async fn delayed_trades(&self, login: i64, delay_minutes: i64, limit: i64) -> Vec<Value> {
        let before = Utc::now() - Duration::minutes(delay_minutes);
        let rows = sqlx::query(
            "SELECT id, symbol, position_side, volume, open_price, price, open_time, time, profit + swap AS profit FROM deals
             WHERE login = $1 AND entry <> 'in' AND NOT reversed AND time < $2 ORDER BY time DESC LIMIT $3",
        )
        .bind(login)
        .bind(before)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .unwrap_or_default();
        rows.iter()
            .map(|r| {
                json!({"id": r.get::<i64, _>("id"), "symbol": r.get::<String, _>("symbol"), "side": r.get::<String, _>("position_side"), "volume": num(r.get::<D, _>("volume")),
                       "openPrice": num(r.get::<D, _>("open_price")), "closePrice": num(r.get::<D, _>("price")), "openTime": r.get::<DateTime<Utc>, _>("open_time"),
                       "closeTime": r.get::<DateTime<Utc>, _>("time"), "profit": num(r.get::<D, _>("profit"))})
            })
            .collect()
    }

    /// Share of closed trades per symbol.
    pub async fn symbol_mix(&self, login: i64) -> Vec<Value> {
        let rows = sqlx::query("SELECT symbol, count(*) AS n FROM deals WHERE login = $1 AND entry <> 'in' AND NOT reversed GROUP BY symbol ORDER BY n DESC LIMIT 8").bind(login).fetch_all(&self.pool).await.unwrap_or_default();
        let total: i64 = rows.iter().map(|r| r.get::<i64, _>("n")).sum();
        rows.iter()
            .map(|r| {
                let n: i64 = r.get("n");
                json!({"symbol": r.get::<String, _>("symbol"), "trades": n, "share": if total > 0 { round2(n as f64 / total as f64 * 100.0) } else { 0.0 }})
            })
            .collect()
    }
}
