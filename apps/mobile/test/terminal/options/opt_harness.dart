// A harness for the options mode: a provider container on the preview trade server (lib/features/terminal/preview)
// and the preview options server (lib/features/terminal/options/options_preview.dart), the account and market streams
// on silent sockets, the options stream on the preview's in-memory socket, toasts recorded, English texts.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:ezymex/core/api/api_providers.dart';
import 'package:ezymex/core/app_info.dart';
import 'package:ezymex/core/auth/secure_store.dart';
import 'package:ezymex/core/notifications/notifications.dart';
import 'package:ezymex/core/prefs.dart';
import 'package:ezymex/features/terminal/core/market.dart';
import 'package:ezymex/features/terminal/core/terminal_controller.dart';
import 'package:ezymex/features/terminal/options/core/store.dart';
import 'package:ezymex/features/terminal/options/options_preview.dart';
import 'package:ezymex/i18n/i18n.dart';
import 'package:ezymex/preview/preview_adapter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class _SilentSink implements WebSocketSink {
  _SilentSink(this.onClose);
  final void Function() onClose;

  @override
  void add(Object? data) {}
  @override
  void addError(Object error, [StackTrace? stackTrace]) {}
  @override
  Future<void> addStream(Stream<Object?> stream) async {}
  @override
  Future<void> close([int? closeCode, String? closeReason]) async => onClose();
  @override
  Future<void> get done => Future<void>.value();
}

/// A socket that opens and stays quiet (the account and market streams of the tests).
class SilentChannel implements WebSocketChannel {
  SilentChannel(Uri _) {
    sink = _SilentSink(() {
      if (!_in.isClosed) unawaited(_in.close());
    });
  }
  // closed by the sink
  // ignore: close_sinks
  final StreamController<Object?> _in = StreamController<Object?>();
  @override
  // closed by the socket under test
  // ignore: close_sinks
  late final WebSocketSink sink;
  @override
  Stream<Object?> get stream => _in.stream;
  @override
  Future<void> get ready => Future<void>.value();
  @override
  String? get protocol => null;
  @override
  int? get closeCode => null;
  @override
  String? get closeReason => null;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// Records toasts and engine notifications (no banners, no bell storage).
class RecordedNotes extends NotificationsController {
  final List<({NotificationKind kind, String title, String? description})> toasts = [];

  @override
  NotificationsState build() => const NotificationsState(loaded: true);

  @override
  void push({required String title, String body = '', String severity = 'info', String category = 'trading_fills', String? link, bool banner = true}) {}

  @override
  void toast(NotificationKind kind, String title, {String? description, bool keep = true}) => toasts.add((kind: kind, title: title, description: description));
}

Messages catalog(String code) => (jsonDecode(File('assets/i18n/$code.json').readAsStringSync()) as Map).cast<String, Object?>();

Future<ProviderContainer> optionsContainer({List<Override> extra = const []}) async {
  SharedPreferences.setMockInitialValues({'ezymex.locale': 'en'});
  final prefs = await Prefs.open();
  final en = catalog('en');
  return ProviderContainer(
    overrides: [
      prefsProvider.overrideWithValue(prefs),
      i18nBootProvider.overrideWithValue(I18nBundle(locale: 'en', english: en, messages: en)),
      appInfoProvider.overrideWithValue(const AppInfo(version: '1.0.0', build: '1', osVersion: 'Android 15', model: 'Pixel 8')),
      secureStoreProvider.overrideWithValue(MemorySecureStore({'ezymex.device': 'test-device-0000000000'})),
      httpAdapterProvider.overrideWithValue(PreviewAdapter(latency: Duration.zero)),
      notificationsProvider.overrideWith(RecordedNotes.new),
      engineConnectorProvider.overrideWithValue(SilentChannel.new),
      marketConnectorProvider.overrideWithValue(SilentChannel.new),
      optionsPreviewOverlayProvider.overrideWithValue(true),
      optionsConnectorProvider.overrideWithValue(PreviewOptions.instance.connector),
      ...extra,
    ],
  );
}

/// Waits (real time) until `ok` holds.
Future<void> until(bool Function() ok, {Duration timeout = const Duration(seconds: 8)}) async {
  final end = DateTime.now().add(timeout);
  while (!ok()) {
    if (DateTime.now().isAfter(end)) throw TimeoutException('condition not met');
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
}

bool _fonts = false;

/// The terminal's fonts, so widget tests lay out real text widths.
Future<void> loadFonts() async {
  if (_fonts) return;
  _fonts = true;
  Future<void> family(String name, List<String> files) async {
    final loader = FontLoader(name);
    for (final f in files) {
      loader.addFont(rootBundle.load(f));
    }
    await loader.load();
  }

  const w = ['Regular', 'Medium', 'SemiBold', 'Bold'];
  await family('Geist', [for (final x in w) 'assets/fonts/Geist-$x.ttf']);
  await family('GeistMono', [for (final x in w) 'assets/fonts/GeistMono-$x.ttf']);
  await family('packages/lucide_icons_flutter/Lucide', ['packages/lucide_icons_flutter/assets/lucide.ttf']);
}
