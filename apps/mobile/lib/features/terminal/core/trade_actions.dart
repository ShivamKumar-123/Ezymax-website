// Trading actions on the active account (web: apps/terminal/lib/engine/actions.ts). The engine is the source of truth:
// nothing here edits positions or orders locally; the account stream brings the result in. Each action confirms with
// a top banner (kept in the bell) and a haptic; a rejection says why in the reader's language. Money writes are never
// retried automatically.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/notifications/notifications.dart';
import '../../../i18n/i18n.dart';
import 'market.dart';
import 'models.dart';
import 'order.dart';
import 'sessions.dart';
import 'terminal_controller.dart';
import 'trade_errors.dart';
import 'trade_math.dart';
import 'workspace.dart';

class TradeActions {
  TradeActions(this.ref);
  final Ref ref;

  T get _t => ref.read(tProvider);
  NotificationsController get _n => ref.read(notificationsProvider.notifier);
  TerminalState get _st => ref.read(terminalProvider);
  TAccount? get _acc => _st.account;
  bool get _cent => _acc?.cent ?? false;
  SymbolBook get _book => ref.read(symbolBookProvider);
  MarketFeed get _feed => ref.read(marketFeedProvider);

  String _money(double usd) => '${accMoney(_cent, usd, signed: true)} ${accCcy(_cent)}';
  String _price(String symbol, double v) => fmtPrice(_book[symbol]?.digits ?? 5, v);

  void _sound(String kind) {
    if (!ref.read(workspaceProvider).sound) return;
    unawaited(SystemSound.play(kind == 'error' || kind == 'alert' ? SystemSoundType.alert : SystemSoundType.click));
  }

  void _ok(String title, {String? description, bool good = true, String sound = 'fill'}) {
    _n.toast(good ? NotificationKind.success : NotificationKind.error, title, description: description);
    KHapticsBridge.success();
    _sound(sound);
  }

  /// A rejection: banner + haptic + sound; a dead engine session re-opens (own accounts) without retrying.
  void _fail(ApiException e, String desc) {
    final r = tradeRejection(e, _t);
    if (e.isTradeSessionEnded || e.isTradeSessionForeign) {
      final login = _st.login;
      if (login != null) unawaited(ref.read(tradeSessionsProvider.notifier).sessionEnded(login));
    }
    _n.toast(NotificationKind.error, r.title, description: [desc, r.detail].where((s) => s.isNotEmpty).join(' · '));
    KHapticsBridge.error();
    _sound('error');
  }

  Future<R?> _run<R>(String desc, Future<R> Function(TradeApi api) call) async {
    final api = ref.read(tradeApiProvider);
    if (api == null) return null;
    try {
      return await call(api);
    } on ApiException catch (e) {
      _fail(e, desc);
      return null;
    }
  }

  static String _cid() {
    final r = math.Random.secure();
    return '${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}-${List.generate(10, (_) => r.nextInt(36).toRadixString(36)).join()}';
  }

  String _orderDesc(OrderRequest o) => o.pending
      ? '${_t(o.buy ? 'order.pending.buy.${o.type}' : 'order.pending.sell.${o.type}')} ${fmtVol(o.volume)} ${o.symbol} @ ${_price(o.symbol, o.price ?? 0)}'
      : '${_t('order.side.${o.side}')} ${fmtVol(o.volume)} ${o.symbol}';

