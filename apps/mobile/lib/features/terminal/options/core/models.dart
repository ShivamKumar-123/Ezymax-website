// Ezymex FX Options shapes (web: apps/terminal/lib/options/types.ts, normalize.ts and book.ts; wire shapes in
// packages/mock/src/options.ts). The options service sends chains, expiries and underlyings; the engine positions,
// orders, deals, previews and book orders. Everything is parsed defensively (fields may be added or arrive as strings).
// The order book (docs/OPTIONS-EXCHANGE.md §10): the service merges the engine's top of book into each chain row:
// `bid` / `ask` are the best bid / offer, null for an empty side, kept here as 0 with `bidQty` / `askQty` null, and
// the USD fields are filled from the mark's own USD rate when the service leaves them out.
import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import 'pricer.dart';

typedef Json = Map<String, dynamic>;

double? numOf(Object? v) {
  if (v is num) return v.isFinite ? v.toDouble() : null;
  if (v is String && v.trim().isNotEmpty) {
    final d = double.tryParse(v);
    return d != null && d.isFinite ? d : null;
  }
  return null;
}

double numOr(Object? v, [double fallback = 0]) => numOf(v) ?? fallback;

String? strOf(Object? v) {
  if (v is String && v.isNotEmpty) return v;
  if (v is num && v.isFinite) return v is int || v == v.roundToDouble() ? '${v.toInt()}' : '$v';
  return null;
}

/// ISO text of a time field (ISO string, unix seconds or ms).
String? isoOf(Object? v) {
  if (v is String && v.isNotEmpty) return v;
  if (v is num && v.isFinite) {
    final ms = v > 1e12 ? v.toInt() : (v * 1000).toInt();
    return DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true).toIso8601String();
  }
  return null;
}

Json jsonOf(Object? v) => v is Map ? v.cast<String, dynamic>() : const <String, dynamic>{};
List<Json> jsonList(Object? v) => [
  for (final x in (v is List ? v : const <Object?>[]))
    if (x is Map) x.cast<String, dynamic>(),
];

int msOf(String? iso) => iso == null ? 0 : (DateTime.tryParse(iso)?.millisecondsSinceEpoch ?? 0);

/* ------------------------------------------------------------------ */
/* Options service                                                     */
/* ------------------------------------------------------------------ */

@immutable
class OptionUnderlying {
  const OptionUnderlying({
    required this.symbol,
    required this.name,
    required this.assetClass,
    required this.contractSize,
    required this.contractUnit,
    required this.digits,
    required this.pipSize,
    required this.minContracts,
    required this.maxContracts,
    required this.contractStep,
    this.atmVol,
    this.realizedVol,
    this.premiumTick,
    this.quoteCcy = 'USD',
  });
  final String symbol, name, assetClass, contractUnit, quoteCcy;
  final double contractSize;
  final int digits;
  final double pipSize;
  final int minContracts, maxContracts, contractStep;
  final double? atmVol, realizedVol, premiumTick;

  static OptionUnderlying fromJson(Json j) {
    final sym = '${j['symbol'] ?? ''}';
    final spec = optionSpecs[sym];
    return OptionUnderlying(
      symbol: sym,
      name: '${j['name'] ?? spec?.name ?? sym}',
      assetClass: '${j['assetClass'] ?? spec?.assetClass ?? 'forex'}',
      contractSize: numOf(j['contractSize']) ?? spec?.contractSize ?? 1,
      contractUnit: '${j['contractUnit'] ?? spec?.contractUnit ?? ''}',
      quoteCcy: '${j['quoteCcy'] ?? spec?.quoteCcy ?? 'USD'}',
      digits: numOf(j['digits'])?.toInt() ?? spec?.digits ?? 5,
      pipSize: numOf(j['pipSize']) ?? spec?.pipSize ?? 0.0001,
      minContracts: numOf(j['minContracts'])?.toInt() ?? OptionDefaults.minContracts,
      maxContracts: numOf(j['maxContracts'])?.toInt() ?? OptionDefaults.maxContracts,
      contractStep: numOf(j['contractStep'])?.toInt() ?? OptionDefaults.contractStep,
      atmVol: numOf(j['atmVol']),
      realizedVol: numOf(j['realizedVol']),
      premiumTick: numOf(j['premiumTick']),
    );
  }
}

@immutable
class OptionExpiry {
  const OptionExpiry({required this.date, required this.kinds, required this.cutAt, this.status = 'listed', this.state = 'open'});

  /// YYYY-MM-DD
  final String date;

  /// daily | weekly | monthly
  final List<String> kinds;
  final String cutAt;
  final String status;

  /// open | close_only | halted | closed
  final String state;

  int get cutMs => msOf(cutAt);

  static OptionExpiry fromJson(Json j) => OptionExpiry(
    date: '${j['date'] ?? ''}',
    kinds: [for (final k in (j['kinds'] as List? ?? const <Object?>[])) '$k'],
    cutAt: isoOf(j['cutAt']) ?? '',
    status: '${j['status'] ?? 'listed'}',
    state: '${j['state'] ?? 'open'}',
  );
}

/// One series' quote: premium per unit of the underlying (quote currency), the USD fields per contract.
@immutable
class OptionQuote {
  const OptionQuote({
    required this.code,
    required this.bid,
    required this.ask,
    required this.mark,
    required this.bidUsd,
    required this.askUsd,
    required this.markUsd,
    this.markPips = 0,
    this.iv = 0,
    this.ivBid = 0,
    this.ivAsk = 0,
    this.delta = 0,
    this.gamma = 0,
    this.vega = 0,
    this.theta = 0,
    this.probItm = 0,
    this.breakeven = 0,
    this.state = 'open',
    this.oi,
    this.volume,
    this.change,
    this.book = false,
    this.bidQty,
    this.askQty,
    this.last,
    this.lastUsd,
    this.lastQty,
    this.theo,
    this.theoUsd,
    this.theoIv,
    this.markIv,
    this.bidIv,
    this.askIv,
  });

  final String code;
  final double bid, ask, mark, bidUsd, askUsd, markUsd, markPips;
  final double iv, ivBid, ivAsk, delta, gamma, vega, theta, probItm, breakeven;
  final String state;
  final double? oi, volume, change;

