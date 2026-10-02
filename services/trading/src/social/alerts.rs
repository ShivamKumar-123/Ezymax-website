//! Copier alerts and the following lifecycle (Task 1 A6–A8):
//!
//! - alerts to the follower through the notification outbox (`crate::notify`): copied trade opened / closed (in-app
//!   only), trade skipped or failed with the reason, equity / drawdown protection stop, master stopped or back,
//!   new terms (email + in-app, following the client's `copy` preference);
//! - a master's fee change: a lower fee applies at once; a higher fee or another fee period waits for each
//!   follower's acceptance (`accept_terms`: the period so far is settled at the old rate, then the new terms
//!   apply); without acceptance the copy pauses after `TERMS_DAYS` (`pause_reason = 'terms'`);
//! - a master that stops (suspended / frozen / removed) flags every follower (`attention = 'master_stopped'`), and
//!   the Client Area offers the unfollow wizard;
//! - add funds / withdraw (free margin) on a copy account while following.

use chrono::{DateTime, Duration, Utc};
use serde_json::{Value, json};

use super::mirror::LogEntry;
use super::{Master, Social, Sub, next_period_end};
use crate::money::{D, ZERO, num, r2};

/// Days a follower has to accept a master's new terms before the copy pauses.
pub const TERMS_DAYS: i64 = 7;

/// Client Area page of the follower's subscriptions.
pub const SUBS_LINK: &str = "/social/copy";

/// Skips that are not worth an alert: duplicates and the follower's own pause.
pub fn alert_worthy_skip(e: &LogEntry) -> bool {
    if e.status == "done" || !matches!(e.action, "open" | "add" | "order") {
        return false;
    }
    let m = e.message.as_str();
    !(m.starts_with("already") || m.contains("copying is paused") || m.contains("pending copy already filled"))
}

/// What a fee change means for one follower: Applied (lower fee, same period), Pending (needs acceptance) or
/// Cleared (the master went back to the follower's terms).
#[derive(Debug, PartialEq, Eq)]
pub enum TermsChange {
    Same,
    Applied,
    Pending,
    Cleared,
}

pub fn terms_change(sub_pct: D, sub_period: &str, pending: bool, new_pct: D, new_period: &str) -> TermsChange {
    if new_pct == sub_pct && new_period == sub_period {
        return if pending { TermsChange::Cleared } else { TermsChange::Same };
    }
    if new_pct < sub_pct && new_period == sub_period { TermsChange::Applied } else { TermsChange::Pending }
}

#[derive(Debug)]
pub struct FundsErr {
    pub code: &'static str,
    pub message: String,
    pub status: u16,
}

impl FundsErr {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { code, message: message.into(), status: 422 }
    }
}

impl Social {
    /// Queues an alert for the follower of `s` (best effort).
    #[allow(clippy::too_many_arguments)]
    pub async fn alert(&self, s: &Sub, kind: &str, title: String, body: String, severity: &str, email: bool, key: String, data: Value) {
        let mut d = json!({"title": title, "body": body, "link": format!("{SUBS_LINK}?sub={}", s.id), "severity": severity, "data": data});
        if !email {
            d["email"] = json!(false);
        }
        d["data"]["subscriptionId"] = json!(s.id);
        d["data"]["login"] = json!(s.login);
        crate::notify::enqueue_or_log(&self.pool, s.tenant_id, s.user_id, kind, d, &key).await;
    }

    /// Alerts for the mirrored steps of one master transaction.
    pub async fn alert_steps(&self, s: &Sub, master: &str, entries: &[(i64, LogEntry)]) {
        for (v, e) in entries {
            let t = e.master_ticket.unwrap_or(0);
            let data = json!({"masterTicket": e.master_ticket, "followerTicket": e.follower_ticket, "action": e.action, "status": e.status, "message": e.message});
            if e.status == "done" && matches!(e.action, "open" | "close" | "partial_close") {
                let (kind, title) = if e.action == "open" { ("copy.trade_opened", format!("Trade copied from {master}")) } else { ("copy.trade_closed", format!("Copied trade closed ({master})")) };
                self.alert(s, kind, title, e.message.clone(), "info", false, format!("copy:{}:{v}:{}:{t}", s.id, e.action), data).await;
            } else if alert_worthy_skip(e) {
                let title = if e.status == "failed" { format!("A trade from {master} could not be copied") } else { format!("A trade from {master} was not copied") };
                self.alert(s, "copy.trade_skipped", title, format!("Reason: {}", e.message), "warning", true, format!("copy:{}:{v}:{}:{t}:skip", s.id, e.action), data).await;
            }
        }
    }

