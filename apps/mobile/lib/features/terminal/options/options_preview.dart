// Kalks FX Options in previews (`--dart-define=KALKS_PREVIEW=true`) and widget tests: sample answers for every
// `trade/options/*` route the options mode calls (the preview trade server hands them over), a small option book per
// account (positions, working orders, closed deals, settlements), and the options stream as a fake WebSocket. Chains
// are priced with the same GK / BS / Black-76 maths as the demo pricer (core/pricer.dart) from the preview trade
// server's walking spot, so prices move. `?optBook=1` on the web preview turns the order book on (book quotes, depth,
// tape, book orders, RFQ). Sample values only; never used in a build that ships.
// Returns null for paths it doesn't know (the preview server then answers 404).
import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:web_socket_channel/web_socket_channel.dart';

import '../preview/preview_server.dart';
import 'core/math.dart';
import 'core/models.dart';
import 'core/pricer.dart';

(int, Object)? previewOptionsAnswer(String method, String path, Map<String, String> query, Map<String, dynamic> body, String? login) =>
    PreviewOptions.instance.answer(method, path, query, body, login);

Map<String, dynamic> _err(String code, String message) => {
  'error': {'code': code, 'message': message},
};

double _r(double v, int d) => roundTo(v, d);

/// One account's sample option book (raw engine JSON, account currency).
class PreviewOptionBook {
  final List<Map<String, dynamic>> positions = [];
  final List<Map<String, dynamic>> orders = [];
  final List<Map<String, dynamic>> deals = [];
  final List<Map<String, dynamic>> settlements = [];
  final List<Map<String, dynamic>> bookOrders = [];
  bool cent = false;
}

class PreviewOptions {
  PreviewOptions._();
  static final PreviewOptions instance = PreviewOptions._();

  final Map<String, PreviewOptionBook> _books = {};
  final Map<String, List<double>> _ladders = {};
  final Map<String, Map<String, dynamic>> _rfqs = {};
  final StreamController<int> _changes = StreamController<int>.broadcast();
  int _version = 0;
  int _ticket = 61200000;
  int _deal = 91300000;
  int _orderSeq = 7700000;

  /// The order book is on (web previews: `?optBook=1`).
  bool bookOn = Uri.base.queryParameters['optBook'] == '1';

  /// Every change of a preview option book (the options mode merges them into the engine state).
  Stream<int> get changes => _changes.stream;

  void _changed() => _changes.add(++_version);

  /* ---------------- market ---------------- */

  /// The spot of an underlying from the preview trade server (it walks while its markets are subscribed).
  ({double bid, double ask, double mid})? spot(String u) {
    final f = PreviewServer.instance.quoteFrame(u, 'standard');
    if (f == null) return null;
    final b = (f['b'] as num).toDouble(), a = (f['a'] as num).toDouble();
    return (bid: b, ask: a, mid: (b + a) / 2);
  }

  double _usdPerQuote(OptionSpec spec) {
    if (spec.quoteCcy == 'USD') return 1;
    final usdX = spot('USD${spec.quoteCcy}');
    if (usdX != null && usdX.mid > 0) return 1 / usdX.mid;
    final xUsd = spot('${spec.quoteCcy}USD');
    return xUsd != null && xUsd.mid > 0 ? xUsd.mid : 1;
  }