  /// The quote came from the order book.
  final bool book;
  final double? bidQty, askQty, last, lastUsd, lastQty, theo, theoUsd, theoIv, markIv, bidIv, askIv;

  /// A cheap signature of what the screens show (stream diffs, tests).
  String get sig => '$bid|$ask|${bidQty ?? ''}|${askQty ?? ''}|${volume ?? ''}|$state|$mark';

  /// normQuote: house quotes pass through; book quotes (or a null side) get the terminal's one shape.
  static OptionQuote? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final x = raw.cast<String, dynamic>();
    final code = '${x['code'] ?? ''}';
    if (code.isEmpty) return null;
    final hasBook = x.containsKey('bidQty') || x.containsKey('askQty') || x.containsKey('theo');
    final common = (
      markPips: numOr(x['markPips']),
      delta: numOr(x['delta']),
      gamma: numOr(x['gamma']),
      vega: numOr(x['vega']),
      theta: numOr(x['theta']),
      probItm: numOr(x['probItm']),
      breakeven: numOr(x['breakeven']),
      state: '${x['state'] ?? 'open'}',
    );
    if (!hasBook && x['bid'] != null && x['ask'] != null) {
      return OptionQuote(
        code: code,
        bid: numOr(x['bid']),
        ask: numOr(x['ask']),
        mark: numOr(x['mark']),
        bidUsd: numOr(x['bidUsd']),
        askUsd: numOr(x['askUsd']),
        markUsd: numOr(x['markUsd']),
        markPips: common.markPips,
        iv: numOr(x['iv']),
        ivBid: numOr(x['ivBid']),
        ivAsk: numOr(x['ivAsk']),
        delta: common.delta,
        gamma: common.gamma,
        vega: common.vega,
        theta: common.theta,
        probItm: common.probItm,
        breakeven: common.breakeven,
        state: common.state,
        oi: numOf(x['oi']),
        volume: numOf(x['volume']),
        change: numOf(x['change']),
        last: numOf(x['ltp']),
      );
    }
    final mark = numOf(x['mark']) ?? 0;
    final markUsd = numOf(x['markUsd']) ?? 0;
    double k;
    if (mark > 0 && markUsd > 0) {
      k = markUsd / mark;
    } else {
      final a = numOf(x['ask']);
      final au = numOf(x['askUsd']);
      k = a != null && a != 0 && au != null ? au / a : 0;
    }
    double? usdOf(double? unit, Object? usd) => numOf(usd) ?? (unit != null && k > 0 ? (unit * k * 100).round() / 100 : null);
    final bid = numOf(x['bid']);
    final ask = numOf(x['ask']);
    final last = numOf(x['last']) ?? numOf(x['ltp']);
    final theo = numOf(x['theo']);
    return OptionQuote(
      code: code,
      book: true,
      bid: bid ?? 0,
      ask: ask ?? 0,
      bidUsd: bid == null ? 0 : (usdOf(bid, x['bidUsd']) ?? 0),
      askUsd: ask == null ? 0 : (usdOf(ask, x['askUsd']) ?? 0),
      bidQty: bid == null ? null : numOf(x['bidQty']),
      askQty: ask == null ? null : numOf(x['askQty']),
      mark: mark,
      markUsd: markUsd,
      markPips: common.markPips,
      last: last,
      lastUsd: last == null ? null : usdOf(last, x['lastUsd']),
      lastQty: numOf(x['lastQty']),
      theo: theo,
      theoUsd: theo == null ? null : usdOf(theo, x['theoUsd']),
      theoIv: numOf(x['theoIv']),
      markIv: numOf(x['markIv']),
      bidIv: numOf(x['bidIv']),
      askIv: numOf(x['askIv']),
      oi: numOf(x['oi']),
      volume: numOf(x['volume']),
      change: numOf(x['change']),
      iv: numOf(x['iv']) ?? numOf(x['markIv']) ?? numOf(x['theoIv']) ?? 0,
      ivBid: numOf(x['ivBid']) ?? numOf(x['bidIv']) ?? numOf(x['iv']) ?? 0,
      ivAsk: numOf(x['ivAsk']) ?? numOf(x['askIv']) ?? numOf(x['iv']) ?? 0,
      delta: common.delta,
      gamma: common.gamma,
      vega: common.vega,
      theta: common.theta,
      probItm: common.probItm,
      breakeven: common.breakeven,
      state: common.state,
    );
  }
}

/// USD per contract for one unit of premium of a quote (contract size × USD per quote currency), 0 when unknown.
double usdPerUnitOfQuote(OptionQuote? q) {
  if (q == null) return 0;
  if (q.mark > 0 && q.markUsd > 0) return q.markUsd / q.mark;
  if (q.ask > 0 && q.askUsd > 0) return q.askUsd / q.ask;
  if (q.bid > 0 && q.bidUsd > 0) return q.bidUsd / q.bid;
  return 0;
}

@immutable
class OptionChainRow {
  const OptionChainRow({required this.strike, required this.strikeLabel, this.call, this.put});
  final double strike;
  final String strikeLabel;
  final OptionQuote? call, put;

  OptionQuote? of(OptionRight r) => r == 'call' ? call : put;

  static OptionChainRow fromJson(Json j) => OptionChainRow(
    strike: numOr(j['strike']),
    strikeLabel: '${j['strikeLabel'] ?? j['strike'] ?? ''}',
    call: OptionQuote.fromJson(j['call']),
    put: OptionQuote.fromJson(j['put']),
  );
}

/// The book of a chain (header): live for this broker and account kind, its tick, bands and fees.
@immutable
class ChainBook {
  const ChainBook({
    required this.active,
    this.premiumTick,
    this.marketBandPct,
    this.limitBandPct,
    this.bandMinTicks,
    this.makerFeePerContract,
    this.takerFeePerContract,
    this.feeCapPct,
  });
  final bool active;
  final double? premiumTick, marketBandPct, limitBandPct, bandMinTicks, makerFeePerContract, takerFeePerContract, feeCapPct;

