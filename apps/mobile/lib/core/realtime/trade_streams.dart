// Kalks Trader streams, for the terminal screens (docs/MOBILE-API.md §6–7; web: apps/terminal/lib/engine/stream.ts and
// lib/options/stream.ts).
//
// EngineStream: one per open trading account. `POST trade/stream-ticket` (with X-Kalks-Trade) -> {ticket, url};
// open url?ticket= within 30 s. Every (re)connect starts with a `snapshot` frame, so state resyncs by construction.
// Frames: snapshot / position / order / deal / ledger / account / notification / equity / hb / resync / ended.
// `resync` and `ended` reconnect with a fresh ticket; a 401 from the ticket call means the trade session is over
// (call trade/sessions again for an own account, or ask for the password): onSessionEnded.
//
// OptionsStream: the option chain. `POST trade/options/stream-ticket` -> {ticket, url}. After each (re)connect it
// re-sends the chain, series, depth and tape subscriptions. 404 options_disabled = "launching soon": retry quietly.
import '../api/api_client.dart';
import '../api/api_error.dart';
import 'backoff.dart';
import 'socket.dart';

/// Engine frame types.
enum EngineFrame { snapshot, position, order, deal, ledger, account, notification, equity, hb, resync, ended, unknown }

EngineFrame engineFrameType(Map<String, dynamic> f) => EngineFrame.values.firstWhere((e) => e.name == f['type'], orElse: () => EngineFrame.unknown);

class EngineStream {
  EngineStream({
    required ApiClient api,
    required this.login,
    required String Function() tradeToken,
    required this.onFrame,
    this.onStatus,
    this.onSessionEnded,
    SocketConnector? connector,
  }) {
    _socket = ReconnectingSocket(
      name: 'engine:$login',
      resolveUrl: () async {
        try {
          final t = await api.post<Map<String, dynamic>>('trade/stream-ticket', tradeToken: tradeToken());
          return Uri.parse('${t['url']}?ticket=${Uri.encodeQueryComponent('${t['ticket']}')}');
        } on ApiException catch (e) {
          if (e.status == 401 || e.isTradeSessionForeign) throw SocketFatal(e.code);
          rethrow;
        }
      },
      onFrame: _frame,
      onStatus: onStatus,
      onFatal: (reason) => onSessionEnded?.call(reason),
      // the backoff resets on the snapshot, not on the bare open (web: stream.ts)
      isReady: (f) => f['type'] == 'snapshot',
      backoff: Backoff(),
      connector: connector,
    );
  }

  final String login;
  final void Function(EngineFrame type, Map<String, dynamic> frame) onFrame;
  final void Function(SocketStatus status)? onStatus;
  final void Function(String reason)? onSessionEnded;
  late final ReconnectingSocket _socket;

  SocketStatus get status => _socket.status;
  void start() => _socket.start();
  void stop() => _socket.stop();
  void resume() => _socket.resume();

  void _frame(Map<String, dynamic> f) {
    final type = engineFrameType(f);
    if (type == EngineFrame.hb) return;
    if (type == EngineFrame.resync || type == EngineFrame.ended) {
      _socket.reconnect();
      return;
    }
    onFrame(type, f);
  }
}

class OptionsStream {
  OptionsStream({required ApiClient api, required String Function() tradeToken, required this.onFrame, this.onStatus, SocketConnector? connector}) {
    _socket = ReconnectingSocket(
      name: 'options',
      resolveUrl: () async {
        try {
          final t = await api.post<Map<String, dynamic>>('trade/options/stream-ticket', tradeToken: tradeToken());
          return Uri.parse('${t['url']}?ticket=${Uri.encodeQueryComponent('${t['ticket']}')}');
        } on ApiException catch (e) {
          if (e.code == 'options_disabled' || e.status == 404) throw const SocketUnavailable();
          if (e.status == 401) throw SocketFatal(e.code);
          rethrow;
        }
      },
      onFrame: (f) {
        if (f['type'] != 'hb') onFrame(f);
      },
      onOpen: _resubscribe,
      onStatus: onStatus,
      backoff: Backoff(),
      silentAfter: const Duration(seconds: 25),
      connector: connector,
    );
  }

  final void Function(Map<String, dynamic> frame) onFrame;
  final void Function(SocketStatus status)? onStatus;
  late final ReconnectingSocket _socket;

  final Map<String, ({String u, String expiry})> _chains = {};
  Set<String> _series = {};
  List<String> _depthSeries = [];
  List<String> _tape = [];

  SocketStatus get status => _socket.status;
  void start() => _socket.start();
  void stop() => _socket.stop();
  void resume() => _socket.resume();

  void _resubscribe() {
    for (final c in _chains.values) {
      _socket.send({'op': 'subscribe', 'u': c.u, 'expiry': c.expiry});
    }
    final codes = _series.toList();
    for (var i = 0; i < codes.length; i += 200) {
      _socket.send({'op': 'subscribe', 'series': codes.sublist(i, (i + 200).clamp(0, codes.length))});
    }
    if (_depthSeries.isNotEmpty) _socket.send({'op': 'depth', 'series': _depthSeries});
    if (_tape.isNotEmpty) _socket.send({'op': 'tape', 'series': _tape});
  }

  /// The chains (underlying + expiry) to follow; replaces the previous set.
  void setChains(Iterable<({String u, String expiry})> list) {
    final next = {for (final c in list) '${c.u}|${c.expiry}': c};
    for (final e in _chains.entries) {
      if (!next.containsKey(e.key)) _socket.send({'op': 'unsubscribe', 'u': e.value.u, 'expiry': e.value.expiry});
    }
    for (final e in next.entries) {
      if (!_chains.containsKey(e.key)) _socket.send({'op': 'subscribe', 'u': e.value.u, 'expiry': e.value.expiry});
    }
    _chains
      ..clear()
      ..addAll(next);
  }

  /// Series quotes to follow (at most 200).
  void setSeries(Iterable<String> codes) {
    final next = codes.take(200).toSet();
    final gone = _series.difference(next).toList();
    final added = next.difference(_series).toList();
    if (gone.isNotEmpty) _socket.send({'op': 'unsubscribe', 'series': gone});
    if (added.isNotEmpty) _socket.send({'op': 'subscribe', 'series': added});
    _series = next;
  }

  /// Order book depth (while the book is on; at most 20 series).
  void setDepth(Iterable<String> codes) {
    final next = codes.toSet().take(20).toList();
    if (next.join(',') == _depthSeries.join(',')) return;
    _depthSeries = next;
    _socket.send({'op': 'depth', 'series': next});
  }

  /// Trades tape (at most 20 series).
  void setTape(Iterable<String> codes) {
    final next = codes.toSet().take(20).toList();
    if (next.join(',') == _tape.join(',')) return;
    _tape = next;
    _socket.send({'op': 'tape', 'series': next});
  }
}
