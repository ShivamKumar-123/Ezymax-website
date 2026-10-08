// API & Algo data: the port of apps/crm/components/algo/api.ts (the ALGO BFF, /api/algo/<path>), served to the app
// at /api/mobile/algo/<path> with the same requests and answers. Same paths and poll intervals as the web's useAlgo
// hooks; small tolerant models; the web's formatters (fmtMoney, fmtPct, ago, …).
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import '../../core/lifecycle.dart';
import '../../i18n/i18n.dart';

/* ------------------------------------------------------------------ json helpers */

Map<String, dynamic> jMap(Object? v) => v is Map ? v.cast<String, dynamic>() : <String, dynamic>{};
List<Map<String, dynamic>> jList(Object? v) => v is List
    ? [
        for (final x in v)
          if (x is Map) x.cast<String, dynamic>(),
      ]
    : const [];
double jD(Object? v) => v is num ? v.toDouble() : (v is String ? double.tryParse(v) ?? 0 : 0);
double? jDn(Object? v) => v is num ? v.toDouble() : (v is String ? double.tryParse(v) : null);
int jI(Object? v) => v is num ? v.toInt() : (v is String ? int.tryParse(v) ?? 0 : 0);
int? jIn(Object? v) => v is num ? v.toInt() : (v is String ? int.tryParse(v) : null);
String jS(Object? v) => v == null ? '' : '$v';
String? jSn(Object? v) => v == null ? null : '$v';
List<String> jStrs(Object? v) => v is List ? [for (final x in v) '$x'] : const [];

/// A deep copy of a JSON value (the editors change copies of the strategy spec).
V jClone<V>(V v) {
  Object? c(Object? x) => x is Map ? {for (final e in x.entries) '${e.key}': c(e.value)} : (x is List ? [for (final y in x) c(y)] : x);
  return c(v) as V;
}

/* ------------------------------------------------------------------ client */

extension AlgoClient on ApiClient {
  Future<Map<String, dynamic>> algoGet(String path, {Map<String, Object?>? query}) => get<Map<String, dynamic>>('algo/$path', query: query);

  Future<Map<String, dynamic>> algoPost(String path, [Object? body]) => post<Map<String, dynamic>>('algo/$path', body: body ?? const <String, Object?>{});

  Future<Map<String, dynamic>> algoPatch(String path, Object body) => patch<Map<String, dynamic>>('algo/$path', body: body);

  Future<Map<String, dynamic>> algoDelete(String path) => delete<Map<String, dynamic>>('algo/$path');

  Future<Map<String, dynamic>> algoPut(String path, Object body) => put<Map<String, dynamic>>('algo/$path', body: body);
}

/* ------------------------------------------------------------------ formatting (web api.ts) */

String _grouped(double v, int digits) {
  final s = v.abs().toStringAsFixed(digits);
  final parts = s.split('.');
  final int = parts[0].replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
  return parts.length > 1 ? '$int.${parts[1]}' : int;
}

bool _ok(num? v) => v != null && v.isFinite;

String fmtMoney(num? v, [int digits = 2]) => !_ok(v) ? '–' : '${v! < 0 ? '−' : ''}\$${_grouped(v.toDouble(), digits)}';
String fmtSigned(num? v, [int digits = 2]) => !_ok(v) ? '–' : '${v! > 0 ? '+' : (v < 0 ? '−' : '')}${_grouped(v.toDouble(), digits)}';
String fmtPct(num? v, [int digits = 1]) => !_ok(v) ? '–' : '${v! > 0 ? '+' : (v < 0 ? '−' : '')}${v.abs().toStringAsFixed(digits)}%';
String fmtNum(num? v, [int digits = 2]) => !_ok(v) ? '–' : '${v! < 0 ? '-' : ''}${_grouped(v.toDouble(), digits)}';

String _iso(DateTime d) => d.toUtc().toIso8601String();

/// `2026-09-24` from unix seconds.
String fmtDate(num? unix) => unix == null || unix == 0 ? '–' : _iso(DateTime.fromMillisecondsSinceEpoch((unix * 1000).round(), isUtc: true)).substring(0, 10);

