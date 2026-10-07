import 'dart:math' as math;

/// Reconnect delays: exponential from `first` up to `max`, with ±`jitter` randomness so phones don't reconnect in
/// lock-step after an outage. docs/MOBILE-API.md §7: 1 s -> 20 s for the ticketed streams; market data retries
/// faster (250 ms -> 2 s, like the web price feed).
class Backoff {
  Backoff({this.first = const Duration(seconds: 1), this.max = const Duration(seconds: 20), this.jitter = 0.25, math.Random? random})
    : _random = random ?? math.Random();

  final Duration first;
  final Duration max;

  /// 0.25 = up to 25 % shorter or longer.
  final double jitter;
  final math.Random _random;
  int _attempt = 0;

  int get attempt => _attempt;

  /// The wait before the next try (and counts it).
  Duration next() {
    final base = first.inMilliseconds * math.pow(2, math.min(_attempt, 16));
    _attempt++;
    final capped = math.min(base.toDouble(), max.inMilliseconds.toDouble());
    final factor = 1 - jitter + _random.nextDouble() * 2 * jitter;
    return Duration(milliseconds: math.min(capped * factor, max.inMilliseconds * (1 + jitter)).round());
  }

  /// A connection worked: start from `first` again.
  void reset() => _attempt = 0;
}