  /// Open expiries (daily: next 5 business days, weekly: next 4 Fridays, monthly: next 3 last Fridays).
  List<Map<String, dynamic>> expiries(String symbol, [int? nowMs]) {
    final now = nowMs ?? DateTime.now().millisecondsSinceEpoch;
    final out = <String, Set<String>>{};
    bool add(String date, String kind) {
      if (cutInstant(date) <= now) return false;
      (out[date] ??= {}).add(kind);
      return true;
    }

    String ymd(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    final n0 = DateTime.fromMillisecondsSinceEpoch(now, isUtc: true);
    final day0 = DateTime.utc(n0.year, n0.month, n0.day);
    for (var i = 0, n = 0; n < 5 && i < 20; i++) {
      final d = day0.add(Duration(days: i));
      if (d.weekday == DateTime.saturday || d.weekday == DateTime.sunday) continue;
      if (add(ymd(d), 'daily')) n++;
    }
    for (var i = 0, n = 0; n < 4 && i < 60; i++) {
      final d = day0.add(Duration(days: i));
      if (d.weekday == DateTime.friday && add(ymd(d), 'weekly')) n++;
    }
    for (var i = 0, n = 0; n < 3 && i < 6; i++) {
      final y = n0.year + (n0.month - 1 + i) ~/ 12;
      final m = (n0.month - 1 + i) % 12 + 1;
      var last = DateTime.utc(y, m + 1, 0);
      while (last.weekday != DateTime.friday) {
        last = last.subtract(const Duration(days: 1));
      }
      if (add(ymd(last), 'monthly')) n++;
    }
    const order = ['daily', 'weekly', 'monthly'];
    final dates = out.keys.toList()..sort();
    return [
      for (final date in dates)
        () {
          final cut = cutInstant(date);
          return <String, dynamic>{
            'id': 1000 + dates.indexOf(date),
            'date': date,
            'kinds': [
              for (final k in order)
                if (out[date]!.contains(k)) k,
            ],
            'cutAt': DateTime.fromMillisecondsSinceEpoch(cut, isUtc: true).toIso8601String(),
            'twapStart': DateTime.fromMillisecondsSinceEpoch(cut - OptionDefaults.twapMinutes * 60000, isUtc: true).toIso8601String(),
            'status': 'listed',
            'state': tradeState(cut, now),
            'series': 0,
            'secondsToCut': ((cut - now) / 1000).round(),
          };
        }(),
    ];
  }

  Map<String, dynamic>? _expiry(String u, String? date) {
    final list = expiries(u);
    if (list.isEmpty) return null;
    if (date == null) return list.first;
    for (final e in list) {
      if (e['date'] == date) return e;
    }
    // a past date (positions): its cut and kinds
    final cut = cutInstant(date);
    return {
      'date': date,
      'kinds': ['daily'],
      'cutAt': DateTime.fromMillisecondsSinceEpoch(cut, isUtc: true).toIso8601String(),
      'state': 'closed',
      'status': 'listed',
    };
  }

  /// Strike ladder around a centre: ATM ± max(10, ~2.5σ√t) steps, at most 40 per side; strikes are never removed.
  List<double> _ladder(OptionSpec spec, String date, double mid, double atmVol, double years) {
    final key = '${spec.symbol}|$date';
    var ladder = _ladders[key];
    final step = spec.strikeStep;
    final d = stepDecimals(step);
    if (ladder == null) {
      final atm = (mid / step).round() * step;
      final n = ((2.5 * atmVol * math.sqrt(math.max(years, 1 / 365)) * mid) / step).ceil().clamp(10, 40);
      ladder = [
        for (var i = -n; i <= n; i++)
          if (atm + i * step > 0) double.parse((atm + i * step).toStringAsFixed(d)),
      ];
      _ladders[key] = ladder;
    }
    while (ladder.length > 4 && mid > ladder[ladder.length - 4]) {
      ladder.add(double.parse((ladder.last + step).toStringAsFixed(d)));
    }
    while (ladder.length > 4 && mid < ladder[3] && ladder.first - step > 0) {
      ladder.insert(0, double.parse((ladder.first - step).toStringAsFixed(d)));
    }
    return ladder;
  }

  /// A full chain in the service's shape (services/options/src/pricing.rs `chain`), book fields when the book is on.
  Map<String, dynamic>? chain(String u, String? date) {
    final spec = optionSpecs[u];
    final sp = spot(u);
    final e = _expiry(u, date);
    if (spec == null || sp == null || e == null) return null;
    final now = DateTime.now().millisecondsSinceEpoch;
    final cut = cutInstant('${e['date']}');
    final ctx = pricingContext(spec, sp.mid, cut.toDouble(), now.toDouble(), _usdPerQuote(spec));
    final ladder = _ladder(spec, '${e['date']}', sp.mid, ctx.quotes.atm, ctx.tCal);
    final state = tradeState(cut, now);
    final tick = defaultPremiumTick(spec);
    final rows = [
      for (final k in ladder)
        {
          'strike': k,
          'strikeLabel': strikeLabelFor(k, spec.strikeStep),
          'call': _book(quoteSeriesJson(ctx, 'call', k, seriesCode(u, '${e['date']}', k, 'call', spec.strikeStep), state), tick, ctx.usdPerUnit, sp.mid, k),
          'put': _book(quoteSeriesJson(ctx, 'put', k, seriesCode(u, '${e['date']}', k, 'put', spec.strikeStep), state), tick, ctx.usdPerUnit, sp.mid, k),
        },
    ];
    return {
      'underlying': u,
      'name': spec.name,
      'model': spec.model,
      'expiry': e['date'],
      'kinds': e['kinds'],
      'cutAt': DateTime.fromMillisecondsSinceEpoch(cut, isUtc: true).toIso8601String(),
      'cut': {'time': '10:00', 'zone': 'America/New_York'},
      'twapStart': DateTime.fromMillisecondsSinceEpoch(cut - 1800000, isUtc: true).toIso8601String(),
      'status': 'listed',
      'state': state,
      'contractSize': spec.contractSize,
      'contractUnit': spec.contractUnit,
      'quoteCcy': spec.quoteCcy,
      'digits': spec.digits,
      'pipSize': spec.pipSize,
      'group': '*',
      'volSpread': OptionDefaults.volSpread,
      'minSpreadUsd': OptionDefaults.minSpreadUsd,
      'commission': {'perContract': OptionDefaults.commissionPerContract, 'capPct': OptionDefaults.commissionCapPct},
      'spot': {'bid': sp.bid, 'ask': sp.ask, 'mid': sp.mid, 't': now, 'ageMs': 0},
      'fixing': null,
      'version': 1,
      'atmStrike': _r(forwardOf(ctx), spec.digits),
      if (bookOn)
        'book': {
          'active': true,
          'premiumTick': tick,
          'marketBandPct': BookDefaults.marketBandPct,
          'limitBandPct': BookDefaults.limitBandPct,
          'bandMinTicks': BookDefaults.bandMinTicks,
          'makerFeePerContract': BookDefaults.makerFeePerContract,
          'takerFeePerContract': BookDefaults.takerFeePerContract,
          'feeCapPct': BookDefaults.feeCapPct,
        },
      if (bookOn) 'pcr': 0.86,
      'rows': rows,
    };
  }

  /// House quote → book quote (best bid / offer on the tick with sizes, theo, last, OI, volume).
  Map<String, dynamic> _book(Map<String, dynamic> q, double tick, double usd, double spot, double strike) {
    if (!bookOn) return q;
    final code = '${q['code']}';
    final h = code.codeUnits.fold<int>(7, (a, c) => (a * 31 + c) & 0x7fffffff);
    final far = ((strike - spot).abs() / spot) > 0.02;
    final theo = (q['mark'] as num).toDouble();
    final bid = far && h % 5 == 0 ? null : toTick((q['bid'] as num).toDouble(), tick, -1);
    final ask = toTick((q['ask'] as num).toDouble(), tick, 1);
    final last = toTick(theo * (1 + ((h % 9) - 4) / 100), tick);
    return {
      ...q,
      'bid': bid != null && bid > 0 ? bid : null,
      'ask': ask > 0 ? ask : null,
      'bidUsd': bid != null && bid > 0 ? _r(bid * usd, 2) : null,
      'askUsd': ask > 0 ? _r(ask * usd, 2) : null,
      'bidQty': bid != null && bid > 0 ? 2 + h % 18 : null,
      'askQty': ask > 0 ? 3 + (h ~/ 7) % 22 : null,
      'mark': clampMark(theo, bid, ask),
      'markUsd': _r(clampMark(theo, bid, ask) * usd, 2),
      'theo': theo,
      'theoUsd': q['markUsd'],
      'theoIv': q['iv'],
      'markIv': q['iv'],
      'bidIv': q['ivBid'],
      'askIv': q['ivAsk'],
      'last': last > 0 ? last : null,
      'lastUsd': last > 0 ? _r(last * usd, 2) : null,
      'lastQty': 1 + h % 5,
      'change': ((h % 21) - 10) / 100,
      'oi': far ? (h % 40).toDouble() : (80 + h % 900).toDouble(),
      'volume': far ? (h % 6).toDouble() : (10 + h % 140).toDouble(),
    };
  }

  /// The quote of one series (positions of other expiries, the series stream).
  Map<String, dynamic>? seriesQuote(String code) {
    final p = parseSeriesCode(code);
    if (p == null) return null;
    final spec = optionSpecs[p.underlying];
    final sp = spot(p.underlying);
    if (spec == null || sp == null) return null;
    final now = DateTime.now().millisecondsSinceEpoch;
    final cut = cutInstant(p.date);
    final ctx = pricingContext(spec, sp.mid, cut.toDouble(), now.toDouble(), _usdPerQuote(spec));
    return _book(quoteSeriesJson(ctx, p.right, p.strike, code, tradeState(cut, now)), defaultPremiumTick(spec), ctx.usdPerUnit, sp.mid, p.strike);
  }

  OptionQuote? _q(String code) => OptionQuote.fromJson(seriesQuote(code));

  List<Map<String, dynamic>> underlyings() {
    final now = DateTime.now().millisecondsSinceEpoch;
    return [
      for (final u in optionUnderlyings.where((x) => x.enabled))
        {
          'symbol': u.symbol,
          'name': u.name,
          'assetClass': u.assetClass,
          'model': u.model,
          'baseCcy': u.baseCcy,
          'quoteCcy': u.quoteCcy,
          'contractSize': u.contractSize,
          'contractUnit': u.contractUnit,
          'digits': u.digits,
          'pipSize': u.pipSize,
          'strikeStep': u.strikeStep,
          'cut': {'time': '10:00', 'zone': 'America/New_York'},
          'twapMinutes': OptionDefaults.twapMinutes,
          'noOpenMinutes': OptionDefaults.noOpenMinutes,
          'closeOnlyMinutes': OptionDefaults.closeOnlyMinutes,
          'minContracts': OptionDefaults.minContracts,
          'maxContracts': OptionDefaults.maxContracts,
          'contractStep': OptionDefaults.contractStep,
          'barriers': true,
          'expiryKinds': const ['daily', 'weekly', 'monthly'],
          'nextExpiry': () {
            final e = expiries(u.symbol, now);
            return e.isEmpty ? null : {'date': e.first['date'], 'cutAt': e.first['cutAt']};
          }(),
          'atmVol': quotesAt(u, 7).atm,
          'realizedVol': _r(u.atm[3] * 0.94, 4),
          'premiumTick': defaultPremiumTick(u),
          'marketBandPct': BookDefaults.marketBandPct,
          'limitBandPct': BookDefaults.limitBandPct,
          'bandMinTicks': BookDefaults.bandMinTicks,
          'rfqQuoteTtlSecs': BookDefaults.rfqQuoteTtlSecs,
        },
    ];
  }

  /* ---------------- the account's book ---------------- */

  /// The sample book of a login (seeded on first use); `null` = the test / unknown account.
  PreviewOptionBook bookOf(String? login) {
    final key = login ?? 'preview';
    return _books[key] ??= _seed(key);
  }

  String _iso(int ms) => DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true).toIso8601String();