    /// The equity stop or the max drawdown stopped the copy.
    pub async fn alert_protection(&self, s: &Sub, reason: &str, equity: D) {
        let master = self.reg.read().unwrap().masters.get(&s.master_id).map(|m| m.nickname.clone()).unwrap_or_default();
        let what = if reason == "equity_stop" { "your equity stop" } else { "your maximum drawdown" };
        self.alert(
            s,
            "copy.protection_stop",
            format!("Copying {master} stopped: {what} was reached"),
            format!("Equity {} USD. Open copied trades were closed. Copy account #{} keeps the balance; move it back to your wallet or delete the account from Social → My subscriptions.", r2(equity).normalize(), s.login),
            "critical",
            true,
            format!("copy:{}:protection", s.id),
            json!({"reason": reason, "equity": num(r2(equity))}),
        )
        .await;
    }

    /// A8: the master stopped (`stopped`) or is back. Flags every follower still copying and tells them.
    pub async fn on_master_stopped(&self, m: &Master, stopped: bool) {
        let subs: Vec<Sub> = self.reg.read().unwrap().subs_of(m.id).into_iter().cloned().collect();
        let stamp = Utc::now().timestamp();
        for mut s in subs {
            s.attention = if stopped { Some("master_stopped".into()) } else { None };
            if let Err(e) = self.save_sub(&s).await {
                tracing::error!(sub = s.id, error = %e, "flagging a follower failed");
                continue;
            }
            if stopped {
                self.alert(
                    &s,
                    "copy.master_stopped",
                    format!("{} stopped trading for followers", m.nickname),
                    "No new trades are copied. Open copied trades still follow the master's closes. You can stop copying and choose what happens to your trades and the copy account.".into(),
                    "warning",
                    true,
                    format!("copy:{}:master_stopped:{stamp}", s.id),
                    json!({"masterId": m.id}),
                )
                .await;
            } else {
                self.alert(&s, "copy.master_resumed", format!("{} is trading for followers again", m.nickname), "New trades are copied again.".into(), "info", true, format!("copy:{}:master_resumed:{stamp}", s.id), json!({"masterId": m.id}))
                    .await;
            }
        }
    }

    /// A8: the master changed the fee or the fee period. Returns (applied at once, waiting for acceptance).
    pub async fn on_terms_changed(&self, m: &Master) -> (usize, usize) {
        let subs: Vec<Sub> = self.reg.read().unwrap().subs_of(m.id).into_iter().cloned().collect();
        let (mut applied, mut pending) = (0, 0);
        let now = Utc::now();
        for mut s in subs {
            let change = terms_change(s.perf_fee_pct, &s.fee_period, s.terms_deadline.is_some(), m.perf_fee_pct, &m.fee_period);
            match change {
                TermsChange::Same => continue,
                TermsChange::Applied => {
                    s.perf_fee_pct = m.perf_fee_pct;
                    clear_pending(&mut s);
                    applied += 1;
                }
                TermsChange::Cleared => {
                    clear_pending(&mut s);
                }
                TermsChange::Pending => {
                    s.pending_fee_pct = Some(m.perf_fee_pct);
                    s.pending_fee_period = Some(m.fee_period.clone());
                    s.terms_deadline = Some(now + Duration::days(TERMS_DAYS));
                    pending += 1;
                }
            }
            if let Err(e) = self.save_sub(&s).await {
                tracing::error!(sub = s.id, error = %e, "saving new terms failed");
                continue;
            }
            let key = format!("copy:{}:terms:{}", s.id, now.timestamp());
            match change {
                TermsChange::Applied => {
                    self.alert(&s, "copy.terms_changed", format!("{} lowered the performance fee", m.nickname), format!("The fee is now {}% ({}). It applies right away.", m.perf_fee_pct.normalize(), m.fee_period), "info", true, key, json!({"perfFeePct": num(m.perf_fee_pct), "feePeriod": m.fee_period}))
                        .await;
                }
                TermsChange::Pending => {
                    let deadline = s.terms_deadline.map(|d| d.format("%d %b %Y").to_string()).unwrap_or_default();
                    self.alert(
                        &s,
                        "copy.terms_changed",
                        format!("{} changed the copy terms: please review", m.nickname),
                        format!(
                            "New terms: {}% performance fee, {} (yours: {}%, {}). Accept them by {deadline} to keep copying; your fee so far is settled at the old rate first. Without acceptance, copying pauses on that date.",
                            m.perf_fee_pct.normalize(),
                            m.fee_period,
                            s.perf_fee_pct.normalize(),
                            s.fee_period
                        ),
                        "warning",
                        true,
                        key,
                        json!({"perfFeePct": num(m.perf_fee_pct), "feePeriod": m.fee_period, "deadline": s.terms_deadline}),
                    )
                    .await;
                }
                _ => {}
            }
        }
        (applied, pending)
    }

