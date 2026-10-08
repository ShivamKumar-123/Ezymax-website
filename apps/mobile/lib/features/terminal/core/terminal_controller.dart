// The account on screen, kept live (web: apps/terminal/lib/store.tsx engine mode). `GET trade/state` loads it, then
// the engine stream (EngineStream, a one-time ticket per connect) keeps it current: snapshot / position / order / deal /
// ledger / account / notification / equity frames; `resync` and `ended` reconnect with a fresh ticket. Ezymex FX Options
// entries (positions, orders and deals with `option`) are kept apart for the options mode. Engine notifications
// (SL / TP hits, pending fills, margin call, stop out, balance, corrections…) become top banners and land in the bell.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/notifications/notifications.dart';
import '../../../core/realtime/socket.dart';
import '../../../core/realtime/trade_streams.dart';
import '../../../env.dart';
import '../../../i18n/i18n.dart';
import '../preview/preview_server.dart';
import 'models.dart';
import 'sessions.dart';
import 'workspace.dart';

@immutable
class TerminalState {
  const TerminalState({
    this.login,
    this.account,
    this.readOnly = false,
    this.positions = const [],
    this.orders = const [],
    this.history = const [],
    this.live,
    this.synced = false,
    this.stream = SocketStatus.idle,
    this.optPositions = const [],
    this.optOrders = const [],
    this.optDeals = const [],
    this.error,
  });

  final String? login;
  final TAccount? account;

  /// Investor session: no trading.
  final bool readOnly;
  final List<TPosition> positions;
  final List<TOrder> orders;

  /// Closed trades, newest first.
  final List<TClosed> history;

  /// The engine's live numbers (equity frames); null until the first.
  final LiveEquity? live;

  /// The first state arrived.
  final bool synced;
  final SocketStatus stream;

  /// Ezymex FX Options entries (raw engine JSON, account currency), for the options mode.
  final List<Map<String, dynamic>> optPositions, optOrders, optDeals;
  final ApiException? error;

  Metrics get metrics => account == null ? Metrics.zero : Metrics.of(account!, live);

  /// Floating profit (USD) of a position: the engine's live value, else its last one.
  double profitOf(TPosition p) => live?.positions[p.ticket]?.profit ?? p.profit ?? 0;

  TerminalState copyWith({
    TAccount? account,
    bool? readOnly,
    List<TPosition>? positions,
    List<TOrder>? orders,
    List<TClosed>? history,
    LiveEquity? live,
    bool? synced,
    SocketStatus? stream,
    List<Map<String, dynamic>>? optPositions,
    List<Map<String, dynamic>>? optOrders,
    List<Map<String, dynamic>>? optDeals,
    ApiException? error,
    bool clearError = false,
  }) => TerminalState(
    login: login,
    account: account ?? this.account,
    readOnly: readOnly ?? this.readOnly,
    positions: positions ?? this.positions,
    orders: orders ?? this.orders,
    history: history ?? this.history,
    live: live ?? this.live,
    synced: synced ?? this.synced,
    stream: stream ?? this.stream,
    optPositions: optPositions ?? this.optPositions,
    optOrders: optOrders ?? this.optOrders,
    optDeals: optDeals ?? this.optDeals,
    error: clearError ? null : (error ?? this.error),
  );
}

class TerminalController extends Notifier<TerminalState> {
  EngineStream? _stream;
  int _snaps = 0;
  final StreamController<Map<String, dynamic>> _events = StreamController.broadcast();

  /// Every engine frame of the active account (the options mode listens for its own entries).
  Stream<Map<String, dynamic>> get frames => _events.stream;

  @override
  TerminalState build() {
    final key = ref.watch(activeTradeSessionProvider.select((s) => s == null ? null : (s.login, s.token)));
    ref.onDispose(_stop);
    final gen = ++_gen;
    if (key == null) return const TerminalState();
    final s = ref.read(activeTradeSessionProvider)!;
    Future.microtask(() => _start(s, gen));
    return TerminalState(login: s.login, account: s.account, readOnly: s.readOnly);
  }

  /// Bumped on every (re)build and dispose: callbacks of an older session or a disposed provider are ignored.
  int _gen = 0;

