// A Ezymex Trader test harness: a provider container on the preview trade server (lib/features/terminal/preview), with
// the account stream on a fake socket the test drives, notifications recorded instead of shown, and English texts.
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
import 'package:ezymex/i18n/i18n.dart';
import 'package:ezymex/preview/preview_adapter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class FakeSink implements WebSocketSink {
  FakeSink(this.onClose);
  final void Function() onClose;
  final List<Object?> sent = [];

  @override
  void add(Object? data) => sent.add(data);
  @override
  void addError(Object error, [StackTrace? stackTrace]) {}
  @override
  Future<void> addStream(Stream<Object?> stream) async {}
  @override
  Future<void> close([int? closeCode, String? closeReason]) async => onClose();
  @override
  Future<void> get done => Future<void>.value();
}

class FakeChannel implements WebSocketChannel {
  FakeChannel(this.url) {
    sink = FakeSink(() {
      if (!_in.isClosed) unawaited(_in.close());
    });
  }
  final Uri url;
  // closed by the sink or drop()
  // ignore: close_sinks
  final StreamController<Object?> _in = StreamController<Object?>();
  @override
  // closed by the socket under test
  // ignore: close_sinks
  late final FakeSink sink;
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

  void push(Map<String, Object?> frame) => _in.add(jsonEncode(frame));

  List<Map<String, dynamic>> get frames => [for (final s in sink.sent) jsonDecode(s! as String) as Map<String, dynamic>];

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// Records engine notifications and toasts (no banners, no bell storage).
class RecordingNotifications extends NotificationsController {
  final List<({String title, String body, String severity})> pushed = [];
  final List<({NotificationKind kind, String title, String? description})> toasts = [];

  @override
  NotificationsState build() => const NotificationsState(loaded: true);

  @override
  void push({required String title, String body = '', String severity = 'info', String category = 'trading_fills', String? link, bool banner = true}) =>
      pushed.add((title: title, body: body, severity: severity));

  @override
  void toast(NotificationKind kind, String title, {String? description, bool keep = true}) => toasts.add((kind: kind, title: title, description: description));
}

Messages catalog(String code) => (jsonDecode(File('assets/i18n/$code.json').readAsStringSync()) as Map).cast<String, Object?>();

/// The container, the engine sockets opened so far, and the notifications recorded.
class Harness {
  Harness(this.container, this.engines);
  final ProviderContainer container;
  final List<FakeChannel> engines;

  RecordingNotifications get notes => container.read(notificationsProvider.notifier) as RecordingNotifications;

  static Future<Harness> create({List<Override> extra = const []}) async {
    SharedPreferences.setMockInitialValues({'ezymex.locale': 'en'});
    final prefs = await Prefs.open();
    final en = catalog('en');
    final engines = <FakeChannel>[];
    final c = ProviderContainer(
      overrides: [
        prefsProvider.overrideWithValue(prefs),
        i18nBootProvider.overrideWithValue(I18nBundle(locale: 'en', english: en, messages: en)),
        appInfoProvider.overrideWithValue(const AppInfo(version: '1.0.0', build: '1', osVersion: 'Android 15', model: 'Pixel 8')),
        secureStoreProvider.overrideWithValue(MemorySecureStore({'ezymex.device': 'test-device-0000000000'})),
        httpAdapterProvider.overrideWithValue(PreviewAdapter(latency: Duration.zero)),
        notificationsProvider.overrideWith(RecordingNotifications.new),
        engineConnectorProvider.overrideWithValue((uri) {
          final ch = FakeChannel(uri);
          engines.add(ch);
          return ch;
        }),
        marketConnectorProvider.overrideWithValue(FakeChannel.new),
        ...extra,
      ],
    );
    return Harness(c, engines);
  }
}

/// Waits (real time) until `ok` holds.
Future<void> until(bool Function() ok, {Duration timeout = const Duration(seconds: 5)}) async {
  final end = DateTime.now().add(timeout);
  while (!ok()) {
    if (DateTime.now().isAfter(end)) throw TimeoutException('condition not met');
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
}

bool _fonts = false;

/// The app's fonts (Geist, Geist Mono, Lucide), so widget tests lay out real text widths (the test font is wider).
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

/// Quotes that never move.
class FixedFeed extends MarketFeed {
  FixedFeed(this.quotes) : super(wsUrl: 'ws://test', httpUrl: 'http://test', symbols: const []);
  final Map<String, TQuote> quotes;

  @override
  TQuote? quote(String symbol) => quotes[symbol];

  @override
  double? bidOf(String symbol) => quotes[symbol]?.bid;

  @override
  void Function() subscribe(Iterable<String> symbols, TQuoteListener fn) {
    for (final s in symbols) {
      final q = quotes[s];
      if (q != null) fn(q);
    }
    return () {};
  }

  @override
  void want(String owner, Iterable<String> symbols) {}

  /// Fixed quotes need no socket.
  @override
  void start() {}

  @override
  Future<List<Candle>> candles(String symbol, String tf, {int limit = 1000, int? to}) async => const [];
}

TQuote q(String s, double bid, double ask) => TQuote(symbol: s, bid: bid, ask: ask, last: (bid + ask) / 2, change: 0.4, dir: 0, delayed: false, time: 0);