    /// A8: the follower accepts the master's new terms: the fee for the period so far is settled at the old rate,
    /// then the new fee and period apply; a copy paused for the terms resumes.
    pub async fn accept_terms(&self, id: i64) -> anyhow::Result<Sub> {
        let has = self.reg.read().unwrap().subs.get(&id).map(|s| s.terms_deadline.is_some() && s.copying()).unwrap_or(false);
        if !has {
            anyhow::bail!("no_pending_terms");
        }
        let now = Utc::now();
        if let Err(e) = self.settle_copy(id, now, false).await {
            tracing::error!(sub = id, error = %e, "settling at the old terms failed");
            anyhow::bail!("settlement_failed");
        }
        let _g = self.sub_lock.lock().await;
        let Some(mut s) = self.reg.read().unwrap().subs.get(&id).cloned() else { anyhow::bail!("not found") };
        if let Some(p) = s.pending_fee_pct {
            s.perf_fee_pct = p;
        }
        if let Some(p) = s.pending_fee_period.clone() {
            s.fee_period = p;
        }
        s.next_fee_at = next_period_end(&s.fee_period, now);
        clear_pending(&mut s);
        if s.status == "paused" && s.pause_reason.as_deref() == Some("terms") {
            s.status = "active".into();
            s.pause_reason = None;
        }
        self.save_sub(&s).await?;
        tracing::info!(sub = id, fee = %s.perf_fee_pct, period = s.fee_period, "new copy terms accepted");
        Ok(s)
    }

    /// A8: pauses every copy whose acceptance deadline passed. Returns how many were paused.
    pub async fn pause_expired_terms(&self, now: DateTime<Utc>) -> usize {
        let due: Vec<Sub> = self.reg.read().unwrap().subs.values().filter(|s| s.status == "active" && s.terms_deadline.is_some_and(|d| d <= now)).cloned().collect();
        let mut n = 0;
        for mut s in due {
            s.status = "paused".into();
            s.pause_reason = Some("terms".into());
            if let Err(e) = self.save_sub(&s).await {
                tracing::error!(sub = s.id, error = %e, "pausing for terms failed");
                continue;
            }
            n += 1;
            let master = self.reg.read().unwrap().masters.get(&s.master_id).map(|m| m.nickname.clone()).unwrap_or_default();
            self.alert(
                &s,
                "copy.paused_terms",
                format!("Copying {master} is paused"),
                "You didn't accept the master's new terms in time. No new trades are copied; open copied trades still follow the master's closes and SL/TP. Accept the new terms to resume, or stop copying.".into(),
                "warning",
                true,
                format!("copy:{}:paused_terms:{}", s.id, s.terms_deadline.map(|d| d.timestamp()).unwrap_or(0)),
                json!({}),
            )
            .await;
        }
        n
    }