  /// `POST trade/orders` (+ the OCO twin). True when filled / placed.
  Future<bool> placeOrder(OrderRequest o) async {
    final spec = _book[o.symbol];
    if (spec == null) return false;
    final q = _feed.quote(o.symbol);
    final desc = _orderDesc(o);
    final ws = ref.read(workspaceProvider);
    final body = orderBody(o, spec, clientOrderId: _cid(), deviationPoints: o.pending ? null : ws.maxDeviation, bid: q?.bid, ask: q?.ask);
    final res = await _run(desc, (api) => api.post<Map<String, dynamic>>('trade/orders', body: body));
    if (res == null) return false;
    final status = res['status'];
    if (status == 'filled') {
      final mode = _acc?.mode ?? '';
      _ok(
        _t(o.buy ? 'order.toast.buyFilled' : 'order.toast.sellFilled', {'volume': fmtVol(o.volume), 'symbol': o.symbol}),
        description: _t('order.toast.filledDesc', {
          'ticket': '${res['positionTicket'] ?? ''}',
          'price': _price(o.symbol, (res['price'] as num?)?.toDouble() ?? 0),
          'mode': mode.isEmpty ? '' : _t.dyn('order.mode.$mode', fallback: mode),
        }),
      );
      return true;
    }
    if (status == 'duplicate') return true;
    // a pending order was placed: the OCO twin follows on the other side
    var twin = '';
    if (o.ocoPrice != null && o.type != 'stop-limit') {
      final twinSide = o.buy ? 'sell' : 'buy';
      final tw = OrderRequest(
        symbol: o.symbol,
        side: twinSide,
        type: o.type,
        volume: o.volume,
        price: o.ocoPrice,
        expiry: o.expiry,
        expiryDate: o.expiryDate,
        comment: o.comment,
      );
      final tb = orderBody(tw, spec, clientOrderId: _cid())..['ocoWith'] = int.tryParse('${res['ticket']}');
      final tr = await _run('OCO ${_orderDesc(tw)}', (api) => api.post<Map<String, dynamic>>('trade/orders', body: tb));
      if (tr != null && tr['status'] == 'placed') {
        twin = _t('order.toast.ocoTwin', {'side': _t('order.side.$twinSide'), 'price': _price(o.symbol, (tr['price'] as num?)?.toDouble() ?? o.ocoPrice!)});
      }
    }
    final label = _t('order.pending.${o.side}.${o.type}');
    final expiry = o.expiry == 'Date' ? (o.expiryDate ?? '') : (o.expiry == 'Today' ? _t('order.expiry.today') : _t('order.expiry.gtc'));
    _ok(
      _t('order.toast.pendingPlaced', {'label': label.isEmpty ? label : label[0].toUpperCase() + label.substring(1)}),
      description: _t('order.toast.pendingPlacedTicketDesc', {
        'ticket': '${res['ticket'] ?? ''}',
        'volume': fmtVol(o.volume),
        'symbol': o.symbol,
        'price': _price(o.symbol, (res['price'] as num?)?.toDouble() ?? o.price ?? 0),
        'oco': twin,
        'expiry': expiry,
      }),
    );
    return true;
  }

  /// One click on the chart, the ladder or a watch price: a market order with the default volume.
  Future<bool> quickTrade(String symbol, String side, double volume) => placeOrder(OrderRequest(symbol: symbol, side: side, type: 'market', volume: volume));

  /// `POST trade/positions/{ticket}/close` (whole, or `volume` lots).
  Future<bool> closePosition(String ticket, {double? volume}) async {
    final p = _st.positions.where((x) => x.ticket == ticket).firstOrNull;
    final vol = volume != null && p != null ? math.min(p.volume, double.parse(volume.toStringAsFixed(2))) : null;
    final partial = p != null && vol != null && vol < p.volume - 1e-9;
    final desc = p == null ? '#$ticket' : '#$ticket ${_t('order.side.${p.side}')} ${fmtVol(vol ?? p.volume)} ${p.symbol}';
    final body = <String, Object?>{if (partial) 'volume': vol};
    final dev = ref.read(workspaceProvider).maxDeviation;
    final q = p == null ? null : _feed.quote(p.symbol);
    if (dev != null && q != null && p != null) {
      body['deviationPoints'] = dev;
      body['requestedPrice'] = p.buy ? q.bid : q.ask;
    }
    final res = await _run(desc, (api) => api.post<Map<String, dynamic>>('trade/positions/$ticket/close', body: body));
    if (res == null) return false;
    final profit = ((res['profit'] as num?)?.toDouble() ?? 0) / (_cent ? 100 : 1);
    final title = partial ? _t('order.toast.closedPartial', {'ticket': ticket, 'volume': fmtVol(vol)}) : _t('order.toast.closed', {'ticket': ticket});
    String? d;
    if (p != null) {
      final side = _t('order.side.${p.side}').toUpperCase();
      d = q != null
          ? _t('order.toast.closedDescApprox', {
              'side': side,
              'volume': fmtVol(vol ?? p.volume),
              'symbol': p.symbol,
              'price': _price(p.symbol, p.buy ? q.bid : q.ask),
              'profit': _money(profit),
            })
          : _t('order.toast.closedDescNoPrice', {'side': side, 'volume': fmtVol(vol ?? p.volume), 'symbol': p.symbol, 'profit': _money(profit)});
    }
    _ok(title, description: d, good: profit >= 0, sound: 'close');
    return true;
  }

