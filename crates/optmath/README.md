# optmath

Option pricing maths for **Kalks FX Options**. It is pure Rust with no dependencies and uses `f64` throughout. The trading engine and the options service will both depend on this crate, so they always compute the same numbers. No service uses it yet.

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

`CARGO_TARGET_DIR=target/optmath cargo test -p optmath` covers:

- Golden values from Haug, *The Complete Guide to Option Pricing Formulas*: GK, Black-76, BS, generalized and Merton prices; delta, gamma, theta and rho examples; 19 rows of the barrier table (S=100, rebate 3).
- Put-call parity on a grid that includes negative rates.
- Closed-form Greeks checked against finite differences for GK, BS and Black-76.
- Implied-vol round trips from 1 day to 5 years and from 2% to 150% vol.
- Knock-in + knock-out = vanilla (no rebate), including negative rates.
- Smile checks: pillar vols reproduced, no overshoot, DNS ATM, and the pillar strikes giving the quoted deltas.

## Not yet here

The plan also lists these for this crate:

- term structure in total variance
- a business-time vol clock
- realized vol (Yang-Zhang, Garman-Klass, EWMA)
- an expiry calendar, strike ladder and TWAP
- a SPAN-style scenario grid
