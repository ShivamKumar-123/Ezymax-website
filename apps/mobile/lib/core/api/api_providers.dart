import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../env.dart';
import '../../i18n/i18n.dart';
import '../../preview/preview_adapter.dart';
import '../app_info.dart';
import '../auth/auth_controller.dart';
import '../auth/secure_store.dart';
import '../prefs.dart';
import 'api_client.dart';

export 'api_client.dart';
export 'api_error.dart';

/// The current gateway session token, written by the auth controller and read by every request.
class SessionHolder {
  String? token;
}

final sessionHolderProvider = Provider<SessionHolder>((ref) => SessionHolder());

/// The in-app demo ("Try the demo" on the sign-in page): the app runs on the sample data of a preview build, inside
/// the app, until Log out. Read from the preferences before the first request, so a restart lands in the demo again.
class DemoMode extends Notifier<bool> {
  @override
  bool build() => ref.read(prefsProvider).demo;

  Future<void> set(bool v) async {
    state = v;
    await ref.read(prefsProvider).setDemo(v);
  }
}

final demoModeProvider = NotifierProvider<DemoMode, bool>(DemoMode.new);

/// The transport: Dio's default, the sample-data adapter in previews and the demo, a fake in tests (override).
/// `apiProvider` watches it, so every API client is rebuilt when the demo starts or ends.
final httpAdapterProvider = Provider<HttpClientAdapter?>((ref) => Env.preview || ref.watch(demoModeProvider) ? PreviewAdapter() : null);

/// The API base (`--dart-define=EZYMEX_API_BASE`; override in tests).
final apiBaseProvider = Provider<String>((ref) => Env.apiBase);

/// The broker's maintenance mode was reported by an API call (503 maintenance).
class MaintenanceFlag extends Notifier<bool> {
  @override
  bool build() => false;
  void set(bool v) => state = v;
}

final maintenanceProvider = NotifierProvider<MaintenanceFlag, bool>(MaintenanceFlag.new);

/// API calls answered 403 module_disabled (a count): the broker switched a module off after the config was read, so
/// the config controller reads it again and the module disappears.
class ModuleDisabledSignal extends Notifier<int> {
  @override
  int build() => 0;
  void hit() => state++;
}

final moduleDisabledProvider = NotifierProvider<ModuleDisabledSignal, int>(ModuleDisabledSignal.new);

final apiProvider = Provider<ApiClient>((ref) {
  final holder = ref.watch(sessionHolderProvider);
  final store = ref.watch(sessionStoreProvider);
  final info = ref.watch(appInfoProvider);
  return ApiClient(
    baseUrl: ref.watch(apiBaseProvider),
    adapter: ref.watch(httpAdapterProvider),
    context: ApiContext(
      token: () => holder.token,
      deviceId: store.deviceId,
      locale: () => ref.read(localeProvider),
      appVersion: info.fullVersion,
      userAgent: info.userAgent,
    ),
    onSessionDead: (_) => ref.read(authProvider.notifier).sessionEnded(),
    onMaintenance: (_) => ref.read(maintenanceProvider.notifier).set(true),
    onModuleDisabled: (_) => ref.read(moduleDisabledProvider.notifier).hit(),
    onDeviceMinted: store.setDeviceId,
  );
});
