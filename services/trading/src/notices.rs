//! Trade notices for the client (bell, realtime, email per preference) from the events of a committed engine
//! transaction: a position opened or closed - by the client, a stop loss, a take profit, the dealing desk or a
//! stop-out - a pending order placed, filled, cancelled, expired or rejected, and a margin call.
//!
//! They are read from the transaction's events and notes in `shard::publish`, which runs after the commit, so
//! every notice describes a deal or an order that is on the books; and they are queued in `notify_outbox` from a
//! spawned task, so the engine never waits on the support service. Dedupe keys are per deal (`deal:<id>`), per
//! order and status, and per margin-call hour - the same keys the support service's polling adapters use, so a
//! notice is never shown or emailed twice whichever side delivers it first.
//!
//! Which of these are emailed is the client's choice: `trading.*` fills and closes fall under "Order fills and
//! closes" (email off by default - a busy trader would get a mail a minute), margin call and stop-out under
//! "Margin call and stop-out" (email on).

use chrono::Utc;
use serde_json::{Value, json};
use sqlx::PgPool;

use crate::engine::{Note, Tx};
use crate::model::{Deal, DealReason, Order, OrderStatus, Side};
use crate::money::D;
use crate::state::Event;

/// Account money, signed: "+12.40", "-63.00", "0.00".
pub fn money(v: D) -> String {
    let r = v.round_dp(2);
    if r.is_zero() { "0.00".into() } else if r.is_sign_positive() { format!("+{r:.2}") } else { format!("{r:.2}") }
}

fn side(s: Side) -> String {
    s.as_str().to_uppercase()
}

fn facts(pairs: &[(&str, String)]) -> Value {
    json!(pairs.iter().map(|(k, v)| json!({"label": k, "value": v})).collect::<Vec<_>>())
}

struct Notice {
    kind: &'static str,
    data: Value,
    dedupe: String,
}

fn notice(kind: &'static str, title: String, body: String, severity: &str, link: &str, data: Value, dedupe: String) -> Notice {
    Notice { kind, data: json!({"title": title, "body": body, "severity": severity, "link": link, "data": data}), dedupe }
}

/// A position opened (a market fill, or a pending order filled).
fn opened(login: i64, ccy: &str, d: &Deal) -> Notice {
    let what = format!("{} {} {}", side(d.position_side), d.volume.normalize(), d.symbol);
    let pending = matches!(d.reason, DealReason::PendingFill);
    let (kind, title) = if pending { ("trading.order_filled", format!("Pending order filled: {what}")) } else { ("trading.opened", format!("Trade opened: {what}")) };
    let body = if pending {
        format!("Your pending order #{} was filled at {} on account {login}. Position #{} is open.", d.order_ticket.unwrap_or(0), d.price.normalize(), d.position_ticket)
    } else {
        format!("{what} was filled at {} on account {login}. Position #{} is open.", d.price.normalize(), d.position_ticket)
    };
    let f = facts(&[("Position", format!("#{}", d.position_ticket)), ("Trade", what.clone()), ("Open price", d.price.normalize().to_string()), ("Account", format!("{login} ({ccy})"))]);
    notice(kind, title, body, "info", "/trader", json!({"login": login, "ticket": d.position_ticket, "dealId": d.id, "symbol": d.symbol, "facts": f}), format!("deal:{}", d.id))
}

/// A position closed, in full or in part, by whoever closed it.
fn closed(login: i64, ccy: &str, d: &Deal, partial: bool) -> Option<Notice> {
    let what = format!("{} {} {}", side(d.position_side), d.volume.normalize(), d.symbol);
    let result = money(d.profit);
    let (kind, severity, title) = match &d.reason {
        DealReason::Sl => ("trading.sl", "warning", format!("Stop loss hit: {}", d.symbol)),
        DealReason::Tp => ("trading.tp", "success", format!("Take profit hit: {}", d.symbol)),
        DealReason::StopOut => ("trading.stop_out", "critical", format!("Stop-out on account {login}: {} closed", d.symbol)),
        DealReason::Dealer | DealReason::Force => ("trading.dealer_close", "warning", format!("{} position closed by the dealing desk", d.symbol)),
        DealReason::Client | DealReason::CloseBy => {
            let part = if partial { "Part of a trade closed" } else { "Trade closed" };
            if d.profit.is_sign_negative() && !d.profit.is_zero() {
                ("trading.closed", "warning", format!("{part} with a loss: {result} {ccy}"))
            } else {
                ("trading.closed", "success", format!("{part} with a profit: {result} {ccy}"))
            }
        }
        // reversals, price corrections and option expiries are not trades the client made
        _ => return None,
    };
    let body = match &d.reason {
        DealReason::Sl => format!("Position #{} {what} hit its stop loss and was closed at {} on account {login}. Result: {result} {ccy}.", d.position_ticket, d.price.normalize()),
        DealReason::Tp => format!("Position #{} {what} reached its take profit and was closed at {} on account {login}. Result: {result} {ccy}.", d.position_ticket, d.price.normalize()),
        DealReason::StopOut => format!("The margin level on account {login} fell to the stop-out level, so the engine closed position #{} {what} at {}. Result: {result} {ccy}.", d.position_ticket, d.price.normalize()),
        DealReason::Dealer | DealReason::Force => format!("Position #{} {what} was closed by the dealing desk at {} on account {login}. Result: {result} {ccy}.", d.position_ticket, d.price.normalize()),
        _ => format!("Position #{} {what} was closed at {} on account {login}. Result: {result} {ccy}.", d.position_ticket, d.price.normalize()),
    };
    let f = facts(&[
        ("Position", format!("#{}", d.position_ticket)),
        ("Trade", what.clone()),
        ("Open / close", format!("{} / {}", d.open_price.normalize(), d.price.normalize())),
        ("Result", format!("{result} {ccy}")),
    ]);
    Some(notice(
        kind,
        title,
        body,
        severity,
        "/portfolio",
        json!({"login": login, "ticket": d.position_ticket, "dealId": d.id, "symbol": d.symbol, "profit": crate::money::num(d.profit), "reason": d.reason.as_str(), "facts": f}),
        format!("deal:{}", d.id),
    ))
}