/// `2026-09-24 14:05` (UTC, as the web prints it) from an ISO string or unix seconds.
String fmtDateTime(Object? at) {
  final d = at is num ? DateTime.fromMillisecondsSinceEpoch((at * 1000).round(), isUtc: true) : (at is String ? DateTime.tryParse(at) : null);
  if (d == null) return '–';
  final s = _iso(d);
  return '${s.substring(0, 10)} ${s.substring(11, 16)}';
}

/// `2026-09-24` from an ISO string or unix seconds (web fmtDateTime(x).slice(0, 10)).
String fmtDay(Object? at) {
  final s = fmtDateTime(at);
  return s.length >= 10 ? s.substring(0, 10) : s;
}

/// "5m ago" (developer.ago.*).
String algoAgo(T t, String? iso) {
  final at = iso == null ? null : DateTime.tryParse(iso);
  if (at == null) return t('developer.ago.never');
  final s = math.max(0, DateTime.now().difference(at).inMilliseconds / 1000);
  if (s < 60) return t('developer.ago.seconds', {'n': s.round()});
  if (s < 3600) return t('developer.ago.minutes', {'n': (s / 60).round()});
  if (s < 86400) return t('developer.ago.hours', {'n': (s / 3600).round()});
  return t('developer.ago.days', {'n': (s / 86400).round()});
}

/// Translation keys of the signal names (SIGNAL_LABEL).
const Map<String, String> kSignalLabel = {
  'buy': 'developer.signal.buy',
  'sell': 'developer.signal.sell',
  'exit_buy': 'developer.signal.exitBuy',
  'exit_sell': 'developer.signal.exitSell',
};

String signalLabel(T t, String k) => kSignalLabel[k] == null ? k : t(kSignalLabel[k]!);

String accountTypeLabel(T t, String type) => type == 'live' ? t('common.live') : t('common.demo');

/* ------------------------------------------------------------------ accounts */

class AlgoAccount {
  AlgoAccount(Map<String, dynamic> j)
    : login = jI(j['login']),
      type = jS(j['type']),
      group = jS(j['group']),
      groupName = jS(j['groupName']),
      currency = jS(j['currency']),
      balance = jD(j['balance']),
      equity = jD(j['equity']),
      status = jS(j['status']),
      name = jS(j['name']),
      leverage = jI(j['leverage']);
  final int login;
  final String type, group, groupName, currency, status, name;
  final double balance, equity;
  final int leverage;
  bool get live => type == 'live';
  bool get active => status == 'active';
}

/// `GET algo/accounts` (once per page).
final algoAccountsProvider = FutureProvider.autoDispose<List<AlgoAccount>>((ref) async {
  final j = await ref.watch(apiProvider).algoGet('accounts');
  return [for (final a in jList(j['items'])) AlgoAccount(a)];
});

/* ------------------------------------------------------------------ meta */

class MetaIndicator {
  MetaIndicator(Map<String, dynamic> j)
    : key = jS(j['key']),
      label = jS(j['label']),
      description = jS(j['description']),
      period = jI(j['period']),
      period2 = jI(j['period2']),
      period3 = jI(j['period3']),
      mult = jD(j['mult']);
  final String key, label, description;
  final int period, period2, period3;
  final double mult;
}

class DslLine {
  DslLine(Map<String, dynamic> j) : syntax = jS(j['syntax']), text = jS(j['text']);
  final String syntax, text;
}

class AlgoMeta {
  AlgoMeta(Map<String, dynamic> j)
    : symbols = [for (final s in jList(j['symbols'])) (symbol: jS(s['symbol']), assetClass: jS(s['assetClass']))],
      timeframes = jStrs(j['timeframes']),
      indicators = [for (final i in jList(j['indicators'])) MetaIndicator(i)],
      priceFields = jStrs(j['priceFields']),
      patterns = jStrs(j['patterns']),
      operators = jStrs(j['operators']),
      distanceModes = jStrs(j['distanceModes']),
      trailModes = jStrs(j['trailModes']),
      functions = [for (final f in jList(jMap(j['dsl'])['functions'])) DslLine(f)],
      settings = [for (final f in jList(jMap(j['dsl'])['settings'])) DslLine(f)],
      limits = {for (final e in jMap(jMap(j['dsl'])['limits']).entries) e.key: jI(e.value)},
      example = jS(jMap(j['dsl'])['example']),
      aiConfigured = jMap(j['ai'])['configured'] == true,
      aiModel = jS(jMap(j['ai'])['model']),
      publicUrl = jSn(j['publicUrl']);
  final List<({String symbol, String assetClass})> symbols;
  final List<String> timeframes, priceFields, patterns, operators, distanceModes, trailModes;
  final List<MetaIndicator> indicators;
  final List<DslLine> functions, settings;
  final Map<String, int> limits;
  final String example, aiModel;
  final bool aiConfigured;
  final String? publicUrl;

