// CSS `color-mix(in oklab, A p%, B)`: how the web derives every tint from the tenant brand colour (pastel washes,
// soft fills, account cards). Porting the maths keeps a white-label broker's colours identical in the app.
import 'dart:math' as math;
import 'dart:ui';

double _toLinear(double c) => c <= 0.04045 ? c / 12.92 : math.pow((c + 0.055) / 1.055, 2.4).toDouble();
double _toSrgb(double c) => c <= 0.0031308 ? 12.92 * c : 1.055 * math.pow(c, 1 / 2.4) - 0.055;
double _cbrt(double x) => x < 0 ? -math.pow(-x, 1 / 3).toDouble() : math.pow(x, 1 / 3).toDouble();

/// sRGB -> OKLab (L, a, b).
List<double> toOklab(Color c) {
  final r = _toLinear(c.r), g = _toLinear(c.g), b = _toLinear(c.b);
  final l = _cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  final m = _cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  final s = _cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

/// OKLab -> sRGB (clamped to the gamut).
Color fromOklab(double lightness, double a, double b, [double alpha = 1]) {
  final l = math.pow(lightness + 0.3963377774 * a + 0.2158037573 * b, 3).toDouble();
  final m = math.pow(lightness - 0.1055613458 * a - 0.0638541728 * b, 3).toDouble();
  final s = math.pow(lightness - 0.0894841775 * a - 1.2914855480 * b, 3).toDouble();
  double ch(double v) => _toSrgb(v).clamp(0.0, 1.0);
  return Color.from(
    alpha: alpha.clamp(0.0, 1.0),
    red: ch(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    green: ch(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    blue: ch(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  );
}

/// `color-mix(in oklab, a p%, b)` with `p` in 0..1 (the share of `a`). Alpha is premultiplied as in CSS, so mixing
/// with `transparent` gives `a` at p opacity.
Color mixOklab(Color a, Color b, double p) {
  final w = p.clamp(0.0, 1.0);
  final alpha = a.a * w + b.a * (1 - w);
  if (alpha <= 0) return const Color(0x00000000);
  final la = toOklab(a), lb = toOklab(b);
  final out = List<double>.generate(3, (i) => (la[i] * a.a * w + lb[i] * b.a * (1 - w)) / alpha);
  return fromOklab(out[0], out[1], out[2], alpha);
}

/// Parses "#rrggbb" (tenant config colours); null when malformed.
Color? parseHex(String? hex) {
  if (hex == null) return null;
  final m = RegExp(r'^#?([0-9a-fA-F]{6})$').firstMatch(hex.trim());
  return m == null ? null : Color(0xFF000000 | int.parse(m.group(1)!, radix: 16));
}