  void _stop() {
    _gen++;
    final st = _stream;
    _stream = null;
    st?.stop();
  }

  bool _current(String login, [int? gen]) => (gen == null || gen == _gen) && ref.mounted && state.login == login;

  Future<void> _start(TradeSession s, int gen) async {
    if (!_current(s.login, gen)) return;
    _snaps = 0;
    await reload();
    if (!_current(s.login, gen)) return;
    final api = ref.read(apiProvider);
    final stream = EngineStream(
      api: api,
      login: s.login,
      tradeToken: () => ref.read(tradeSessionsProvider).sessions[s.login]?.token ?? s.token,
      connector: ref.read(engineConnectorProvider),
      onStatus: (st) {
        if (_current(s.login, gen)) state = state.copyWith(stream: st);
      },
      onFrame: (type, f) {
        if (_current(s.login, gen)) _onFrame(s.login, type, f);
      },
      onSessionEnded: (reason) {
        if (_current(s.login, gen)) unawaited(_sessionEnded(s.login));
      },
    );
    _stream = stream;
    stream.start();
  }

  /// Back in the foreground: reconnect at once if the socket is down.
  void resume() => _stream?.resume();

  Future<void> _sessionEnded(String login) async {
    final fresh = await ref.read(tradeSessionsProvider.notifier).sessionEnded(login);
    if (fresh == null && _current(login)) {
      final t = ref.read(tProvider);
      ref
          .read(notificationsProvider.notifier)
          .toast(NotificationKind.warning, t('order.toast.sessionExpired'), description: t('order.toast.sessionExpiredDesc', {'login': login}));
    }
  }

  /// `GET trade/state`: the account, positions, orders and recent deals (also after a reconnect: deals closed while
  /// the socket was down only come with the full state).
  Future<void> reload() async {
    final login = state.login;
    final api = ref.read(tradeApiProvider);
    if (login == null || api == null) return;
    try {
      final st = await api.get<Map<String, dynamic>>('trade/state', query: {'historyLimit': 200});
      if (!_current(login)) return;
      _applyState(st);
    } on ApiException catch (e) {
      if (!_current(login)) return;
      if (e.isTradeSessionEnded || e.isTradeSessionForeign) {
        await _sessionEnded(login);
        return;
      }
      state = state.copyWith(error: e);
    }
  }

  void _applyState(Map<String, dynamic> st) {
    final accJson = st['account'] is Map ? (st['account'] as Map).cast<String, dynamic>() : null;
    final acc = accJson == null ? state.account : TAccount.fromJson(accJson);
    final cent = acc?.cent ?? false;
    final pos = _maps(st['positions']);
    final ord = _maps(st['orders']);
    final deals = _maps((st['history'] is Map ? (st['history'] as Map)['deals'] : null));
    state = state.copyWith(
      account: acc,
      readOnly: st['readOnly'] == true,
      positions: [for (final p in pos.where((p) => !isOptionEntry(p))) TPosition.fromJson(p, cent: cent)],
      orders: [for (final o in ord.where((o) => !isOptionEntry(o))) TOrder.fromJson(o)],
      history: mapHistory(deals.where((d) => !isOptionEntry(d)).toList(), cent: cent),
      optPositions: pos.where(isOptionEntry).toList(),
      optOrders: ord.where(isOptionEntry).toList(),
      optDeals: deals.where(isOptionEntry).toList(),
      live: acc == null ? null : LiveEquity.fromAccount(acc, state.live),
      synced: true,
      clearError: true,
    );
    if (acc != null) ref.read(tradeSessionsProvider.notifier).updateAccount(acc.login, acc, readOnly: st['readOnly'] == true);
  }

  static List<Map<String, dynamic>> _maps(Object? v) => [
    for (final x in (v is List ? v : const []))
      if (x is Map) x.cast<String, dynamic>(),
  ];