  MetaIndicator? indicator(String key) {
    for (final i in indicators) {
      if (i.key == key) return i;
    }
    return null;
  }
}

/// `GET algo/meta`: the builder's catalogue, fetched once (web useMeta's module cache).
final algoMetaProvider = FutureProvider<AlgoMeta>((ref) async => AlgoMeta(await ref.watch(apiProvider).algoGet('meta')));

/* ------------------------------------------------------------------ API keys */

class ApiKey {
  ApiKey(Map<String, dynamic> j)
    : id = jI(j['id']),
      name = jS(j['name']),
      keyId = jS(j['keyId']),
      login = jI(j['login']),
      accountType = jS(j['accountType']),
      scopes = jStrs(j['scopes']),
      ipWhitelist = jStrs(j['ipWhitelist']),
      expiresAt = jSn(j['expiresAt']),
      status = jS(j['status']),
      createdAt = jS(j['createdAt']),
      lastUsedAt = jSn(j['lastUsedAt']),
      lastIp = jSn(j['lastIp']);
  final int id, login;
  final String name, keyId, accountType, status, createdAt;
  final List<String> scopes, ipWhitelist;
  final String? expiresAt, lastUsedAt, lastIp;
}

class KeysData {
  KeysData(Map<String, dynamic> j)
    : items = [for (final k in jList(j['items'])) ApiKey(k)],
      requests24h = jI(jMap(j['usage'])['requests24h']),
      errors24h = jI(jMap(j['usage'])['errors24h']),
      rateLimited24h = jI(jMap(j['usage'])['rateLimited24h']),
      p50 = jD(jMap(j['usage'])['p50']),
      p99 = jD(jMap(j['usage'])['p99']),
      writes24h = jI(jMap(j['usage'])['writes24h']),
      hourly = [for (final h in jList(jMap(j['usage'])['hourly'])) jD(h['n'])],
      baseUrl = jS(j['baseUrl']);
  final List<ApiKey> items;
  final int requests24h, errors24h, rateLimited24h, writes24h;
  final double p50, p99;
  final List<double> hourly;
  final String baseUrl;
}

/// `GET algo/keys` every 10 s.
final apiKeysProvider = FutureProvider.autoDispose<KeysData>((ref) async {
  ref.pollEvery(const Duration(seconds: 10));
  return KeysData(await ref.watch(apiProvider).algoGet('keys'));
});

typedef KeyCall = ({String at, String method, String path, int status, String? ip, int ms});

/// `GET algo/keys/{id}/activity`.
final keyActivityProvider = FutureProvider.autoDispose.family<List<KeyCall>, int>((ref, id) async {
  final j = await ref.watch(apiProvider).algoGet('keys/$id/activity');
  return [
    for (final r in jList(j['items']))
      (at: jS(r['at']), method: jS(r['method']), path: jS(r['path']), status: jI(r['status']), ip: jSn(r['ip']), ms: jI(r['ms'])),
  ];
});

/* ------------------------------------------------------------------ webhooks */