  Map<String, dynamic> _info(String code) {
    final p = parseSeriesCode(code)!;
    final spec = optionSpecs[p.underlying]!;
    return {
      'series': code,
      'underlying': p.underlying,
      'right': p.right,
      'strike': p.strike,
      'expiry': p.date,
      'expiryAt': _iso(cutInstant(p.date)),
      'style': 'european',
      'barrier': null,
      'contractSize': spec.contractSize,
    };
  }

  Map<String, dynamic> _position(
    String login,
    PreviewOptionBook b,
    String code,
    String side,
    int contracts,
    double price, {
    String? comboId,
    int agoMin = 0,
    String venue = 'house',
  }) {
    final k = b.cent ? 100.0 : 1.0;
    final usd = (_q(code) == null ? 0.0 : usdPerUnitOfQuote(_q(code)));
    final now = DateTime.now().millisecondsSinceEpoch - agoMin * 60000;
    final commission = _r(math.min(OptionDefaults.commissionPerContract * contracts, 0.1 * price * usd * contracts) * k, 2);
    final ticket = _ticket += 3;
    final p = {
      'ticket': ticket,
      'login': int.tryParse(login) ?? login,
      'symbol': code,
      'side': side,
      'contracts': contracts,
      'volume': contracts,
      'openPrice': price,
      'openTime': _iso(now),
      'commission': commission,
      'swap': 0,
      'comboId': ?comboId,
      'venue': venue,
      'option': _info(code),
    };
    b.deals.insert(0, {
      'id': _deal += 2,
      'login': p['login'],
      'positionTicket': ticket,
      'symbol': code,
      'side': side,
      'positionSide': side,
      'entry': 'in',
      'volume': contracts,
      'price': price,
      'openPrice': price,
      'profit': 0,
      'swap': 0,
      'commission': commission,
      'reason': 'client',
      'time': _iso(now),
      'openTime': _iso(now),
      'comboId': ?comboId,
      'option': _info(code),
    });
    return p;
  }

