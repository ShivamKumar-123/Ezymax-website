# optmath

Option pricing maths for **Kalks FX Options**. It is pure Rust with no dependencies (proptest is a dev-dependency only) and uses `f64` throughout. The trading engine and the options service (`services/options`) both depend on this crate, so they always compute the same numbers.

## Conventions

- Time `t` is in **years**. Rates and vols are annual, continuously compounded decimals (`0.05` = 5%).
- Everything goes through generalized Black-Scholes-Merton with **cost of carry `b`**:

  | model | function | `b` | underlying |
  |---|---|---|---|
  | Garman-Kohlhagen (FX) | `gk_*` | `rd - rf` | spot; premium in quote ccy per 1 base |
  | Black-76 (oil futures) | `black76_*` | `0` | forward / future |
  | Black-Scholes (metals) | `bs_*` | `r - q` | spot, `q` = lease / dividend yield |
  | generic | `price`, `greeks`, `implied_vol` | any | |

- **Greeks** (`Greeks` struct): `delta` = dV/dS, `gamma`, `vega` = dV/dσ per 1.00 of vol (divide by 100 for per vol point), `theta` = −dV/dT **per year** (divide by 365 or your day count), `rho` = dV/dr (domestic), `phi` = dV/dq (rho-foreign / dividend). In the generic `greeks`, `rho` holds `q = r − b` fixed and `phi = −dV/db`. In `black76_greeks`, delta and gamma are with respect to the forward, `rho = −t·V` (F fixed), and `phi = 0`. GK delta is the spot delta `e^{-rf t} N(d1)`.
- **Edge cases**: `t == 0` or `σ == 0` gives the discounted intrinsic value of the forward. Invalid inputs (spot/strike ≤ 0, negative t or σ, non-finite) return `NaN`. Nothing panics.

## API

```rust
use optmath::{OptionType::*, *};

let p = gk_price(Call, 1.10, 1.12, 0.25, 0.045, 0.03, 0.08);            // GK premium
let g = gk_greeks(Put, 1.10, 1.12, 0.25, 0.045, 0.03, 0.08);            // g.delta, g.gamma, ...
let f = black76_price(Call, 78.5, 80.0, 0.3, 0.05, 0.35);               // oil
let m = bs_price(Put, 2350.0, 2400.0, 0.1, 0.045, 0.01, 0.16);          // gold, q = lease rate
let iv = gk_implied_vol(Call, p, 1.10, 1.12, 0.25, 0.045, 0.03)?;       // -> 0.08
let doc = barrier_price(Call, BarrierType::DownOut, 100.0, 90.0, 95.0, 3.0, 0.5, 0.08, 0.04, 0.25);

let smile = Smile::new(
    SmileQuotes { atm: 0.08, rr25: -0.006, bf25: 0.002, rr10: Some(-0.011), bf10: Some(0.007) },
    1.10, 0.25, 0.045, 0.03, DeltaConvention::Spot,
)?;
let vol = smile.vol_at_strike(1.12);
```

