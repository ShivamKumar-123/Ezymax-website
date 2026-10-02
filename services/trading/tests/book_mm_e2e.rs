//! Options order book, second milestone, END TO END against the REAL local services (docs/OPTIONS-EXCHANGE.md
//! §4, §5, §8, §11, §12; no mocked market data): market-data (:8081), the options service (:8104) and PostgreSQL.
//!
//! 1. **Enable / novation** (four-eyes through the Back Office handlers): a client's house-priced option and a
//!    pending house order exist; the plan counts them; the same staff member cannot confirm; a second one enables:
//!    the pending order is cancelled, the position moves to the book venue, the market maker gets the mirror
//!    position and the house premium, the book's positions match the accounts.
//! 2. **Market maker** quotes the real chain from the real snapshot under the client rules: ephemeral post-only
//!    quotes on both sides around the model, a client takes its ask (firm: no last look, MM fee 0, taker fee).
//! 3. **Combo RFQ**: the MM answers a call spread, the client accepts at the ask: both legs fill in one journal
//!    entry, one outbox item per account, the MM's hold is released, the tape shows the legs and a combo print.
//! 4. **Liquidation**: a client past its stop-out level is closed on the book first (within the band, against a
//!    resting order) and the rest by the Kalks backstop at mark + fee; every step is logged.
//! 5. **Bust** (four-eyes): a fill is reversed on both sides with `bust:` keys; positions move back.
//! 6. **Back Office** monitors answer; halt / resume and MM pause / resume work.
//! 7. Money: every transaction balances, clearing accounts net to 0, reserves 0 when idle, the account replay and
//!    the journal replay are identical.
//!
//! Run (FX must be open): `cargo test -p trading --test book_mm_e2e -- --ignored --nocapture`

mod common;

use axum::Json;
use axum::extract::{Path, State};
use chrono::Utc;
use serde_json::{Value, json};
use std::time::Duration;