  PreviewOptionBook _seed(String login) {
    final b = PreviewOptionBook()..cent = login == '10051123';
    _books[login] = b;
    String? near(String u, String right, {int steps = 0, String kind = 'weekly'}) {
      final spec = optionSpecs[u]!;
      final sp = spot(u);
      if (sp == null) return null;
      final list = expiries(u);
      final e = list.firstWhere((x) => (x['kinds'] as List).contains(kind), orElse: () => list.first);
      final atm = (sp.mid / spec.strikeStep).round() * spec.strikeStep + steps * spec.strikeStep;
      return seriesCode(u, '${e['date']}', double.parse(atm.toStringAsFixed(stepDecimals(spec.strikeStep))), right, spec.strikeStep);
    }

    final c1 = near('EURUSD', 'call', steps: 1);
    final q1 = c1 == null ? null : _q(c1);
    if (c1 != null && q1 != null) b.positions.add(_position(login, b, c1, 'buy', 2, _r(q1.mark * 0.82, 7), agoMin: 300));
    final p1 = near('XAUUSD', 'put', steps: -2, kind: 'daily');
    final qp = p1 == null ? null : _q(p1);
    if (p1 != null && qp != null) b.positions.add(_position(login, b, p1, 'sell', 1, _r(qp.mark * 1.15, 4), agoMin: 90));
    final sc = near('GBPUSD', 'call', kind: 'monthly');
    final sp = near('GBPUSD', 'put', kind: 'monthly');
    if (sc != null && sp != null && _q(sc) != null && _q(sp) != null) {
      const combo = 'c4410287';
      b.positions.add(_position(login, b, sc, 'buy', 1, _r(_q(sc)!.mark * 0.95, 7), comboId: combo, agoMin: 1440));
      b.positions.add(_position(login, b, sp, 'buy', 1, _r(_q(sp)!.mark * 1.04, 7), comboId: combo, agoMin: 1440));
    }
    // closed trades and settlements of the last days
    final now = DateTime.now().millisecondsSinceEpoch;
    void closed(String u, double strike, String right, String side, int contracts, double open, double close, String reason, int agoH, {double? fixing}) {
      final spec = optionSpecs[u]!;
      final date = DateTime.fromMillisecondsSinceEpoch(now - agoH * 3600000, isUtc: true).toIso8601String().substring(0, 10);
      final code = seriesCode(u, date, strike, right, spec.strikeStep);
      final k = b.cent ? 100.0 : 1.0;
      final usd = spec.contractSize * _usdPerQuote(spec);
      final ticket = _ticket += 3;
      final gross = _r((side == 'buy' ? 1 : -1) * (close - open) * usd * contracts * k, 2);
      final info = {..._info(code), 'fixing': ?fixing};
      b.deals.add({
        'id': _deal += 2,
        'login': int.tryParse(login) ?? login,
        'positionTicket': ticket,
        'symbol': code,
        'side': side,
        'positionSide': side,
        'entry': 'in',
        'volume': contracts,
        'price': open,
        'profit': 0,
        'commission': _r(0.25 * contracts * k, 2),
        'reason': 'client',
        'time': _iso(now - (agoH + 20) * 3600000),
        'option': info,
      });
      b.deals.add({
        'id': _deal += 2,
        'login': int.tryParse(login) ?? login,
        'positionTicket': ticket,
        'symbol': code,
        'side': side == 'buy' ? 'sell' : 'buy',
        'positionSide': side,
        'entry': 'out',
        'volume': contracts,
        'price': close,
        'openPrice': open,
        'openTime': _iso(now - (agoH + 20) * 3600000),
        'profit': gross,
        'swap': 0,
        'commission': reason == 'expiry' ? 0 : _r(0.25 * contracts * k, 2),
        'reason': reason,
        'time': _iso(now - agoH * 3600000),
        'option': info,
      });
      if (reason == 'expiry') {
        b.settlements.add({
          'ticket': ticket,
          'series': code,
          'side': side,
          'contracts': contracts,
          'fixing': fixing,
          'payout': _r((side == 'buy' ? 1 : -1) * close * usd * contracts * k, 2),
          'profit': gross,
          'at': _iso(now - agoH * 3600000),
          'run': 1,
        });
      }
    }

    final eu = spot('EURUSD')?.mid ?? 1.085;
    final xau = spot('XAUUSD')?.mid ?? 2650;
    final eStrike = double.parse(((eu / 0.0025).round() * 0.0025).toStringAsFixed(4));
    final gStrike = ((xau / 25).round() * 25).toDouble();
    closed('EURUSD', eStrike, 'call', 'buy', 3, 0.00142, 0.00198, 'client', 26);
    closed('XAUUSD', gStrike, 'put', 'buy', 1, 14.2, 0, 'expiry', 50, fixing: gStrike + 8.4);
    closed('EURUSD', eStrike - 0.005, 'put', 'sell', 2, 0.00088, 0, 'expiry', 74, fixing: eStrike + 0.0021);
    closed('USDJPY', 150, 'call', 'buy', 1, 0.62, 0.41, 'client', 98);
    b.deals.sort((a, c) => '${c['time']}'.compareTo('${a['time']}'));
    return b;
  }

  /* ---------------- REST ---------------- */

  (int, Object)? answer(String method, String path, Map<String, String> query, Map<String, dynamic> body, String? login) {
    if (path == 'trade/ai-trader') return (200, {'configured': false, 'model': null, 'result': null, 'warnings': <Object>[]});
    if (!path.startsWith('trade/options')) return null;
    final p = path.replaceFirst('trade/options', '').replaceFirst(RegExp('^/'), '');
    final b = bookOf(login);
    switch (p) {
      case 'underlyings':
        return (200, {'underlyings': underlyings(), 'version': 1});
      case 'expiries':
        final u = query['u'] ?? 'EURUSD';
        if (!optionSpecs.containsKey(u)) return (404, _err('not_found', 'Unknown underlying.'));
        return (200, {'underlying': u, 'expiries': expiries(u)});
      case 'chain':
        final c = chain(query['u'] ?? 'EURUSD', query['expiry']);
        return c == null ? (404, _err('not_found', 'No such chain.')) : (200, c);
      case 'candles':
        final c = candles(
          query['series'] ?? '',
          int.tryParse(query['tf'] ?? '') ?? 15,
          limit: int.tryParse(query['limit'] ?? '') ?? 600,
          to: int.tryParse(query['to'] ?? ''),
        );
        return c == null ? (404, _err('not_found', 'No candles for this series.')) : (200, c);
      case 'smile':
        final s = smile(query['u'] ?? 'EURUSD', query['expiry']);
        return s == null ? (404, _err('not_found', 'No smile.')) : (200, s);
      case 'stream-ticket':
        return (200, {'ticket': 'preview-options-${login ?? 'x'}', 'expiresIn': 30, 'url': 'wss://preview.local/options/stream'});
      case 'explain':
        return (200, {'configured': false});
      case 'preview':
        return (200, _preview(b, body));
      case 'orders':
        return _order(login, b, body);
      case 'settlements':
        return (200, {'items': b.settlements});
    }
    final combo = RegExp(r'^combos/([^/]+)/close$').firstMatch(p);
    if (combo != null) return _closeCombo(login, b, Uri.decodeComponent(combo[1]!));
    final series = RegExp(r'^series/([^/]+)$').firstMatch(p);
    if (series != null) {
      final q = seriesQuote(Uri.decodeComponent(series[1]!));
      return q == null ? (404, _err('not_found', 'Unknown series.')) : (200, q);
    }
    final pub = RegExp(r'^public/(book|trades|stats)/([^/]+)$').firstMatch(p);
    if (pub != null) {
      final code = Uri.decodeComponent(pub[2]!);
      if (pub[1] == 'book') return (200, depth(code) ?? {'bids': <Object>[], 'asks': <Object>[]});
      if (pub[1] == 'trades') return (200, {'trades': trades(code, int.tryParse(query['limit'] ?? '') ?? 60)});
      return (200, {'underlying': code, 'pcr': 0.86});
    }
    if (p.startsWith('book') || p.startsWith('rfq')) {
      if (!bookOn) return (404, _err('not_found', 'The order book is not active.'));
      return _bookAnswer(method, p, query, body, login, b);
    }
    return (404, _err('not_found', 'Not in the preview options server: $method $path'));
  }

