//! The options mark (docs/OPTIONS-EXCHANGE.md §6): the model mid clamped inside the order book's best bid / ask.
//!
//! * Both sides present with at least `min_qty` each, and the book spread at most `max_spread_mult` × the model
//!   spread: `clamp(model, bid, ask)`.
//! * Only the bid qualifies: `max(model, bid)`. Only the ask: `min(model, ask)`.
//! * Otherwise (no qualifying side, or both sides but the book spread is too wide): the model mid.
//!
//! The trading engine (equity, margin, stop-out, stop triggers, price bands) and the options service (the chain's
//! `mark`) both call [`clamp_mark`], so they always agree. Pure, no allocation.

/// One side of the top of book: best price and the quantity there (contracts).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct BookSide {
    pub price: f64,
    pub qty: f64,
}

/// Where the mark came from (callers holding exact decimals pick their own value of that source).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MarkSource {
    Model,
    Bid,
    Ask,
}

/// The clamped mark and its source. `model_spread` = model ask − model bid (same units as the prices).
/// Non-finite or non-positive book prices are ignored (treated as an empty side).
pub fn clamp_mark(model_mid: f64, model_spread: f64, bid: Option<BookSide>, ask: Option<BookSide>, min_qty: f64, max_spread_mult: f64) -> (f64, MarkSource) {
    let ok = |s: &Option<BookSide>| s.filter(|s| s.price.is_finite() && s.price > 0.0 && s.qty.is_finite() && s.qty >= min_qty.max(0.0) && s.qty > 0.0);
    let (bid, ask) = (ok(&bid), ok(&ask));
    match (bid, ask) {
        (Some(b), Some(a)) => {
            let spread = a.price - b.price;
            if model_spread.is_finite() && model_spread > 0.0 && spread <= max_spread_mult * model_spread {
                if model_mid < b.price {
                    (b.price, MarkSource::Bid)
                } else if model_mid > a.price {
                    (a.price, MarkSource::Ask)
                } else {
                    (model_mid, MarkSource::Model)
                }
            } else {
                (model_mid, MarkSource::Model)
            }
        }
        (Some(b), None) if model_mid < b.price => (b.price, MarkSource::Bid),
        (None, Some(a)) if model_mid > a.price => (a.price, MarkSource::Ask),
        _ => (model_mid, MarkSource::Model),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(price: f64, qty: f64) -> Option<BookSide> {
        Some(BookSide { price, qty })
    }

    #[test]
    fn clamps_inside_a_tight_book() {
        // model 10, book 11 / 12 (spread 1 <= 3 x model spread 2): clamped up to the bid
        assert_eq!(clamp_mark(10.0, 2.0, s(11.0, 5.0), s(12.0, 5.0), 1.0, 3.0), (11.0, MarkSource::Bid));
        assert_eq!(clamp_mark(13.0, 2.0, s(11.0, 5.0), s(12.0, 5.0), 1.0, 3.0), (12.0, MarkSource::Ask));
        assert_eq!(clamp_mark(11.5, 2.0, s(11.0, 5.0), s(12.0, 5.0), 1.0, 3.0), (11.5, MarkSource::Model));
    }

    #[test]
    fn wide_book_or_thin_sides_keep_the_model() {
        // spread 10 > 3 x 2: model
        assert_eq!(clamp_mark(10.0, 2.0, s(11.0, 5.0), s(21.0, 5.0), 1.0, 3.0), (10.0, MarkSource::Model));
        // both sides below min qty: model
        assert_eq!(clamp_mark(10.0, 2.0, s(11.0, 0.5), s(12.0, 0.5), 1.0, 3.0), (10.0, MarkSource::Model));
        // no book at all
        assert_eq!(clamp_mark(10.0, 2.0, None, None, 1.0, 3.0), (10.0, MarkSource::Model));
        // zero model spread never clamps two-sided
        assert_eq!(clamp_mark(10.0, 0.0, s(11.0, 5.0), s(12.0, 5.0), 1.0, 3.0), (10.0, MarkSource::Model));
    }

    #[test]
    fn one_sided_books() {
        assert_eq!(clamp_mark(10.0, 2.0, s(11.0, 5.0), None, 1.0, 3.0), (11.0, MarkSource::Bid));
        assert_eq!(clamp_mark(10.0, 2.0, s(9.0, 5.0), None, 1.0, 3.0), (10.0, MarkSource::Model));
        assert_eq!(clamp_mark(10.0, 2.0, None, s(9.0, 5.0), 1.0, 3.0), (9.0, MarkSource::Ask));
        assert_eq!(clamp_mark(10.0, 2.0, None, s(12.0, 5.0), 1.0, 3.0), (10.0, MarkSource::Model));
        // a thin ask with a qualifying bid: one-sided rule on the bid
        assert_eq!(clamp_mark(10.0, 2.0, s(11.0, 5.0), s(12.0, 0.1), 1.0, 3.0), (11.0, MarkSource::Bid));
    }

    #[test]
    fn mark_always_inside_a_qualifying_tight_book() {
        for m in [0.0, 5.0, 11.2, 50.0] {
            let (x, _) = clamp_mark(m, 2.0, s(11.0, 1.0), s(12.0, 1.0), 1.0, 3.0);
            assert!((11.0..=12.0).contains(&x));
        }
    }
}
