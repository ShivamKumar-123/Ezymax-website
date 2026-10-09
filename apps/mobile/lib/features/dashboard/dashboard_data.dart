// The dashboard's own data, with the web's paths and refresh times (apps/crm/components/dashboard/live-dashboard.tsx,
// movers.tsx, news-live/dashboard.tsx, growth/banner-slot.tsx):
// - the 28 core markets and their live prices come from the Markets module (lib/features/markets: kInstruments,
//   marketsFeedProvider = the web's price layer: `/v1/quotes` snapshot + the stream); the movers' 1W / 1M ranges
//   rank on closes (`GET /v1/candles`, fetchCandles);
// - headlines (`news/feed?limit=6`, 2 min), today's calendar (`news/calendar?impact=2,3`, 5 min), the news map
//   (`news/map?hours=24`, 5 min);
// - targeted banners (`growth/banners?placement=dashboard`).
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import '../../core/lifecycle.dart';
import '../markets/instruments.dart';
import '../markets/markets_feed.dart';
import '../updates/updates_api.dart';

export '../updates/updates_api.dart' show PromoItem;

double _d(Object? v) => v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;
int _i(Object? v) => v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0;
List<Map<String, dynamic>> _maps(Object? v) => [
  for (final x in (v is List ? v : const []))
    if (x is Map) x.cast<String, dynamic>(),
];
List<String> _strs(Object? v) => [for (final x in (v is List ? v : const [])) '$x'];

/* ------------------------------------------------------------------ */
/* Markets: the movers' range closes (prices: markets/markets_feed.dart) */
/* ------------------------------------------------------------------ */

/// The movers' ranges: bars per range (web RANGE_BARS + MoverRow).
const Map<String, (String, int)> kMoverBars = {'1D': ('M30', 48), '1W': ('H4', 42), '1M': ('D1', 22)};

/// Closes of `symbol` for a range (`GET /v1/candles?symbol&tf&limit`), kept a minute (web closesCache). Null when
/// unavailable.
final moverClosesProvider = FutureProvider.autoDispose.family<List<double>?, (String, String, int)>((ref, k) async {
  final (symbol, tf, limit) = k;
  final link = ref.keepAlive();
  final timer = Timer(const Duration(minutes: 1), link.close);
  ref.onDispose(timer.cancel);
  final bars = await fetchCandles(ref, symbol, tf, limit);
  if (bars == null || bars.length < 2) {
    link.close();
    return null;
  }
  return [for (final b in bars) b.close];
});

/// Top movers (web topMovers / useRangeChanges): 1D by today's change, 1W / 1M by the change over the range once the
/// series are in (`rangeChanges` symbol -> %).
List<Instrument> topMovers(Map<String, double> todayChange, {required bool gainers, Map<String, double>? rangeChanges, int n = 6}) {
  if (rangeChanges != null) {
    final ranked = kInstruments.where((i) => rangeChanges.containsKey(i.symbol)).toList()
      ..sort((a, b) => rangeChanges[b.symbol]!.compareTo(rangeChanges[a.symbol]!));
    return (gainers ? ranked : ranked.reversed).take(n).toList();
  }
  double ch(Instrument i) => todayChange[i.symbol] ?? 0;
  final sorted = [...kInstruments]..sort((a, b) => ch(b).compareTo(ch(a)));
  return (gainers ? sorted : sorted.reversed).take(n).toList();
}

/* ------------------------------------------------------------------ */
/* News, calendar, map                                                 */
/* ------------------------------------------------------------------ */

@immutable
class DashNews {
  const DashNews({
    required this.id,
    required this.title,
    required this.summary,
    required this.link,
    required this.source,
    required this.publishedAt,
    required this.countries,
    required this.symbols,
    required this.category,
    required this.sentiment,
    required this.pinned,
  });
  final int id;
  final String title, summary, link, source, category, sentiment;
  final DateTime publishedAt;
  final List<String> countries, symbols;
  final bool pinned;

  static DashNews fromJson(Map<String, dynamic> j) => DashNews(
    id: _i(j['id']),
    title: '${j['title'] ?? ''}',
    summary: '${j['summary'] ?? ''}',
    link: '${j['link'] ?? ''}',
    source: j['source'] is Map ? '${(j['source'] as Map)['name'] ?? ''}' : '${j['source'] ?? ''}',
    publishedAt: DateTime.tryParse('${j['publishedAt']}') ?? DateTime.now(),
    countries: _strs(j['countries']),
    symbols: _strs(j['symbols']),
    category: '${j['category'] ?? 'markets'}',
    sentiment: '${j['sentiment'] ?? 'neutral'}',
    pinned: j['pinned'] == true,
  );
}