  Map<String, dynamic>? candles(String code, int tf, {int limit = 600, int? to}) {
    final p = parseSeriesCode(code);
    final spec = p == null ? null : optionSpecs[p.underlying];
    if (p == null || spec == null) return null;
    final tfName = const {1: 'M1', 5: 'M5', 15: 'M15', 30: 'M30', 60: 'H1', 240: 'H4', 1440: 'D1'}[tf] ?? 'M15';
    final bars = PreviewServer.instance.candlesAs(p.underlying, tfName, (t, o, h, l, c, v) => (t: t, o: o, h: h, l: l, c: c), limit: limit, to: to);
    final cut = cutInstant(p.date).toDouble();
    final step = tf * 60000;
    final from = cut - 35 * 86400000;
    final usd = _usdPerQuote(spec) * spec.contractSize;
    double at(double s, double ms) => _r(premiumAt(spec, p.right, p.strike, s, ms, cut) * usd, 2);
    final out = <Map<String, num>>[];
    for (final b in bars) {
      final t0 = b.t * 1000.0;
      if (t0 >= cut) break;
      if (t0 + step <= from || !(b.o > 0 && b.c > 0)) continue;
      final t1 = math.min(t0 + step, cut);
      final o = at(b.o, t0), c = at(b.c, t1);
      final hi = math.max(at(b.h, t0), at(b.l, t0));
      final lo = math.min(at(b.h, t1), at(b.l, t1));
      out.add({'t': b.t, 'o': o, 'h': math.max(math.max(o, c), hi), 'l': math.min(math.min(o, c), lo), 'c': c, 'u': b.c});
    }
    return {
      'series': code,
      'underlying': p.underlying,
      'right': p.right,
      'strike': p.strike,
      'expiryAt': _iso(cut.toInt()),
      'tf': tf,
      'contractSize': spec.contractSize,
      'usdPerUnit': _r(_usdPerQuote(spec), 10),
      'unit': 'usd_per_contract',
      'candles': out,
    };
  }

  Map<String, dynamic>? smile(String u, String? date) {
    final spec = optionSpecs[u];
    final sp = spot(u);
    final e = _expiry(u, date);
    if (spec == null || sp == null || e == null) return null;
    final now = DateTime.now().millisecondsSinceEpoch.toDouble();
    final cut = cutInstant('${e['date']}').toDouble();
    if (cut <= now) return null;
    final ctx = pricingContext(spec, sp.mid, cut, now, 1);
    final fwd = forwardOf(ctx);
    final ladder = _ladder(spec, '${e['date']}', sp.mid, ctx.quotes.atm, ctx.tCal);
    const tenors = [('ON', 1), ('1W', 7), ('2W', 14), ('1M', 30), ('2M', 61), ('3M', 91)];
    return {
      'underlying': u,
      'expiry': e['date'],
      'atmVol': ctx.quotes.atm,
      'points': [
        for (final k in ladder) {'strike': k, 'vol': volAtStrike(ctx, k)},
      ],
      'pillars': [
        for (final d in const [0.1, 0.25, 0.5, 0.75, 0.9])
          {'callDelta': d, 'vol': smileAtDelta(ctx.quotes, d), 'strike': strikeAtCallDelta(fwd, d, smileAtDelta(ctx.quotes, d), ctx.tVol)},
      ],
      'termStructure': [
        for (var i = 0; i < tenors.length; i++) {'tenor': tenors[i].$1, 'days': tenors[i].$2, 'atm': spec.atm[i]},
      ],
    };
  }

  Map<String, dynamic> _preview(PreviewOptionBook b, Map<String, dynamic> body) {
    final legs = jsonList(body['legs']);
    final est = <EstimateLeg>[];
    String? u;
    for (final l in legs) {
      final code = '${l['series']}';
      final p = parseSeriesCode(code);
      if (p == null) continue;
      u ??= p.underlying;
      est.add(
        EstimateLeg(
          series: code,
          right: p.right,
          strike: p.strike,
          side: l['side'] == 'sell' ? 'sell' : 'buy',
          contracts: numOr(l['contracts'], 1),
          quote: _q(code),
        ),
      );
    }
    if (u == null) {
      return {
        'ok': false,
        'reasons': ['no_price'],
        'legs': <Object>[],
        'netPremium': 0,
        'commission': 0,
        'breakevens': <Object>[],
        'greeks': <String, Object>{},
      };
    }
    final c = chain(u, parseSeriesCode(est.first.series)!.date);
    final pv = estimatePreview(
      underlying: u,
      legs: est,
      type: body['type'] == 'limit' ? 'limit' : 'market',
      limitPremium: numOf(body['limitPremium']),
      chain: c == null ? null : OptionChain.fromJson(c),
      account: (cash: 12480.55, margin: 1840.2, free: 10220.4),
    );
    final k = b.cent ? 100.0 : 1.0;
    return {
      'ok': pv.ok,
      'reasons': [for (final r in pv.reasons) r.code],
      'legs': [
        for (final l in pv.legs) {'series': l.series, 'side': l.side, 'contracts': l.contracts, 'price': l.price, 'premium': (l.premium ?? 0) * k},
      ],
      'netPremium': pv.netPremium * k,
      'commission': pv.commission * k,
      'marginBefore': pv.marginBefore * k,
      'marginAfter': pv.marginAfter * k,
      'freeMarginAfter': pv.freeMarginAfter * k,
      'cashAfter': pv.cashAfter * k,
      'maxProfit': pv.maxProfit == null ? null : pv.maxProfit! * k,
      'maxLoss': pv.maxLoss == null ? null : pv.maxLoss! * k,
      'breakevens': pv.breakevens,
      'greeks': pv.greeks,
      'currency': b.cent ? 'USC' : 'USD',
    };
  }

  (int, Object) _order(String? login, PreviewOptionBook b, Map<String, dynamic> body) {
    final cid = '${body['clientOrderId'] ?? ''}';
    if (cid.length < 8 || cid.length > 64) return (422, _err('validation', 'clientOrderId must be 8 to 64 characters.'));
    final legs = jsonList(body['legs']);
    if (legs.isEmpty) return (422, _err('validation', 'No legs.'));
    final comboId = legs.length > 1 ? 'c${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}' : null;
    final type = body['type'] == 'limit' ? 'limit' : 'market';
    final limit = numOf(body['limitPremium']);
    final fills = <Map<String, dynamic>>[];
    for (final l in legs) {
      final code = '${l['series']}';
      final q = _q(code);
      if (q == null) return (422, _err('no_price', 'No price for $code.'));
      if (q.state != 'open') return (422, _err(q.state == 'close_only' ? 'cutoff' : 'closed', 'This option no longer opens new positions.'));
      final side = l['side'] == 'sell' ? 'sell' : 'buy';
      final px = side == 'buy' ? q.ask : q.bid;
      if (type == 'limit' && limit != null && legs.length == 1 && (side == 'buy' ? limit < px : limit > px)) {
        final o = {
          'ticket': _ticket += 3,
          'login': int.tryParse(login ?? '') ?? login,
          'symbol': code,
          'side': side,
          'contracts': numOr(l['contracts'], 1),
          'type': body['trigger'] != null ? 'trigger' : 'limit',
          'limitPremium': limit,
          'trigger': body['trigger'],
          'placedAt': DateTime.now().toUtc().toIso8601String(),
          'option': _info(code),
        };
        b.orders.add(o);
        _changed();
        return (200, {'status': 'placed', 'order': o});
      }
      fills.add(
        _position(
          login ?? 'preview',
          b,
          code,
          side,
          numOr(l['contracts'], 1).round(),
          type == 'limit' && limit != null && legs.length == 1 ? limit : px,
          comboId: comboId,
        ),
      );
    }
    b.positions.addAll(fills);
    _changed();
    return (200, {'status': 'filled', 'positions': fills});
  }

