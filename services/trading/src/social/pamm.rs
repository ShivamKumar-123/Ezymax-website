//! PAMM funds (D65–D67, D74): fund creation with the master's seed, invest / redeem requests queued until the
//! rollover, rollover execution (fees → redemptions → investments at one NAV, planned by
//! `math::plan_rollover` inside the fund account's shard so the equity it uses is exact), investor stop-loss,
//! fund max-drawdown freeze.

use chrono::{DateTime, Duration, Utc};
use serde_json::{Value, json};
use sqlx::Row;
use std::sync::Arc;

use super::math::{self, Holding, PlanReq, RolloverPlan};
use super::wallet::{self, CREDIT, DEBIT};
use super::{Fund, Master, Social, next_period_end};
use crate::engine::funds::{self, Direction};
use crate::engine::metrics;
use crate::model::{Status, TxnKind};
use crate::money::{D, ZERO, num, num_opt, r2};
use crate::shard::{ExecError, Op};

/// A refused social request (mapped to `{"error": {code, message}}` by the API).
#[derive(Debug, Clone)]
pub struct SocErr {
    pub status: u16,
    pub code: &'static str,
    pub message: String,
}

impl SocErr {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { status: 422, code, message: message.into() }
    }
    pub fn not_found(what: &str) -> Self {
        Self { status: 404, code: "not_found", message: format!("{what} not found") }
    }
    pub fn internal(e: impl std::fmt::Display) -> Self {
        tracing::error!(error = %e, "social internal error");
        Self { status: 500, code: "internal", message: "Something went wrong. Please try again.".into() }
    }
    pub fn wallet(e: &wallet::WalletError) -> Self {
        if e.status == 0 {
            Self { status: 503, code: "wallet_unavailable", message: format!("{} Try again shortly.", e.message) }
        } else {
            Self { status: 422, code: "wallet_rejected", message: e.message.clone() }
        }
    }
}

impl From<anyhow::Error> for SocErr {
    fn from(e: anyhow::Error) -> Self {
        SocErr::internal(e)
    }
}
impl From<sqlx::Error> for SocErr {
    fn from(e: sqlx::Error) -> Self {
        SocErr::internal(e)
    }
}

pub fn request_json(r: &sqlx::postgres::PgRow) -> Value {
    json!({
        "id": r.get::<i64, _>("id"), "fundId": r.get::<i64, _>("fund_id"), "kind": r.get::<String, _>("kind"),
        "amount": num_opt(r.get::<Option<D>, _>("amount")), "units": num_opt(r.get::<Option<D>, _>("units")), "all": r.get::<bool, _>("redeem_all"),
        "status": r.get::<String, _>("status"), "reason": r.get::<Option<String>, _>("reason"), "createdAt": r.get::<DateTime<Utc>, _>("created_at"),
        "executedAt": r.get::<Option<DateTime<Utc>>, _>("executed_at"), "nav": num_opt(r.get::<Option<D>, _>("nav")),
        "unitsDelta": num_opt(r.get::<Option<D>, _>("units_delta")), "amountOut": num_opt(r.get::<Option<D>, _>("amount_out")), "fee": num_opt(r.get::<Option<D>, _>("fee")),
    })
}

fn pos(v: D) -> bool {
    v > ZERO && r2(v) == v
}

impl Social {
    pub fn fund(&self, id: i64) -> Option<Fund> {
        self.reg.read().unwrap().funds.get(&id).cloned()
    }