use common::*;
use trading::api;
use trading::book::types::*;
use trading::model::AccountKind;
use trading::money::D;
use trading::options::OptionPricing;

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "needs the real market-data (:8081), options service (:8104) and PostgreSQL (:5433)"]
async fn market_maker_rfq_liquidation_enable_and_bust_end_to_end() {
    let rig = Rig::boot("book_mm_e2e", 4).await;
    let st = rig.st.clone();
    let hub = rig.hub.clone();
    trading::book::liquidator::spawn(st.clone());
    let spot = rig.spot("EURUSD").await;
    eprintln!("EURUSD raw mid {spot}");
    let snap = rig.options.snapshot().unwrap();
    let (series, cut) = pick(&snap, "EURUSD", spot, 30, 0, "call").expect("a EURUSD expiry more than a day out");
    let (series2, _) = pick(&snap, "EURUSD", spot, 30, 2, "call").expect("a call two strikes up");
    let (put, _) = pick(&snap, "EURUSD", spot, 30, 0, "put").expect("an ATM put");
    eprintln!("series {series}, {series2}, {put} (cut {cut})");
    let clearing = format!("house:options_clearing.EURUSD.{}:USD", cut.date_naive().format("%Y%m%d"));
    let (a, b, c) = (50_019_301i64, 50_019_302i64, 50_019_303i64);
    let (ta, tb, tc) = (rig.client(a, 19301, 10_000).await, rig.client(b, 19302, 50_000).await, rig.client(c, 19303, 3_000).await);

    // ---------------- 1. house position + pending house order, then enable (four-eyes) ----------------
    let Json(h) = api::options::place(State(st.clone()), rig.ctx(&ta), body(json!({"legs": [{"series": series, "side": "buy", "contracts": 2}], "type": "market", "clientOrderId": "house-1"}))).await.unwrap();
    eprintln!("house fill {h}");
    let Json(_) = api::options::place(State(st.clone()), rig.ctx(&ta), body(json!({"legs": [{"series": series2, "side": "buy", "contracts": 1}], "type": "limit", "limitPremium": "0.00001", "tif": "gtc", "clientOrderId": "house-2"})))
        .await
        .unwrap();
    let Json(plan) = api::book_admin::enable_plan(State(st.clone()), rig.staff("s1"), q(json!({"kind": "demo"}))).await.unwrap();
    eprintln!("plan {plan}");
    assert_eq!((plan["enabled"].as_bool(), plan["novation"]["positions"].as_u64(), plan["legacyPendingOrders"].as_u64()), (Some(false), Some(1), Some(1)), "{plan}");
    assert!(plan["blockers"].as_array().unwrap().is_empty(), "{plan}");
    let Json(p1) = api::book_admin::enable(State(st.clone()), rig.staff("s1"), body(json!({"kind": "demo", "reason": "go live (e2e)"}))).await.unwrap();
    assert_eq!(p1["status"], "pending_approval", "{p1}");
    let aid = p1["approval"]["id"].as_i64().unwrap();
    let e = api::book_admin::enable(State(st.clone()), rig.staff("s1"), body(json!({"kind": "demo", "reason": "self approve", "approvalId": aid}))).await.unwrap_err();
    assert!(format!("{e:?}").contains("four_eyes"), "{e:?}");
    assert!(!hub.shared.books.venue_enabled(1, AccountKind::Demo));
    let Json(en) = api::book_admin::enable(State(st.clone()), rig.staff("s2"), body(json!({"kind": "demo", "reason": "approve", "approvalId": aid}))).await.unwrap();
    eprintln!("enable {en}");
    assert_eq!(en["status"], "enabled", "{en}");
    assert!(hub.shared.books.venue_enabled(1, AccountKind::Demo));
    assert_eq!(en["report"]["cancelledOrders"].as_u64(), Some(1));
    let mm = hub.shared.books.mm.login(1, AccountKind::Demo).expect("the market maker account");
    rig.drained().await;
    assert_eq!(rig.book_pos(a).await.get(&series).copied(), Some(D::from(2)), "the client keeps its position, now on the book");
    assert_eq!(rig.book_pos(mm).await.get(&series).copied(), Some(D::from(-2)), "the market maker holds the house's side");
    let mm_cash: D = rig.ledger_like(&format!("acct:{mm}:balance")).await;
    assert!(mm_cash > D::from(25_000_000), "the premium the house took moved to the MM: {mm_cash}");
    let orders_left = hub.read(a, Box::new(|x| json!(x.unwrap().0.orders.len()))).await;
    assert_eq!(orders_left.as_u64(), Some(0), "the pending house order was cancelled");
    let key = trading::book::BookKey::new(1, AccountKind::Demo, "EURUSD");
    let h = hub.shared.books.handle(&key).expect("the EURUSD book runs");
    assert!(trading::book::reconcile(&hub, &h, &[]).await.is_none(), "book positions = account positions after novation");
    // enabling again changes nothing (idempotent)
    let again = trading::book::enable::enable(&st, 1, AccountKind::Demo, "e2e", "again").await.unwrap();
    assert!(again["novated"].as_array().unwrap().is_empty(), "{again}");
    assert_eq!(rig.book_pos(mm).await.get(&series).copied(), Some(D::from(-2)));

    // ---------------- 2. the market maker quotes the real chain ----------------
    for i in 0..20 {
        let t0 = std::time::Instant::now();
        trading::book::mm::pass(&st, 1, AccountKind::Demo).await.unwrap();
        let cov = hub.shared.books.mm.run(1, AccountKind::Demo).under.get("EURUSD").map(|u| (u.series_quoted, u.series_total, u.status.clone()));
        let age = rig.options.spot("EURUSD").map(|s| Utc::now().timestamp_millis() - s.1);
        eprintln!("mm pass {i}: {:?} in {:?}; EURUSD spot age {age:?} ms, open {:?}", cov, t0.elapsed(), hub.shared.specs.get("EURUSD").map(|s| s.is_open(Utc::now())));
        if i >= 3 && cov.as_ref().is_some_and(|c| c.1 > 0 && c.0 * 10 >= c.1 * 8) && rig.options.top.get("kalks", AccountKind::Demo, &series).is_some_and(|t| t.bid.is_some() && t.ask.is_some()) {
            break;
        }
        tokio::time::sleep(Duration::from_millis(300)).await;
    }
    let Json(mms) = api::book_admin::mm(State(st.clone()), rig.staff("s1"), q(json!({"kind": "demo"}))).await.unwrap();
    eprintln!("mm status: status {} coverage {} quotes {} latency {}", mms["status"], mms["coveragePct"], mms["quotesLive"], mms["latency"]);
    let eur = mms["underlyings"].as_array().unwrap().iter().find(|u| u["symbol"] == "EURUSD").unwrap().clone();
    assert!(eur["coveragePct"].as_f64().unwrap() > 80.0, "the MM quotes the EURUSD chain both sides: {eur}");
    let top = rig.options.top.get("kalks", AccountKind::Demo, &series).expect("top of book");
    let (bid, ask) = (top.bid.expect("an MM bid"), top.ask.expect("an MM ask"));
    let s2 = series.clone();
    let model = hub
        .read(b, Box::new(move |x| {
            let (_, env) = x.unwrap();
            let (t, _) = trading::engine::options_book::terms_of(&env.options.snapshot().unwrap(), &s2).unwrap();
            json!(env.options.price(&env.tenant.slug, "*", &t, env.now).unwrap().mark.to_string())
        }))
        .await;
    let model: D = model.as_str().unwrap().parse().unwrap();
    eprintln!("{series}: MM bid {} × {} / ask {} × {} around the model {model}", bid.0, bid.1, ask.0, ask.1);
    assert!(bid.0 < model && model < ask.0, "bid < model < ask");
    // the quotes are ephemeral (never in book_orders) and journaled in the quote journal
    let mm_rows: i64 = sqlx::query_scalar("SELECT count(*) FROM book_orders WHERE login = $1").bind(mm).fetch_one(&rig.pool).await.unwrap();
    assert_eq!(mm_rows, 0);
    tokio::time::sleep(Duration::from_millis(1200)).await;
    let mq: i64 = sqlx::query_scalar("SELECT count(*) FROM book_quote_journal WHERE login = $1 AND cmd_kind = 'mass_quote'").bind(mm).fetch_one(&rig.pool).await.unwrap();
    assert!(mq > 0, "mass quotes journaled");
    // a client takes the MM's ask: firm, at the quoted price; the MM pays no fee, the client the taker fee
    let order = |s: &str, side: &str, kind: &str, qty: i64, price: Option<D>, cid: &str| json!({"series": s, "side": side, "type": kind, "qty": qty, "price": price.map(|p| p.to_string()), "tif": if kind == "market" { "ioc" } else { "gtc" }, "clientOrderId": cid});
    let Json(f) = api::options_book::place(State(st.clone()), rig.ctx(&tb), body(order(&series, "buy", "market", 1, None, "b1"))).await.unwrap();
    eprintln!("b takes the MM ask: {f}");
    assert_eq!(f["status"], "filled", "{f}");
    assert_eq!(dec(&f["fills"][0]["price"]), ask.0, "filled at the MM's quote (no last look)");
    assert!(dec(&f["fills"][0]["fee"]) > D::ZERO, "the taker pays the taker fee");
    rig.drained().await;
    let mm_fee: i64 = sqlx::query_scalar("SELECT count(*) FROM ledger_txns WHERE login = $1 AND idempotency_key LIKE 'fill:%:fee'").bind(mm).fetch_one(&rig.pool).await.unwrap();
    assert_eq!(mm_fee, 0, "the market-maker tier pays no fee");
    assert_eq!(rig.ledger_sum(&clearing).await, D::ZERO);

    // ---------------- 3. combo RFQ: a call spread, accepted at the MM's ask ----------------
    let Json(r) = api::options_book::rfq_open(State(st.clone()), rig.ctx(&tb), body(json!({"legs": [{"series": series, "side": "buy", "ratio": 1}, {"series": series2, "side": "sell", "ratio": 1}], "qty": 2}))).await.unwrap();
    eprintln!("rfq {r}");
    let rid = r["rfq"]["id"].as_str().unwrap().to_string();
    let Json(g) = api::options_book::rfq_get(State(st.clone()), rig.ctx(&tb), Path(rid.clone())).await.unwrap();
    let quote = g["quotes"][0].clone();
    assert_eq!(quote["responder"], "kalks-mm", "the Kalks MM always answers: {g}");
    let (qb, qa) = (dec(&quote["bid"]), dec(&quote["ask"]));
    assert!(qb < qa, "{quote}");
    let mm_hold = hub.read(mm, Box::new(|x| json!(x.unwrap().0.book.rfq_holds.len()))).await;
    assert_eq!(mm_hold.as_u64(), Some(1), "the MM reserves for its worst side");
    // a limit below the ask is refused, nothing fills
    let e = api::options_book::rfq_accept(State(st.clone()), rig.ctx(&tb), Path(rid.clone()), body(json!({"quoteId": quote["quoteId"], "side": "buy", "limitNet": (qa - D::new(1, 5)).to_string()}))).await.unwrap_err();
    assert!(format!("{e:?}").contains("price_moved"), "{e:?}");
    let before_b = rig.book_pos(b).await;
    let Json(acc) = api::options_book::rfq_accept(State(st.clone()), rig.ctx(&tb), Path(rid.clone()), body(json!({"quoteId": quote["quoteId"], "side": "buy", "limitNet": qa.to_string()}))).await.unwrap();
    eprintln!("rfq accepted {acc}");
    assert_eq!((acc["status"].as_str(), acc["fills"].as_array().unwrap().len()), (Some("filled"), 2), "{acc}");
    let fills = acc["fills"].as_array().unwrap();
    assert!(fills.iter().all(|f| f["kind"] == "rfq" && f["comboId"].as_str() == Some(rid.as_str()) && f["positionTicket"].as_i64().is_some()), "{acc}");
    let net: D = dec(&fills[0]["price"]) - dec(&fills[1]["price"]);
    assert_eq!(net, qa, "the legs sum to the net");
    rig.drained().await;
    let after_b = rig.book_pos(b).await;
    assert_eq!(after_b.get(&series).copied().unwrap_or_default() - before_b.get(&series).copied().unwrap_or_default(), D::from(2));
    assert_eq!(after_b.get(&series2).copied().unwrap_or_default() - before_b.get(&series2).copied().unwrap_or_default(), D::from(-2));
    let mm_hold = hub.read(mm, Box::new(|x| json!(x.unwrap().0.book.rfq_holds.len()))).await;
    assert_eq!(mm_hold.as_u64(), Some(0), "the hold is released once the legs are booked");
    let one_item: i64 = sqlx::query_scalar("SELECT count(*) FROM book_outbox WHERE item_kind = 'fills' AND login = $1").bind(b).fetch_one(&rig.pool).await.unwrap();
    assert_eq!(one_item, 1, "one outbox item holds both legs of the client");
    let e = api::options_book::rfq_accept(State(st.clone()), rig.ctx(&tb), Path(rid.clone()), body(json!({"quoteId": quote["quoteId"], "side": "buy", "limitNet": qa.to_string()}))).await.unwrap_err();
    assert!(format!("{e:?}").contains("expired"), "a filled RFQ cannot be accepted twice: {e:?}");
    assert_eq!(rig.ledger_sum(&clearing).await, D::ZERO);

    // ---------------- 4. liquidation: book first, then the backstop ----------------
    // c sells puts to the MM's bid (opening margin), then loses most of its balance: past stop-out
    let put_bid = rig.options.top.get("kalks", AccountKind::Demo, &put).and_then(|t| t.bid).expect("an MM bid on the put");
    let mut sell = order(&put, "sell", "limit", 4, Some(put_bid.0), "c1");
    sell["tif"] = json!("ioc");
    let Json(sold) = api::options_book::place(State(st.clone()), rig.ctx(&tc), body(sell)).await.unwrap();
    eprintln!("c sells puts: {sold}");
    assert!(matches!(sold["status"].as_str(), Some("filled") | Some("partially_filled")), "{sold}");
    rig.drained().await;
    let short = -rig.book_pos(c).await.get(&put).copied().unwrap_or_default();
    assert!(short > D::ZERO);
    // b rests an offer inside the liquidation band: the liquidator buys there first
    let p3 = put.clone();
    let mark = hub
        .read(c, Box::new(move |x| {
            let (acc, env) = x.unwrap();
            let (t, _) = trading::engine::options_book::terms_of(&env.options.snapshot().unwrap(), &p3).unwrap();
            json!(trading::engine::options::mark_of(env, &acc.account, &t).unwrap().mark.to_string())
        }))
        .await;
    let mark: D = mark.as_str().unwrap().parse().unwrap();
    let tick = D::new(1, 5);
    let offer = (mark / tick).ceil() * tick + tick;
    let Json(ro) = api::options_book::place(State(st.clone()), rig.ctx(&tb), body(order(&put, "sell", "limit", 1, Some(offer), "b-offer"))).await.unwrap();
    assert_eq!(ro["status"], "working", "{ro}");
    let op: trading::shard::Op = Box::new(|tx, env| {
        let m = trading::engine::metrics(env, &tx.st);
        let cut = m.balance - m.margin * D::new(3, 1);
        trading::engine::funds::adjust(tx, env, trading::engine::funds::AdjustKind::Adjustment, -cut, "e2e-loss", "E2E", "simulated loss")?;
        trading::engine::risk::check_margin(tx, env);
        Ok(json!({"level": trading::engine::metrics(env, &tx.st).level.map(|l| l.to_string())}))
    });
    let d = hub.exec(c, "e2e", None, "", "", None, op).await.unwrap();
    eprintln!("c after the loss: {}", d.value);
    // the liquidator works through it
    let mut rows: Vec<Value> = vec![];
    for _ in 0..100 {
        tokio::time::sleep(Duration::from_millis(100)).await;
        let Json(l) = api::book_admin::liquidations(State(st.clone()), rig.staff("s1"), q(json!({"login": c}))).await.unwrap();
        rows = l["items"].as_array().cloned().unwrap_or_default();
        if rows.iter().any(|r| r["route"] == "backstop") || rig.book_pos(c).await.is_empty() {
            break;
        }
    }
    eprintln!("liquidation log {}", serde_json::to_string(&rows).unwrap());
    assert!(rows.iter().any(|r| r["route"] == "book" && r["qty"].as_f64().unwrap_or(0.0) >= 1.0), "book first: {rows:?}");
    rig.drained().await;
    let liq_fill: (String,) = sqlx::query_as("SELECT fill_kind FROM book_fills WHERE taker_login = $1 AND maker_login = $2 ORDER BY at DESC LIMIT 1").bind(c).bind(b).fetch_one(&rig.pool).await.unwrap();
    assert_eq!(liq_fill.0, "liquidation", "the tape flags the book step");
    let level = hub.read(c, Box::new(|x| { let (a, env) = x.unwrap(); json!(trading::engine::metrics(env, a).level.map(|l| l.to_string())) })).await;
    let still = rig.book_pos(c).await.get(&put).copied().unwrap_or_default();
    eprintln!("c after liquidation: level {level}, put position {still}");
    if still.is_zero() || rows.iter().any(|r| r["route"] == "backstop") {
        let bs: i64 = sqlx::query_scalar("SELECT count(*) FROM book_fills WHERE fill_kind = 'backstop' AND taker_login = $1 AND maker_login = $2").bind(c).bind(mm).fetch_one(&rig.pool).await.unwrap();
        assert!(bs >= 1 || rows.iter().all(|r| r["route"] != "backstop"), "the backstop traded with the MM");
    }
    assert_eq!(rig.ledger_sum(&clearing).await, D::ZERO);

    // ---------------- 5. bust (four-eyes) ----------------
    let (fid, taker, maker): (String, i64, i64) = sqlx::query_as("SELECT fill_id, taker_login, maker_login FROM book_fills WHERE taker_login = $1 AND fill_kind = 'book' ORDER BY at LIMIT 1").bind(b).fetch_one(&rig.pool).await.unwrap();
    let (pt, pm) = (rig.book_pos(taker).await, rig.book_pos(maker).await);
    let Json(b1) = api::book_admin::bust(State(st.clone()), rig.staff("s1"), Path(fid.clone()), body(json!({"reason": "off-market print (e2e)"}))).await.unwrap();
    assert_eq!(b1["status"], "pending_approval", "{b1}");
    let Json(ap) = api::book_admin::approvals(State(st.clone()), rig.staff("s2"), q(json!({"status": "pending"}))).await.unwrap();
    assert!(ap["items"].as_array().unwrap().iter().any(|x| x["target"] == fid.as_str()), "{ap}");
    let Json(b2) = api::book_admin::bust(State(st.clone()), rig.staff("s2"), Path(fid.clone()), body(json!({"reason": "confirmed", "approvalId": b1["approval"]["id"]}))).await.unwrap();
    eprintln!("bust {b2}");
    assert_eq!(b2["status"], "busted", "{b2}");
    rig.drained().await;
    let s3 = series.clone();
    let delta = |before: &std::collections::BTreeMap<String, D>, after: &std::collections::BTreeMap<String, D>| after.get(&s3).copied().unwrap_or_default() - before.get(&s3).copied().unwrap_or_default();
    assert_eq!(delta(&pt, &rig.book_pos(taker).await), D::from(-1), "the taker's buy is reversed");
    assert_eq!(delta(&pm, &rig.book_pos(maker).await), D::from(1), "the maker's sale is reversed");
    let keys: i64 = sqlx::query_scalar("SELECT count(*) FROM ledger_txns WHERE idempotency_key LIKE $1").bind(format!("bust:{fid}:%:prem")).fetch_one(&rig.pool).await.unwrap();
    assert_eq!(keys, 2, "both sides reversed with bust: keys");
    let e = api::book_admin::bust(State(st.clone()), rig.staff("s1"), Path(fid.clone()), body(json!({"reason": "again"}))).await.unwrap_err();
    assert!(format!("{e:?}").contains("already_busted"), "{e:?}");
    assert!(trading::book::reconcile(&hub, &h, &[]).await.is_none(), "book = accounts after the bust");

    // ---------------- 6. Back Office: monitors, halt / resume, MM pause / resume ----------------
    let Json(mon) = api::book_admin::books(State(st.clone()), rig.staff("s1"), q(json!({"kind": "demo"}))).await.unwrap();
    let eu = mon["books"].as_array().unwrap().iter().find(|x| x["underlying"] == "EURUSD").unwrap().clone();
    eprintln!("monitor EURUSD {eu}");
    assert!(mon["enabled"].as_bool() == Some(true) && eu["restingOrders"].as_u64().unwrap() > 0 && eu["clearingUsd"].as_f64() == Some(0.0), "{eu}");
    let Json(dp) = api::book_admin::depth(State(st.clone()), rig.staff("s1"), Path(series.clone()), q(json!({"kind": "demo"}))).await.unwrap();
    assert!(dp["audited"] == true && dp["bids"][0]["orders"][0]["mm"] == true, "depth with owners: {}", dp["bids"][0]);
    assert!(dp["trades"].as_array().unwrap().iter().any(|t| t["busted"] == true));
    let Json(hl) = api::book_admin::halt(State(st.clone()), rig.staff("s1"), body(json!({"kind": "demo", "scope": "series", "target": series, "mode": "halt", "reason": "e2e halt"}))).await.unwrap();
    let e = api::options_book::place(State(st.clone()), rig.ctx(&tb), body(order(&series, "buy", "limit", 1, Some(bid.0), "b-halted"))).await;
    let refused = match e {
        Ok(Json(v)) => v["status"] == "rejected",
        Err(_) => true,
    };
    assert!(refused, "a halted series refuses orders");
    let Json(_) = api::book_admin::unhalt(State(st.clone()), rig.staff("s1"), Path(hl["halt"]["id"].as_i64().unwrap()), q(json!({"reason": "e2e resume"}))).await.unwrap();
    let Json(_) = api::book_admin::mm_pause(State(st.clone()), rig.staff("s1"), Path("pause".into()), body(json!({"kind": "demo", "scope": "underlying", "target": "EURUSD", "reason": "e2e pause"}))).await.unwrap();
    trading::book::mm::pass(&st, 1, AccountKind::Demo).await.unwrap();
    rig.drained().await;
    assert!(rig.options.top.get("kalks", AccountKind::Demo, &series2).is_none_or(|t| t.bid.is_none() && t.ask.is_none()), "paused: the MM pulled its EURUSD quotes");
    let Json(_) = api::book_admin::mm_pause(State(st.clone()), rig.staff("s1"), Path("resume".into()), body(json!({"kind": "demo", "scope": "all", "reason": "e2e resume"}))).await.unwrap();
    let Json(rf) = api::book_admin::rfqs(State(st.clone()), rig.staff("s1"), q(json!({"kind": "demo"}))).await.unwrap();
    assert!(rf["recent"].as_array().unwrap().iter().any(|x| x["status"] == "filled"), "{rf}");
    let Json(cl) = api::book_admin::clearing(State(st.clone()), rig.staff("s1"), q(json!({"kind": "demo"}))).await.unwrap();
    assert!(cl["items"].as_array().unwrap().iter().all(|x| x["balanceUsd"].as_f64() == Some(0.0)), "{cl}");

    // ---------------- 7. money and replay ----------------
    let at = Utc::now().timestamp_millis();
    for l in [a, b, c] {
        for hd in hub.shared.books.handles() {
            let _ = trading::book::entry::call(&hub, l, &hd.key, Cmd::CancelAll { login: l, series: None, expiry: None, ephemeral_only: false, reason: "e2e end".into(), at }).await;
        }
    }
    rig.drained().await;
    for l in [a, b, c] {
        assert_eq!(rig.reserve(l).await, D::ZERO, "reserve 0 when idle ({l})");
    }
    rig.money_and_replay_ok(&[a, b, c, mm]).await;
    for (u, d) in [("EURUSD", rig.ledger_like("house:options_clearing.EURUSD.%").await)] {
        assert_eq!(d, D::ZERO, "{u} clearing nets to 0");
    }
    eprintln!("book MM / RFQ / liquidation / enable / bust e2e OK");
    rig.drop_db().await;
}
