// The options calls of the mobile API (docs/MOBILE-API.md §6: `trade/options/*` with the account's trade token; web:
// apps/terminal/lib/options/api.ts + book-api.ts). The options service (underlyings, expiries, chain, candles, smile,
// stream ticket), the engine's options API (preview, orders, combo close, settlements), the order book (preview,
// orders, fills, RFQ) and its public market data. Errors are ApiException; money writes are never retried.
import '../../../../core/api/api_error.dart';
import '../../core/sessions.dart';
import '../options_preview.dart';
import 'models.dart';

class OptionsApi {
  OptionsApi(this.api, {this.local = false});
  final TradeApi api;

  /// Previews: the sample option book's tickets are closed / cancelled by the preview options server itself (the CFD
  /// preview server only knows its own accounts' tickets).
  final bool local;

  static Map<String, dynamic> _local((int, Object) r) {
    final body = r.$2 is Map ? (r.$2 as Map).cast<String, dynamic>() : <String, dynamic>{};
    if (r.$1 >= 400) {
      final e = body['error'] is Map ? (body['error'] as Map).cast<String, dynamic>() : const <String, dynamic>{};
      throw ApiException(status: r.$1, code: '${e['code'] ?? 'error'}', message: '${e['message'] ?? ''}');
    }
    return body;
  }

  String get login => api.login;

  Future<List<OptionUnderlying>> underlyings() async {
    final r = await api.get<Map<String, dynamic>>('trade/options/underlyings');
    return [for (final u in jsonList(r['underlyings'])) OptionUnderlying.fromJson(u)];
  }

  Future<List<OptionExpiry>> expiries(String u) async {
    final r = await api.get<Map<String, dynamic>>('trade/options/expiries', query: {'u': u});
    return [for (final e in jsonList(r['expiries'])) OptionExpiry.fromJson(e)];
  }

  Future<OptionChain> chain(String u, String? expiry) async {
    final r = await api.get<Map<String, dynamic>>('trade/options/chain', query: {'u': u, 'expiry': ?expiry});
    return OptionChain.fromJson(r);
  }

  /// Premium candles of one series (`tf` in minutes: 1, 5, 15, 30, 60, 240, 1440; `to` unix seconds, inclusive).
  Future<Map<String, dynamic>> candles(String series, int tf, {int limit = 600, int? to}) =>
      api.get<Map<String, dynamic>>('trade/options/candles', query: {'series': series, 'tf': tf, 'limit': limit, 'to': ?to});

  Future<Map<String, dynamic>> smile(String u, String expiry) => api.get<Map<String, dynamic>>('trade/options/smile', query: {'u': u, 'expiry': expiry});

  /// The engine's preview, in USD (cent accounts scaled back).
  Future<OptPreview> preview(Map<String, Object?> req) async => OptPreview.fromJson(await api.post<Map<String, dynamic>>('trade/options/preview', body: req));

  /// `{status: filled | placed | duplicate, positions?, order?}`
  Future<Map<String, dynamic>> order(Map<String, Object?> req) => api.post<Map<String, dynamic>>('trade/options/orders', body: req);

  /// Close an option position (all of it, or `contracts`): a book-venue position closes reduce-only at market through
  /// the book (`{status: filled | partial, filled, avgPrice, left}`), house positions at the house price
  /// (`{status, profit}`; account currency).
  Future<Map<String, dynamic>> closePosition(String ticket, {double? contracts}) async {
    if (local && PreviewOptions.instance.owns(login, ticket)) return _local(PreviewOptions.instance.closePosition(login, ticket, contracts: contracts));
    return api.post<Map<String, dynamic>>('trade/positions/$ticket/close', body: contracts == null ? <String, Object?>{} : {'volume': contracts});
  }

  Future<Map<String, dynamic>> closeCombo(String comboId) => api.post<Map<String, dynamic>>('trade/options/combos/${Uri.encodeComponent(comboId)}/close');

  /// A working house option order (limit premium / trigger).
  Future<void> cancelOrder(String ticket) async {
    if (local && PreviewOptions.instance.owns(login, ticket)) {
      _local(PreviewOptions.instance.cancelOrder(login, ticket));
      return;
    }
    await api.delete<Object?>('trade/orders/$ticket');
  }