    /// Creates a fund: opens the fund account (group `pamm`, owned by the master), takes the seed from the
    /// master's wallet and books it at NAV 1.00.
    #[allow(clippy::too_many_arguments)]
    pub async fn create_fund(&self, m: &Master, name: &str, period: &str, fee: D, lock_in_days: i64, min_investment: D, max_dd_pct: Option<D>, seed: D) -> Result<(Fund, Value), SocErr> {
        let s = self.settings(m.tenant_id);
        if fee < s.fee_min_pct || fee > s.fee_max_pct {
            return Err(SocErr::new("fee_out_of_range", format!("The performance fee must be between {}% and {}%", s.fee_min_pct.normalize(), s.fee_max_pct.normalize())));
        }
        if !pos(seed) {
            return Err(SocErr::new("validation", "Enter the seed amount (up to 2 decimals)"));
        }
        let (login, pw, inv) = self.open_account(m.tenant_id, m.user_id, "pamm", &format!("PAMM · {name}")).await.map_err(|e| SocErr::internal(format!("{e:?}")))?;
        let now = Utc::now();
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO pamm_funds (tenant_id, master_id, user_id, login, name, period, perf_fee_pct, lock_in_days, min_investment, max_dd_pct, min_own_pct, status, next_rollover_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',$12) RETURNING id",
        )
        .bind(m.tenant_id)
        .bind(m.id)
        .bind(m.user_id)
        .bind(login)
        .bind(name)
        .bind(period)
        .bind(fee)
        .bind(lock_in_days as i32)
        .bind(min_investment)
        .bind(max_dd_pct)
        .bind(s.min_own_capital_pct)
        .bind(next_period_end(period, now))
        .fetch_one(&self.pool)
        .await?;
        let investor: i64 = sqlx::query_scalar("INSERT INTO pamm_investors (tenant_id, fund_id, user_id, is_master) VALUES ($1,$2,$3,true) RETURNING id").bind(m.tenant_id).bind(id).bind(m.user_id).fetch_one(&self.pool).await?;
        let row = sqlx::query("SELECT * FROM pamm_funds WHERE id = $1").bind(id).fetch_one(&self.pool).await?;
        let mut f = super::fund_from(&row);
        self.reg.write().unwrap().funds.insert(id, f.clone());

        let key = format!("pamm:seed:{id}");
        if let Err(e) = self.wallet.transfer(&self.slug(m.tenant_id), &key, m.user_id, seed, DEBIT, "pamm_invest", &key, &format!("Seed capital of PAMM fund {name}")).await {
            f.status = "closed".into();
            f.freeze_reason = Some(format!("seed not funded: {}", e.message));
            self.save_fund(&f).await?;
            return Err(SocErr::wallet(&e));
        }
        let k = key.clone();
        let op: Op = Box::new(move |tx, env| funds::transfer(tx, env, Direction::In, seed, &k, Some(k.clone())).map(|_| Value::Null));
        match self.hub.exec(login, "wallet", None, "", "", None, op).await {
            Ok(_) | Err(ExecError::Duplicate(_)) => {}
            Err(e) => return Err(SocErr::internal(format!("{e:?}"))),
        }
        let mut t = self.pool.begin().await?;
        sqlx::query("UPDATE pamm_investors SET units = $2, hwm_nav = 1, net_invested = $2, first_at = now(), updated_at = now() WHERE id = $1").bind(investor).bind(seed).execute(&mut *t).await?;
        sqlx::query("INSERT INTO pamm_unit_ledger (tenant_id, fund_id, investor_id, kind, units, nav, amount) VALUES ($1,$2,$3,'seed',$4,1,$4)").bind(m.tenant_id).bind(id).bind(investor).bind(seed).execute(&mut *t).await?;
        t.commit().await?;
        f.units = seed;
        f.nav_peak = D::ONE;
        f.last_equity = Some(seed);
        self.save_fund(&f).await?;
        tracing::info!(fund = id, login, master = m.id, seed = %seed, "PAMM fund created");
        Ok((f, json!({"login": login, "password": pw, "investorPassword": inv})))
    }

    /// Invest request: the wallet is debited now, units are bought at the next rollover (D67).
    pub async fn invest_request(&self, fund_id: i64, user: i64, amount: D, stop_loss_pct: Option<D>) -> Result<Value, SocErr> {
        let f = self.fund(fund_id).ok_or_else(|| SocErr::not_found("Fund"))?;
        if f.status != "active" {
            return Err(SocErr::new("fund_frozen", "This fund is not accepting investments right now"));
        }
        if !pos(amount) {
            return Err(SocErr::new("validation", "Enter an amount above 0 (up to 2 decimals)"));
        }
        if user != f.user_id && amount < f.min_investment {
            return Err(SocErr::new("min_investment", format!("The minimum investment is {} USD", f.min_investment.normalize())));
        }
        if let Some(sl) = stop_loss_pct
            && (sl <= ZERO || sl >= D::ONE_HUNDRED)
        {
            return Err(SocErr::new("validation", "Stop-loss must be between 0 and 100 %"));
        }
        let id: i64 = sqlx::query_scalar("INSERT INTO pamm_requests (tenant_id, fund_id, user_id, kind, amount, stop_loss_pct, status) VALUES ($1,$2,$3,'invest',$4,$5,'funding') RETURNING id")
            .bind(f.tenant_id)
            .bind(fund_id)
            .bind(user)
            .bind(amount)
            .bind(stop_loss_pct)
            .fetch_one(&self.pool)
            .await?;
        let key = format!("pamm:invest:{id}");
        match self.wallet.transfer(&self.slug(f.tenant_id), &key, user, amount, DEBIT, "pamm_invest", &key, &format!("Investment in PAMM fund {}", f.name)).await {
            Ok(_) => {
                sqlx::query("UPDATE pamm_requests SET status = 'pending', updated_at = now() WHERE id = $1").bind(id).execute(&self.pool).await?;
            }
            Err(e) => {
                sqlx::query("UPDATE pamm_requests SET status = 'rejected', reason = $2, updated_at = now() WHERE id = $1").bind(id).bind(&e.message).execute(&self.pool).await?;
                return Err(SocErr::wallet(&e));
            }
        }
        let r = sqlx::query("SELECT * FROM pamm_requests WHERE id = $1").bind(id).fetch_one(&self.pool).await?;
        Ok(request_json(&r))
    }

