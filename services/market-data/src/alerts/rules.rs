//! The pure part of price alerts: conditions, trigger prices, validation of a new level against the market, the
//! per-quote evaluation step and the notification text. No IO here, so every rule is unit-tested.

use crate::instruments::Instrument;

/// Smallest and largest move a % alert may watch.
pub const MIN_PCT: f64 = 0.01;
pub const MAX_PCT: f64 = 50.0;
/// A level more than this factor away from the market is a typo, not an alert (e.g. 108.5 for EURUSD).
pub const MAX_LEVEL_FACTOR: f64 = 10.0;
/// Longest a note can be (characters).
pub const NOTE_MAX: usize = 120;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Cond {
    /// The price rises to the level or above it.
    Above,
    /// The price falls to the level or below it.
    Below,
    /// The price rises by `value` percent from the reference.
    ChangeUp,
    /// The price falls by `value` percent from the reference.
    ChangeDown,
}

impl Cond {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "above" => Some(Self::Above),
            "below" => Some(Self::Below),
            "change_up" => Some(Self::ChangeUp),
            "change_down" => Some(Self::ChangeDown),
            _ => None,
        }
    }
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Above => "above",
            Self::Below => "below",
            Self::ChangeUp => "change_up",
            Self::ChangeDown => "change_down",
        }
    }
    /// A price level (as opposed to a % move).
    pub fn is_level(self) -> bool {
        matches!(self, Self::Above | Self::Below)
    }
    /// Fires on the way up.
    pub fn rising(self) -> bool {
        matches!(self, Self::Above | Self::ChangeUp)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Basis {
    Bid,
    Ask,
}

impl Basis {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "bid" => Some(Self::Bid),
            "ask" => Some(Self::Ask),
            _ => None,
        }
    }
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Bid => "bid",
            Self::Ask => "ask",
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            Self::Bid => "Bid",
            Self::Ask => "Ask",
        }
    }
}

/// The price that triggers: the level itself, or the reference moved by `value` percent, on the symbol's digits.
pub fn target_of(cond: Cond, value: f64, reference: f64, inst: &Instrument) -> f64 {
    match cond {
        Cond::Above | Cond::Below => inst.round(value),
        Cond::ChangeUp => inst.round(reference * (1.0 + value / 100.0)),
        Cond::ChangeDown => inst.round(reference * (1.0 - value / 100.0)),
    }
}

/// Why a new (or re-armed) alert can't be set against the current price.
#[derive(Clone, Debug, PartialEq)]
pub enum Refusal {
    /// `value` is not a usable number for this condition.
    Invalid(&'static str),
    /// The level is already reached: an "above" level at or under the price, a "below" level at or over it.
    Reached,
    /// The level is so far from the market it can only be a typo.
    TooFar,
}

/// Checks the value of an alert against the price it will be judged on (`price` = bid or ask of the client's group).
/// Levels must be on the right side of the market (so the alert fires when the price gets there, never at once);
/// % moves must be between MIN_PCT and MAX_PCT.
pub fn check(cond: Cond, value: f64, price: f64, inst: &Instrument) -> Result<(), Refusal> {
    if !value.is_finite() || value <= 0.0 {
        // a move is stored on two decimals, so 0.001 % arrives here as 0: name the bounds, not "above zero"
        return Err(Refusal::Invalid(if cond.is_level() { "Enter a price above zero." } else { "Enter a move between 0.01% and 50%." }));
    }
    if !cond.is_level() {
        if !(MIN_PCT..=MAX_PCT).contains(&value) {
            return Err(Refusal::Invalid("Enter a move between 0.01% and 50%."));
        }
        return Ok(());
    }
    let level = inst.round(value);
    if level <= 0.0 {
        return Err(Refusal::Invalid("Enter a price above zero."));
    }
    if price > 0.0 && (level > price * MAX_LEVEL_FACTOR || level < price / MAX_LEVEL_FACTOR) {
        return Err(Refusal::TooFar);
    }
    match cond {
        Cond::Above if level <= price => Err(Refusal::Reached),
        Cond::Below if level >= price => Err(Refusal::Reached),
        _ => Ok(()),
    }
}

/// What one quote does to one live alert.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Step {
    Hold,
    Fire,
    /// A repeating level alert whose price came back to the other side of the level: it can fire again.
    Rearm,
}

