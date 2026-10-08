// The news + calendar API (web components/news-live/api.ts; BFF app/api/news/[...path]/route.ts), same paths and
// refresh intervals:
//   GET  news/feed?limit=36&category&country&sentiment&before     every 2 min (load more: before=<next>)
//   GET  news/map?hours=48                                         every 5 min
//   GET  news/brief                                                every 10 min
//   GET  news/calendar[?from&to]                                   every 5 min
//   GET  news/calendar/next?impact=3                               every 5 min
//   GET  news/calendar/<id>                                        the event's history
//   GET  news/me/calendar                                          reminders + high-impact alerts
//   POST news/me/calendar/reminders {eventId, minutes: 15} · DELETE news/me/calendar/reminders/<id>
//   PUT  news/me/calendar/alerts {highImpact, currencies, minutes} · DELETE news/me/calendar/alerts
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import '../../core/lifecycle.dart';

String _s(Object? v) => v == null ? '' : '$v';
int _i(Object? v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
double _d(Object? v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
List<String> _list(Object? v) => v is List ? [for (final x in v) '$x'] : const [];
Map<String, dynamic> _map(Object? v) => v is Map ? v.cast<String, dynamic>() : const {};

/* ------------------------------------------------------------------ news */

enum Sentiment { bullish, bearish, neutral }

Sentiment _sentiment(Object? v) => switch ('$v') {
  'bullish' => Sentiment.bullish,
  'bearish' => Sentiment.bearish,
  _ => Sentiment.neutral,
};

class NewsItem {
  const NewsItem({
    required this.id,
    required this.title,
    required this.summary,
    required this.link,
    required this.sourceName,
    required this.publishedAt,
    required this.countries,
    required this.symbols,
    required this.category,
    required this.sentiment,
    required this.importance,
    required this.pinned,
  });
  final int id;
  final String title, summary, link, sourceName, category;
  final DateTime publishedAt;
  final List<String> countries, symbols;
  final Sentiment sentiment;
  final double importance;
  final bool pinned;

  factory NewsItem.fromJson(Map<String, dynamic> j) => NewsItem(
    id: _i(j['id']),
    title: _s(j['title']),
    summary: _s(j['summary']),
    link: _s(j['link']),
    sourceName: _s(_map(j['source'])['name']),
    publishedAt: DateTime.tryParse(_s(j['publishedAt'])) ?? DateTime.now(),
    countries: _list(j['countries']),
    symbols: _list(j['symbols']),
    category: _s(j['category']),
    sentiment: _sentiment(j['sentiment']),
    importance: _d(j['importance']),
    pinned: j['pinned'] == true,
  );
}

class NewsFeed {
  const NewsFeed({required this.pinned, required this.items, required this.next});
  final List<NewsItem> pinned, items;
  final String? next;

  factory NewsFeed.fromJson(Map<String, dynamic> j) => NewsFeed(
    pinned: [for (final x in (j['pinned'] as List? ?? const [])) NewsItem.fromJson(_map(x))],
    items: [for (final x in (j['items'] as List? ?? const [])) NewsItem.fromJson(_map(x))],
    next: j['next'] == null ? null : _s(j['next']),
  );
}

class MapCountry {
  const MapCountry({required this.country, required this.name, required this.count, required this.bullish, required this.bearish, required this.sentiment});
  final String country, name;
  final int count, bullish, bearish;
  final double sentiment;
}

class NewsMap {
  const NewsMap({required this.total, required this.countries, required this.mentions});
  final int total;
  final List<MapCountry> countries;
  final List<({String symbol, int count})> mentions;

  factory NewsMap.fromJson(Map<String, dynamic> j) => NewsMap(
    total: _i(j['total']),
    countries: [
      for (final c in (j['countries'] as List? ?? const []).map(_map))
        MapCountry(
          country: _s(c['country']),
          name: _s(c['name']),
          count: _i(c['count']),
          bullish: _i(c['bullish']),
          bearish: _i(c['bearish']),
          sentiment: _d(c['sentiment']),
        ),
    ],
    mentions: [for (final m in (j['mentions'] as List? ?? const []).map(_map)) (symbol: _s(m['symbol']), count: _i(m['count']))],
  );
}

class BriefPoint {
  const BriefPoint(this.text, this.tone);
  final String text;

  /// up | down | neutral
  final String tone;
}

class Brief {
  const Brief({required this.mood, required this.headline, required this.points, required this.watch, required this.calendarNote});
  final String mood, headline, calendarNote;
  final List<BriefPoint> points;
  final List<String> watch;
}

class BriefAnswer {
  const BriefAnswer({required this.brief, required this.createdAt, required this.configured});
  final Brief? brief;
  final DateTime? createdAt;
  final bool configured;

  factory BriefAnswer.fromJson(Map<String, dynamic> j) {
    final b = j['brief'] is Map ? _map(j['brief']) : null;
    return BriefAnswer(
      configured: j['configured'] != false,
      createdAt: DateTime.tryParse(_s(j['createdAt'])),
      brief: b == null
          ? null
          : Brief(
              mood: _s(b['mood']),
              headline: _s(b['headline']),
              calendarNote: _s(b['calendarNote']),
              points: [for (final p in (b['points'] as List? ?? const []).map(_map)) BriefPoint(_s(p['text']), _s(p['tone']))],
              watch: _list(b['watch']),
            ),
    );
  }
}

/// `news/feed?…` (every 2 min). The key is the query string without `before`.
final newsFeedProvider = FutureProvider.autoDispose.family<NewsFeed, String>((ref, query) async {
  ref.pollEvery(const Duration(minutes: 2));
  return NewsFeed.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('news/feed?$query'));
});

/// Older stories (`before=<next>`), for "Load older stories".
Future<NewsFeed> loadOlderNews(WidgetRef ref, String query, String before) async =>
    NewsFeed.fromJson(await ref.read(apiProvider).get<Map<String, dynamic>>('news/feed?$query&before=${Uri.encodeQueryComponent(before)}'));

final newsMapProvider = FutureProvider.autoDispose<NewsMap>((ref) async {
  ref.pollEvery(const Duration(minutes: 5));
  return NewsMap.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('news/map', query: {'hours': 48}));
});