  /// A ticket of a preview option position or order (the options mode closes these locally in previews).
  bool owns(String? login, String ticket) {
    final b = bookOf(login);
    return b.positions.any((p) => '${p['ticket']}' == ticket) || b.orders.any((o) => '${o['ticket']}' == ticket);
  }

  /// `POST trade/positions/{ticket}/close` for a preview option position: `{status, profit}` (account currency).
  (int, Object) closePosition(String? login, String ticket, {double? contracts}) {
    final b = bookOf(login);
    final p = b.positions.where((x) => '${x['ticket']}' == ticket).firstOrNull;
    if (p == null) return (404, _err('not_found', 'Position not found.'));
    final code = '${p['symbol']}';
    final q = _q(code);
    if (q == null) return (422, _err('no_price', 'No price.'));
    final side = '${p['side']}';
    final full = numOr(p['contracts']);
    final n = contracts == null ? full : math.min(full, contracts);
    final close = side == 'buy' ? q.bid : q.ask;
    final k = b.cent ? 100.0 : 1.0;
    final usd = usdPerUnitOfQuote(q);
    final profit = _r((side == 'buy' ? 1 : -1) * (close - numOr(p['openPrice'])) * usd * n * k, 2);
    b.deals.insert(0, {
      'id': _deal += 2,
      'login': p['login'],
      'positionTicket': p['ticket'],
      'symbol': code,
      'side': side == 'buy' ? 'sell' : 'buy',
      'positionSide': side,
      'entry': 'out',
      'volume': n,
      'price': close,
      'openPrice': p['openPrice'],
      'openTime': p['openTime'],
      'profit': profit,
      'swap': 0,
      'commission': _r(0.25 * n * k, 2),
      'reason': 'client',
      'time': DateTime.now().toUtc().toIso8601String(),
      'comboId': ?p['comboId'],
      'option': p['option'],
    });
    if (n >= full - 1e-9) {
      b.positions.remove(p);
    } else {
      p['contracts'] = full - n;
      p['volume'] = full - n;
    }
    _changed();
    return (200, {'status': 'closed', 'profit': profit});
  }

  /// `DELETE trade/orders/{ticket}` for a preview option order.
  (int, Object) cancelOrder(String? login, String ticket) {
    final b = bookOf(login);
    final before = b.orders.length;
    b.orders.removeWhere((o) => '${o['ticket']}' == ticket);
    if (b.orders.length == before) return (404, _err('not_found', 'Order not found.'));
    _changed();
    return (200, {'status': 'cancelled'});
  }

  (int, Object) _closeCombo(String? login, PreviewOptionBook b, String comboId) {
    final legs = b.positions.where((p) => p['comboId'] == comboId).toList();
    if (legs.isEmpty) return (404, _err('not_found', 'Strategy not found.'));
    var total = 0.0;
    for (final p in legs) {
      final r = closePosition(login, '${p['ticket']}');
      if (r.$2 is Map) total += numOr((r.$2 as Map)['profit']);
    }
    _changed();
    return (200, {'status': 'closed', 'comboId': comboId, 'profit': _r(total, 2), 'venue': 'house'});
  }

  /* ---------------- order book ---------------- */

  Map<String, dynamic>? depth(String code) {
    final q = seriesQuote(code);
    final spec = optionSpecs[parseSeriesCode(code)?.underlying ?? ''];
    if (q == null || spec == null) return null;
    final tick = defaultPremiumTick(spec);
    final bid = numOf(q['bid']);
    final ask = numOf(q['ask']);
    final r = math.Random(code.hashCode ^ (DateTime.now().millisecondsSinceEpoch ~/ 2000));
    List<List<num>> side(double? top, int dir) => top == null || top <= 0
        ? <List<num>>[]
        : [
            for (var i = 0; i < 10; i++)
              if (top + dir * i * tick * 2 > 0) [toTick(top + dir * i * tick * 2, tick), 1 + r.nextInt(14) + i * 2, 1 + r.nextInt(3)],
          ];
    return {'series': code, 'bids': side(bid, -1), 'asks': side(ask, 1), 'seq': DateTime.now().millisecondsSinceEpoch};
  }

  List<Map<String, dynamic>> trades(String code, int limit) {
    final q = seriesQuote(code);
    if (q == null) return const [];
    final mark = numOr(q['mark']);
    final spec = optionSpecs[parseSeriesCode(code)?.underlying ?? ''];
    final tick = spec == null ? 0.00001 : defaultPremiumTick(spec);
    final now = DateTime.now().millisecondsSinceEpoch;
    final r = math.Random(code.hashCode);
    return [
      for (var i = 0; i < math.min(limit, 24); i++)
        {
          'id': '${code.hashCode & 0xffff}-$i',
          'series': code,
          'price': toTick(mark * (1 + (r.nextDouble() - 0.5) * 0.06), tick),
          'qty': 1 + r.nextInt(6),
          'side': r.nextBool() ? 'buy' : 'sell',
          't': now - i * (40000 + r.nextInt(400000)),
          'kind': i == 5 ? 'combo' : 'book',
        },
    ];
  }