  /// `book: {active, …}`, `book: true`, `venue: "book"` or `bookActive`; rows with book fields; null = house prices.
  static ChainBook? fromChain(Json raw) {
    final b = raw['book'];
    final fees = jsonOf(raw['fees']);
    if (b is Map) {
      final o = b.cast<String, dynamic>();
      return ChainBook(
        active: o['active'] != false,
        premiumTick: numOf(o['premiumTick']),
        marketBandPct: numOf(o['marketBandPct']),
        limitBandPct: numOf(o['limitBandPct']),
        bandMinTicks: numOf(o['bandMinTicks']),
        makerFeePerContract: numOf(o['makerFeePerContract']) ?? numOf(fees['makerFeePerContract']),
        takerFeePerContract: numOf(o['takerFeePerContract']) ?? numOf(fees['takerFeePerContract']),
        feeCapPct: numOf(o['feeCapPct']),
      );
    }
    if (b == true || raw['venue'] == 'book' || raw['bookActive'] == true) {
      return ChainBook(
        active: true,
        makerFeePerContract: numOf(fees['makerFeePerContract']),
        takerFeePerContract: numOf(fees['takerFeePerContract']),
        feeCapPct: numOf(fees['feeCapPct']),
      );
    }
    for (final r in jsonList(raw['rows'])) {
      final q = r['call'] ?? r['put'];
      if (q is Map) {
        if (q.containsKey('bidQty') || q.containsKey('askQty') || q.containsKey('theo')) return const ChainBook(active: true);
        break;
      }
    }
    return null;
  }
}

@immutable
class ChainSpot {
  const ChainSpot(this.bid, this.ask, this.mid);
  final double bid, ask, mid;

  static ChainSpot? fromJson(Object? v) {
    if (v is! Map) return null;
    final j = v.cast<String, dynamic>();
    final bid = numOr(j['bid']), ask = numOr(j['ask']);
    final mid = numOf(j['mid']) ?? (bid + ask) / 2;
    return mid > 0 ? ChainSpot(bid, ask, mid) : null;
  }
}

@immutable
class OptionChain {
  const OptionChain({
    required this.underlying,
    required this.name,
    required this.expiry,
    required this.kinds,
    required this.cutAt,
    required this.cutTime,
    required this.cutZone,
    required this.state,
    required this.contractSize,
    required this.contractUnit,
    required this.quoteCcy,
    required this.digits,
    required this.pipSize,
    required this.commissionPerContract,
    required this.commissionCapPct,
    required this.rows,
    this.spot,
    this.atmStrike,
    this.error,
    this.book,
    this.pcr,
    this.expiries = const [],
  });

  final String underlying, name, expiry;
  final List<String> kinds;
  final String cutAt, cutTime, cutZone, state;
  final double contractSize;
  final String contractUnit, quoteCcy;
  final int digits;
  final double pipSize, commissionPerContract, commissionCapPct;
  final List<OptionChainRow> rows;
  final ChainSpot? spot;
  final double? atmStrike;
  final String? error;

  /// The order book of this chain (null = house prices).
  final ChainBook? book;

  /// Put / call ratio of the expiry (open interest), once the book reports it.
  final double? pcr;

  /// The public chain's open expiries.
  final List<OptionExpiry> expiries;

  int get cutMs => msOf(cutAt);

  OptionChain copyWith({List<OptionChainRow>? rows, ChainSpot? spot, String? state}) => OptionChain(
    underlying: underlying,
    name: name,
    expiry: expiry,
    kinds: kinds,
    cutAt: cutAt,
    cutTime: cutTime,
    cutZone: cutZone,
    state: state ?? this.state,
    contractSize: contractSize,
    contractUnit: contractUnit,
    quoteCcy: quoteCcy,
    digits: digits,
    pipSize: pipSize,
    commissionPerContract: commissionPerContract,
    commissionCapPct: commissionCapPct,
    rows: rows ?? this.rows,
    spot: spot ?? this.spot,
    atmStrike: atmStrike,
    error: error,
    book: book,
    pcr: pcr,
    expiries: expiries,
  );

  /// normChain: book quotes normalised, the book header read.
  static OptionChain fromJson(Json j) {
    final u = '${j['underlying'] ?? ''}';
    final spec = optionSpecs[u];
    final cut = jsonOf(j['cut']);
    final com = jsonOf(j['commission']);
    final err = j['error'];
    return OptionChain(
      underlying: u,
      name: '${j['name'] ?? spec?.name ?? u}',
      expiry: '${j['expiry'] ?? ''}',
      kinds: [for (final k in (j['kinds'] as List? ?? const <Object?>[])) '$k'],
      cutAt: isoOf(j['cutAt']) ?? '',
      cutTime: '${cut['time'] ?? '10:00'}',
      cutZone: '${cut['zone'] ?? 'America/New_York'}',
      state: '${j['state'] ?? 'open'}',
      contractSize: numOf(j['contractSize']) ?? spec?.contractSize ?? 1,
      contractUnit: '${j['contractUnit'] ?? spec?.contractUnit ?? ''}',
      quoteCcy: '${j['quoteCcy'] ?? spec?.quoteCcy ?? 'USD'}',
      digits: numOf(j['digits'])?.toInt() ?? spec?.digits ?? 5,
      pipSize: numOf(j['pipSize']) ?? spec?.pipSize ?? 0.0001,
      commissionPerContract: numOf(com['perContract']) ?? OptionDefaults.commissionPerContract,
      commissionCapPct: numOf(com['capPct']) ?? OptionDefaults.commissionCapPct,
      rows: [for (final r in jsonList(j['rows'])) OptionChainRow.fromJson(r)],
      spot: ChainSpot.fromJson(j['spot']),
      atmStrike: numOf(j['atmStrike']),
      error: err is Map ? '${err['code'] ?? 'error'}' : null,
      book: ChainBook.fromChain(j),
      pcr: numOf(j['pcr']),
      expiries: [for (final e in jsonList(j['expiries'])) OptionExpiry.fromJson(e)],
    );
  }
}

/// One price level of a series' book: price per unit (quote currency), contracts, resting orders.
@immutable
class DepthLevel {
  const DepthLevel(this.price, this.qty, [this.orders]);
  final double price, qty;
  final double? orders;
}

@immutable
class SeriesDepth {
  const SeriesDepth({required this.series, required this.bids, required this.asks, this.seq});
  final String series;
  final List<DepthLevel> bids, asks;
  final double? seq;