/// Latest headlines, pinned first, four of them (web LiveNewsCard: `feed?limit=6` every 2 minutes).
final dashNewsProvider = FutureProvider.autoDispose<List<DashNews>>((ref) async {
  ref.pollEvery(const Duration(minutes: 2));
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('news/feed', query: {'limit': 6});
  return [
    for (final n in [..._maps(j['pinned']), ..._maps(j['items'])]) DashNews.fromJson(n),
  ].take(4).toList();
});

@immutable
class DashEvent {
  const DashEvent({
    required this.id,
    required this.title,
    required this.currency,
    required this.country,
    required this.startsAt,
    required this.serverDate,
    required this.serverTime,
    required this.allDay,
    required this.impact,
    required this.forecast,
    required this.previous,
    required this.actual,
    required this.surprise,
  });
  final int id, impact, surprise;
  final String title, currency, country, serverDate, serverTime, forecast, previous, actual;
  final DateTime startsAt;
  final bool allDay;

  static DashEvent fromJson(Map<String, dynamic> j) => DashEvent(
    id: _i(j['id']),
    title: '${j['title'] ?? ''}',
    currency: '${j['currency'] ?? ''}',
    country: '${j['country'] ?? ''}',
    startsAt: DateTime.tryParse('${j['startsAt']}') ?? DateTime.now(),
    serverDate: '${j['serverDate'] ?? ''}',
    serverTime: '${j['serverTime'] ?? ''}',
    allDay: j['allDay'] == true,
    impact: _i(j['impact']),
    forecast: '${j['forecast'] ?? ''}',
    previous: '${j['previous'] ?? ''}',
    actual: '${j['actual'] ?? ''}',
    surprise: _i(j['surprise']),
  );
}

/// This week's medium and high impact events (web LiveCalendarCard: `calendar?impact=2,3` every 5 minutes).
final dashCalendarProvider = FutureProvider.autoDispose<({List<DashEvent> events, int serverOffset})>((ref) async {
  ref.pollEvery(const Duration(minutes: 5));
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('news/calendar', query: {'impact': '2,3'});
  return (events: [for (final e in _maps(j['events'])) DashEvent.fromJson(e)], serverOffset: j['serverOffset'] is num ? _i(j['serverOffset']) : 3);
});

/// The calendar card's rows: events still ahead (or under two hours old), five of them (web `upcoming.slice(0, 5)`).
List<DashEvent> upcomingEvents(List<DashEvent> all, DateTime now) =>
    all.where((e) => !e.allDay && e.startsAt.isAfter(now.subtract(const Duration(hours: 2)))).take(5).toList();

@immutable
class DashMapCountry {
  const DashMapCountry({required this.country, required this.name, required this.count, required this.sentiment});
  final String country, name;
  final int count;
  final double sentiment;
}

/// Stories by country over the last 24 hours (web LiveWorldCard: `map?hours=24` every 5 minutes).
final dashMapProvider = FutureProvider.autoDispose<({int total, List<DashMapCountry> countries})>((ref) async {
  ref.pollEvery(const Duration(minutes: 5));
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('news/map', query: {'hours': 24});
  return (
    total: _i(j['total']),
    countries: [
      for (final c in _maps(j['countries']))
        DashMapCountry(country: '${c['country']}', name: '${c['name'] ?? ''}', count: _i(c['count']), sentiment: _d(c['sentiment'])),
    ],
  );
});

/// Heat per country, -1..1 (web heatOf).
Map<String, double> heatOf(List<DashMapCountry> countries) => {
  for (final c in countries)
    if (c.count > 0 && c.sentiment != 0) c.country: (c.sentiment * (c.count / 3).clamp(0, 1)).clamp(-1, 1).toDouble(),
};

/* ------------------------------------------------------------------ */
/* Growth banners                                                      */
/* ------------------------------------------------------------------ */

/// What targets this client on the dashboard (web DashboardBanners): hero items (layout "hero") for the carousel at
/// the top, card banners for the slot under it (one at most).
final dashBannersProvider = FutureProvider.autoDispose<List<PromoItem>>((ref) async {
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('growth/banners', query: {'placement': 'dashboard'});
  return [for (final b in _maps(j['items'])) PromoItem.fromJson(b)];
});

/// Counts a banner impression / click / dismissal (fire and forget, like the web's `track`).
void trackBanner(ApiClient api, String id, String kind) => trackPromo(api, id, kind);