  (int, Object) _bookAnswer(String method, String p, Map<String, String> query, Map<String, dynamic> body, String? login, PreviewOptionBook b) {
    if (p == 'book/preview') {
      final code = '${body['series']}';
      final q = _q(code);
      if (q == null) return (422, _err('no_price', 'No price.'));
      final side = '${body['side']}';
      final qty = numOr(body['qty'], 1);
      final type = '${body['type']}';
      final price = numOf(body['price']);
      final touch = side == 'buy' ? q.ask : q.bid;
      final crosses = type == 'market' || (price != null && touch > 0 && (side == 'buy' ? price >= touch : price <= touch));
      final filled = type.startsWith('stop') ? 0.0 : (crosses ? math.min(qty, side == 'buy' ? (q.askQty ?? 0) : (q.bidQty ?? 0)) : 0.0);
      final usd = usdPerUnitOfQuote(q);
      return (
        200,
        {
          'ok': true,
          'reasons': <Object>[],
          'reserve': _r((price ?? touch) * usd * qty * (side == 'sell' ? 3 : 1), 2),
          'estAvgPrice': filled > 0 ? touch : null,
          'estFilled': filled,
          'fee': _r(filled * BookDefaults.takerFeePerContract, 2),
          'feeMaker': BookDefaults.makerFeePerContract,
          'feeCapPct': BookDefaults.feeCapPct,
          'usdPerUnit': usd,
          if (type == 'market') 'price': side == 'buy' ? q.mark * 1.1 : q.mark * 0.9,
          'freeMarginAfter': 10220.4,
        },
      );
    }
    if (p == 'book/orders' && method == 'POST') {
      final code = '${body['series']}';
      final q = _q(code);
      if (q == null) return (422, _err('no_price', 'No price.'));
      final side = '${body['side']}';
      final qty = numOr(body['qty'], 1);
      final type = '${body['type']}';
      final price = numOf(body['price']);
      final touch = side == 'buy' ? q.ask : q.bid;
      final id = '${_orderSeq += 7}';
      final now = DateTime.now().toUtc().toIso8601String();
      final crosses = type == 'market' || (price != null && touch > 0 && (side == 'buy' ? price >= touch : price <= touch));
      if (type.startsWith('stop') || !crosses) {
        if (type != 'limit' && !type.startsWith('stop')) return (200, {'status': 'cancelled', 'reason': 'no_liquidity', 'order': null, 'fills': <Object>[]});
        if (body['tif'] == 'ioc' || body['tif'] == 'fok') {
          return (200, {'status': 'cancelled', 'reason': body['tif'] == 'fok' ? 'fok_not_filled' : 'ioc_remainder', 'order': null, 'fills': <Object>[]});
        }
        final o = {
          'id': id,
          'series': code,
          'side': side,
          'type': type,
          'qty': qty,
          'filled': 0,
          'left': qty,
          'price': price,
          'tif': body['tif'] ?? 'gtc',
          'expireAt': body['expireAt'],
          'flags': [if (body['postOnly'] == true) 'post_only', if (body['reduceOnly'] == true) 'reduce_only'],
          'reserved': _r((price ?? q.mark) * usdPerUnitOfQuote(q) * qty, 2),
          'createdAt': now,
          'status': 'working',
          'trigger': body['trigger'],
        };
        b.bookOrders.insert(0, o);
        _changed();
        return (200, {'status': 'working', 'order': o, 'fills': <Object>[]});
      }
      final pos = _position(login ?? 'preview', b, code, side, qty.round(), touch, venue: 'book');
      b.positions.add(pos);
      _changed();
      final fill = {
        'fillId': 'f$id',
        'orderId': id,
        'series': code,
        'side': side,
        'price': touch,
        'qty': qty,
        'role': 'taker',
        'fee': _r(qty * BookDefaults.takerFeePerContract, 2),
        'positionTicket': pos['ticket'],
        'at': now,
      };
      return (
        200,
        {
          'status': 'filled',
          'order': {
            'id': id,
            'series': code,
            'side': side,
            'type': type,
            'qty': qty,
            'filled': qty,
            'left': 0,
            'avgPrice': touch,
            'price': price,
            'tif': body['tif'] ?? 'ioc',
            'createdAt': now,
            'status': 'filled',
          },
          'fills': [fill],
        },
      );
    }
    if (p == 'book/orders' && method == 'GET') {
      return (200, {'orders': query['status'] == 'history' ? <Object>[] : b.bookOrders});
    }
    if (p == 'book/fills') return (200, {'fills': <Object>[]});
    final one = RegExp(r'^book/orders/([^/]+)$').firstMatch(p);
    if (one != null) {
      final id = Uri.decodeComponent(one[1]!);
      final o = b.bookOrders.where((x) => '${x['id']}' == id).firstOrNull;
      if (o == null) return (404, _err('not_found', 'Order not found.'));
      if (method == 'DELETE') {
        b.bookOrders.remove(o);
        _changed();
        return (
          200,
          {
            'status': 'cancelled',
            'order': {...o, 'status': 'cancelled'},
          },
        );
      }
      if (body['price'] != null) o['price'] = body['price'];
      if (body['qty'] != null) o['qty'] = body['qty'];
      _changed();
      return (200, {'status': 'working', 'order': o, 'fills': <Object>[]});
    }
    if (p == 'rfq' && method == 'POST') {
      final id = 'r${_orderSeq += 3}';
      final legs = jsonList(body['legs']);
      final rfq = {
        'id': id,
        'expiresAt': DateTime.now().add(const Duration(seconds: 30)).toUtc().toIso8601String(),
        'legs': legs,
        'qty': body['qty'] ?? 1,
        'status': 'open',
      };
      _rfqs[id] = rfq;
      return (200, {'rfq': rfq, 'quotes': <Object>[]});
    }
    final rq = RegExp(r'^rfq/([^/]+)(/accept)?$').firstMatch(p);
    if (rq != null) {
      final id = Uri.decodeComponent(rq[1]!);
      final rfq = _rfqs[id];
      if (rfq == null) return (404, _err('rfq_expired', 'The request expired.'));
      final expired = DateTime.parse('${rfq['expiresAt']}').isBefore(DateTime.now());
      if (method == 'DELETE') {
        _rfqs.remove(id);
        return (200, {'status': 'cancelled'});
      }
      if (rq[2] == null) {
        if (expired) {
          return (
            200,
            {
              'rfq': {...rfq, 'status': 'expired'},
              'quotes': <Object>[],
            },
          );
        }
        var net = 0.0;
        for (final l in jsonList(rfq['legs'])) {
          final q = _q('${l['series']}');
          if (q == null) continue;
          net += (l['side'] == 'sell' ? -1 : 1) * numOr(l['ratio'], 1) * q.mark;
        }
        final spread = math.max(net.abs() * 0.04, 0.00002);
        final slot = DateTime.now().millisecondsSinceEpoch ~/ 5000;
        return (
          200,
          {
            'rfq': rfq,
            'quotes': [
              {
                'quoteId': 'q$id-$slot',
                'responder': 'kalks-mm',
                'bid': net - spread,
                'ask': net + spread,
                'qty': rfq['qty'],
                'validUntil': DateTime.fromMillisecondsSinceEpoch((slot + 1) * 5000, isUtc: true).toIso8601String(),
              },
            ],
          },
        );
      }
      if (expired) return (409, _err('rfq_expired', 'The request expired.'));
      final side = '${body['side']}';
      final comboId = 'c${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}';
      final fills = <Map<String, dynamic>>[];
      for (final l in jsonList(rfq['legs'])) {
        final code = '${l['series']}';
        final q = _q(code);
        if (q == null) continue;
        final legSide = side == 'buy' ? '${l['side']}' : (l['side'] == 'buy' ? 'sell' : 'buy');
        final qty = numOr(l['ratio'], 1) * numOr(rfq['qty'], 1);
        b.positions.add(_position(login ?? 'preview', b, code, legSide, qty.round(), q.mark, comboId: comboId, venue: 'book'));
        fills.add({
          'fillId': 'f$comboId${fills.length}',
          'series': code,
          'side': legSide,
          'price': q.mark,
          'qty': qty,
          'role': 'taker',
          'fee': 0.25 * qty,
          'comboId': comboId,
        });
      }
      _rfqs.remove(id);
      _changed();
      return (200, {'status': 'filled', 'comboId': comboId, 'net': body['limitNet'], 'fills': fills});
    }
    return (404, _err('not_found', 'Not in the preview options server.'));
  }