  static List<DepthLevel> _levels(Object? v) {
    final out = <DepthLevel>[];
    for (final l in (v is List ? v : const <Object?>[])) {
      if (l is List && l.length >= 2) {
        final p = numOf(l[0]), q = numOf(l[1]);
        if (p != null && q != null) out.add(DepthLevel(p, q, l.length > 2 ? numOf(l[2]) : null));
      } else if (l is Map) {
        final p = numOf(l['price']) ?? numOf(l['px']) ?? numOf(l['p']);
        final q = numOf(l['qty']) ?? numOf(l['size']) ?? numOf(l['q']);
        if (p != null && q != null) out.add(DepthLevel(p, q, numOf(l['orders']) ?? numOf(l['n'])));
      }
    }
    return out.take(10).toList();
  }

  static SeriesDepth? fromJson(Object? raw, {String? series}) {
    if (raw is! Map) return null;
    final s = strOf(raw['series']) ?? strOf(raw['code']) ?? series;
    if (s == null) return null;
    return SeriesDepth(series: s, bids: _levels(raw['bids']), asks: _levels(raw['asks']), seq: numOf(raw['seq']));
  }
}

/// A print on the trade tape: per unit, contracts, the taker's side.
@immutable
class TapeTrade {
  const TapeTrade({required this.id, required this.series, required this.price, required this.qty, required this.side, required this.t, this.kind});
  final String id, series;
  final double price, qty;
  final String side;

  /// ms
  final int t;
  final String? kind;

  static TapeTrade? fromJson(Object? raw, {String? series}) {
    if (raw is! Map) return null;
    final price = numOf(raw['price']) ?? numOf(raw['px']);
    final qty = numOf(raw['qty']) ?? numOf(raw['size']);
    final s = strOf(raw['series']) ?? series;
    if (price == null || qty == null || s == null) return null;
    final side = raw['side'] ?? raw['takerSide'] ?? raw['taker'];
    var t =
        numOf(raw['t']) ??
        (raw['at'] is String ? DateTime.tryParse(raw['at'] as String)?.millisecondsSinceEpoch.toDouble() : null) ??
        DateTime.now().millisecondsSinceEpoch.toDouble();
    if (t < 1e12) t *= 1000;
    return TapeTrade(
      id: strOf(raw['id']) ?? strOf(raw['fillId']) ?? '$s-${t.toInt()}-$price-$qty',
      series: s,
      price: price,
      qty: qty,
      side: side == 'sell' ? 'sell' : 'buy',
      t: t.toInt(),
      kind: strOf(raw['kind']),
    );
  }
}

/* ------------------------------------------------------------------ */
/* Engine: positions, orders, closed trades                            */
/* ------------------------------------------------------------------ */

@immutable
class OptionBarrier {
  const OptionBarrier({this.kind, this.level, this.rebate, this.knockedIn = false});
  final String? kind;
  final double? level, rebate;
  final bool knockedIn;
}

/// `option` of an engine position / order / deal.
@immutable
class OptionInfo {
  const OptionInfo({
    required this.series,
    required this.underlying,
    required this.right,
    required this.strike,
    required this.expiry,
    required this.expiryAt,
    this.barrier,
    this.contractSize = 0,
  });
  final String series, underlying;
  final OptionRight right;
  final double strike;

  /// YYYY-MM-DD
  final String expiry;

  /// The cut (ISO), '' when the engine didn't send it.
  final String expiryAt;
  final OptionBarrier? barrier;
  final double contractSize;

  static final RegExp _re = RegExp(r'^([A-Z0-9]{3,12})-(\d{4})(\d{2})(\d{2})-([0-9.]+)-([CP])');

  static OptionInfo of(Json x) {
    final o = jsonOf(x['option']);
    final series = strOf(o['series']) ?? strOf(x['symbol']) ?? '';
    final m = _re.firstMatch(series);
    final b = o['barrier'];
    OptionBarrier? barrier;
    if (b is Map) {
      barrier = OptionBarrier(
        kind: strOf(b['kind']) ?? strOf(b['type']),
        level: numOf(b['level']) ?? numOf(b['price']),
        rebate: numOf(b['rebate']),
        knockedIn: b['knockedIn'] == true,
      );
    }
    final exp = strOf(o['expiry']);
    return OptionInfo(
      series: series,
      underlying: strOf(o['underlying']) ?? m?[1] ?? '',
      right: o['right'] == 'put' || o['right'] == 'call' ? o['right'] as String : (m?[6] == 'P' ? 'put' : 'call'),
      strike: numOf(o['strike']) ?? (m == null ? 0 : double.tryParse(m[5]!) ?? 0),
      expiry: exp != null && exp.length >= 10 ? exp.substring(0, 10) : (m == null ? '' : '${m[2]}-${m[3]}-${m[4]}'),
      expiryAt: strOf(o['expiryAt']) ?? '',
      barrier: barrier,
      contractSize: numOf(o['contractSize']) ?? 0,
    );
  }
}

/// An open option position. Money (commission, profit) in USD; premiums per unit in the quote currency.
@immutable
class OptPosition {
  const OptPosition({
    required this.ticket,
    required this.login,
    required this.side,
    required this.contracts,
    required this.openPrice,
    required this.openTime,
    required this.commission,
    required this.option,
    this.profit,
    this.mark,
    this.greeks,
    this.comboId,
    this.venue,
  });
  final String ticket, login, side;
  final double contracts, openPrice;
  final String openTime;
  final double commission;
  final double? profit, mark;
  final Map<String, double>? greeks;
  final String? comboId;

  /// book | house
  final String? venue;
  final OptionInfo option;

  bool get buy => side == 'buy';

  /// mapOptionPosition (cent accounts: USC ÷ 100).
  static OptPosition fromJson(Json x, {bool cent = false}) {
    final k = cent ? 100.0 : 1.0;
    final profit = numOf(x['profit']);
    final g = x['greeks'];
    return OptPosition(
      ticket: '${x['ticket']}',
      login: '${x['login'] ?? ''}',
      side: x['side'] == 'sell' ? 'sell' : 'buy',
      contracts: numOf(x['contracts']) ?? numOf(x['volume']) ?? 0,
      openPrice: numOr(x['openPrice']),
      openTime: strOf(x['openTime']) ?? DateTime.now().toUtc().toIso8601String(),
      commission: numOr(x['commission']) / k,
      profit: profit == null ? null : profit / k,
      mark: numOf(x['mark']) ?? numOf(x['currentPrice']),
      greeks: g is Map ? {for (final e in g.entries) '${e.key}': numOr(e.value)} : null,
      comboId: strOf(x['comboId']),
      venue: strOf(x['venue']) ?? strOf(jsonOf(x['option'])['venue']),
      option: OptionInfo.of(x),
    );
  }
}