final newsBriefProvider = FutureProvider.autoDispose<BriefAnswer>((ref) async {
  ref.pollEvery(const Duration(minutes: 10));
  return BriefAnswer.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('news/brief'));
});

/* ------------------------------------------------------------------ calendar */

class CalEvent {
  const CalEvent({
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
    required this.lowerIsBetter,
    required this.symbols,
  });
  final int id;
  final String title, currency, country, serverDate, serverTime, forecast, previous, actual;
  final DateTime startsAt;
  final bool allDay, lowerIsBetter;

  /// 0 holiday, 1 low, 2 medium, 3 high.
  final int impact;

  /// -1 worse than forecast, 0, +1 better.
  final int surprise;
  final List<String> symbols;

  factory CalEvent.fromJson(Map<String, dynamic> j) => CalEvent(
    id: _i(j['id']),
    title: _s(j['title']),
    currency: _s(j['currency']),
    country: _s(j['country']),
    startsAt: DateTime.tryParse(_s(j['startsAt'])) ?? DateTime.now(),
    serverDate: _s(j['serverDate']),
    serverTime: _s(j['serverTime']),
    allDay: j['allDay'] == true,
    impact: _i(j['impact']).clamp(0, 3),
    forecast: _s(j['forecast']),
    previous: _s(j['previous']),
    actual: _s(j['actual']),
    surprise: _i(j['surprise']).clamp(-1, 1),
    lowerIsBetter: j['lowerIsBetter'] == true,
    symbols: _list(j['symbols']),
  );
}

class CalendarWeek {
  const CalendarWeek({
    required this.events,
    required this.from,
    required this.to,
    required this.serverOffset,
    required this.updatedAt,
    required this.sourceName,
  });
  final List<CalEvent> events;
  final DateTime from, to;
  final int serverOffset;
  final DateTime? updatedAt;
  final String sourceName;

  factory CalendarWeek.fromJson(Map<String, dynamic> j) => CalendarWeek(
    events: [for (final e in (j['events'] as List? ?? const [])) CalEvent.fromJson(_map(e))],
    from: DateTime.tryParse(_s(j['from'])) ?? DateTime.now(),
    to: DateTime.tryParse(_s(j['to'])) ?? DateTime.now(),
    serverOffset: j['serverOffset'] is num ? _i(j['serverOffset']) : 3,
    updatedAt: DateTime.tryParse(_s(j['updatedAt'])),
    sourceName: _s(_map(j['source'])['name']).isEmpty ? 'Forex Factory' : _s(_map(j['source'])['name']),
  );
}

