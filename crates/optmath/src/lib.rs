//! `optmath`: option pricing maths for Ezymex FX Options.
//!
//! Pure Rust, no dependencies, `f64` throughout. The trading engine and the
//! options service both use this crate so they always compute the same
//! numbers. See `README.md` for conventions.
//!
//! * [`normal`]: N(x), n(x), N^-1(p) (Cody / Acklam+Halley, ~1e-15).
//! * [`bsm`]: generalized Black-Scholes-Merton with cost of carry `b`, the
//!   Garman-Kohlhagen / Black-76 / Black-Scholes wrappers, closed-form Greeks.
//! * [`iv`]: implied volatility (Newton with bisection fallback).
//! * [`smile`]: FX smile from ATM + 25D/10D RR/BF, strike to vol.
//! * [`barrier`]: Reiner-Rubinstein single barriers with rebate.
//! * [`date`], [`calendar`]: civil dates, New York / London / Tokyo DST, holiday calendars, the
//!   daily / weekly / monthly expiry rules and the expiry cut.
//! * [`volclock`]: business-time vol clock (weekend / holiday weights).
//! * [`term`]: term structure in total variance with a calendar-arbitrage check.
//! * [`realized`]: Yang-Zhang, Garman-Klass, Rogers-Satchell, close-to-close and EWMA vol.
//! * [`ladder`], [`twap`], [`scenario`], [`payoff`]: strike ladder, fixing TWAP with gap accounting,
//!   SPAN-style 16-scenario grid, multi-leg payoff / breakevens.
//! * [`mark`]: the options mark, the model mid clamped inside the order book's best bid / ask.
//!
//! ```
//! use optmath::{OptionType::*, *};
//!
//! // EURUSD 3M call, GK.
//! let p = gk_price(Call, 1.10, 1.12, 0.25, 0.045, 0.03, 0.08);
//! let g = gk_greeks(Call, 1.10, 1.12, 0.25, 0.045, 0.03, 0.08);
//! assert_eq!(g.price, p);
//! let iv = gk_implied_vol(Call, p, 1.10, 1.12, 0.25, 0.045, 0.03).unwrap();
//! assert!((iv - 0.08).abs() < 1e-12);
//!
//! // Smile from ATM / RR / BF, then the vol for any strike.
//! let q = SmileQuotes { atm: 0.08, rr25: -0.006, bf25: 0.002, rr10: Some(-0.011), bf10: Some(0.007) };
//! let smile = Smile::new(q, 1.10, 0.25, 0.045, 0.03, DeltaConvention::Spot).unwrap();
//! let vol = smile.vol_at_strike(1.12);
//! assert!(vol > 0.07 && vol < 0.09);
//!
//! // Haug's down-and-out call with rebate.
//! let doc = barrier_price(Call, BarrierType::DownOut, 100.0, 90.0, 95.0, 3.0, 0.5, 0.08, 0.04, 0.25);
//! assert!((doc - 9.0246).abs() < 5e-5);
//! ```

pub mod barrier;
pub mod bsm;
pub mod calendar;
pub mod date;
pub mod iv;
pub mod ladder;
pub mod mark;
pub mod normal;
pub mod payoff;
pub mod realized;
pub mod scenario;
pub mod smile;
pub mod term;
pub mod twap;
pub mod volclock;

pub use barrier::{BarrierType, barrier_price};
pub use bsm::{
    Greeks, OptionType, black76_greeks, black76_price, bs_greeks, bs_price, gk_greeks, gk_price, greeks, price,
};
pub use iv::{IvError, black76_implied_vol, bs_implied_vol, gk_implied_vol, implied_vol};
pub use normal::{norm_cdf, norm_inv, norm_pdf};
pub use smile::{DeltaConvention, Smile, SmileError, SmileQuotes};
pub use calendar::{Cut, ExpiryKind, HolidayCalendar, expiry_dates, monthly_expiry, next_expiries, weekly_expiry};
pub use date::{Date, Weekday, Zone};
pub use term::{CalendarViolation, SurfaceError, TenorQuotes, VolSurface};
pub use volclock::{VolClock, calendar_years, effective_vol};