/// A webhook's route: one account with its sizing (editable copy).
class HookRoute {
  HookRoute({this.id, required this.login, this.accountType, required this.mode, required this.value, this.maxLots, this.symbolMap, this.enabled = true});
  factory HookRoute.fromJson(Map<String, dynamic> j) {
    final s = jMap(j['sizing']);
    return HookRoute(
      id: jIn(j['id']),
      login: jI(j['login']),
      accountType: jSn(j['accountType']),
      mode: s['mode'] == null ? 'fixed' : jS(s['mode']),
      value: jD(s['value']),
      maxLots: jDn(s['maxLots']),
      symbolMap: j['symbolMap'] is Map ? jMap(j['symbolMap']) : null,
      enabled: j['enabled'] != false,
    );
  }
  final int? id;
  final int login;
  final String? accountType;
  String mode;
  double value;
  double? maxLots;
  final Map<String, dynamic>? symbolMap;
  bool enabled;

  HookRoute copy() =>
      HookRoute(id: id, login: login, accountType: accountType, mode: mode, value: value, maxLots: maxLots, symbolMap: symbolMap, enabled: enabled);

  Map<String, Object?> toJson() => {
    'id': ?id,
    'login': login,
    'accountType': ?accountType,
    'sizing': {'mode': mode, 'value': value, 'maxLots': ?maxLots},
    'symbolMap': ?symbolMap,
    'enabled': enabled,
  };
}

class Hook {
  Hook(Map<String, dynamic> j)
    : id = jI(j['id']),
      name = jS(j['name']),
      status = jS(j['status']),
      tokenHint = jS(j['tokenHint']),
      passphrase = j['passphrase'] == true,
      createdAt = jS(j['createdAt']),
      lastUsedAt = jSn(j['lastUsedAt']),
      routeCount = j['routes'] is num ? jI(j['routes']) : (j['routes'] is List ? (j['routes'] as List).length : 0),
      events24h = jI(j['events24h']);
  final int id, routeCount, events24h;
  final String name, status, tokenHint, createdAt;
  final bool passphrase;
  final String? lastUsedAt;
}

class HookEvent {
  HookEvent(Map<String, dynamic> j)
    : id = jI(j['id']),
      receivedAt = jS(j['receivedAt']),
      ip = jSn(j['ip']),
      payload = j['payload'] is Map ? jMap(j['payload']) : null,
      status = jS(j['status']),
      error = jSn(j['error']),
      results = jList(j['results']);
  final int id;
  final String receivedAt, status;
  final String? ip, error;
  final Map<String, dynamic>? payload;
  final List<Map<String, dynamic>> results;
}

class HookList {
  HookList(Map<String, dynamic> j) : items = [for (final h in jList(j['items'])) Hook(h)], baseUrl = jS(j['baseUrl']);
  final List<Hook> items;
  final String baseUrl;
}

class HookDetail {
  HookDetail(Map<String, dynamic> j)
    : hook = Hook(j),
      routes = [for (final r in jList(j['routes'])) HookRoute.fromJson(r)],
      events = [for (final e in jList(j['events'])) HookEvent(e)];
  final Hook hook;
  final List<HookRoute> routes;
  final List<HookEvent> events;
}

/// `GET algo/webhooks` every 5 s.
final webhooksProvider = FutureProvider.autoDispose<HookList>((ref) async {
  ref.pollEvery(const Duration(seconds: 5));
  return HookList(await ref.watch(apiProvider).algoGet('webhooks'));
});

/// `GET algo/webhooks/{id}` every 5 s.
final webhookDetailProvider = FutureProvider.autoDispose.family<HookDetail, int>((ref, id) async {
  ref.pollEvery(const Duration(seconds: 5));
  return HookDetail(await ref.watch(apiProvider).algoGet('webhooks/$id'));
});

/* ------------------------------------------------------------------ strategies */

class BuildError {
  BuildError(Map<String, dynamic> j) : line = jIn(j['line']), col = jIn(j['col']), message = jS(j['message']);
  final int? line, col;
  final String message;
}

/// A validated strategy (Built): the spec, the generated code and the signal summary.
class Built {
  Built(Map<String, dynamic> j)
    : kind = jS(j['kind']),
      valid = j['valid'] == true,
      errors = [for (final e in jList(j['errors'])) BuildError(e)],
      warnings = jStrs(j['warnings']),
      spec = jMap(j['spec']),
      code = jS(j['code']),
      source = jSn(j['source']),
      summary = {for (final e in jMap(j['summary']).entries) e.key: jS(e.value)},
      id = jI(j['id']),
      version = jI(j['version']),
      createdAt = jSn(j['createdAt']);
  final String kind, code;
  final bool valid;
  final List<BuildError> errors;
  final List<String> warnings;
  final Map<String, dynamic> spec;
  final String? source, createdAt;
  final Map<String, String> summary;

