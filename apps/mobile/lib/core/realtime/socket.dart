// A WebSocket that stays connected: a fresh URL (one-time ticket) for every attempt, reconnect with backoff and
// jitter, a watchdog for silent sockets (the servers send hb / ping frames), and hooks to re-subscribe after each
// (re)connect. Shared by the market-data, support, engine (account) and options streams.
import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import 'backoff.dart';

enum SocketStatus { idle, connecting, open, reconnecting, unavailable, closed }

typedef SocketConnector = WebSocketChannel Function(Uri url);

/// Thrown by `resolveUrl` when the session is gone (401 from the ticket call): the socket stops and reports it.
class SocketFatal implements Exception {
  const SocketFatal([this.reason = 'unauthorized']);
  final String reason;
}

/// Thrown by `resolveUrl` when the feature is off (e.g. options "launching soon"): try again later, quietly.
class SocketUnavailable implements Exception {
  const SocketUnavailable([this.retryIn = const Duration(minutes: 1)]);
  final Duration retryIn;
}

class ReconnectingSocket {
  ReconnectingSocket({
    required this.name,
    required this.resolveUrl,
    required this.onFrame,
    this.onStatus,
    this.onOpen,
    this.onFatal,
    this.isReady,
    Backoff? backoff,
    this.silentAfter = const Duration(seconds: 20),
    this.watchEvery = const Duration(seconds: 5),
    SocketConnector? connector,
  }) : backoff = backoff ?? Backoff(),
       _connect = connector ?? WebSocketChannel.connect;

  /// For logs and tests ("engine:10001234").
  final String name;

  /// The URL to open: mints a ticket first where the stream needs one (called before every attempt).
  final Future<Uri> Function() resolveUrl;

  /// Every JSON frame (heartbeats included; the owner ignores what it doesn't need).
  final void Function(Map<String, dynamic> frame) onFrame;
  final void Function(SocketStatus status)? onStatus;

  /// After every (re)connect: send the subscriptions again.
  final void Function()? onOpen;

  /// The session is gone; the socket has stopped.
  final void Function(String reason)? onFatal;

  /// A frame that proves the stream is healthy (the engine's `snapshot`); until then the backoff isn't reset.
  /// Default: the socket opening is enough.
  final bool Function(Map<String, dynamic> frame)? isReady;

  final Backoff backoff;

  /// No frame for this long (servers heartbeat every 5–10 s): treat the socket as dead.
  final Duration silentAfter;
  final Duration watchEvery;
  final SocketConnector _connect;

  WebSocketChannel? _ch;
  // cancelled in _drop()
  // ignore: cancel_subscriptions
  StreamSubscription<dynamic>? _sub;
  Timer? _retry;
  Timer? _watchdog;
  int _silentTicks = 0;
  bool _running = false;
  bool _connecting = false;
  int _generation = 0;
  int _closedGen = -1;
  SocketStatus _status = SocketStatus.idle;

  SocketStatus get status => _status;
  bool get isOpen => _status == SocketStatus.open;

  void _set(SocketStatus s) {
    if (_status == s) return;
    _status = s;
    onStatus?.call(s);
  }

  void start() {
    if (_running) return;
    _running = true;
    _watchdog = Timer.periodic(watchEvery, (_) => _watch());
    unawaited(_open());
  }

  /// Stops for good (sign-out, screen closed).
  void stop() {
    _running = false;
    _generation++;
    _retry?.cancel();
    _watchdog?.cancel();
    _drop();
    _set(SocketStatus.closed);
  }

  /// Drop the socket and connect again now (a `resync` / `ended` frame, or the app came back to the foreground).
  void reconnect() {
    if (!_running) return;
    _retry?.cancel();
    _drop();
    backoff.reset();
    unawaited(_open());
  }

  /// Back in the foreground: connect at once if the socket is down (instead of waiting for the backoff).
  void resume() {
    if (_running && _ch == null && !_connecting) reconnect();
  }

  void send(Object json) {
    if (_ch == null || _status != SocketStatus.open) return;
    try {
      _ch!.sink.add(json is String ? json : jsonEncode(json));
    } catch (_) {}
  }

  void _drop() {
    final sub = _sub, ch = _ch;
    _sub = null;
    _ch = null;
    unawaited(sub?.cancel());
    try {
      unawaited(ch?.sink.close());
    } catch (_) {}
  }

  void _watch() {
    if (_ch == null || _status != SocketStatus.open) return;
    _silentTicks++;
    if (watchEvery * _silentTicks >= silentAfter) {
      _drop();
      _later();
    }
  }

  Future<void> _open() async {
    if (!_running || _connecting) return;
    _connecting = true;
    final gen = ++_generation;
    _set(backoff.attempt == 0 && _status != SocketStatus.reconnecting ? SocketStatus.connecting : SocketStatus.reconnecting);
    Uri url;
    try {
      url = await resolveUrl();
    } on SocketFatal catch (e) {
      _connecting = false;
      if (gen != _generation) return;
      stop();
      onFatal?.call(e.reason);
      return;
    } on SocketUnavailable catch (e) {
      _connecting = false;
      if (gen != _generation) return;
      _set(SocketStatus.unavailable);
      _retry?.cancel();
      _retry = Timer(e.retryIn, () => unawaited(_open()));
      return;
    } catch (_) {
      _connecting = false;
      if (gen == _generation) _later();
      return;
    }
    if (!_running || gen != _generation) {
      _connecting = false;
      return;
    }
    try {
      final ch = _connect(url);
      _ch = ch;
      _silentTicks = 0;
      _sub = ch.stream.listen((data) => _frame(data, gen), onDone: () => _closed(gen), onError: (Object _) => _closed(gen), cancelOnError: true);
      await ch.ready;
      _connecting = false;
      if (gen != _generation || !_running) return;
      _set(SocketStatus.open);
      if (isReady == null) backoff.reset();
      onOpen?.call();
    } catch (_) {
      _connecting = false;
      _closed(gen);
    }
  }

  void _frame(Object? data, int gen) {
    if (gen != _generation) return;
    _silentTicks = 0;
    Map<String, dynamic> f;
    try {
      final v = data is String ? jsonDecode(data) : (data is List<int> ? jsonDecode(utf8.decode(data)) : null);
      if (v is! Map<String, dynamic>) return;
      f = v;
    } catch (_) {
      return; // a malformed frame never kills the stream
    }
    if (isReady != null && isReady!(f)) backoff.reset();
    onFrame(f);
  }

  void _closed(int gen) {
    if (gen != _generation || _closedGen == gen) return;
    _closedGen = gen;
    _sub = null;
    _ch = null;
    if (_running) _later();
  }

  void _later() {
    if (!_running) return;
    _retry?.cancel();
    _set(SocketStatus.reconnecting);
    _retry = Timer(backoff.next(), () => unawaited(_open()));
  }
}