  /// `PATCH trade/positions/{ticket}`: SL / TP (null clears) and the trailing stop (points; 0 clears).
  Future<bool> modifyPosition(
    String ticket, {
    double? sl,
    double? tp,
    bool clearSl = false,
    bool clearTp = false,
    int? trailingPoints,
    bool setTrailing = false,
  }) async {
    final p = _st.positions.where((x) => x.ticket == ticket).firstOrNull;
    if (p == null) return false;
    final digits = _book[p.symbol]?.digits ?? 5;
    final body = <String, Object?>{};
    if (clearSl) {
      body['sl'] = null;
    } else if (sl != null) {
      body['sl'] = roundPrice(digits, sl);
    }
    if (clearTp) {
      body['tp'] = null;
    } else if (tp != null) {
      body['tp'] = roundPrice(digits, tp);
    }
    if (setTrailing) body['trailingPoints'] = trailingPoints == null || trailingPoints <= 0 ? null : trailingPoints;
    final newSl = clearSl ? null : (sl ?? p.sl);
    final newTp = clearTp ? null : (tp ?? p.tp);
    final res = await _run('#$ticket', (api) => api.patch<Map<String, dynamic>>('trade/positions/$ticket', body: body));
    if (res == null) return false;
    final trail = setTrailing && (trailingPoints ?? 0) > 0 ? _t('order.toast.trailingPts', {'n': trailingPoints}) : '';
    _ok(
      _t('order.toast.positionModified', {'ticket': ticket}),
      description:
          '${_t('order.toast.slTp', {'sl': newSl == null ? '—' : fmtPrice(digits, newSl), 'tp': newTp == null ? '—' : fmtPrice(digits, newTp)})}$trail',
      sound: 'none',
    );
    return true;
  }

  /// `POST trade/positions/close-by` (hedging accounts).
  Future<bool> closeBy(String a, String b) async {
    final pa = _st.positions.where((x) => x.ticket == a).firstOrNull;
    final pb = _st.positions.where((x) => x.ticket == b).firstOrNull;
    final res = await _run(
      '#$a / #$b',
      (api) => api.post<Map<String, dynamic>>('trade/positions/close-by', body: {'ticket': int.tryParse(a), 'by': int.tryParse(b)}),
    );
    if (res == null) return false;
    _ok(
      _t('order.toast.closedBy', {'a': a, 'b': b}),
      description: pa == null ? null : _t('order.toast.closedByDesc', {'volume': fmtVol(math.min(pa.volume, pb?.volume ?? pa.volume)), 'symbol': pa.symbol}),
      sound: 'close',
    );
    return true;
  }

  /// `DELETE trade/orders/{ticket}`.
  Future<bool> cancelOrder(String ticket) async {
    final o = _st.orders.where((x) => x.ticket == ticket).firstOrNull;
    final res = await _run('#$ticket', (api) => api.delete<Map<String, dynamic>>('trade/orders/$ticket'));
    if (res == null) return false;
    _n.toast(
      NotificationKind.neutral,
      _t('order.toast.orderCancelled', {'ticket': ticket}),
      description: o == null ? null : _t('order.toast.orderDesc', {'label': _t(o.labelKey), 'volume': fmtVol(o.volume), 'symbol': o.symbol}),
    );
    KHapticsBridge.success();
    return true;
  }