  void _onFrame(String login, EngineFrame type, Map<String, dynamic> f) {
    if (!_current(login)) return;
    _events.add(f);
    final cent = state.account?.cent ?? false;
    switch (type) {
      case EngineFrame.snapshot:
        _snaps++;
        final acc = f['account'] is Map ? TAccount.fromJson((f['account'] as Map).cast<String, dynamic>()) : state.account;
        final pos = _maps(f['positions']);
        final ord = _maps(f['orders']);
        state = state.copyWith(
          account: acc,
          readOnly: f['readOnly'] == true,
          positions: [for (final p in pos.where((p) => !isOptionEntry(p))) TPosition.fromJson(p, cent: acc?.cent ?? cent)],
          orders: [for (final o in ord.where((o) => !isOptionEntry(o))) TOrder.fromJson(o)],
          optPositions: pos.where(isOptionEntry).toList(),
          optOrders: ord.where(isOptionEntry).toList(),
          live: acc == null ? state.live : LiveEquity.fromAccount(acc, state.live),
          synced: true,
        );
        if (acc != null) ref.read(tradeSessionsProvider.notifier).updateAccount(login, acc, readOnly: f['readOnly'] == true);
        // a reconnect: deals closed while the socket was down only come with the full state
        if (_snaps > 1) unawaited(reload());
      case EngineFrame.position:
        if (f['op'] == 'remove') {
          final t = '${f['ticket']}';
          state = state.copyWith(
            positions: state.positions.where((p) => p.ticket != t).toList(),
            optPositions: state.optPositions.where((p) => '${p['ticket']}' != t).toList(),
          );
          return;
        }
        final raw = f['position'] is Map ? (f['position'] as Map).cast<String, dynamic>() : null;
        if (raw == null) return;
        if (isOptionEntry(raw)) {
          state = state.copyWith(optPositions: _upsert(state.optPositions, raw));
          return;
        }
        final p = TPosition.fromJson(raw, cent: cent);
        final list = [...state.positions];
        final i = list.indexWhere((x) => x.ticket == p.ticket);
        if (i >= 0) {
          list[i] = p;
        } else {
          list.add(p);
        }
        state = state.copyWith(positions: list);
      case EngineFrame.order:
        if (f['op'] == 'remove') {
          final t = '${f['ticket']}';
          state = state.copyWith(
            orders: state.orders.where((o) => o.ticket != t).toList(),
            optOrders: state.optOrders.where((o) => '${o['ticket']}' != t).toList(),
          );
          return;
        }
        final raw = f['order'] is Map ? (f['order'] as Map).cast<String, dynamic>() : null;
        if (raw == null) return;
        if (isOptionEntry(raw)) {
          state = state.copyWith(optOrders: _upsert(state.optOrders, raw));
          return;
        }
        final o = TOrder.fromJson(raw);
        final list = [...state.orders];
        final i = list.indexWhere((x) => x.ticket == o.ticket);
        if (i >= 0) {
          list[i] = o;
        } else {
          list.add(o);
        }
        state = state.copyWith(orders: list);
      case EngineFrame.deal:
        final d = f['deal'] is Map ? (f['deal'] as Map).cast<String, dynamic>() : null;
        if (d == null) return;
        if (isOptionEntry(d)) {
          state = state.copyWith(optDeals: [d, ...state.optDeals.where((x) => '${x['id']}' != '${d['id']}')]);
          return;
        }
        if (d['entry'] == 'in') return;
        // the position (still at its pre-close volume) carries the entry commission for the share
        final pos = state.positions.where((p) => p.ticket == '${d['positionTicket']}');
        final k = cent ? 100.0 : 1.0;
        final entry = pos.isEmpty
            ? const <Map<String, dynamic>>[]
            : [
                {...d, 'id': -1, 'entry': 'in', 'volume': pos.first.volume, 'commission': pos.first.commission * k, 'swap': 0, 'profit': 0},
              ];
        final rows = mapHistory([d, ...entry], cent: cent);
        state = state.copyWith(history: [...rows, ...state.history.where((h) => h.deal != '${d['id']}')]);
      case EngineFrame.account:
        final raw = f['account'] is Map ? (f['account'] as Map).cast<String, dynamic>() : null;
        if (raw == null) return;
        final acc = TAccount.fromJson(raw);
        state = state.copyWith(account: acc, live: LiveEquity.fromAccount(acc, state.live));
        ref.read(tradeSessionsProvider.notifier).updateAccount(login, acc);
      case EngineFrame.equity:
        state = state.copyWith(live: LiveEquity.fromFrame(f, cent: cent));
      case EngineFrame.notification:
        _notice(login, '${f['kind'] ?? ''}', '${f['message'] ?? ''}', f['data'] is Map ? (f['data'] as Map).cast<String, dynamic>() : const {});
      case EngineFrame.ledger:
      case EngineFrame.hb:
      case EngineFrame.resync:
      case EngineFrame.ended:
      case EngineFrame.unknown:
        break;
    }
  }