    /// Redeem request (units, an amount at the rollover NAV, or everything), executed at the next rollover.
    pub async fn redeem_request(&self, fund_id: i64, user: i64, units: Option<D>, amount: Option<D>, all: bool) -> Result<Value, SocErr> {
        let f = self.fund(fund_id).ok_or_else(|| SocErr::not_found("Fund"))?;
        let inv = sqlx::query("SELECT units, first_at FROM pamm_investors WHERE fund_id = $1 AND user_id = $2").bind(fund_id).bind(user).fetch_optional(&self.pool).await?.ok_or_else(|| SocErr::new("insufficient_units", "You have no units in this fund"))?;
        let have: D = inv.get("units");
        if have <= ZERO {
            return Err(SocErr::new("insufficient_units", "You have no units in this fund"));
        }
        if user != f.user_id
            && let Some(first) = inv.get::<Option<DateTime<Utc>>, _>("first_at")
            && first + Duration::days(f.lock_in_days) > Utc::now()
        {
            let until = first + Duration::days(f.lock_in_days);
            return Err(SocErr::new("locked", format!("Your investment is locked in until {}", until.format("%Y-%m-%d %H:%M UTC"))));
        }
        let (units, amount) = if all {
            (None, None)
        } else if let Some(u) = units {
            if u <= ZERO || u > have {
                return Err(SocErr::new("insufficient_units", format!("You can redeem up to {} units", have.normalize())));
            }
            (Some(u), None)
        } else if let Some(a) = amount {
            if !pos(a) {
                return Err(SocErr::new("validation", "Enter an amount above 0 (up to 2 decimals)"));
            }
            (None, Some(a))
        } else {
            return Err(SocErr::new("validation", "Choose units, an amount or everything"));
        };
        let r = sqlx::query("INSERT INTO pamm_requests (tenant_id, fund_id, user_id, kind, amount, units, redeem_all, status) VALUES ($1,$2,$3,'redeem',$4,$5,$6,'pending') RETURNING *")
            .bind(f.tenant_id)
            .bind(fund_id)
            .bind(user)
            .bind(amount)
            .bind(units)
            .bind(all)
            .fetch_one(&self.pool)
            .await?;
        Ok(request_json(&r))
    }

    pub async fn cancel_request(&self, id: i64, user: i64) -> Result<Value, SocErr> {
        let _g = self.pamm_lock.lock().await;
        let r = sqlx::query("UPDATE pamm_requests SET status = 'cancelled', reason = 'cancelled by investor', updated_at = now() WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING *")
            .bind(id)
            .bind(user)
            .fetch_optional(&self.pool)
            .await?;
        let Some(r) = r else {
            return Err(match sqlx::query("SELECT 1 FROM pamm_requests WHERE id = $1 AND user_id = $2").bind(id).bind(user).fetch_optional(&self.pool).await? {
                Some(_) => SocErr::new("request_done", "This request has already been processed"),
                None => SocErr::not_found("Request"),
            });
        };
        if r.get::<String, _>("kind") == "invest"
            && let Some(a) = r.get::<Option<D>, _>("amount")
        {
            let key = format!("pamm:refund:{id}");
            wallet::enqueue(&self.pool, r.get("tenant_id"), &key, user, a, CREDIT, "pamm_redeem", &key, "Cancelled PAMM investment").await?;
        }
        Ok(request_json(&r))
    }

    /// Runs a fund's rollover now (scheduled, manual or stop-loss). See README "PAMM".
    pub async fn rollover(&self, fund_id: i64, kind: &str) -> anyhow::Result<Value> {
        self.execute_fund(fund_id, kind, None).await
    }