| module | contents |
|---|---|
| `normal` | `norm_pdf`, `norm_cdf` (Cody's algorithm, ~1e-15 relative error including the tails), `norm_inv` (Acklam's approximation plus one Halley step) |
| `bsm` | `OptionType`, `Greeks`, `price`, `greeks`, `d1_d2`, `forward`, and the `gk_*` / `bs_*` / `black76_*` wrappers |
| `iv` | `implied_vol` (Newton on vega inside a bisection bracket, vol in [1e-8, 20]) plus model wrappers; returns `IvError` when the price is below intrinsic, above the maximum, or the input is invalid |
| `smile` | `Smile::new(quotes, spot, t, rd, rf, convention)`, `vol_at_call_delta`, `vol_at_strike`, `strike_at_call_delta`, `atm_strike`, `pillars` |
| `barrier` | `barrier_price(kind, BarrierType, s, k, h, rebate, t, r, b, σ)`: Reiner-Rubinstein, all 8 types |
| `date` | `Date` (days since 1970, `parse`, `ymd`, `weekday`, `nth_weekday`, `last_weekday`), `Zone` (UTC / New York / London / Tokyo with DST: `local_to_unix_ms`, `offset_minutes_at`, `local_date`) |
| `calendar` | `HolidayCalendar` (`union`, `is_business_day`, `adjust_preceding`, `add_business_days`), `ExpiryKind`, `expiry_dates`, `next_expiries`, `weekly_expiry`, `monthly_expiry`, `Cut` (default `Cut::NY10`, `instant_ms(date)`) |
| `volclock` | `VolClock` (weighted trading days, 17:00 NY roll), `vol_years`, `calendar_years`, `effective_vol`, `rates_in_vol_time` |
| `term` | `VolSurface` (ATM in total variance, RR/BF linear in t, calendar-arbitrage check), `TenorQuotes`, `calendar_violations` |
| `realized` | `Ohlc`, `yang_zhang`, `garman_klass`, `rogers_satchell`, `close_to_close`, `ewma` |
| `ladder` | `ladder`, `extension`, `strike_ticks`, `tick_to_strike`, `format_strike`, `step_decimals` |
| `twap` | `twap(samples, start, end, interval, prior)` with gap accounting, `twap_bars` (M1 fallback) |
| `scenario` | `scenario_grid(positions, Market, ScanParams)`: 16 SPAN scenarios, worst loss |
| `payoff` | `payoff(legs, s)`, `summarize(legs)`: breakevens, max profit / loss (`None` = unlimited) |

### Calendar and business time

- **Expiries.**
  - Daily: every business day.
  - Weekly: the Friday of each week.
  - Monthly: the last Friday of the month.
  - A weekly or monthly date that is not a business day rolls to the **previous** business day, never into the previous week.
  - A pair's calendar is the union of both currencies and USD (`HolidayCalendar::union`). Weekends are always closed.
- **Cut.** Local wall time in a `Zone`. 10:00 New York is 14:00 UTC in summer and 15:00 UTC in winter; US and EU DST are handled separately (e.g. 9–29 March 2026).
- **Vol clock.** Trading days run 17:00 → 17:00 New York, so Monday's day starts on Sunday at 17:00.
  - Weights: business day 1, Saturday / Sunday `weekend_weight` (default 0.15), holiday `holiday_weight` (0.5), plus optional per-day overrides for event days.
  - `vol_years` is the weighted fraction of days crossed divided by `365·5/7 + 365·2/7·weekend_weight`.
  - Carry and discounting stay on ACT/365 calendar time. Price with `price(.., t_cal, r, b, effective_vol(σ, t_vol, t_cal))`. This is exact because BSM depends only on `r·t`, `b·t` and `σ²t`.
  - To build a smile in vol time, pass `t_vol` and the rates from `rates_in_vol_time` so the forward and the spot-delta discounting stay exact.

### Term structure, realized vol, TWAP, scenarios

- **Term structure.**
  - ATM is linear in total variance `σ²t`, with flat vol outside the pillars. RR/BF are linear in `t`; 10D only when both neighbours quote it.
  - Calendar arbitrage = total variance falling between pillars, checked for ATM and for each wing at fixed delta. `VolSurface::new` rejects it with `SurfaceError::CalendarArbitrage`.
- **Realized vol.** Annualized with `periods_per_year` (260 for daily FX).
  - Yang-Zhang is gap-aware (weekends / overnight) and needs ≥ 3 bars.
  - Garman-Klass and Rogers-Satchell ignore opening gaps.
  - EWMA is seeded with the mean of the first ≤ 10 squared returns.
  - Invalid bars return `None`.
- **TWAP.** The time average of the "last sample at or before t" step function over `[start, end)`:
  - Before the first sample it uses the prior mid, or back-fills (`backfilled_ms`).
  - `coverage` is the share of `interval` slots with a sample; `max_gap_ms` includes the window edges.
  - `twap_bars` weights each bar's `(O+H+L+C)/4` by its overlap with the window.