  /// The saved version's id and number (StrategyDetail.current).
  final int id, version;
}

class BacktestSummary {
  BacktestSummary(Map<String, dynamic> j)
    : netProfit = jD(j['netProfit']),
      returnPct = jD(j['returnPct']),
      trades = jI(j['trades']),
      winRate = jD(j['winRate']);
  final double netProfit, returnPct, winRate;
  final int trades;
}

class StrategyItem {
  StrategyItem(Map<String, dynamic> j)
    : id = jI(j['id']),
      name = jS(j['name']),
      symbol = jS(j['symbol']),
      timeframe = jS(j['timeframe']),
      kind = jS(j['kind']),
      version = jI(j['version']),
      valid = j['valid'] == true,
      running = jI(j['running']),
      lastBacktest = j['lastBacktest'] is Map ? BacktestSummary(jMap(j['lastBacktest'])) : null;
  final int id, version, running;
  final String name, symbol, timeframe, kind;
  final bool valid;
  final BacktestSummary? lastBacktest;
}

class StrategyDetail {
  StrategyDetail(Map<String, dynamic> j)
    : id = jI(j['id']),
      name = jS(j['name']),
      symbol = jS(j['symbol']),
      timeframe = jS(j['timeframe']),
      kind = jS(j['kind']),
      current = Built(jMap(j['current'])),
      deployments = [for (final d in jList(j['deployments'])) Deployment(d)],
      backtests = [for (final b in jList(j['backtests'])) BacktestRow(b)];
  final int id;
  final String name, symbol, timeframe, kind;
  final Built current;
  final List<Deployment> deployments;
  final List<BacktestRow> backtests;
}

/// `GET algo/strategies`.
final strategiesProvider = FutureProvider.autoDispose<List<StrategyItem>>((ref) async {
  final j = await ref.watch(apiProvider).algoGet('strategies');
  return [for (final s in jList(j['items'])) StrategyItem(s)];
});

/// `GET algo/strategies/{id}`.
final strategyDetailProvider = FutureProvider.autoDispose.family<StrategyDetail, int>((ref, id) async {
  return StrategyDetail(await ref.watch(apiProvider).algoGet('strategies/$id'));
});

/* ------------------------------------------------------------------ deployments */

class Deployment {
  Deployment(Map<String, dynamic> j)
    : id = jI(j['id']),
      strategyId = jI(j['strategyId']),
      strategyName = jS(j['strategyName']),
      symbol = jS(j['symbol']),
      timeframe = jS(j['timeframe']),
      version = jI(j['version']),
      login = jI(j['login']),
      accountType = jS(j['accountType']),
      status = jS(j['status']),
      risk = jMap(j['risk']),
      stats = jMap(j['stats']),
      subscriptionId = jIn(j['subscriptionId']),
      openPositions = jI(j['openPositions']),
      lastEvalAt = jSn(j['lastEvalAt']),
      error = jSn(j['error']),
      stopReason = jSn(j['stopReason']),
      startBalance = jDn(j['startBalance']),
      createdAt = jS(j['createdAt']);
  final int id, strategyId, version, login, openPositions;
  final String strategyName, symbol, timeframe, accountType, status, createdAt;
  final Map<String, dynamic> risk, stats;
  final int? subscriptionId;
  final String? lastEvalAt, error, stopReason;
  final double? startBalance;

  int get trades => jI(stats['trades']);
  int get wins => jI(stats['wins']);
  double get realized => jD(stats['realized']);
  bool get live => status == 'running' || status == 'paused';
}

typedef DepLog = ({int id, String at, String level, String kind, String message});
typedef DepPosition = ({int ticket, String side, double volume, double? openPrice, String? closedAt, double? closePrice, double? profit, String? reason});

