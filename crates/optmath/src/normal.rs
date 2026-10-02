//! Standard normal density, distribution and quantile functions.
//!
//! `norm_cdf` is W. J. Cody's rational Chebyshev algorithm (the ANORM routine
//! from netlib SPECFUN, also used by R's `pnorm`). It is accurate to about
//! 1e-15 relative error over the whole real line, including the far tails,
//! because the tail branches compute the small tail probability directly
//! instead of as `1 - something`.
//!
//! `norm_inv` is Acklam's rational approximation polished with one Halley
//! step against `norm_cdf`, which brings it to near machine precision.

/// 1 / sqrt(2 * pi)
pub const INV_SQRT_2PI: f64 = 0.398_942_280_401_432_7;

/// Standard normal probability density n(x).
#[inline]
pub fn norm_pdf(x: f64) -> f64 {
    INV_SQRT_2PI * (-0.5 * x * x).exp()
}

const A: [f64; 5] = [
    2.235_252_035_460_683_9,
    161.028_231_068_555_88,
    1_067.689_485_460_370_9,
    18_154.981_253_343_56,
    0.065_682_337_918_207_45,
];
const B: [f64; 4] = [
    47.202_581_904_688_24,
    976.098_551_737_776_7,
    10_260.932_208_618_978,
    45_507.789_335_026_73,
];
const C: [f64; 9] = [
    0.398_941_512_088_134_67,
    8.883_149_794_388_376,
    93.506_656_132_177_86,
    597.270_276_394_800_3,
    2_494.537_585_290_372_7,
    6_848.190_450_536_282,
    11_602.651_437_647_35,
    9_842.714_838_383_978,
    1.076_557_677_372_019_2e-8,
];
const D: [f64; 8] = [
    22.266_688_044_328_116,
    235.387_901_782_625,
    1_519.377_599_407_554_8,
    6_485.558_298_266_761,
    18_615.571_640_885_1,
    34_900.952_721_145_98,
    38_912.003_286_093_27,
    19_685.429_676_859_99,
];
const P: [f64; 6] = [
    0.215_898_534_057_957,
    0.127_401_161_160_247_36,
    0.022_235_277_870_649_807,
    0.001_421_619_193_227_893_5,
    2.911_287_495_116_879e-5,
    0.023_073_441_764_940_174,
];
const Q: [f64; 5] = [
    1.284260096144911,
    0.468_238_212_480_865_1,
    0.065_988_137_868_928_55,
    0.003_782_396_332_027_582_4,
    7.297_515_550_839_662e-5,
];

/// Splits `exp(-x^2/2)` as `exp(-xs^2/2) * exp(-del/2)` with `xs` = x truncated
/// to 1/16, which avoids cancellation error in the exponent (Cody).
#[inline]
fn gauss_tail_factor(x: f64) -> f64 {
    let xsq = (x * 16.0).trunc() / 16.0;
    let del = (x - xsq) * (x + xsq);
    (-xsq * xsq * 0.5).exp() * (-del * 0.5).exp()
}

/// Standard normal cumulative distribution N(x) = P(Z <= x).
pub fn norm_cdf(x: f64) -> f64 {
    if x.is_nan() {
        return f64::NAN;
    }
    let y = x.abs();
    if y <= 0.674_489_75 {
        let (xnum, xden) = if y > 1.11e-16 {
            let xsq = x * x;
            let mut xnum = A[4] * xsq;
            let mut xden = xsq;
            for (a, b) in A.iter().zip(&B).take(3) {
                xnum = (xnum + a) * xsq;
                xden = (xden + b) * xsq;
            }
            (xnum, xden)
        } else {
            (0.0, 0.0)
        };
        return 0.5 + x * (xnum + A[3]) / (xden + B[3]);
    }
    // Lower tail probability Q = N(-|x|).
    let tail = if y <= 32f64.sqrt() {
        let mut xnum = C[8] * y;
        let mut xden = y;
        for (c, d) in C.iter().zip(&D).take(7) {
            xnum = (xnum + c) * y;
            xden = (xden + d) * y;
        }
        let r = (xnum + C[7]) / (xden + D[7]);
        gauss_tail_factor(y) * r
    } else if y < 38.5 {
        let xsq = 1.0 / (x * x);
        let mut xnum = P[5] * xsq;
        let mut xden = xsq;
        for (p, q) in P.iter().zip(&Q).take(4) {
            xnum = (xnum + p) * xsq;
            xden = (xden + q) * xsq;
        }
        let r = xsq * (xnum + P[4]) / (xden + Q[4]);
        let r = (INV_SQRT_2PI - r) / y;
        gauss_tail_factor(y) * r
    } else {
        0.0
    };
    if x > 0.0 { 1.0 - tail } else { tail }
}