- **Scenario grid.** CME-style 16 scenarios:
  - price 0, ±⅓, ±⅔, ±1 × R, each with vol up and down;
  - ±`extreme_multiple`·R at `extreme_cover` (3×, 35%);
  - every scenario valued after `dt_cal` / `dt_vol` (one business day).
  - Positions are in units of the underlying (contracts × size): vanilla, Reiner-Rubinstein barrier, or linear.
  - Expired legs are valued at intrinsic; a breached knock-out pays its rebate.
  - `worst_loss = max(0, max weighted loss)`.
- **Payoff.** Vanilla and linear legs, piecewise linear at expiry, so breakevens and extremes are exact (barriers are path-dependent and not handled).

### Smile conventions

- Pillars use the simple strangle approximation: `σ(25Δ call/put) = ATM + BF25 ± RR25/2`, and the same for 10Δ (optional, only used when both RR10 and BF10 are given).
- ATM is the delta-neutral straddle (`d1 = 0`, `K = F·e^{σ²t/2}`).
- Deltas are **not premium-adjusted**. They are quoted as spot (`e^{-rf t}N(d1)`, the default) or forward (`N(d1)`) delta. USD/JPY-style premium-adjusted deltas are not modelled yet.
- Interpolation is monotone cubic (Fritsch-Carlson) in forward call delta `N(d1)`. It never overshoots the pillar vols, and it is flat beyond the outer pillars.
- Strike → vol solves the fixed point `σ = smile(N(d1(K, σ)))` by iteration, falling back to bisection, which always converges.

### Barriers

- Haug §4.17.1 (Reiner-Rubinstein), with continuous monitoring.
- A knock-out pays its rebate **at the hit**. A knock-in that never knocks in pays its rebate **at expiry**.
- If the barrier is already breached, a knock-out is worth its rebate and a knock-in is worth the vanilla.
- With negative rates and low vol (`μ² + 2r/σ² < 0`), a knock-out with a **non-zero** rebate returns `NaN`. Without a rebate, rates of either sign work.

## Tests

`cargo test -p optmath` covers:

- Golden values from Haug, *The Complete Guide to Option Pricing Formulas*: GK, Black-76, BS, generalized and Merton prices; delta, gamma, theta and rho examples; 19 rows of the barrier table (S=100, rebate 3).
- Put-call parity on a grid that includes negative rates.
- Closed-form Greeks checked against finite differences for GK, BS and Black-76.
- Implied-vol round trips from 1 day to 5 years and from 2% to 150% vol.
- Knock-in + knock-out = vanilla (no rebate), including negative rates.
- Smile checks: pillar vols reproduced, no overshoot, DNS ATM, and the pillar strikes giving the quoted deltas.
- `tests/calendar_time.rs`:
  - golden checks: civil dates, New York / London DST offsets and transitions, the DST-aware 10:00 NY cut;
  - daily / weekly / monthly expiries over Good Friday, TARGET2 May 1, Thanksgiving and Christmas;
  - vol-clock weights (weekend, holiday, 23 h DST day, event override);
  - properties: vol time is additive and monotone; business-time pricing equals rescaled rates; the cut is always 10:00 NY local; expiries are ordered business days.
- `tests/risk_toolkit.rs`:
  - term structure: total-variance interpolation, calendar-arbitrage rejection (ATM and wing), monotone total variance (property);
  - realized vol: Garman-Klass / Rogers-Satchell golden values, recovery of simulated GBM vol (Yang-Zhang sees overnight gaps, GK does not), EWMA, scale invariance (property);
  - strike ladder: golden values; extension restores a contiguous ladder (property);
  - TWAP: constant, ramp, 10-minute gap, prior / back-fill, M1 bars; the result stays within the sample range (property);
  - scenario grid: linear worst loss = 1.05 R, a long option never loses more than its value, expiring legs, a knocked-out barrier, antisymmetry, a hedged synthetic forward has no risk (properties);
  - payoff: long call, short put, straddle, iron condor, covered call; breakevens are zeros and the extremes bound the payoff (property).