/// A working option order (limit premium / underlying trigger), house flow.
@immutable
class OptOrder {
  const OptOrder({
    required this.ticket,
    required this.side,
    required this.contracts,
    required this.type,
    required this.placedAt,
    required this.option,
    this.price,
    this.trigger,
    this.comboId,
  });
  final String ticket, side;
  final double contracts;
  final String type;
  final double? price;
  final ({String symbol, String op, double price})? trigger;
  final String? comboId;
  final String placedAt;
  final OptionInfo option;

  static OptOrder fromJson(Json x) {
    final trig = x['trigger'];
    return OptOrder(
      ticket: '${x['ticket']}',
      side: x['side'] == 'sell' ? 'sell' : 'buy',
      contracts: numOf(x['contracts']) ?? numOf(x['volume']) ?? 0,
      type: strOf(x['type']) ?? 'limit',
      price: numOf(x['limitPremium']) ?? numOf(x['price']),
      trigger: trig is Map ? (symbol: '${trig['symbol'] ?? ''}', op: '${trig['op'] ?? 'above'}', price: numOr(trig['price'])) : null,
      comboId: strOf(x['comboId']),
      placedAt: strOf(x['placedAt']) ?? DateTime.now().toUtc().toIso8601String(),
      option: OptionInfo.of(x),
    );
  }
}

/// Why an option position (or part of it) closed.
enum OptCloseReason { closed, expired, knockedOut, stopOut, liquidation, bust, sl, tp, dealer, other }

extension OptCloseReasonKey on OptCloseReason {
  /// The web's key suffix (`trader.opt.hist.reason.<key>`).
  String get key => switch (this) {
    OptCloseReason.knockedOut => 'knocked_out',
    OptCloseReason.stopOut => 'stop_out',
    _ => name,
  };
}

/// Engine deal reason (and the book fill kind) → why it closed.
({OptCloseReason reason, String raw}) closeReasonOf(Json x) {
  final raw = '${x['reason'] ?? ''}';
  final fill = jsonOf(jsonOf(x['option'])['fill']);
  final kind = '${fill['kind'] ?? ''}'.toLowerCase();
  if (kind == 'bust') return (reason: OptCloseReason.bust, raw: raw);
  if (kind == 'liquidation' || kind == 'backstop') return (reason: OptCloseReason.liquidation, raw: raw);
  final r = raw.toLowerCase();
  if (const ['expiry', 'expired', 'settlement', 'settle', 'exercise'].contains(r)) return (reason: OptCloseReason.expired, raw: raw);
  if (const ['knock_out', 'knockout', 'knocked_out', 'barrier'].contains(r)) return (reason: OptCloseReason.knockedOut, raw: raw);
  if (r == 'stop_out' || r == 'stopout') return (reason: OptCloseReason.stopOut, raw: raw);
  if (r == 'liquidation' || r == 'backstop') return (reason: OptCloseReason.liquidation, raw: raw);
  if (r == 'sl') return (reason: OptCloseReason.sl, raw: raw);
  if (r == 'tp') return (reason: OptCloseReason.tp, raw: raw);
  if (const ['dealer', 'force', 'void', 'price_correction'].contains(r)) return (reason: OptCloseReason.dealer, raw: raw);
  if (const ['client', 'close_by', 'pending_fill', '', 'manual', 'book', 'rfq'].contains(r)) return (reason: OptCloseReason.closed, raw: raw);
  return (reason: OptCloseReason.other, raw: raw);
}

/// A closed option trade (one exit deal): premiums per unit in the quote currency, money in USD.
@immutable
class OptClosed {
  const OptClosed({
    required this.deal,
    required this.ticket,
    required this.side,
    required this.contracts,
    required this.openPrice,
    required this.closePrice,
    required this.openTime,
    required this.closeTime,
    required this.gross,
    required this.commission,
    required this.swap,
    required this.profit,
    required this.reason,
    required this.rawReason,
    required this.usdPerUnit,
    required this.option,
    this.fillKind,
    this.fixing,
    this.comboId,
  });
  final String deal, ticket, side;
  final double contracts, openPrice, closePrice;
  final String openTime, closeTime;
  final double gross, commission, swap, profit;
  final OptCloseReason reason;
  final String rawReason;
  final String? fillKind;

  /// USD per contract for one unit of premium (0 = unknown)
  final double usdPerUnit;
  final double? fixing;
  final String? comboId;
  final OptionInfo option;
}