class DeploymentDetail extends Deployment {
  DeploymentDetail(super.j)
    : logs = [for (final l in jList(j['logs'])) (id: jI(l['id']), at: jS(l['at']), level: jS(l['level']), kind: jS(l['kind']), message: jS(l['message']))],
      positions = [
        for (final p in jList(j['positions']))
          (
            ticket: jI(p['ticket']),
            side: jS(p['side']),
            volume: jD(p['volume']),
            openPrice: jDn(p['openPrice']),
            closedAt: jSn(p['closedAt']),
            closePrice: jDn(p['closePrice']),
            profit: jDn(p['profit']),
            reason: jSn(p['reason']),
          ),
      ],
      daily = [for (final d in jList(j['daily'])) (day: jS(d['day']), realized: jD(d['realized']))],
      summary = {for (final e in jMap(j['summary']).entries) e.key: jS(e.value)},
      spec = jMap(j['spec']),
      rulesHidden = j['rulesHidden'] == true;
  final List<DepLog> logs;
  final List<DepPosition> positions;
  final List<({String day, double realized})> daily;
  final Map<String, String> summary;
  final Map<String, dynamic> spec;
  final bool rulesHidden;
}

class AlgoControls {
  AlgoControls(Map<String, dynamic> j) : killed = j['killed'] == true, killedAt = jSn(j['killedAt']), globalKill = j['globalKill'] == true;
  final bool killed, globalKill;
  final String? killedAt;
}

/// `GET algo/deployments` every 5 s.
final deploymentsProvider = FutureProvider.autoDispose<List<Deployment>>((ref) async {
  ref.pollEvery(const Duration(seconds: 5));
  final j = await ref.watch(apiProvider).algoGet('deployments');
  return [for (final d in jList(j['items'])) Deployment(d)];
});

/// `GET algo/deployments/{id}` every 3 s.
final deploymentDetailProvider = FutureProvider.autoDispose.family<DeploymentDetail, int>((ref, id) async {
  ref.pollEvery(const Duration(seconds: 3));
  return DeploymentDetail(await ref.watch(apiProvider).algoGet('deployments/$id'));
});

/// `GET algo/controls` every 10 s (the account-wide kill switch).
final algoControlsProvider = FutureProvider.autoDispose<AlgoControls>((ref) async {
  ref.pollEvery(const Duration(seconds: 10));
  return AlgoControls(await ref.watch(apiProvider).algoGet('controls'));
});

/* ------------------------------------------------------------------ backtests */

class BacktestRow {
  BacktestRow(Map<String, dynamic> j)
    : id = jI(j['id']),
      params = jMap(j['params']),
      status = jS(j['status']),
      progress = jD(j['progress']),
      summary = j['summary'] is Map ? BacktestSummary(jMap(j['summary'])) : null,
      error = jSn(j['error']),
      strategyName = jS(j['strategyName']),
      version = jI(j['version']);
  final int id, version;
  final Map<String, dynamic> params;
  final String status, strategyName;
  final double progress;
  final BacktestSummary? summary;
  final String? error;

  bool get active => status == 'queued' || status == 'running';
  String get symbol => jS(params['symbol']);
  String get timeframe => jS(params['timeframe']);
}

typedef BtTrade = ({
  int id,
  String side,
  double volume,
  num openTime,
  double openPrice,
  num closeTime,
  double closePrice,
  String reason,
  double swap,
  double net,
});

class BacktestReport {
  BacktestReport(Map<String, dynamic> j)
    : metrics = jMap(j['metrics']),
      equity = [for (final p in jList(j['equity'])) (t: jD(p['t']), equity: jD(p['equity']), dd: jD(p['dd']))],
      monthly = [
        for (final y in jList(j['monthly'])) (year: jI(y['year']), months: [for (final m in (y['months'] as List? ?? const [])) jDn(m)], total: jD(y['total'])),
      ],
      trades = [
        for (final x in jList(j['trades']))
          (
            id: jI(x['id']),
            side: jS(x['side']),
            volume: jD(x['volume']),
            openTime: jD(x['openTime']),
            openPrice: jD(x['openPrice']),
            closeTime: jD(x['closeTime']),
            closePrice: jD(x['closePrice']),
            reason: jS(x['reason']),
            swap: jD(x['swap']),
            net: jD(x['net']),
          ),
      ],
      signals = jMap(j['signals']),
      skipped = jList(j['skipped']),
      model = jS(j['model']),
      coverage = jMap(j['coverage']),
      notes = jStrs(j['notes']),
      firstBar = jDn(j['firstBar']),
      lastBar = jDn(j['lastBar']);
  final Map<String, dynamic> metrics, signals, coverage;
  final List<({double t, double equity, double dd})> equity;
  final List<({int year, List<double?> months, double total})> monthly;
  final List<BtTrade> trades;
  final List<Map<String, dynamic>> skipped;
  final String model;
  final List<String> notes;
  final double? firstBar, lastBar;