  Future<List<Settlement>> settlements({required bool cent}) async {
    final r = await api.get<Map<String, dynamic>>('trade/options/settlements', query: {'limit': 200});
    return [for (final x in jsonList(r['items'])) Settlement.fromJson(x, cent: cent)];
  }

  /// Older closed trades (engine history of the period): option deals only.
  Future<List<Json>> history({required int days}) async {
    final from = DateTime.now().toUtc().subtract(Duration(days: days)).toIso8601String();
    final r = await api.get<Map<String, dynamic>>('trade/history', query: {'from': from, 'limit': 500});
    return jsonList(r['deals']);
  }

  /// "Explain it to me": `{locale, strategy}` → `{configured, text}`.
  Future<Map<String, dynamic>> explain(Map<String, Object?> body) => api.post<Map<String, dynamic>>('trade/options/explain', body: body);

  /* ---------------- order book ---------------- */

  Future<BookPreview> bookPreview(Map<String, Object?> req) async {
    final r = await api.post<Map<String, dynamic>>('trade/options/book/preview', body: req);
    return BookPreview.fromJson(r, type: '${req['type']}', side: '${req['side']}', qty: numOr(req['qty']), tif: '${req['tif']}', price: numOf(req['price']));
  }

  Future<BookOrderResult> bookPlace(Map<String, Object?> req) async =>
      BookOrderResult.fromJson(await api.post<Map<String, dynamic>>('trade/options/book/orders', body: req));

  Future<BookOrderResult> bookAmend(String id, Map<String, Object?> patch) async =>
      BookOrderResult.fromJson(await api.patch<Map<String, dynamic>>('trade/options/book/orders/${Uri.encodeComponent(id)}', body: patch));

  Future<void> bookCancel(String id) => api.delete<Object?>('trade/options/book/orders/${Uri.encodeComponent(id)}');

  Future<List<BookOrder>> bookOrders({String status = 'open', String? series}) async {
    final r = await api.get<Object?>('trade/options/book/orders', query: {'status': status, 'series': ?series});
    final list = r is List ? r : (r is Map ? (r['orders'] ?? r['items'] ?? const <Object?>[]) : const <Object?>[]);
    return [for (final o in (list is List ? list : const <Object?>[])) ?BookOrder.fromJson(o)];
  }

  Future<Rfq?> rfq({required List<RfqLeg> legs, required int qty, bool reduceOnly = false}) async {
    final r = await api.post<Map<String, dynamic>>(
      'trade/options/rfq',
      body: {
        'legs': [for (final l in legs) l.toJson()],
        'qty': qty,
        if (reduceOnly) 'reduceOnly': true,
      },
    );
    return Rfq.fromJson(r);
  }

  Future<({Rfq? rfq, List<RfqQuote> quotes})> rfqGet(String id) async {
    final r = await api.get<Map<String, dynamic>>('trade/options/rfq/${Uri.encodeComponent(id)}');
    return (rfq: Rfq.fromJson(r['rfq']), quotes: [for (final q in (r['quotes'] as List? ?? const <Object?>[])) ?RfqQuote.fromJson(q)]);
  }

  Future<RfqAcceptResult> rfqAccept(String id, {required String quoteId, required String side, required double limitNet}) async => RfqAcceptResult.fromJson(
    await api.post<Map<String, dynamic>>('trade/options/rfq/${Uri.encodeComponent(id)}/accept', body: {'quoteId': quoteId, 'side': side, 'limitNet': limitNet}),
  );

  Future<void> rfqCancel(String id) async {
    try {
      await api.delete<Object?>('trade/options/rfq/${Uri.encodeComponent(id)}');
    } on ApiException {
      // the request lapses on its own
    }
  }

  /// Public market data (the stream's polling fallback).
  Future<SeriesDepth?> depth(String series) async {
    final r = await api.get<Map<String, dynamic>>('trade/options/public/book/${Uri.encodeComponent(series)}');
    return SeriesDepth.fromJson({'series': series, ...r});
  }

  Future<List<TapeTrade>> trades(String series, {int limit = 60}) async {
    final r = await api.get<Object?>('trade/options/public/trades/${Uri.encodeComponent(series)}', query: {'limit': limit});
    final list = r is List ? r : (r is Map ? (r['trades'] ?? const <Object?>[]) : const <Object?>[]);
    return [for (final t in (list is List ? list : const <Object?>[])) ?TapeTrade.fromJson(t, series: series)];
  }
}