  /// `PATCH trade/orders/{ticket}`: price, SL / TP (null clears).
  Future<bool> modifyOrder(String ticket, {double? price, double? sl, double? tp, bool clearSl = false, bool clearTp = false}) async {
    final o = _st.orders.where((x) => x.ticket == ticket).firstOrNull;
    if (o == null) return false;
    final digits = _book[o.symbol]?.digits ?? 5;
    final body = <String, Object?>{
      if (price != null && price.isFinite) 'price': roundPrice(digits, price),
      if (clearSl) 'sl': null else if (sl != null) 'sl': roundPrice(digits, sl),
      if (clearTp) 'tp': null else if (tp != null) 'tp': roundPrice(digits, tp),
    };
    final res = await _run('#$ticket', (api) => api.patch<Map<String, dynamic>>('trade/orders/$ticket', body: body));
    if (res == null) return false;
    _ok(
      _t('order.toast.orderModified', {'ticket': ticket}),
      description: _t('order.toast.orderAtDesc', {'label': _t(o.labelKey), 'price': fmtPrice(digits, price ?? o.price)}),
      sound: 'none',
    );
    return true;
  }

  /// `POST trade/bulk-close {filter}`: all | profitable | losing | pending | buys | sells.
  Future<bool> bulkClose(String filter, {String? symbol}) async {
    final n = filter == 'pending' ? _st.orders.length : _st.positions.length;
    if (n == 0) {
      _n.toast(NotificationKind.neutral, _t(filter == 'pending' ? 'order.toast.noPendingOrders' : 'order.toast.nothingToClose'));
      return false;
    }
    final res = await _run(filter, (api) => api.post<Map<String, dynamic>>('trade/bulk-close', body: {'filter': filter, 'symbol': ?symbol}));
    if (res == null) return false;
    final done = (res['done'] as List?)?.length ?? 0;
    final failed = (res['failed'] as List?) ?? const [];
    if (filter == 'pending') {
      _n.toast(NotificationKind.neutral, _t('order.toast.cancelledPending', {'count': done}));
      return true;
    }
    final profit = ((res['profit'] as num?)?.toDouble() ?? 0) / (_cent ? 100 : 1);
    final reasons = <String>{
      for (final f in failed)
        if (f is Map)
          f['error'] is Map ? _t.dyn('order.reject.${(f['error'] as Map)['code']}', fallback: '${(f['error'] as Map)['message'] ?? ''}') : '${f['error']}',
    };
    if (done == 0 && failed.isNotEmpty) {
      _n.toast(
        NotificationKind.error,
        reasons.isEmpty ? _t('order.toast.closeFailed') : reasons.first,
        description: _t('order.toast.couldNotClose', {'count': failed.length}),
      );
      KHapticsBridge.error();
      return false;
    }
    _ok(
      _t('order.toast.closedCount', {'count': done}),
      description:
          '${_t('order.toast.realised', {'amount': _money(profit)})}${failed.isEmpty ? '' : _t('order.toast.notClosed', {'count': failed.length, 'reasons': reasons.join(', ')})}',
      good: profit >= 0,
      sound: 'close',
    );
    return true;
  }

  /// `POST trade/demo-refill`.
  Future<bool> refillDemo() async {
    final res = await _run(_t('trader.mobile.refill'), (api) => api.post<Map<String, dynamic>>('trade/demo-refill'));
    if (res == null) return false;
    final bal = ((res['balance'] as num?)?.toDouble() ?? 0) / (_cent ? 100 : 1);
    _ok(_t('order.toast.demoRefilled'), description: '${accMoney(_cent, bal)} ${accCcy(_cent)}', sound: 'none');
    unawaited(ref.read(terminalProvider.notifier).reload());
    return true;
  }
}

final tradeActionsProvider = Provider<TradeActions>(TradeActions.new);