  double m(String k) => jD(metrics[k]);
  double? mn(String k) => jDn(metrics[k]);
}

class BacktestDetail extends BacktestRow {
  BacktestDetail(super.j) : stage = jSn(j['stage']), cpuMs = jD(j['cpuMs']), report = j['report'] is Map ? BacktestReport(jMap(j['report'])) : null;
  final String? stage;
  final double cpuMs;
  final BacktestReport? report;
}

/// `GET algo/backtests?limit=30`: every 1.5 s while one runs, else every 10 s.
final backtestsProvider = FutureProvider.autoDispose<List<BacktestRow>>((ref) async {
  final j = await ref.watch(apiProvider).algoGet('backtests', query: {'limit': 30});
  final rows = [for (final b in jList(j['items'])) BacktestRow(b)];
  ref.pollEvery(rows.any((b) => b.active) ? const Duration(milliseconds: 1500) : const Duration(seconds: 10));
  return rows;
});

/// `GET algo/backtests/{id}`, every 1.2 s while it is queued or running.
final backtestDetailProvider = FutureProvider.autoDispose.family<BacktestDetail, int>((ref, id) async {
  final d = BacktestDetail(await ref.watch(apiProvider).algoGet('backtests/$id'));
  if (d.active) ref.pollEvery(const Duration(milliseconds: 1200));
  return d;
});

/* ------------------------------------------------------------------ marketplace */

class Track {
  Track(Map<String, dynamic> j)
    : returnPct = jD(j['returnPct']),
      winRate = jD(j['winRate']),
      trades = jI(j['trades']),
      maxDrawdownPct = jD(j['maxDrawdownPct']),
      days = jD(j['days']),
      accountType = jS(j['accountType']),
      sparkline = j['curve'] is List
          ? [
              for (final v in j['curve'] as List)
                if (v is num) v.toDouble(),
            ]
          : const [],
      equity = jList(j['curve']).map((p) => (day: jS(p['day']), equity: jD(p['equity']))).toList(),
      netProfit = jD(j['netProfit']),
      since = jSn(j['since']);
  final double returnPct, winRate, maxDrawdownPct, days, netProfit;
  final int trades;
  final String accountType;

  /// The card's curve (numbers) and the detail's curve (day / equity points).
  final List<double> sparkline;
  final List<({String day, double equity})> equity;
  final String? since;
}

class Listing {
  Listing(Map<String, dynamic> j)
    : id = jI(j['id']),
      title = jS(j['title']),
      description = jS(j['description']),
      author = jS(j['author']),
      symbol = jS(j['symbol']),
      timeframe = jS(j['timeframe']),
      priceMonthly = jD(j['priceMonthly']),
      allowClone = j['allowClone'] == true,
      status = jS(j['status']),
      moderationNote = jSn(j['moderationNote']),
      rating = jD(j['rating']),
      ratings = jI(j['ratings']),
      subscribers = jI(j['subscribers']),
      track = Track(jMap(j['track'])),
      house = j['house'] == true;
  final int id, ratings, subscribers;
  final String title, description, author, symbol, timeframe, status;
  final double priceMonthly, rating;
  final bool allowClone, house;
  final String? moderationNote;
  final Track track;

  /// The price as the web prints it (`19` / `19.5`).
  String get price => priceMonthly == priceMonthly.roundToDouble() ? priceMonthly.toStringAsFixed(0) : '$priceMonthly';
}

