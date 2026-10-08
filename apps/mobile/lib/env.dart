/// Build-time configuration (`--dart-define`). Everything else comes from `GET /api/mobile/config` at run time.
///
///   flutter run                                                     production API
///   flutter run --dart-define=EZYMEX_API_BASE=http://127.0.0.1:3000/api/mobile    a local Client Area (adb reverse)
///   flutter run -d chrome --dart-define=EZYMEX_PREVIEW=true          design preview on sample data (no network)
abstract final class Env {
  /// The Client Area's mobile API (docs/MOBILE-API.md). The app talks to this one server only.
  static const String apiBase = String.fromEnvironment('EZYMEX_API_BASE', defaultValue: 'https://app.ezymex.com/api/mobile');

  /// Development previews (web screenshots, golden tests): every API call is answered from sample data
  /// (lib/preview/), sign-in accepts any password and code. Never set in a build that ships.
  static const bool preview = bool.fromEnvironment('EZYMEX_PREVIEW');

  /// `X-Ezymex-Platform`: recorded on orders and sign-up attribution.
  static const String platform = 'android';
}
