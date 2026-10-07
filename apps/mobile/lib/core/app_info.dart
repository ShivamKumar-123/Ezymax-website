import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// The app's version and the phone it runs on, read once at start-up.
class AppInfo {
  const AppInfo({required this.version, required this.build, required this.osVersion, required this.model});

  /// "1.0.0"
  final String version;

  /// "1"
  final String build;

  /// "Android 15"
  final String osVersion;

  /// "Pixel 8"
  final String model;

  /// X-Kalks-App-Version: "1.0.0+1".
  String get fullVersion => build.isEmpty ? version : '$version+$build';

  /// The User-Agent the Security page lists: "KalksApp/1.0.0 (Android 15; Pixel 8)".
  String get userAgent => 'KalksApp/$version ($osVersion; $model)';

  static const AppInfo fallback = AppInfo(version: '1.0.0', build: '1', osVersion: 'Android', model: 'Phone');

  static Future<AppInfo> load() async {
    var version = fallback.version, build = fallback.build, os = fallback.osVersion, model = fallback.model;
    try {
      final p = await PackageInfo.fromPlatform();
      version = p.version.isEmpty ? version : p.version;
      build = p.buildNumber;
    } catch (_) {}
    try {
      if (kIsWeb) {
        os = 'Web';
        model = 'Preview';
      } else if (defaultTargetPlatform == TargetPlatform.android) {
        final a = await DeviceInfoPlugin().androidInfo;
        os = 'Android ${a.version.release}';
        model = a.model.toLowerCase().startsWith(a.manufacturer.toLowerCase()) ? a.model : '${a.manufacturer} ${a.model}';
      }
    } catch (_) {}
    return AppInfo(version: version, build: build, osVersion: os, model: model);
  }
}

/// Overridden in main().
final appInfoProvider = Provider<AppInfo>((ref) => AppInfo.fallback);