    async fn execute_fund(&self, fund_id: i64, kind: &str, only: Option<i64>) -> anyhow::Result<Value> {
        let _g = self.pamm_lock.lock().await;
        let f = self.fund(fund_id).ok_or_else(|| anyhow::anyhow!("fund not found"))?;
        if f.status == "closed" {
            anyhow::bail!("fund is closed");
        }
        let now = Utc::now();
        // new investors get a (zero) holding first
        sqlx::query(
            "INSERT INTO pamm_investors (tenant_id, fund_id, user_id) SELECT DISTINCT tenant_id, fund_id, user_id FROM pamm_requests
             WHERE fund_id = $1 AND status = 'pending' AND kind = 'invest' ON CONFLICT (fund_id, user_id) DO NOTHING",
        )
        .bind(fund_id)
        .execute(&self.pool)
        .await?;
        let inv_rows = sqlx::query("SELECT id, user_id, is_master, units, hwm_nav, net_invested, first_at FROM pamm_investors WHERE fund_id = $1 ORDER BY id").bind(fund_id).fetch_all(&self.pool).await?;
        let by_user: std::collections::HashMap<i64, i64> = inv_rows.iter().map(|r| (r.get::<i64, _>("user_id"), r.get::<i64, _>("id"))).collect();
        let user_of: std::collections::HashMap<i64, i64> = inv_rows.iter().map(|r| (r.get::<i64, _>("id"), r.get::<i64, _>("user_id"))).collect();
        let only_user = match only {
            Some(rq) => sqlx::query_scalar::<_, i64>("SELECT user_id FROM pamm_requests WHERE id = $1").bind(rq).fetch_optional(&self.pool).await?,
            None => None,
        };
        let holdings: Vec<Holding> = inv_rows
            .iter()
            .map(|r| {
                let uid: i64 = r.get("user_id");
                // an out-of-cycle redemption charges the fee of that investor only
                let hwm = if only_user.is_some_and(|u| u != uid) { D::MAX } else { r.get("hwm_nav") };
                Holding { investor: r.get("id"), units: r.get("units"), hwm, is_master: r.get("is_master") }
            })
            .collect();
        let req_rows = match only {
            Some(rq) => sqlx::query("SELECT * FROM pamm_requests WHERE id = $1 AND status = 'pending'").bind(rq).fetch_all(&self.pool).await?,
            None => sqlx::query("SELECT * FROM pamm_requests WHERE fund_id = $1 AND status = 'pending' ORDER BY id").bind(fund_id).fetch_all(&self.pool).await?,
        };
        let mut pre_rejected: Vec<(i64, String)> = Vec::new();
        let mut pre_deferred: Vec<(i64, String)> = Vec::new();
        // (request, investor, kind, amount, units, all)
        let mut reqs: Vec<(i64, i64, String, Option<D>, Option<D>, bool)> = Vec::new();
        for r in &req_rows {
            let id: i64 = r.get("id");
            let uid: i64 = r.get("user_id");
            let k: String = r.get("kind");
            let Some(&inv) = by_user.get(&uid) else {
                pre_rejected.push((id, "insufficient_units".into()));
                continue;
            };
            if k == "invest" && f.status != "active" {
                pre_rejected.push((id, "fund_frozen".into()));
                continue;
            }
            if k == "redeem" && kind != "stop_loss" && uid != f.user_id {
                let first: Option<DateTime<Utc>> = inv_rows.iter().find(|x| x.get::<i64, _>("id") == inv).and_then(|x| x.get("first_at"));
                if let Some(first) = first
                    && first + Duration::days(f.lock_in_days) > now
                {
                    pre_deferred.push((id, format!("locked until {}", (first + Duration::days(f.lock_in_days)).format("%Y-%m-%d"))));
                    continue;
                }
            }
            reqs.push((id, inv, k, r.get("amount"), r.get("units"), r.get("redeem_all")));
        }
        let rid: i64 = sqlx::query_scalar("SELECT nextval(pg_get_serial_sequence('pamm_rollovers', 'id'))").fetch_one(&self.pool).await?;
        let fee_pct = f.perf_fee_pct;
        let min_own = f.min_own_pct;
        let sink: Arc<std::sync::Mutex<Option<RolloverPlan>>> = Default::default();
        let out = sink.clone();
        let hold = holdings.clone();
        let rq = reqs.clone();
        let op: Op = Box::new(move |tx, env| {
            let m = metrics(env, &tx.st);
            let fx = tx.st.account.usd_factor();
            let equity = m.equity / fx;
            let cash = m.withdrawable() / fx;
            let units: D = hold.iter().map(|h| h.units).sum();
            let nav = math::nav(equity, units);
            let plan_reqs: Vec<PlanReq> = rq
                .iter()
                .map(|(id, inv, k, amount, u, all)| {
                    if k == "invest" {
                        PlanReq::Invest { id: *id, investor: *inv, amount: amount.unwrap_or(ZERO) }
                    } else if *all {
                        PlanReq::Redeem { id: *id, investor: *inv, units: None }
                    } else if let Some(u) = u {
                        PlanReq::Redeem { id: *id, investor: *inv, units: Some(*u) }
                    } else {
                        PlanReq::Redeem { id: *id, investor: *inv, units: Some(math::units_for(amount.unwrap_or(ZERO), nav)) }
                    }
                })
                .collect();
            let plan = math::plan_rollover(equity, &hold, &plan_reqs, fee_pct, min_own, cash);
            if plan.fees_total > ZERO {
                let key = format!("perf:pamm:{fund_id}:{rid}");
                tx.post(env, TxnKind::PerformanceFee, key.clone(), "balance", "perf_fees", -(plan.fees_total * fx), Some(key), None, Some("PAMM performance fees".into()));
            }
            for (req, _, _, amount) in &plan.redemptions {
                let key = format!("pamm:redeem:{req}");
                funds::transfer(tx, env, Direction::Out, *amount, &key, Some(key.clone()))?;
            }
            for (req, _, _, _) in &plan.investments {
                let amount = rq.iter().find(|x| x.0 == *req).and_then(|x| x.3).unwrap_or(ZERO);
                let key = format!("pamm:invest:{req}");
                funds::transfer(tx, env, Direction::In, amount, &key, Some(key.clone()))?;
            }
            *out.lock().unwrap() = Some(plan);
            Ok(Value::Null)
        });
        self.hub.exec(f.login, "pamm", None, "", "", None, op).await.map_err(|e| anyhow::anyhow!("rollover ledger failed: {e:?}"))?;
        let plan = sink.lock().unwrap().take().ok_or_else(|| anyhow::anyhow!("no rollover plan"))?;

        // ---- apply the plan to the unit ledger, requests, fees and the outbox (one transaction) ----
        let settings = self.settings(f.tenant_id);
        let scheduled = kind != "stop_loss";
        let mut t = self.pool.begin().await?;
        sqlx::query(
            "INSERT INTO pamm_rollovers (id, tenant_id, fund_id, at, kind, nav, equity_before, equity_after, units_before, units_after, fees, invested, redeemed)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
        )
        .bind(rid)
        .bind(f.tenant_id)
        .bind(fund_id)
        .bind(now)
        .bind(kind)
        .bind(plan.nav)
        .bind(r2(plan.equity_before))
        .bind(r2(plan.equity_after))
        .bind(plan.units_before)
        .bind(plan.units_after)
        .bind(plan.fees_total)
        .bind(plan.invested_total)
        .bind(plan.redeemed_total)
        .execute(&mut *t)
        .await?;
        let mut fee_of: std::collections::HashMap<i64, D> = Default::default();
        for (inv, fee, fu, hwm_after) in &plan.fees {
            let old_hwm = holdings.iter().find(|h| h.investor == *inv).map(|h| h.hwm).unwrap_or(D::ONE);
            let units = holdings.iter().find(|h| h.investor == *inv).map(|h| h.units).unwrap_or(ZERO);
            fee_of.insert(*inv, *fee);
            sqlx::query("UPDATE pamm_investors SET units = units - $2, hwm_nav = $3, fees_paid = fees_paid + $4, updated_at = now() WHERE id = $1").bind(inv).bind(fu).bind(hwm_after).bind(fee).execute(&mut *t).await?;
            sqlx::query("INSERT INTO pamm_unit_ledger (tenant_id, fund_id, investor_id, kind, units, nav, amount, rollover_id) VALUES ($1,$2,$3,'fee',$4,$5,$6,$7)")
                .bind(f.tenant_id)
                .bind(fund_id)
                .bind(inv)
                .bind(-*fu)
                .bind(plan.nav)
                .bind(fee)
                .bind(rid)
                .execute(&mut *t)
                .await?;
            let (cut, to_master) = math::split_fee(*fee, settings.platform_cut_pct);
            sqlx::query(
                "INSERT INTO social_fees (tenant_id, source, master_id, fund_id, payer_user_id, login, ledger_key, amount, platform_cut, master_amount, period_start, period_end, hwm_before, hwm_after, equity, status)
                 VALUES ($1,'pamm',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending') ON CONFLICT DO NOTHING",
            )
            .bind(f.tenant_id)
            .bind(f.master_id)
            .bind(fund_id)
            .bind(user_of.get(inv).copied().unwrap_or(0))
            .bind(f.login)
            .bind(format!("perf:pamm:{fund_id}:{rid}"))
            .bind(fee)
            .bind(cut)
            .bind(to_master)
            .bind(f.last_rollover_at.unwrap_or(f.created_at))
            .bind(now)
            .bind(old_hwm)
            .bind(hwm_after)
            .bind(r2(units * plan.nav))
            .execute(&mut *t)
            .await?;
        }
        let ledger_kind = if kind == "stop_loss" { "stop_loss" } else { "redeem" };
        for (req, inv, u, amount) in &plan.redemptions {
            let before = holdings.iter().find(|h| h.investor == *inv).map(|h| h.units).unwrap_or(ZERO) - plan.fees.iter().find(|x| x.0 == *inv).map(|x| x.2).unwrap_or(ZERO);
            let keep = if before > ZERO { (before - *u) / before } else { ZERO };
            sqlx::query("UPDATE pamm_investors SET units = units - $2, net_invested = round(net_invested * $3, 2), updated_at = now() WHERE id = $1").bind(inv).bind(u).bind(keep).execute(&mut *t).await?;
            sqlx::query("INSERT INTO pamm_unit_ledger (tenant_id, fund_id, investor_id, kind, units, nav, amount, request_id, rollover_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)")
                .bind(f.tenant_id)
                .bind(fund_id)
                .bind(inv)
                .bind(ledger_kind)
                .bind(-*u)
                .bind(plan.nav)
                .bind(amount)
                .bind(req)
                .bind(rid)
                .execute(&mut *t)
                .await?;
            sqlx::query("UPDATE pamm_requests SET status = 'done', executed_at = $2, nav = $3, units_delta = $4, amount_out = $5, fee = $6, updated_at = now() WHERE id = $1")
                .bind(req)
                .bind(now)
                .bind(plan.nav)
                .bind(-*u)
                .bind(amount)
                .bind(fee_of.get(inv).copied())
                .execute(&mut *t)
                .await?;
            let key = format!("pamm:redeem:{req}");
            wallet::enqueue(&mut *t, f.tenant_id, &key, user_of.get(inv).copied().unwrap_or(0), *amount, CREDIT, "pamm_redeem", &key, &format!("Redemption from PAMM fund {}", f.name)).await?;
        }
        for (req, inv, u, hwm) in &plan.investments {
            let (amount, sl) = req_rows.iter().find(|r| r.get::<i64, _>("id") == *req).map(|r| (r.get::<Option<D>, _>("amount").unwrap_or(ZERO), r.get::<Option<D>, _>("stop_loss_pct"))).unwrap_or((ZERO, None));
            sqlx::query("UPDATE pamm_investors SET units = units + $2, hwm_nav = $3, net_invested = net_invested + $4, first_at = COALESCE(first_at, $5), stop_loss_pct = COALESCE($6, stop_loss_pct), updated_at = now() WHERE id = $1")
                .bind(inv)
                .bind(u)
                .bind(hwm)
                .bind(amount)
                .bind(now)
                .bind(sl)
                .execute(&mut *t)
                .await?;
            sqlx::query("INSERT INTO pamm_unit_ledger (tenant_id, fund_id, investor_id, kind, units, nav, amount, request_id, rollover_id) VALUES ($1,$2,$3,'invest',$4,$5,$6,$7,$8)")
                .bind(f.tenant_id)
                .bind(fund_id)
                .bind(inv)
                .bind(u)
                .bind(plan.nav)
                .bind(amount)
                .bind(req)
                .bind(rid)
                .execute(&mut *t)
                .await?;
            sqlx::query("UPDATE pamm_requests SET status = 'done', executed_at = $2, nav = $3, units_delta = $4, updated_at = now() WHERE id = $1").bind(req).bind(now).bind(plan.nav).bind(u).execute(&mut *t).await?;
        }
        let rejected: Vec<(i64, String)> = plan.rejected.iter().map(|(i, r)| (*i, r.to_string())).chain(pre_rejected.into_iter()).collect();
        for (req, reason) in &rejected {
            let r = sqlx::query("UPDATE pamm_requests SET status = 'rejected', reason = $2, executed_at = $3, updated_at = now() WHERE id = $1 RETURNING kind, amount, user_id")
                .bind(req)
                .bind(reason)
                .bind(now)
                .fetch_one(&mut *t)
                .await?;
            if r.get::<String, _>("kind") == "invest"
                && let Some(a) = r.get::<Option<D>, _>("amount")
            {
                let key = format!("pamm:refund:{req}");
                wallet::enqueue(&mut *t, f.tenant_id, &key, r.get("user_id"), a, CREDIT, "pamm_redeem", &key, &format!("Refund: PAMM investment not accepted ({reason})")).await?;
            }
        }
        for (req, reason) in plan.deferred.iter().map(|(i, r)| (*i, r.to_string())).chain(pre_deferred.into_iter()) {
            sqlx::query("UPDATE pamm_requests SET reason = $2, updated_at = now() WHERE id = $1").bind(req).bind(reason).execute(&mut *t).await?;
        }
        t.commit().await?;

        let mut nf = self.fund(fund_id).unwrap_or(f.clone());
        nf.units = plan.units_after;
        if scheduled {
            nf.last_rollover_at = Some(now);
            if kind == "scheduled" || nf.next_rollover_at <= now {
                nf.next_rollover_at = next_period_end(&nf.period, now);
            }
        }
        if plan.nav > nf.nav_peak {
            nf.nav_peak = plan.nav;
        }
        nf.last_equity = Some(plan.equity_after);
        self.save_fund(&nf).await?;
        tracing::info!(fund = fund_id, kind, nav = %plan.nav, fees = %plan.fees_total, invested = %plan.invested_total, redeemed = %plan.redeemed_total, "PAMM rollover");
        Ok(json!({
            "id": rid, "fundId": fund_id, "kind": kind, "at": now, "nav": num(plan.nav), "equityBefore": num(r2(plan.equity_before)), "equityAfter": num(r2(plan.equity_after)),
            "unitsBefore": num(plan.units_before), "unitsAfter": num(plan.units_after), "feesTotal": num(plan.fees_total), "invested": num(plan.invested_total), "redeemed": num(plan.redeemed_total),
            "fees": plan.fees.iter().map(|(i, fee, u, _)| json!({"investor": i, "fee": num(*fee), "units": num(*u)})).collect::<Vec<_>>(),
            "redemptions": plan.redemptions.iter().map(|(r, i, u, a)| json!({"request": r, "investor": i, "units": num(*u), "amount": num(*a)})).collect::<Vec<_>>(),
            "investments": plan.investments.iter().map(|(r, i, u, _)| json!({"request": r, "investor": i, "units": num(*u)})).collect::<Vec<_>>(),
            "rejected": rejected.iter().map(|(r, why)| json!({"request": r, "reason": why})).collect::<Vec<_>>(),
            "deferred": plan.deferred.iter().map(|(r, why)| json!({"request": r, "reason": why})).collect::<Vec<_>>(),
        }))
    }

    /// Freeze (D74 max drawdown, D125 emergency) or unfreeze a fund.
    pub async fn freeze_fund(&self, id: i64, freeze: bool, close: bool, reason: &str) -> anyhow::Result<Value> {
        let _g = self.pamm_lock.lock().await;
        let mut f = self.fund(id).ok_or_else(|| anyhow::anyhow!("fund not found"))?;
        let status = if freeze { Status::CloseOnly } else { Status::Active };
        let op: Op = Box::new(move |tx, env| {
            let mut out = json!({"closed": [], "failed": []});
            if freeze && close {
                let a = crate::engine::trade::bulk_close(tx, env, crate::engine::trade::BulkFilter::Pending, None);
                let b = crate::engine::trade::bulk_close(tx, env, crate::engine::trade::BulkFilter::All, None);
                out = json!({"closed": a.done.iter().chain(b.done.iter()).collect::<Vec<_>>(), "failed": a.failed.iter().chain(b.failed.iter()).map(|(t, e)| json!({"ticket": t, "error": e})).collect::<Vec<_>>()});
            }
            if tx.st.account.status != status {
                funds::set_status(tx, status)?;
            }
            Ok(out)
        });
        let done = self.hub.exec(f.login, "system", None, "", "", None, op).await.map_err(|e| anyhow::anyhow!("{e:?}"))?;
        if freeze {
            f.status = "frozen".into();
            f.freeze_reason = Some(reason.to_string());
        } else {
            f.status = "active".into();
            f.freeze_reason = None;
            if let Some(b) = self.account_brief(f.login).await {
                f.nav_peak = math::nav(b.equity, f.units);
            }
        }
        self.save_fund(&f).await?;
        tracing::warn!(fund = id, freeze, close, reason, "PAMM fund freeze changed");
        Ok(done.value)
    }

    /// Fund protection (D74): NAV peak, max-drawdown freeze, investor stop-loss.
    pub async fn guard_funds(&self) {
        let ids: Vec<i64> = self.reg.read().unwrap().funds.values().filter(|f| f.status != "closed").map(|f| f.id).collect();
        for id in ids {
            // never read a fund mid-rollover (ledger already moved, units not yet): skip it this round
            let Ok(lock) = self.pamm_lock.try_lock() else { continue };
            let Some(f) = self.fund(id) else { continue };
            let Some(b) = self.account_brief(f.login).await else { continue };
            drop(lock);
            let nav = math::nav(b.equity, f.units);
            let mut peak_up = false;
            {
                let mut reg = self.reg.write().unwrap();
                if let Some(x) = reg.funds.get_mut(&f.id) {
                    x.last_equity = Some(b.equity);
                    if f.units > ZERO && nav > x.nav_peak {
                        x.nav_peak = nav;
                        peak_up = true;
                    }
                }
            }
            if peak_up {
                let _ = sqlx::query("UPDATE pamm_funds SET nav_peak = $2 WHERE id = $1 AND nav_peak < $2").bind(f.id).bind(nav).execute(&self.pool).await;
            }
            if f.units <= ZERO {
                continue;
            }
            if f.status == "active"
                && let Some(dd) = f.max_dd_pct.filter(|d| *d > ZERO)
                && nav <= f.nav_peak.max(nav) * (D::ONE_HUNDRED - dd) / D::ONE_HUNDRED
            {
                tracing::warn!(fund = f.id, nav = %nav, peak = %f.nav_peak, "fund max drawdown reached: freezing");
                if let Err(e) = self.freeze_fund(f.id, true, true, "max_drawdown").await {
                    tracing::error!(fund = f.id, error = %e, "freeze failed");
                }
                continue;
            }
            // investor stop-loss
            let rows = sqlx::query("SELECT user_id, units, net_invested, stop_loss_pct FROM pamm_investors WHERE fund_id = $1 AND stop_loss_pct IS NOT NULL AND units > 0 AND NOT is_master")
                .bind(f.id)
                .fetch_all(&self.pool)
                .await
                .unwrap_or_default();
            for r in rows {
                let (user, units, net, sl): (i64, D, D, D) = (r.get("user_id"), r.get("units"), r.get("net_invested"), r.get("stop_loss_pct"));
                if net <= ZERO || units * nav > net * (D::ONE_HUNDRED - sl) / D::ONE_HUNDRED {
                    continue;
                }
                let exists: Option<i64> = sqlx::query_scalar("SELECT id FROM pamm_requests WHERE fund_id = $1 AND user_id = $2 AND kind = 'redeem' AND status = 'pending' AND reason = 'stop_loss'").bind(f.id).bind(user).fetch_optional(&self.pool).await.unwrap_or(None);
                let req = match exists {
                    Some(r) => r,
                    None => match sqlx::query_scalar::<_, i64>("INSERT INTO pamm_requests (tenant_id, fund_id, user_id, kind, redeem_all, status, reason) VALUES ($1,$2,$3,'redeem',true,'pending','stop_loss') RETURNING id").bind(f.tenant_id).bind(f.id).bind(user).fetch_one(&self.pool).await {
                        Ok(id) => id,
                        Err(e) => {
                            tracing::error!(error = %e, "stop-loss request failed");
                            continue;
                        }
                    },
                };
                tracing::warn!(fund = f.id, user, nav = %nav, "investor stop-loss hit: redeeming now");
                if let Err(e) = self.execute_fund(f.id, "stop_loss", Some(req)).await {
                    tracing::error!(fund = f.id, user, error = %e, "stop-loss redemption failed");
                }
            }
        }
    }

    /// The investor's holdings (and requests) across funds.
    pub async fn investments(&self, tenant: i64, user: i64) -> anyhow::Result<Value> {
        let rows = sqlx::query("SELECT * FROM pamm_investors WHERE tenant_id = $1 AND user_id = $2 ORDER BY fund_id").bind(tenant).bind(user).fetch_all(&self.pool).await?;
        let reqs = sqlx::query("SELECT * FROM pamm_requests WHERE tenant_id = $1 AND user_id = $2 AND status <> 'funding' ORDER BY id DESC LIMIT 200").bind(tenant).bind(user).fetch_all(&self.pool).await?;
        let mut items = Vec::new();
        for r in &rows {
            let fund_id: i64 = r.get("fund_id");
            let Some(f) = self.fund(fund_id) else { continue };
            let pending: Vec<Value> = reqs.iter().filter(|q| q.get::<i64, _>("fund_id") == fund_id && q.get::<String, _>("status") == "pending").map(request_json).collect();
            let units: D = r.get("units");
            if units <= ZERO && pending.is_empty() {
                continue;
            }
            let nav = f.nav_now();
            let value = r2(units * nav);
            let net: D = r.get("net_invested");
            let first: Option<DateTime<Utc>> = r.get("first_at");
            let fv = self.fund_view(&f, false).await;
            items.push(json!({
                "fundId": fund_id, "fund": fv, "units": num(crate::money::rdp(units, 4)), "nav": num(crate::money::rdp(nav, 6)), "value": num(value), "netInvested": num(net),
                "pnl": num(value - net), "pnlPct": if net > ZERO { num(r2((value - net) / net * D::ONE_HUNDRED)) } else { json!(0) },
                "hwmNav": num(crate::money::rdp(r.get::<D, _>("hwm_nav"), 6)), "stopLossPct": num_opt(r.get::<Option<D>, _>("stop_loss_pct")),
                "lockedUntil": first.map(|t| t + Duration::days(f.lock_in_days)).filter(|t| *t > Utc::now() && !r.get::<bool, _>("is_master")),
                "feesPaid": num(r.get::<D, _>("fees_paid")), "isMaster": r.get::<bool, _>("is_master"), "pending": pending,
            }));
        }
        Ok(json!({"items": items, "requests": reqs.iter().map(request_json).collect::<Vec<_>>()}))
    }

    pub async fn set_stop_loss(&self, fund_id: i64, user: i64, sl: Option<D>) -> Result<(), SocErr> {
        if let Some(v) = sl
            && (v <= ZERO || v >= D::ONE_HUNDRED)
        {
            return Err(SocErr::new("validation", "Stop-loss must be between 0 and 100 %"));
        }
        let n = sqlx::query("UPDATE pamm_investors SET stop_loss_pct = $3, updated_at = now() WHERE fund_id = $1 AND user_id = $2 AND NOT is_master").bind(fund_id).bind(user).bind(sl).execute(&self.pool).await?.rows_affected();
        if n == 0 {
            return Err(SocErr::not_found("Investment"));
        }
        Ok(())
    }

    pub async fn statement(&self, fund_id: i64, user: i64) -> anyhow::Result<Value> {
        let items = sqlx::query("SELECT l.at, l.kind, l.units, l.nav, l.amount FROM pamm_unit_ledger l JOIN pamm_investors i ON i.id = l.investor_id WHERE l.fund_id = $1 AND i.user_id = $2 ORDER BY l.id DESC LIMIT 500")
            .bind(fund_id)
            .bind(user)
            .fetch_all(&self.pool)
            .await?;
        let reqs = sqlx::query("SELECT * FROM pamm_requests WHERE fund_id = $1 AND user_id = $2 AND status <> 'funding' ORDER BY id DESC LIMIT 200").bind(fund_id).bind(user).fetch_all(&self.pool).await?;
        Ok(json!({
            "items": items.iter().map(|r| json!({"at": r.get::<DateTime<Utc>, _>("at"), "kind": r.get::<String, _>("kind"), "units": num(crate::money::rdp(r.get::<D, _>("units"), 8)), "nav": num(r.get::<D, _>("nav")), "amount": num(r.get::<D, _>("amount"))})).collect::<Vec<_>>(),
            "requests": reqs.iter().map(request_json).collect::<Vec<_>>(),
        }))
    }

    /// FundView (see README) with investor counts from the database.
    pub async fn fund_view(&self, f: &Fund, owner: bool) -> Value {
        let r = sqlx::query("SELECT count(*) FILTER (WHERE units > 0 AND NOT is_master) AS n, COALESCE(sum(units) FILTER (WHERE is_master), 0) AS mu FROM pamm_investors WHERE fund_id = $1").bind(f.id).fetch_one(&self.pool).await.ok();
        let (n, mu): (i64, D) = r.map(|r| (r.get("n"), r.get("mu"))).unwrap_or((0, ZERO));
        let m = self.reg.read().unwrap().masters.get(&f.master_id).cloned();
        let ret1m = self.fund_return_since(f, Utc::now() - Duration::days(30)).await;
        let all: f64 = rust_decimal::prelude::ToPrimitive::to_f64(&((f.nav_now() - D::ONE) * D::ONE_HUNDRED)).unwrap_or(0.0);
        let mut v = super::fund_json(f, m.as_ref(), n, mu, owner, Some(((all * 100.0).round() / 100.0, ret1m)));
        if owner {
            v["pending"] = json!(sqlx::query_scalar::<_, i64>("SELECT count(*) FROM pamm_requests WHERE fund_id = $1 AND status = 'pending'").bind(f.id).fetch_one(&self.pool).await.unwrap_or(0));
        }
        v
    }

    /// NAV return (%) since `from` (last rollover NAV at or before it, else the launch NAV 1.00).
    pub async fn fund_return_since(&self, f: &Fund, from: DateTime<Utc>) -> f64 {
        let base: Option<D> = sqlx::query_scalar("SELECT nav FROM pamm_rollovers WHERE fund_id = $1 AND at <= $2 ORDER BY at DESC LIMIT 1").bind(f.id).bind(from).fetch_optional(&self.pool).await.ok().flatten();
        let base = base.unwrap_or(D::ONE);
        if base <= ZERO {
            return 0.0;
        }
        let r = (f.nav_now() / base - D::ONE) * D::ONE_HUNDRED;
        (rust_decimal::prelude::ToPrimitive::to_f64(&r).unwrap_or(0.0) * 100.0).round() / 100.0
    }
}