fn order_placed(login: i64, o: &Order) -> Notice {
    let what = format!("{} {} {} {}", side(o.side), o.kind.as_str().replace('-', " ").to_uppercase(), o.volume.normalize(), o.symbol);
    let expiry = match &o.expiry {
        crate::model::Expiry::Gtc => "Good till cancelled".to_string(),
        crate::model::Expiry::Today => "Today".to_string(),
        crate::model::Expiry::Date => o.expiry_at.map(|t| t.format("%d %b %Y, %H:%M UTC").to_string()).unwrap_or_else(|| "Date".into()),
    };
    let f = facts(&[("Order", format!("#{}", o.ticket)), ("Trade", what.clone()), ("Price", o.price.normalize().to_string()), ("Expiry", expiry)]);
    notice(
        "trading.order_placed",
        format!("Pending order placed: {what}"),
        format!("{what} at {} is waiting on account {login}. It fills when the market reaches that price.", o.price.normalize()),
        "info",
        "/trader",
        json!({"login": login, "ticket": o.ticket, "symbol": o.symbol, "facts": f}),
        format!("order:{}:placed", o.ticket),
    )
}

fn order_removed(login: i64, ticket: i64, status: OrderStatus, reason: &str) -> Option<Notice> {
    let (kind, severity, title, body) = match status {
        // the fill is told by the position it opened (`opened`, reason PendingFill)
        OrderStatus::Filled => return None,
        OrderStatus::Cancelled => ("trading.order_cancelled", "info", format!("Pending order #{ticket} cancelled"), format!("Pending order #{ticket} on account {login} was cancelled{}.", if reason.is_empty() { String::new() } else { format!(" ({reason})") })),
        OrderStatus::Expired => ("trading.order_expired", "info", format!("Pending order #{ticket} expired"), format!("Pending order #{ticket} on account {login} reached its expiry without being filled and was removed.")),
        OrderStatus::Rejected => ("trading.order_rejected", "warning", format!("Pending order #{ticket} could not be filled"), format!("Pending order #{ticket} on account {login} was triggered but could not be filled{}.", if reason.is_empty() { String::new() } else { format!(": {reason}") })),
    };
    Some(notice(kind, title, body, severity, "/trader", json!({"login": login, "ticket": ticket, "status": status.as_str(), "reason": reason}), format!("order:{ticket}:{}", status.as_str())))
}

fn margin_call(login: i64, n: &Note) -> Notice {
    let level = n.data.get("level").and_then(Value::as_f64).map(|l| format!("{l:.1}%")).unwrap_or_default();
    notice(
        "trading.margin_call",
        format!("Margin call on account {login}"),
        format!("The margin level on account {login} is {level}. Add funds or close positions - if it falls to the stop-out level the engine closes positions, largest loss first."),
        "warning",
        "/wallet/deposit",
        json!({"login": login, "level": n.data.get("level").cloned().unwrap_or(Value::Null), "facts": facts(&[("Account", login.to_string()), ("Margin level", level)])}),
        format!("margin:{login}:{}", Utc::now().format("%Y%m%d%H")),
    )
}

/// Every notice a committed transaction gives rise to.
fn collect(tx: &Tx) -> Vec<Notice> {
    let login = tx.st.login();
    let ccy = tx.st.account.ccy();
    let mut out = Vec::new();
    for e in &tx.events {
        match e {
            Event::PositionOpened { deal: Some(d), .. } => out.push(opened(login, ccy, d)),
            Event::PositionClosed { deal, position } => out.extend(closed(login, ccy, deal, position.is_some())),
            Event::OrderPlaced { order } => out.push(order_placed(login, order)),
            Event::OrderRemoved { ticket, status, reason, .. } => out.extend(order_removed(login, *ticket, *status, reason)),
            _ => {}
        }
    }
    for n in &tx.notes {
        if n.kind == "margin_call" {
            out.push(margin_call(login, n));
        }
    }
    out
}

/// Queues the notices of a committed transaction, off the engine's path.
pub fn publish(pool: PgPool, tx: &Tx) {
    let notices = collect(tx);
    if notices.is_empty() {
        return;
    }
    let (tenant_id, user_id) = (tx.st.account.tenant_id, tx.st.account.user_id);
    tokio::spawn(async move {
        for n in notices {
            crate::notify::enqueue_or_log(&pool, tenant_id, user_id, n.kind, n.data, &n.dedupe).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::money;
    use crate::money::D;

    fn d(s: &str) -> D {
        s.parse().unwrap()
    }

    #[test]
    fn money_is_signed_to_the_cent() {
        assert_eq!(money(d("12.4")), "+12.40");
        assert_eq!(money(d("-63")), "-63.00");
        assert_eq!(money(d("0")), "0.00");
        assert_eq!(money(d("-0.004")), "0.00");
    }
}