/// The part of a live alert the evaluation needs.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Watch {
    pub cond: Cond,
    pub target: f64,
    pub armed: bool,
    pub repeat: bool,
    /// ms since epoch; None = good until cancelled
    pub expires_ms: Option<i64>,
    /// ms since epoch of the last trigger; 0 = never
    pub last_fire_ms: i64,
}

/// Evaluates one alert on one price. Level alerts fire when the price reaches the level while armed; a repeating
/// one is disarmed by the trigger and re-armed once the price is back on the other side. % alerts fire when the
/// price reaches their target (a repeating one then gets a new reference, done by the caller). A repeating alert
/// never fires twice within `cooldown_ms`; an expired one never fires (the expiry sweep retires it).
pub fn step(w: &Watch, price: f64, now_ms: i64, cooldown_ms: i64) -> Step {
    if !(price > 0.0) || w.expires_ms.is_some_and(|e| now_ms >= e) {
        return Step::Hold;
    }
    let reached = if w.cond.rising() { price >= w.target } else { price <= w.target };
    if w.cond.is_level() && !w.armed {
        let back = if w.cond.rising() { price < w.target } else { price > w.target };
        return if back { Step::Rearm } else { Step::Hold };
    }
    if !reached {
        return Step::Hold;
    }
    if w.repeat && w.last_fire_ms > 0 && now_ms - w.last_fire_ms < cooldown_ms {
        return Step::Hold;
    }
    Step::Fire
}

/// A price with the symbol's digits.
pub fn px(v: f64, digits: u32) -> String {
    format!("{:.*}", digits as usize, v)
}

/// A percentage without trailing zeros ("1.5", "2", "0.25").
pub fn pct(v: f64) -> String {
    let s = format!("{:.2}", v);
    s.trim_end_matches('0').trim_end_matches('.').to_string()
}

/// Everything the notification text needs about one trigger.
pub struct Fired<'a> {
    pub symbol: &'a str,
    pub digits: u32,
    pub cond: Cond,
    pub value: f64,
    pub basis: Basis,
    pub reference: Option<f64>,
    pub target: f64,
    pub price: f64,
    pub repeat: bool,
    pub note: &'a str,
}

/// Title and body of the notification (English: the notifications service stores the text as sent).
pub fn message(f: &Fired) -> (String, String) {
    let d = f.digits;
    let title = match f.cond {
        Cond::Above => format!("{} rose above {}", f.symbol, px(f.target, d)),
        Cond::Below => format!("{} fell below {}", f.symbol, px(f.target, d)),
        Cond::ChangeUp => format!("{} up {}%", f.symbol, pct(f.value)),
        Cond::ChangeDown => format!("{} down {}%", f.symbol, pct(f.value)),
    };
    let mut parts = vec![format!("{} {}", f.basis.label(), px(f.price, d))];
    match (f.cond, f.reference) {
        (Cond::ChangeUp, Some(r)) => parts.push(format!("up from {}", px(r, d))),
        (Cond::ChangeDown, Some(r)) => parts.push(format!("down from {}", px(r, d))),
        _ => parts.push(format!("your alert at {}", px(f.target, d))),
    }
    if f.repeat {
        parts.push("repeating alert".into());
    }
    let note = f.note.trim();
    if !note.is_empty() {
        parts.push(note.to_string());
    }
    (title, parts.join(" · "))
}

/// A note as stored: trimmed, single line, no control characters, at most NOTE_MAX characters.
pub fn clean_note(raw: &str) -> String {
    raw.chars().map(|c| if c == '\n' || c == '\r' || c == '\t' { ' ' } else { c }).filter(|c| !c.is_control()).collect::<String>().trim().chars().take(NOTE_MAX).collect::<String>().trim().to_string()
}

/// A spread group code as the feed uses it (lower-case letters, digits, `_` and `-`).
pub fn clean_group(raw: &str) -> Option<String> {
    let g = raw.trim().to_ascii_lowercase();
    (!g.is_empty() && g.len() <= 32 && g.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '-')).then_some(g)
}

/// Delay before delivery attempt `attempts + 1` (5 s, 15 s, 45 s … capped at an hour).
pub fn retry_delay_secs(attempts: i32) -> i64 {
    let n = attempts.clamp(0, 10) as u32;
    (5 * 3i64.pow(n)).min(3600)
}

