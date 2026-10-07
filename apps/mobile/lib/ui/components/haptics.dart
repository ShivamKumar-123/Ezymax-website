import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// iOS-style haptics (Android maps them to its own vibration effects). Taps on controls: [tap]; switches and
/// segments: [selection]; a trade filled or a sheet confirming money: [success]; refused: [error].
abstract final class KHaptics {
  static void tap() => _run(HapticFeedback.lightImpact);
  static void selection() => _run(HapticFeedback.selectionClick);
  static void medium() => _run(HapticFeedback.mediumImpact);
  static void success() => _run(HapticFeedback.mediumImpact);
  static void error() => _run(HapticFeedback.heavyImpact);

  static void _run(Future<void> Function() f) {
    if (kIsWeb) return;
    f().ignore();
  }
}
