import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';

/// Biometric unlock (fingerprint, face, or the phone's screen lock as a fallback) through the system prompt.
/// The web preview and tests have no biometrics: [available] answers false there.
abstract class Biometrics {
  Future<bool> available();

  /// True when the person unlocked; false when they cancelled or failed.
  Future<bool> authenticate(String reason);
}

class LocalBiometrics implements Biometrics {
  final LocalAuthentication _auth = LocalAuthentication();

  @override
  Future<bool> available() async {
    if (kIsWeb) return false;
    try {
      return await _auth.isDeviceSupported() && (await _auth.canCheckBiometrics || (await _auth.getAvailableBiometrics()).isNotEmpty);
    } catch (_) {
      return false;
    }
  }

  @override
  Future<bool> authenticate(String reason) async {
    if (kIsWeb) return false;
    try {
      // the screen lock (PIN, pattern) stays allowed as the fallback, like banking apps
      return await _auth.authenticate(localizedReason: reason, persistAcrossBackgrounding: true);
    } catch (_) {
      return false;
    }
  }
}

/// Always unavailable (web preview, tests).
class NoBiometrics implements Biometrics {
  const NoBiometrics({this.result = false});
  final bool result;

  @override
  Future<bool> available() async => result;

  @override
  Future<bool> authenticate(String reason) async => result;
}

final biometricsProvider = Provider<Biometrics>((ref) => kIsWeb ? const NoBiometrics() : LocalBiometrics());
