// Secrets on the device: the gateway session, the trade tokens and the device id. Android keeps them encrypted with
// a key in the Android Keystore (flutter_secure_storage). The web preview falls back to memory if the browser's
// storage is unavailable, so previews still run.
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

abstract class SecureStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class KeystoreSecureStore implements SecureStore {
  KeystoreSecureStore() : _s = const FlutterSecureStorage();
  final FlutterSecureStorage _s;
  final Map<String, String> _fallback = {};

  @override
  Future<String?> read(String key) async {
    try {
      return await _s.read(key: key);
    } catch (_) {
      return _fallback[key];
    }
  }

  @override
  Future<void> write(String key, String value) async {
    try {
      await _s.write(key: key, value: value);
    } catch (_) {
      _fallback[key] = value;
    }
  }

  @override
  Future<void> delete(String key) async {
    _fallback.remove(key);
    try {
      await _s.delete(key: key);
    } catch (_) {}
  }
}

/// Tests and previews.
class MemorySecureStore implements SecureStore {
  MemorySecureStore([Map<String, String>? initial]) : values = {...?initial};
  final Map<String, String> values;

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async => values[key] = value;

  @override
  Future<void> delete(String key) async => values.remove(key);
}

/// The gateway session (docs/MOBILE-API.md §1): opaque, 7 days, no refresh token.
class Session {
  const Session({required this.token, required this.expiresAt});
  final String token;
  final DateTime expiresAt;

  /// A view-only login (D90): tokens start with "v.".
  bool get viewOnly => token.startsWith('v.');

  bool expiredAt(DateTime now) => !expiresAt.isAfter(now);

  Map<String, Object> toJson() => {'token': token, 'expires_at': expiresAt.toUtc().toIso8601String()};

  static Session? fromJson(Object? j) {
    if (j is! Map) return null;
    final token = j['token'];
    final exp = DateTime.tryParse('${j['expires_at']}');
    if (token is! String || token.isEmpty) return null;
    return Session(token: token, expiresAt: exp ?? DateTime.now().add(const Duration(days: 7)));
  }
}

/// Reads and writes the secrets. The device id survives sign-out (the gateway trusts a device after its first email
/// code); everything else is wiped on sign-out.
class SessionStore {
  SessionStore(this._s);
  final SecureStore _s;

  static const _kSession = 'ezymex.session';
  static const _kUser = 'ezymex.user';
  static const _kDevice = 'ezymex.device';
  static const _kTrade = 'ezymex.trade';

  Future<Session?> readSession() async {
    final raw = await _s.read(_kSession);
    if (raw == null) return null;
    try {
      return Session.fromJson(jsonDecode(raw));
    } catch (_) {
      return null;
    }
  }

  Future<void> writeSession(Session s) => _s.write(_kSession, jsonEncode(s.toJson()));

  /// The last `me` answer (the client's record), so a locked or offline start can show the name.
  Future<Map<String, dynamic>?> readUser() async {
    final raw = await _s.read(_kUser);
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<void> writeUser(Map<String, dynamic> u) => _s.write(_kUser, jsonEncode(u));

  String? _device;

  /// X-Ezymex-Device: minted on the first launch (a UUID, 36 base64url-safe characters) and kept for the install.
  Future<String> deviceId() async {
    if (_device != null) return _device!;
    var id = await _s.read(_kDevice);
    if (id == null || !RegExp(r'^[A-Za-z0-9_-]{16,128}$').hasMatch(id)) {
      id = const Uuid().v4();
      await _s.write(_kDevice, id);
    }
    return _device = id;
  }

  /// The server minted a device id (first sign-in call without one): keep it.
  Future<void> setDeviceId(String id) async {
    if (!RegExp(r'^[A-Za-z0-9_-]{16,128}$').hasMatch(id)) return;
    _device = id;
    await _s.write(_kDevice, id);
  }

  /// Ezymex Trader tokens per login (X-Ezymex-Trade), from trade/sessions or trade/login.
  Future<Map<String, String>> tradeTokens() async {
    final raw = await _s.read(_kTrade);
    if (raw == null) return {};
    try {
      return (jsonDecode(raw) as Map).map((k, v) => MapEntry('$k', '$v'));
    } catch (_) {
      return {};
    }
  }

  Future<void> setTradeToken(String login, String? token) async {
    final all = await tradeTokens();
    if (token == null) {
      all.remove(login);
    } else {
      all[login] = token;
    }
    await _s.write(_kTrade, jsonEncode(all));
  }

  /// Sign-out: the session, the client's record and every trade token go; the device id stays.
  Future<void> clear() async {
    await _s.delete(_kSession);
    await _s.delete(_kUser);
    await _s.delete(_kTrade);
  }
}

/// Overridden in main() (tests: a MemorySecureStore).
final secureStoreProvider = Provider<SecureStore>((ref) => KeystoreSecureStore());
final sessionStoreProvider = Provider<SessionStore>((ref) => SessionStore(ref.watch(secureStoreProvider)));