  static List<Map<String, dynamic>> _upsert(List<Map<String, dynamic>> list, Map<String, dynamic> x) {
    final out = [...list];
    final i = out.indexWhere((y) => '${y['ticket']}' == '${x['ticket']}');
    if (i >= 0) {
      out[i] = x;
    } else {
      out.add(x);
    }
    return out;
  }

  /// Server-side events become banners and land in the bell (web store onNotice). The terminal's own requests are
  /// confirmed by their action (fill / close / close_by frames are not repeated).
  void _notice(String login, String kind, String message, Map<String, dynamic> data) {
    final t = ref.read(tProvider);
    final n = ref.read(notificationsProvider.notifier);
    final ws = ref.read(workspaceProvider);
    void push(String title, String severity, {String category = 'trading_fills', String sound = 'fill'}) {
      n.push(title: title, body: message, severity: severity, category: category);
      if (severity == 'success') {
        KHapticsBridge.success();
      } else if (severity != 'info') {
        KHapticsBridge.error();
      }
      if (ws.sound) unawaited(SystemSound.play(sound == 'alert' ? SystemSoundType.alert : SystemSoundType.click));
    }

    switch (kind) {
      case 'fill':
      case 'close':
      case 'close_by':
        return;
      case 'sl':
        return push(t('order.toast.slTriggered'), 'warning', category: 'trading_alerts');
      case 'tp':
        return push(t('order.toast.tpTriggered'), 'success');
      case 'order_triggered':
        return push(t('order.toast.pendingTriggered'), 'success');
      case 'order_filled':
        return push(t('order.toast.pendingFilled'), 'success');
      case 'order_rejected':
        return push(t('order.toast.pendingRejected'), 'warning', category: 'trading_alerts');
      case 'order_expired':
        return push(t('order.toast.pendingExpired'), 'warning', category: 'trading_alerts');
      case 'margin_call':
        return push(t('order.toast.marginCall'), 'warning', category: 'trading_alerts', sound: 'alert');
      case 'stop_out':
        return push(t('order.toast.stopOut'), 'critical', category: 'trading_alerts', sound: 'alert');
      case 'balance':
        return push(t('order.toast.balanceOperation'), 'info', category: 'wallet');
      case 'correction':
        if (data['options'] == true || data['bust'] == true) {
          final m = RegExp(r'^([A-Z0-9]{3,12})-\d{8}-([0-9.]+)-([CP])').firstMatch('${data['series'] ?? ''}');
          final what = m == null ? '${data['series'] ?? ''}' : '${m[1]} ${m[2]} ${m[3] == 'C' ? t('trader.opt.call') : t('trader.opt.put')}';
          n.push(
            title: t('trader.opt.bust.title'),
            body: t('trader.opt.bust.text', {'what': what, 'n': '${data['contracts'] ?? ''}'}),
            severity: 'warning',
            category: 'trading_alerts',
          );
          return;
        }
        n.push(title: t('trader.inbox.cat.trading_alerts'), body: message, severity: 'warning', category: 'trading_alerts');
        return;
      default:
        if (message.isNotEmpty) n.push(title: message, banner: false);
    }
  }
}

/// Haptics without importing the design system into the core (the terminal's success / error feedback).
abstract final class KHapticsBridge {
  static void success() {
    if (!kIsWeb) HapticFeedback.mediumImpact().ignore();
  }

  static void error() {
    if (!kIsWeb) HapticFeedback.heavyImpact().ignore();
  }
}

final terminalProvider = NotifierProvider<TerminalController, TerminalState>(TerminalController.new);

/// How the account stream connects (previews and the in-app demo: the preview server; tests override it).
final engineConnectorProvider = Provider<SocketConnector?>((ref) => Env.preview || ref.watch(demoModeProvider) ? PreviewServer.instance.engineConnector : null);