/// Option exit deals → closed-trade rows (entry deals give the commission share), newest first. `usdPerQuote` gives
/// USD per unit of a quote currency when the deal's own numbers can't (JPY via USDJPY …).
List<OptClosed> mapOptionClosed(List<Json> deals, {required bool cent, double Function(String underlying)? usdPerQuote}) {
  final k = cent ? 100.0 : 1.0;
  final entries = <String, Json>{};
  for (final d in deals) {
    if (d['entry'] == 'in') entries.putIfAbsent('${d['positionTicket']}', () => d);
  }
  final out = <OptClosed>[];
  for (final d in deals) {
    if ((d['entry'] != 'out' && d['entry'] != 'out_by') || d['reversed'] == true) continue;
    final e = entries['${d['positionTicket']}'];
    final volume = numOf(d['volume']) ?? numOf(d['contracts']) ?? 0;
    final eVol = e == null ? 0.0 : numOr(e['volume']);
    final entryCommission = e != null && eVol > 0 ? numOr(e['commission']) * (volume / eVol).clamp(0, 1) : 0.0;
    final commission = (numOr(d['commission']) + entryCommission) / k;
    final swap = numOr(d['swap']) / k;
    final gross = numOr(d['profit']) / k;
    final side = d['positionSide'] == 'sell' ? 'sell' : (d['positionSide'] == 'buy' ? 'buy' : (d['side'] == 'buy' ? 'sell' : 'buy'));
    final open = numOr(d['openPrice']);
    final close = numOr(d['price']);
    final info = OptionInfo.of(d);
    // the rate the engine used: gross = ±(close − open) × rate × contracts
    final move = (side == 'buy' ? 1 : -1) * (close - open) * volume;
    final derived = move.abs() > 1e-12 && gross.abs() > 0.004 ? gross / move : 0.0;
    final size = info.contractSize > 0 ? info.contractSize : (optionSpecs[info.underlying]?.contractSize ?? 0);
    final fallback = size * (usdPerQuote?.call(info.underlying) ?? 1);
    final usdPerUnit = derived > 0 && (fallback == 0 || (derived / fallback - 1).abs() < 0.5) ? derived : fallback;
    final why = closeReasonOf(d);
    final opt = jsonOf(d['option']);
    out.add(
      OptClosed(
        deal: '${d['id']}',
        ticket: '${d['positionTicket']}',
        side: side,
        contracts: volume,
        openPrice: open,
        closePrice: close,
        openTime: strOf(d['openTime']) ?? strOf(d['time']) ?? '',
        closeTime: strOf(d['time']) ?? '',
        gross: double.parse(gross.toStringAsFixed(2)),
        commission: double.parse(commission.toStringAsFixed(2)),
        swap: double.parse(swap.toStringAsFixed(2)),
        profit: double.parse((gross + swap - commission).toStringAsFixed(2)),
        reason: why.reason,
        rawReason: why.raw,
        fillKind: strOf(jsonOf(opt['fill'])['kind']),
        usdPerUnit: usdPerUnit,
        fixing: numOf(opt['fixing']) ?? (why.reason == OptCloseReason.expired ? numOf(d['fixing']) : null),
        comboId: strOf(d['comboId']),
        option: info,
      ),
    );
  }
  out.sort((a, b) => msOf(b.closeTime).compareTo(msOf(a.closeTime)));
  return out;
}

/// How an expired option settled (`GET trade/options/settlements`), money in USD.
@immutable
class Settlement {
  const Settlement({
    required this.ticket,
    required this.series,
    required this.side,
    required this.contracts,
    required this.fixing,
    required this.payout,
    required this.at,
    required this.run,
    this.profit,
    this.reversed = false,
  });
  final String ticket, series, side;
  final double contracts;
  final double? fixing;

  /// + paid to the client, − paid by a seller, 0 = expired worthless (USD)
  final double payout;
  final double? profit;
  final String at;
  final int run;
  final bool reversed;