    /// A6: moves money between the wallet and the copy account while following. `add` = wallet → copy account;
    /// otherwise copy account → wallet, capped at the free margin (rounded down to the cent) and never below the
    /// follower's equity stop. Returns (amount, new balance).
    pub async fn sub_funds(&self, id: i64, add: bool, amount: D) -> Result<(D, Option<D>), FundsErr> {
        let s = self.reg.read().unwrap().subs.get(&id).cloned().ok_or_else(|| FundsErr { status: 404, ..FundsErr::new("not_found", "Subscription not found") })?;
        if amount <= ZERO || r2(amount) != amount {
            return Err(FundsErr::new("validation", "Enter an amount above 0 (up to 2 decimals)"));
        }
        let b = self.account_brief(s.login).await.ok_or_else(|| FundsErr { status: 404, ..FundsErr::new("not_found", "Copy account not found") })?;
        let slug = self.slug(s.tenant_id);
        if add {
            if !s.copying() {
                return Err(FundsErr::new("stopped", "This subscription has stopped"));
            }
            let key = format!("copy:add:{id}:{}:{}", b.version, amount.normalize());
            self.wallet.to_trading(&slug, &key, s.user_id, s.login, amount).await.map_err(|e| FundsErr { status: if e.status == 0 { 503 } else { 422 }, ..FundsErr::new(if e.status == 0 { "wallet_unavailable" } else { "wallet_rejected" }, e.message) })?;
        } else {
            let free = super::copier::returnable(b.withdrawable);
            if amount > free {
                return Err(FundsErr::new("insufficient_funds", format!("You can withdraw up to {} USD (free margin)", free.normalize())));
            }
            if let Some(es) = s.equity_stop.filter(|_| s.copying())
                && b.equity - amount <= es
            {
                return Err(FundsErr::new("equity_stop", format!("After this withdrawal the equity would reach your equity stop of {} USD. Lower the equity stop or withdraw less.", es.normalize())));
            }
            let key = format!("copy:wd:{id}:{}:{}", b.version, amount.normalize());
            self.wallet.from_trading(&slug, &key, s.user_id, s.login, amount).await.map_err(|e| FundsErr { status: if e.status == 0 { 503 } else { 422 }, ..FundsErr::new(if e.status == 0 { "wallet_unavailable" } else if e.code == "insufficient_funds" { "insufficient_funds" } else { "wallet_rejected" }, e.message) })?;
        }
        // the tap books the flow (HWM, drawdown peak) a moment later
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        let bal = self.account_brief(s.login).await.map(|b| r2(b.balance));
        tracing::info!(sub = id, add, amount = %amount, "copy account funds moved");
        Ok((amount, bal))
    }
}

fn clear_pending(s: &mut Sub) {
    s.pending_fee_pct = None;
    s.pending_fee_period = None;
    s.terms_deadline = None;
}

#[cfg(test)]
mod tests {
    use super::{TermsChange, alert_worthy_skip, terms_change};
    use crate::money::D;
    use crate::social::mirror::LogEntry;

    #[test]
    fn a_lower_fee_applies_at_once_anything_else_needs_acceptance() {
        let d = |v: i64| D::from(v);
        assert_eq!(terms_change(d(20), "monthly", false, d(15), "monthly"), TermsChange::Applied);
        assert_eq!(terms_change(d(20), "monthly", false, d(25), "monthly"), TermsChange::Pending);
        assert_eq!(terms_change(d(20), "monthly", false, d(15), "weekly"), TermsChange::Pending, "a new period always needs acceptance");
        assert_eq!(terms_change(d(20), "monthly", false, d(20), "monthly"), TermsChange::Same);
        assert_eq!(terms_change(d(20), "monthly", true, d(20), "monthly"), TermsChange::Cleared, "back to the follower's terms clears the request");
    }

    #[test]
    fn duplicates_and_own_pauses_are_not_alerted() {
        let skip = |m: &str| LogEntry::new("open", Some(1), "skipped", m);
        assert!(alert_worthy_skip(&skip("below the minimum lot for your sizing")));
        assert!(alert_worthy_skip(&skip("EURUSD is excluded")));
        assert!(!alert_worthy_skip(&skip("already copied")));
        assert!(!alert_worthy_skip(&skip("copying is paused")));
        assert!(alert_worthy_skip(&LogEntry::new("order", Some(1), "failed", "no_money: Not enough free margin")));
        assert!(!alert_worthy_skip(&LogEntry::new("close", Some(1), "failed", "market_closed")), "closes are retried by the follower's own stop; not alerted as skips");
    }
}