class ListingSub {
  ListingSub(Map<String, dynamic> j)
    : id = jI(j['id']),
      mode = jS(j['mode']),
      status = jS(j['status']),
      login = jIn(j['login']),
      deploymentId = jIn(j['deploymentId']),
      clonedStrategyId = jIn(j['clonedStrategyId']),
      periodEnd = jSn(j['periodEnd']),
      autoRenew = j['autoRenew'] == true;
  final int id;
  final String mode, status;
  final int? login, deploymentId, clonedStrategyId;
  final String? periodEnd;
  final bool autoRenew;
}

class ListingDetail extends Listing {
  ListingDetail(super.j)
    : risk = j['risk'] is Map ? jMap(j['risk']) : null,
      summary = j['summary'] is Map ? {for (final e in jMap(j['summary']).entries) e.key: jS(e.value)} : null,
      reviews = [
        for (final r in jList(j['reviews']))
          (id: jI(r['id']), user: jS(r['user']), rating: jD(r['rating']), comment: jS(r['comment']), createdAt: jS(r['createdAt'])),
      ],
      subscription = j['subscription'] is Map ? ListingSub(jMap(j['subscription'])) : null,
      isAuthor = j['isAuthor'] == true,
      backtest = j['backtest'] is Map ? jMap(j['backtest']) : null;
  final Map<String, dynamic>? risk, backtest;
  final Map<String, String>? summary;
  final List<({int id, String user, double rating, String comment, String createdAt})> reviews;
  final ListingSub? subscription;
  final bool isAuthor;
}

class ListingsPage {
  ListingsPage(Map<String, dynamic> j)
    : items = [for (final l in jList(j['items'])) Listing(l)],
      subscribed = [for (final s in (j['subscribed'] as List? ?? const [])) jI(s)],
      platformCutPct = jIn(j['platformCutPct']);
  final List<Listing> items;
  final List<int> subscribed;
  final int? platformCutPct;
}

/// `GET algo/market/listings?q&price&sort`.
final listingsProvider = FutureProvider.autoDispose.family<ListingsPage, ({String q, String price, String sort})>((ref, f) async {
  final j = await ref
      .watch(apiProvider)
      .algoGet('market/listings', query: {if (f.q.isNotEmpty) 'q': f.q, if (f.price.isNotEmpty) 'price': f.price, 'sort': f.sort});
  return ListingsPage(j);
});

/// `GET algo/market/listings/{id}`.
final listingDetailProvider = FutureProvider.autoDispose.family<ListingDetail, int>((ref, id) async {
  return ListingDetail(await ref.watch(apiProvider).algoGet('market/listings/$id'));
});

typedef MarketSub = ({
  int id,
  int listingId,
  String title,
  String author,
  String symbol,
  String timeframe,
  String mode,
  String status,
  int? login,
  String? deploymentStatus,
  double price,
  String? periodEnd,
  bool autoRenew,
});

/// `GET algo/market/subscriptions`.
final marketSubsProvider = FutureProvider.autoDispose<List<MarketSub>>((ref) async {
  final j = await ref.watch(apiProvider).algoGet('market/subscriptions');
  return [
    for (final s in jList(j['items']))
      (
        id: jI(s['id']),
        listingId: jI(s['listingId']),
        title: jS(s['title']),
        author: jS(s['author']),
        symbol: jS(s['symbol']),
        timeframe: jS(s['timeframe']),
        mode: jS(s['mode']),
        status: jS(s['status']),
        login: jIn(s['login']),
        deploymentStatus: jSn(s['deploymentStatus']),
        price: jD(s['price']),
        periodEnd: jSn(s['periodEnd']),
        autoRenew: s['autoRenew'] == true,
      ),
  ];
});

/// `GET algo/market/mine`.
final marketMineProvider = FutureProvider.autoDispose<({List<Listing> items, double earned, double platformFees, int payments})>((ref) async {
  final j = await ref.watch(apiProvider).algoGet('market/mine');
  return (items: [for (final l in jList(j['items'])) Listing(l)], earned: jD(j['earned']), platformFees: jD(j['platformFees']), payments: jI(j['payments']));
});