/// Inverse of the standard normal CDF: returns x with N(x) = p.
///
/// Returns `-inf` for p = 0, `+inf` for p = 1 and NaN outside [0, 1].
pub fn norm_inv(p: f64) -> f64 {
    if p.is_nan() || !(0.0..=1.0).contains(&p) {
        return f64::NAN;
    }
    if p == 0.0 {
        return f64::NEG_INFINITY;
    }
    if p == 1.0 {
        return f64::INFINITY;
    }
    const AA: [f64; 6] = [
        -3.969_683_028_665_376e1,
        2.209_460_984_245_205e2,
        -2.759_285_104_469_687e2,
        1.383_577_518_672_69e2,
        -3.066_479_806_614_716e1,
        2.506_628_277_459_239,
    ];
    const BB: [f64; 5] = [
        -5.447_609_879_822_406e1,
        1.615_858_368_580_409e2,
        -1.556_989_798_598_866e2,
        6.680_131_188_771_972e1,
        -1.328_068_155_288_572e1,
    ];
    const CC: [f64; 6] = [
        -7.784_894_002_430_293e-3,
        -3.223_964_580_411_365e-1,
        -2.400_758_277_161_838,
        -2.549_732_539_343_734,
        4.374_664_141_464_968,
        2.938_163_982_698_783,
    ];
    const DD: [f64; 4] = [
        7.784_695_709_041_462e-3,
        3.224_671_290_700_398e-1,
        2.445_134_137_142_996,
        3.754_408_661_907_416,
    ];
    const P_LOW: f64 = 0.024_25;
    let tail = |q: f64| {
        (((((CC[0] * q + CC[1]) * q + CC[2]) * q + CC[3]) * q + CC[4]) * q + CC[5])
            / ((((DD[0] * q + DD[1]) * q + DD[2]) * q + DD[3]) * q + 1.0)
    };
    let mut x = if p < P_LOW {
        tail((-2.0 * p.ln()).sqrt())
    } else if p <= 1.0 - P_LOW {
        let q = p - 0.5;
        let r = q * q;
        (((((AA[0] * r + AA[1]) * r + AA[2]) * r + AA[3]) * r + AA[4]) * r + AA[5]) * q
            / (((((BB[0] * r + BB[1]) * r + BB[2]) * r + BB[3]) * r + BB[4]) * r + 1.0)
    } else {
        -tail((-2.0 * (1.0 - p).ln()).sqrt())
    };
    // One Halley refinement step. In the upper tail work with the complement
    // so the residual is not swamped by rounding of values near 1.
    let e = if x > 0.0 {
        (1.0 - p) - norm_cdf(-x)
    } else {
        norm_cdf(x) - p
    };
    let u = e / norm_pdf(x);
    x -= u / (1.0 + 0.5 * x * u);
    x
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rel(a: f64, b: f64) -> f64 {
        if b == 0.0 { a.abs() } else { ((a - b) / b).abs() }
    }

    #[test]
    fn cdf_reference_values() {
        // Reference values: 0.5 * erfc(-x / sqrt 2) in high precision.
        let cases = [
            (0.0, 0.5),
            (0.5, 0.691_462_461_274_013_1),
            (1.0, 0.841_344_746_068_542_9),
            (-1.0, 0.158_655_253_931_457_05),
            (2.0, 0.977_249_868_051_820_8),
            (-2.0, 0.022_750_131_948_179_21),
            (-3.0, 0.001_349_898_031_630_094_6),
            (-5.0, 2.866_515_718_791_939e-7),
            (-6.0, 9.86587645037698e-10),
            (-8.0, 6.220_960_574_271_784e-16),
            (-10.0, 7.619_853_024_160_527e-24),
            (-20.0, 2.753_624_118_606_233_6e-89),
        ];
        for (x, want) in cases {
            let got = norm_cdf(x);
            assert!(rel(got, want) < 5e-15, "N({x}) = {got:e}, want {want:e}");
        }
    }

    #[test]
    fn cdf_symmetry_and_limits() {
        for i in -60..=60 {
            let x = i as f64 * 0.1;
            assert!((norm_cdf(x) + norm_cdf(-x) - 1.0).abs() < 1e-15);
        }
        assert_eq!(norm_cdf(f64::INFINITY), 1.0);
        assert_eq!(norm_cdf(f64::NEG_INFINITY), 0.0);
        assert!(norm_cdf(f64::NAN).is_nan());
    }

    #[test]
    fn inverse_round_trip() {
        for &p in &[1e-300, 1e-12, 1e-6, 0.001, 0.02425, 0.1, 0.25, 0.5, 0.75, 0.9, 0.975, 0.999] {
            let x = norm_inv(p);
            assert!(rel(norm_cdf(x), p) < 1e-13, "p={p} x={x}");
        }
        assert!((norm_inv(0.975) - 1.959_963_984_540_054).abs() < 1e-14);
        assert_eq!(norm_inv(0.5), 0.0);
        assert!(norm_inv(1.5).is_nan());
    }
}
