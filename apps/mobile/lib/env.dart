/// Build-time configuration (`--dart-define`). Everything else comes from `GET /api/mobile/config` at run time.
///
///   flutter run                                                     production API
///   flutter run --dart-define=KALKS_API_BASE=http://127.0.0.1:3000/api/mobile    a local Client Area (adb reverse)
///   flutter run -d chrome --dart-define=KALKS_PREVIEW=true          design preview on sample data (no network)
abstract final class Env {
  /// The Client Area's mobile API (docs/MOBILE-API.md). The app talks to this one server only.
  static const String apiBase = String.fromEnvironment('KALKS_API_BASE', defaultValue: 'https://app.kalkstrade.com/api/mobile');

  /// Development previews (web screenshots, golden tests): every API call is answered from sample data
  /// (lib/preview/), sign-in accepts any password and code. Never set in a build that ships.
  static const bool preview = bool.fromEnvironment('KALKS_PREVIEW');

  /// `X-Kalks-Platform`: recorded on orders and sign-up attribution.
  static const String platform = 'android';
}