  static Settlement fromJson(Json x, {required bool cent}) {
    final k = cent ? 100.0 : 1.0;
    final profit = numOf(x['profit']);
    return Settlement(
      ticket: '${x['ticket']}',
      series: '${x['series'] ?? ''}',
      side: x['side'] == 'sell' ? 'sell' : 'buy',
      contracts: numOr(x['contracts']),
      fixing: numOf(x['fixing']),
      payout: numOr(x['payout']) / k,
      profit: profit == null ? null : profit / k,
      at: isoOf(x['at']) ?? '',
      run: numOf(x['run'])?.toInt() ?? 1,
      reversed: x['reversed'] == true,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Previews                                                            */
/* ------------------------------------------------------------------ */

@immutable
class PreviewLeg {
  const PreviewLeg({required this.series, required this.side, required this.contracts, this.price, this.premium});
  final String series, side;
  final double contracts;
  final double? price, premium;
}

/// The engine's preview of an option order (USD; cent accounts scaled back, web previewInUsd).
@immutable
class OptPreview {
  const OptPreview({
    required this.ok,
    required this.reasons,
    required this.legs,
    required this.netPremium,
    required this.commission,
    required this.marginBefore,
    required this.marginAfter,
    required this.freeMarginAfter,
    required this.cashAfter,
    required this.maxProfit,
    required this.maxLoss,
    required this.breakevens,
    required this.greeks,
    this.estimate = false,
  });
  final bool ok;

  /// reason codes with an optional message: (code, message)
  final List<({String code, String? message})> reasons;
  final List<PreviewLeg> legs;

  /// USD, positive = the client pays (debit)
  final double netPremium, commission, marginBefore, marginAfter, freeMarginAfter, cashAfter;
  final double? maxProfit, maxLoss;
  final List<double> breakevens;
  final Map<String, double> greeks;

  /// client-side estimate (the engine's options API isn't live yet)
  final bool estimate;

  static List<({String code, String? message})> reasonsOf(Object? v) => [
    for (final r in (v is List ? v : const <Object?>[]))
      if (r is String) (code: r, message: null) else if (r is Map) (code: '${r['code'] ?? ''}', message: strOf(r['message'])),
  ];

  static OptPreview fromJson(Json j) {
    final k = j['currency'] == 'USC' ? 100.0 : 1.0;
    double m(Object? v) => numOr(v) / k;
    double? mo(Object? v) {
      final x = numOf(v);
      return x == null ? null : x / k;
    }

    final g = jsonOf(j['greeks']);
    return OptPreview(
      ok: j['ok'] != false,
      reasons: reasonsOf(j['reasons']),
      legs: [
        for (final l in jsonList(j['legs']))
          PreviewLeg(
            series: '${l['series'] ?? ''}',
            side: l['side'] == 'sell' ? 'sell' : 'buy',
            contracts: numOr(l['contracts']),
            price: numOf(l['price']),
            premium: mo(l['premium']),
          ),
      ],
      netPremium: m(j['netPremium']),
      commission: m(j['commission']),
      marginBefore: m(j['marginBefore']),
      marginAfter: m(j['marginAfter']),
      freeMarginAfter: m(j['freeMarginAfter']),
      cashAfter: m(j['cashAfter']),
      maxProfit: mo(j['maxProfit']),
      maxLoss: mo(j['maxLoss']),
      breakevens: [for (final b in (j['breakevens'] as List? ?? const <Object?>[])) ?numOf(b)],
      greeks: {for (final e in g.entries) e.key: numOr(e.value)},
      estimate: j['estimate'] == true,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Order book                                                          */
/* ------------------------------------------------------------------ */

@immutable
class StopTrigger {
  const StopTrigger({required this.source, required this.op, required this.price});

  /// mark | underlying
  final String source;

  /// above | below
  final String op;
  final double price;

  Json toJson() => {'source': source, 'op': op, 'price': price};

  static StopTrigger? fromJson(Object? v) {
    if (v is! Map) return null;
    final p = numOf(v['price']);
    if (p == null) return null;
    return StopTrigger(source: v['source'] == 'underlying' ? 'underlying' : 'mark', op: v['op'] == 'below' ? 'below' : 'above', price: p);
  }
}

@immutable
class BookOrder {
  const BookOrder({
    required this.id,
    required this.series,
    required this.side,
    required this.type,
    required this.qty,
    required this.filled,
    required this.left,
    required this.tif,
    required this.createdAt,
    required this.status,
    this.avgPrice,
    this.price,
    this.expireAt,
    this.flags = const [],
    this.reserved = 0,
    this.reason,
    this.trigger,
  });
  final String id, series, side, type;
  final double qty, filled, left;
  final double? avgPrice, price;
  final String tif;
  final String? expireAt;
  final List<String> flags;
  final double reserved;
  final String createdAt, status;
  final String? reason;
  final StopTrigger? trigger;

  static BookOrder? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final x = raw.cast<String, dynamic>();
    final id = strOf(x['id']) ?? strOf(x['ticket']);
    final series = strOf(x['series']) ?? strOf(x['symbol']) ?? strOf(jsonOf(x['option'])['series']);
    if (id == null || series == null) return null;
    final qty = numOf(x['qty']) ?? numOf(x['contracts']) ?? 0;
    final filled = numOf(x['filled']) ?? 0;
    final flags = [for (final f in (x['flags'] as List? ?? const <Object?>[])) '$f'.toLowerCase()];
    if (x['postOnly'] == true && !flags.contains('post_only')) flags.add('post_only');
    if (x['reduceOnly'] == true && !flags.contains('reduce_only')) flags.add('reduce_only');
    const types = ['limit', 'market', 'stop_market', 'stop_limit'];
    const tifs = ['gtc', 'ioc', 'fok', 'gtd'];
    return BookOrder(
      id: id,
      series: series,
      side: x['side'] == 'sell' ? 'sell' : 'buy',
      type: types.contains(x['type']) ? x['type'] as String : 'limit',
      qty: qty,
      filled: filled,
      left: numOf(x['left']) ?? (qty - filled).clamp(0, double.infinity),
      avgPrice: numOf(x['avgPrice']),
      price: numOf(x['price']),
      tif: tifs.contains(x['tif']) ? x['tif'] as String : 'gtc',
      expireAt: isoOf(x['expireAt']),
      flags: [for (final f in flags) f.replaceAll('-', '_').replaceAll(RegExp(r'^postonly$'), 'post_only').replaceAll(RegExp(r'^reduceonly$'), 'reduce_only')],
      reserved: numOr(x['reserved']),
      createdAt: isoOf(x['createdAt']) ?? isoOf(x['placedAt']) ?? DateTime.now().toUtc().toIso8601String(),
      status: strOf(x['status']) ?? 'working',
      reason: strOf(x['reason']),
      trigger: StopTrigger.fromJson(x['trigger']),
    );
  }
}

@immutable
class BookFill {
  const BookFill({
    required this.fillId,
    required this.series,
    required this.side,
    required this.price,
    required this.qty,
    required this.role,
    required this.fee,
    required this.rebate,
    this.comboId,
  });
  final String fillId, series, side;
  final double price, qty;
  final String role;
  final double fee, rebate;
  final String? comboId;

  static BookFill? fromJson(Object? raw, {String? series, String? side}) {
    if (raw is! Map) return null;
    final price = numOf(raw['price']), qty = numOf(raw['qty']);
    if (price == null || qty == null) return null;
    final fee = numOf(raw['fee']) ?? 0;
    return BookFill(
      fillId: strOf(raw['fillId']) ?? strOf(raw['id']) ?? '',
      series: strOf(raw['series']) ?? series ?? '',
      side: raw['side'] == 'sell' ? 'sell' : (raw['side'] == 'buy' ? 'buy' : (side ?? 'buy')),
      price: price,
      qty: qty,
      role: strOf(raw['role']) ?? 'taker',
      // a negative fee is a rebate
      fee: fee < 0 ? 0 : fee,
      rebate: numOf(raw['rebate']) ?? (fee < 0 ? -fee : 0),
      comboId: strOf(raw['comboId']) ?? strOf(raw['combo']),
    );
  }
}

@immutable
class BookOrderResult {
  const BookOrderResult({required this.status, this.order, this.fills = const [], this.reason});
  final String status;
  final BookOrder? order;
  final List<BookFill> fills;
  final String? reason;

  static BookOrderResult fromJson(Object? raw) {
    final x = jsonOf(raw);
    final order = BookOrder.fromJson(x['order']);
    return BookOrderResult(
      status: strOf(x['status']) ?? order?.status ?? 'working',
      order: order,
      fills: [for (final f in (x['fills'] as List? ?? const <Object?>[])) ?BookFill.fromJson(f, series: order?.series, side: order?.side)],
      reason: strOf(x['reason']),
    );
  }
}

/// `POST …/book/preview` (USD; cent accounts scaled back).
@immutable
class BookPreview {
  const BookPreview({
    required this.ok,
    required this.reasons,
    required this.reserve,
    required this.estAvgPrice,
    required this.estFilled,
    required this.estResting,
    required this.fee,
    required this.rebate,
    this.bandMin,
    this.bandMax,
    this.hasBand = false,
    this.freeMarginAfter,
    this.estimate = false,
  });
  final bool ok;
  final List<({String code, String? message})> reasons;
  final double reserve;
  final double? estAvgPrice;
  final double estFilled, estResting, fee, rebate;
  final double? bandMin, bandMax;
  final bool hasBand;
  final double? freeMarginAfter;
  final bool estimate;

  /// normPreview: what the engine leaves to the client is derived from the order (the part that rests, the maker
  /// rebate on it, a market order's band).
  static BookPreview fromJson(Object? raw, {required String type, required String side, required double qty, required String tif, double? price}) {
    final x = jsonOf(raw);
    final band = x['band'] is Map ? jsonOf(x['band']) : null;
    final fee = numOf(x['fee']) ?? numOf(x['takerFee']) ?? 0;
    final estFilled = numOf(x['estFilled']) ?? numOf(x['fillQty']) ?? 0;
    final rests = type == 'limit' && (tif == 'gtc' || tif == 'gtd');
    final estResting = numOf(x['estResting']) ?? numOf(x['restQty']) ?? (rests ? (qty - estFilled).clamp(0, double.infinity).toDouble() : 0.0);
    final makerRate = numOf(x['feeMaker']);
    final unitUsd = numOf(x['usdPerUnit']);
    final capPct = numOf(x['feeCapPct']);
    final restPx = price ?? numOf(x['price']);
    var rebate = numOf(x['rebate']) ?? (fee < 0 ? -fee : 0);
    if (numOf(x['rebate']) == null && makerRate != null && makerRate < 0 && estResting > 0) {
      final byRate = -makerRate * estResting;
      final byCap = capPct != null && restPx != null && unitUsd != null ? (capPct / 100) * restPx * unitUsd * estResting : double.infinity;
      rebate = ((byRate < byCap ? byRate : byCap) * 100).round() / 100;
    }
    final bandPx = numOf(x['price']);
    double? bMin, bMax;
    var hasBand = false;
    if (band != null) {
      bMin = numOf(band['min']);
      bMax = numOf(band['max']);
      hasBand = true;
    } else if ((type == 'market' || type == 'stop_market') && bandPx != null) {
      hasBand = true;
      if (side == 'buy') {
        bMax = bandPx;
      } else {
        bMin = bandPx;
      }
    }
    final k = x['currency'] == 'USC' ? 100.0 : 1.0;
    final fma = numOf(x['freeMarginAfter']);
    return BookPreview(
      ok: x['ok'] != false,
      reasons: OptPreview.reasonsOf(x['reasons']),
      reserve: (numOf(x['reserve']) ?? numOf(x['reserved']) ?? 0) / k,
      estAvgPrice: numOf(x['estAvgPrice'] ?? x['avgPrice']),
      estFilled: estFilled,
      estResting: estResting,
      fee: fee < 0 ? 0 : fee,
      rebate: rebate,
      bandMin: bMin,
      bandMax: bMax,
      hasBand: hasBand,
      freeMarginAfter: fma == null ? null : fma / k,
      estimate: x['estimate'] == true,
    );
  }
}

/* ---- combo RFQ ---- */

@immutable
class RfqLeg {
  const RfqLeg({required this.series, required this.side, required this.ratio});
  final String series, side;
  final int ratio;
  Json toJson() => {'series': series, 'side': side, 'ratio': ratio};
}

@immutable
class Rfq {
  const Rfq({required this.id, required this.expiresAt, required this.legs, required this.qty, this.status, this.note});
  final String id, expiresAt;
  final List<RfqLeg> legs;
  final int qty;
  final String? status, note;

  Rfq withNote(String? n) => Rfq(id: id, expiresAt: expiresAt, legs: legs, qty: qty, status: status, note: n);

  static Rfq? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final x = raw['rfq'] is Map ? jsonOf(raw['rfq']) : raw.cast<String, dynamic>();
    final note = strOf(raw['note']);
    final id = strOf(x['id']);
    if (id == null) return null;
    return Rfq(
      id: id,
      expiresAt: isoOf(x['expiresAt']) ?? DateTime.now().add(const Duration(seconds: 30)).toUtc().toIso8601String(),
      legs: [
        for (final l in jsonList(x['legs']))
          RfqLeg(series: strOf(l['series']) ?? '', side: l['side'] == 'sell' ? 'sell' : 'buy', ratio: numOf(l['ratio'])?.toInt() ?? 1),
      ],
      qty: numOf(x['qty'])?.toInt() ?? 1,
      status: strOf(x['status']),
      note: note ?? strOf(x['note']),
    );
  }
}

/// A responder's firm quote: net per combo unit, per unit of the underlying (quote currency).
@immutable
class RfqQuote {
  const RfqQuote({required this.quoteId, required this.responder, required this.bid, required this.ask, required this.qty, required this.validUntil});
  final String quoteId, responder;
  final double? bid, ask;
  final double qty;
  final String validUntil;

  static RfqQuote? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final id = strOf(raw['quoteId']) ?? strOf(raw['id']);
    if (id == null) return null;
    return RfqQuote(
      quoteId: id,
      responder: strOf(raw['responder']) ?? 'ezymex',
      bid: numOf(raw['bid']),
      ask: numOf(raw['ask']),
      qty: numOr(raw['qty']),
      validUntil: isoOf(raw['validUntil']) ?? DateTime.now().add(const Duration(seconds: 5)).toUtc().toIso8601String(),
    );
  }
}

@immutable
class RfqAcceptResult {
  const RfqAcceptResult({required this.status, this.comboId, this.fills = const [], this.net, this.settling = false});
  final String status;
  final String? comboId;
  final List<BookFill> fills;
  final double? net;
  final bool settling;

  static RfqAcceptResult fromJson(Object? raw) {
    final x = jsonOf(raw);
    return RfqAcceptResult(
      status: strOf(x['status']) ?? 'filled',
      comboId: strOf(x['comboId']),
      fills: [for (final f in (x['fills'] as List? ?? const <Object?>[])) ?BookFill.fromJson(f)],
      net: numOf(x['net']),
      settling: x['settling'] == true,
    );
  }
}

/// Premium tick of an underlying (quote currency per unit): the service's, else the §2 default.
double premiumTickOf(String u, {OptionUnderlying? under, ChainBook? chainBook}) {
  final t = chainBook?.premiumTick ?? under?.premiumTick;
  if (t != null && t > 0) return t;
  final spec = optionSpecs[u] ?? optionSpecs[parseSeriesCode(u)?.underlying ?? ''];
  return spec == null ? 0.00001 : defaultPremiumTick(spec);
}

/// Snap a per-unit price to the tick (nearest; `dir` 1 = up, -1 = down).
double toTick(double price, double tick, [int dir = 0]) {
  if (!(tick > 0) || !price.isFinite) return price;
  final n = price / tick;
  final r = dir > 0 ? (n - 1e-9).ceil() : (dir < 0 ? (n + 1e-9).floor() : n.round());
  final d = (-(math.log(tick) / math.ln10) - 1e-9).ceil().clamp(0, 10);
  return double.parse((r * tick).toStringAsFixed(d));
}