/// Constant-time comparison for the internal token.
pub fn same_secret(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::instruments::Provider;

    fn inst(symbol: &str, digits: u32) -> Instrument {
        Instrument { symbol: symbol.into(), asset_class: "metals".into(), digits, base_spread: 0.2, provider: Provider { market: "common".into(), code: symbol.into() }, session: None }
    }
    fn watch(cond: Cond, target: f64) -> Watch {
        Watch { cond, target, armed: true, repeat: false, expires_ms: None, last_fire_ms: 0 }
    }

    #[test]
    fn conditions_round_trip() {
        for c in [Cond::Above, Cond::Below, Cond::ChangeUp, Cond::ChangeDown] {
            assert_eq!(Cond::parse(c.as_str()), Some(c));
        }
        assert_eq!(Cond::parse("crosses"), None);
        assert_eq!(Basis::parse("ask"), Some(Basis::Ask));
        assert_eq!(Basis::parse("mid"), None);
        assert!(Cond::Above.is_level() && !Cond::ChangeUp.is_level());
        assert!(Cond::ChangeUp.rising() && !Cond::Below.rising());
    }

    #[test]
    fn targets_use_the_symbols_digits() {
        let gold = inst("XAUUSD", 2);
        assert_eq!(target_of(Cond::Above, 2700.504, 0.0, &gold), 2700.5);
        assert_eq!(target_of(Cond::ChangeUp, 2.0, 2650.0, &gold), 2703.0);
        assert_eq!(target_of(Cond::ChangeDown, 1.5, 2650.0, &gold), 2610.25);
        let eur = inst("EURUSD", 5);
        assert_eq!(target_of(Cond::ChangeUp, 0.5, 1.08, &eur), 1.0854);
    }

    #[test]
    fn a_level_must_be_on_the_far_side_of_the_market() {
        let gold = inst("XAUUSD", 2);
        assert_eq!(check(Cond::Above, 2700.0, 2650.0, &gold), Ok(()));
        assert_eq!(check(Cond::Above, 2650.0, 2650.0, &gold), Err(Refusal::Reached));
        assert_eq!(check(Cond::Above, 2600.0, 2650.0, &gold), Err(Refusal::Reached));
        assert_eq!(check(Cond::Below, 2600.0, 2650.0, &gold), Ok(()));
        assert_eq!(check(Cond::Below, 2650.001, 2650.0, &gold), Err(Refusal::Reached)); // rounds to the price
        assert_eq!(check(Cond::Above, 26000.0, 2650.0, &gold), Ok(()));
        assert_eq!(check(Cond::Above, 26600.0 * 2.0, 2650.0, &gold), Err(Refusal::TooFar));
        assert_eq!(check(Cond::Below, 200.0, 2650.0, &gold), Err(Refusal::TooFar));
        assert!(matches!(check(Cond::Above, f64::NAN, 2650.0, &gold), Err(Refusal::Invalid(_))));
        assert!(matches!(check(Cond::Below, -1.0, 2650.0, &gold), Err(Refusal::Invalid(_))));
        assert!(matches!(check(Cond::Below, 0.001, 2650.0, &gold), Err(Refusal::Invalid(_)))); // 0.00 on 2 digits
    }

    #[test]
    fn a_move_is_between_the_bounds() {
        let gold = inst("XAUUSD", 2);
        assert_eq!(check(Cond::ChangeUp, 0.01, 2650.0, &gold), Ok(()));
        assert_eq!(check(Cond::ChangeDown, 50.0, 2650.0, &gold), Ok(()));
        assert!(matches!(check(Cond::ChangeUp, 0.001, 2650.0, &gold), Err(Refusal::Invalid(_))));
        assert!(matches!(check(Cond::ChangeDown, 51.0, 2650.0, &gold), Err(Refusal::Invalid(_))));
        assert!(matches!(check(Cond::ChangeDown, 0.0, 2650.0, &gold), Err(Refusal::Invalid(_))));
    }

    #[test]
    fn a_one_shot_level_fires_when_the_price_gets_there() {
        let w = watch(Cond::Above, 2700.0);
        assert_eq!(step(&w, 2699.99, 1_000, 0), Step::Hold);
        assert_eq!(step(&w, 2700.0, 1_000, 0), Step::Fire);
        assert_eq!(step(&w, 2712.0, 1_000, 0), Step::Fire); // a gap through the level still counts
        let b = watch(Cond::Below, 2600.0);
        assert_eq!(step(&b, 2600.01, 1_000, 0), Step::Hold);
        assert_eq!(step(&b, 2599.5, 1_000, 0), Step::Fire);
        assert_eq!(step(&b, 0.0, 1_000, 0), Step::Hold); // no price
    }

    #[test]
    fn a_repeating_level_rearms_on_the_other_side_and_waits_for_the_cooldown() {
        let mut w = Watch { repeat: true, ..watch(Cond::Above, 2700.0) };
        assert_eq!(step(&w, 2701.0, 10_000, 60_000), Step::Fire);
        // fired: disarmed until the price is back under the level
        w.armed = false;
        w.last_fire_ms = 10_000;
        assert_eq!(step(&w, 2702.0, 11_000, 60_000), Step::Hold);
        assert_eq!(step(&w, 2700.0, 11_000, 60_000), Step::Hold); // at the level is not "back"
        assert_eq!(step(&w, 2699.0, 12_000, 60_000), Step::Rearm);
        w.armed = true;
        // back above within the cooldown: held; after it: fires
        assert_eq!(step(&w, 2701.0, 30_000, 60_000), Step::Hold);
        assert_eq!(step(&w, 2701.0, 70_001, 60_000), Step::Fire);
    }

    #[test]
    fn moves_fire_at_their_target() {
        let up = watch(Cond::ChangeUp, 2703.0);
        assert_eq!(step(&up, 2702.99, 1, 0), Step::Hold);
        assert_eq!(step(&up, 2703.0, 1, 0), Step::Fire);
        let down = Watch { armed: false, ..watch(Cond::ChangeDown, 2597.0) }; // armed doesn't apply to moves
        assert_eq!(step(&down, 2597.0, 1, 0), Step::Fire);
        assert_eq!(step(&down, 2600.0, 1, 0), Step::Hold);
    }

    #[test]
    fn an_expired_alert_never_fires() {
        let w = Watch { expires_ms: Some(5_000), ..watch(Cond::Above, 1.0) };
        assert_eq!(step(&w, 2.0, 4_999, 0), Step::Fire);
        assert_eq!(step(&w, 2.0, 5_000, 0), Step::Hold);
    }

    #[test]
    fn notification_text() {
        let f = Fired { symbol: "XAUUSD", digits: 2, cond: Cond::Above, value: 2700.5, basis: Basis::Bid, reference: None, target: 2700.5, price: 2700.62, repeat: false, note: "" };
        assert_eq!(message(&f), ("XAUUSD rose above 2700.50".to_string(), "Bid 2700.62 · your alert at 2700.50".to_string()));
        let f = Fired { cond: Cond::Below, basis: Basis::Ask, repeat: true, note: " breakdown watch ", ..f };
        assert_eq!(message(&f).0, "XAUUSD fell below 2700.50");
        assert_eq!(message(&f).1, "Ask 2700.62 · your alert at 2700.50 · repeating alert · breakdown watch");
        let f = Fired { symbol: "EURUSD", digits: 5, cond: Cond::ChangeUp, value: 1.5, basis: Basis::Bid, reference: Some(1.08), target: 1.0962, price: 1.09623, repeat: false, note: "" };
        assert_eq!(message(&f), ("EURUSD up 1.5%".to_string(), "Bid 1.09623 · up from 1.08000".to_string()));
        let f = Fired { cond: Cond::ChangeDown, value: 2.0, reference: Some(1.1), ..f };
        assert_eq!(message(&f).0, "EURUSD down 2%");
        assert!(message(&f).1.contains("down from 1.10000"));
    }

    #[test]
    fn inputs_are_cleaned() {
        assert_eq!(clean_note("  Breakout\nwatch\u{7}  "), "Breakout watch");
        assert_eq!(clean_note(&"x".repeat(300)).chars().count(), NOTE_MAX);
        assert_eq!(clean_group(" Standard "), Some("standard".into()));
        assert_eq!(clean_group("pro-2"), Some("pro-2".into()));
        assert_eq!(clean_group("a b"), None);
        assert_eq!(clean_group(""), None);
        assert_eq!(pct(2.0), "2");
        assert_eq!(pct(0.25), "0.25");
        assert_eq!(pct(1.50), "1.5");
    }

    #[test]
    fn retries_back_off_to_an_hour() {
        assert_eq!(retry_delay_secs(0), 5);
        assert_eq!(retry_delay_secs(1), 15);
        assert_eq!(retry_delay_secs(2), 45);
        assert_eq!(retry_delay_secs(9), 3600);
        assert_eq!(retry_delay_secs(-3), 5);
    }

    #[test]
    fn secrets_compare_exactly() {
        assert!(same_secret(b"abc", b"abc"));
        assert!(!same_secret(b"abc", b"abd"));
        assert!(!same_secret(b"abc", b"ab"));
        assert!(!same_secret(b"", b"x"));
    }
}