class CalHistory {
  const CalHistory(this.startsAt, this.actual);
  final DateTime startsAt;
  final String actual;
}

class MyCalendar {
  const MyCalendar({required this.reminders, required this.highImpact, required this.currencies, required this.minutes});
  final List<int> reminders;
  final bool highImpact;
  final List<String> currencies;
  final int minutes;

  factory MyCalendar.fromJson(Map<String, dynamic> j) {
    final a = j['alerts'] is Map ? _map(j['alerts']) : null;
    return MyCalendar(
      reminders: [for (final r in (j['reminders'] as List? ?? const [])) _i(r)],
      highImpact: a?['highImpact'] == true,
      currencies: _list(a?['currencies']),
      minutes: a == null || a['minutes'] == null ? 15 : _i(a['minutes']),
    );
  }

  MyCalendar copyWith({List<int>? reminders}) =>
      MyCalendar(reminders: reminders ?? this.reminders, highImpact: highImpact, currencies: currencies, minutes: minutes);
}

/// `news/calendar` (this week) or `news/calendar?from&to` (another week), every 5 min. The key is `from` (ISO) or ''.
final calendarWeekProvider = FutureProvider.autoDispose.family<CalendarWeek, String>((ref, from) async {
  ref.pollEvery(const Duration(minutes: 5));
  final api = ref.watch(apiProvider);
  if (from.isEmpty) return CalendarWeek.fromJson(await api.get<Map<String, dynamic>>('news/calendar'));
  final to = DateTime.parse(from).add(const Duration(days: 7)).toUtc().toIso8601String();
  return CalendarWeek.fromJson(await api.get<Map<String, dynamic>>('news/calendar', query: {'from': from, 'to': to}));
});

/// The next high-impact event (`news/calendar/next?impact=3`), every 5 min.
final calendarNextProvider = FutureProvider.autoDispose<CalEvent?>((ref) async {
  ref.pollEvery(const Duration(minutes: 5));
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('news/calendar/next', query: {'impact': 3});
  return j['event'] is Map ? CalEvent.fromJson(_map(j['event'])) : null;
});

/// One event's past releases (`news/calendar/<id>`).
final calendarDetailProvider = FutureProvider.autoDispose.family<List<CalHistory>, int>((ref, id) async {
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('news/calendar/$id');
  return [for (final h in (j['history'] as List? ?? const []).map(_map)) CalHistory(DateTime.tryParse(_s(h['startsAt'])) ?? DateTime.now(), _s(h['actual']))];
});

/// The client's reminders and alerts (`news/me/calendar`); writes update it in place.
class MyCalendarNotifier extends AsyncNotifier<MyCalendar> {
  @override
  Future<MyCalendar> build() async => MyCalendar.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('news/me/calendar'));

  /// Sets or removes the 15-minute reminder of `e`; returns true when it is now set. Throws ApiException.
  Future<bool> toggleReminder(CalEvent e) async {
    final cur = state.value;
    final on = cur?.reminders.contains(e.id) ?? false;
    final api = ref.read(apiProvider);
    if (on) {
      await api.delete<Map<String, dynamic>>('news/me/calendar/reminders/${e.id}');
    } else {
      await api.post<Map<String, dynamic>>('news/me/calendar/reminders', body: {'eventId': e.id, 'minutes': 15});
    }
    if (cur != null) {
      final next = on
          ? [
              for (final r in cur.reminders)
                if (r != e.id) r,
            ]
          : [...cur.reminders, e.id];
      state = AsyncData(cur.copyWith(reminders: next));
    }
    return !on;
  }

  /// Turns the high-impact alerts on (with `minutes` before) or off. Throws ApiException.
  Future<void> setAlerts(bool enable, int minutes) async {
    final api = ref.read(apiProvider);
    if (enable) {
      await api.put<Map<String, dynamic>>(
        'news/me/calendar/alerts',
        body: {'highImpact': true, 'currencies': state.value?.currencies ?? const <String>[], 'minutes': minutes},
      );
    } else {
      await api.delete<Map<String, dynamic>>('news/me/calendar/alerts');
    }
    ref.invalidateSelf();
    await future;
  }
}

final myCalendarProvider = AsyncNotifierProvider.autoDispose<MyCalendarNotifier, MyCalendar>(MyCalendarNotifier.new);