  /* ---------------- the stream ---------------- */

  /// OptionsStream's connector in previews and tests.
  WebSocketChannel connector(Uri url) => _OptChannel(this);
}

/// The options stream played in memory: the full chain on subscribe, then changed rows twice a second, changed
/// series quotes, depth and tape of the followed series, a heartbeat.
class _OptChannel implements WebSocketChannel {
  _OptChannel(this.server) {
    sink = _OptSink(this);
    _timer = Timer.periodic(const Duration(milliseconds: 500), (_) => _tick());
  }

  final PreviewOptions server;
  // closed by close()
  // ignore: close_sinks
  final StreamController<Object?> _in = StreamController<Object?>();
  late final Timer _timer;
  bool _closed = false;
  int _n = 0;
  final Map<String, ({String u, String expiry, Map<String, String> last})> _chains = {};
  final Map<String, String> _series = {};
  final Set<String> _depth = {};
  final Set<String> _tape = {};

  @override
  // closed by the socket that uses this channel
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

  void send(Map<String, dynamic> frame) {
    if (!_closed) _in.add(jsonEncode(frame));
  }

  void close() {
    if (_closed) return;
    _closed = true;
    _timer.cancel();
    unawaited(_in.close());
  }

  static String _sig(Object? q) => q is Map ? '${q['bid']}|${q['ask']}|${q['bidQty']}|${q['askQty']}|${q['state']}' : '';

  void _full(String key, String u, String expiry) {
    final c = server.chain(u, expiry);
    if (c == null) return;
    _chains[key] = (u: u, expiry: expiry, last: {for (final r in jsonList(c['rows'])) '${r['strikeLabel']}': '${_sig(r['call'])}/${_sig(r['put'])}'});
    send({'type': 'chain', ...c});
  }

  void received(Map<String, dynamic> m) {
    switch (m['op']) {
      case 'subscribe':
        if (m['u'] is String && m['expiry'] is String) {
          final key = '${m['u']}|${m['expiry']}';
          scheduleMicrotask(() => _full(key, m['u'] as String, m['expiry'] as String));
        }
        for (final s in (m['series'] as List? ?? const <Object?>[])) {
          _series['$s'] = '';
        }
      case 'unsubscribe':
        if (m['u'] is String) _chains.remove('${m['u']}|${m['expiry']}');
        for (final s in (m['series'] as List? ?? const <Object?>[])) {
          _series.remove('$s');
        }
      case 'depth':
        _depth
          ..clear()
          ..addAll([for (final s in (m['series'] as List? ?? const <Object?>[])) '$s']);
        scheduleMicrotask(() {
          for (final s in _depth) {
            final d = server.depth(s);
            if (d != null) send({'type': 'depth', ...d});
          }
        });
      case 'tape':
        _tape
          ..clear()
          ..addAll([for (final s in (m['series'] as List? ?? const <Object?>[])) '$s']);
        scheduleMicrotask(() {
          for (final s in _tape) {
            send({'type': 'tape', 'trades': server.trades(s, 30).reversed.toList()});
          }
        });
    }
  }

  void _tick() {
    if (_closed) return;
    _n++;
    for (final e in _chains.entries.toList()) {
      final c = server.chain(e.value.u, e.value.expiry);
      if (c == null) continue;
      final rows = jsonList(c['rows']);
      if (rows.length != e.value.last.length) {
        _full(e.key, e.value.u, e.value.expiry);
        continue;
      }
      final changed = <Map<String, dynamic>>[];
      for (final r in rows) {
        final sig = '${_sig(r['call'])}/${_sig(r['put'])}';
        if (e.value.last['${r['strikeLabel']}'] != sig) {
          e.value.last['${r['strikeLabel']}'] = sig;
          changed.add(r);
        }
      }
      if (changed.isNotEmpty) send({'type': 'rows', 'u': c['underlying'], 'expiry': c['expiry'], 'spot': c['spot'], 'state': c['state'], 'rows': changed});
    }
    final quotes = <Map<String, dynamic>>[];
    for (final code in _series.keys.toList()) {
      final q = server.seriesQuote(code);
      if (q == null) continue;
      final sig = _sig(q);
      if (sig != _series[code]) {
        _series[code] = sig;
        quotes.add(q);
      }
    }
    if (quotes.isNotEmpty) send({'type': 'series', 'quotes': quotes});
    if (_n % 2 == 0) {
      for (final s in _depth) {
        final d = server.depth(s);
        if (d != null) send({'type': 'depth', ...d});
      }
    }
    if (_n % 10 == 0) send({'type': 'hb', 't': DateTime.now().millisecondsSinceEpoch});
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _OptSink implements WebSocketSink {
  _OptSink(this.ch);
  final _OptChannel ch;

  @override
  void add(Object? data) {
    try {
      final m = jsonDecode('$data');
      if (m is Map) ch.received(m.cast<String, dynamic>());
    } catch (_) {}
  }

  @override
  void addError(Object error, [StackTrace? stackTrace]) {}

  @override
  Future<void> addStream(Stream<Object?> stream) async {}

  @override
  Future<void> close([int? closeCode, String? closeReason]) async => ch.close();

  @override
  Future<void> get done => Future<void>.value();
}
