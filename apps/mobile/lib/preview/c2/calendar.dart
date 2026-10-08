// Sample answers for the Calendar page (previews and widget tests only; shapes of components/news-live/api.ts).
const int _offset = 3;

/// Monday 00:00 server time of the week holding `at` (as a UTC instant).
DateTime _weekStart(DateTime at) {
  final server = at.toUtc().add(const Duration(hours: _offset));
  final monday = DateTime.utc(server.year, server.month, server.day).subtract(Duration(days: server.weekday - 1));
  return monday.subtract(const Duration(hours: _offset));
}

final List<int> _reminders = [];
Map<String, dynamic>? _alerts = {'highImpact': true, 'currencies': <String>[], 'minutes': 15};

Map<String, dynamic> _event(
  int id,
  DateTime start,
  int dayOffset,
  String time,
  String ccy,
  String country,
  String title,
  int impact, {
  String forecast = '',
  String previous = '',
  String actual = '',
  int surprise = 0,
  List<String> symbols = const [],
  bool lowerIsBetter = false,
}) {
  final h = int.parse(time.substring(0, 2)), m = int.parse(time.substring(3));
  final serverMidnight = start.add(Duration(days: dayOffset));
  final at = serverMidnight.add(Duration(hours: h, minutes: m));
  final serverDate = serverMidnight.add(const Duration(hours: _offset)).toIso8601String().substring(0, 10);
  return {
    'id': id,
    'title': title,
    'currency': ccy,
    'country': country,
    'startsAt': at.toIso8601String(),
    'serverDate': serverDate,
    'serverTime': time,
    'allDay': false,
    'impact': impact,
    'impactLabel': const ['holiday', 'low', 'medium', 'high'][impact],
    'forecast': forecast,
    'previous': previous,
    'actual': actual,
    'actualSource': actual.isEmpty ? null : 'preview',
    'surprise': surprise,
    'lowerIsBetter': lowerIsBetter,
    'symbols': symbols,
    'updatedAt': DateTime.now().toUtc().toIso8601String(),
  };
}

List<Map<String, dynamic>> _week(DateTime start) {
  final base = start.millisecondsSinceEpoch ~/ 86400000 % 1000 * 100;
  return [
    _event(base + 1, start, 0, '03:30', 'AUD', 'au', 'RBA Meeting Minutes', 2, symbols: ['AUDUSD']),
    _event(
      base + 2,
      start,
      0,
      '11:00',
      'EUR',
      'de',
      'German ZEW Economic Sentiment',
      2,
      forecast: '10.2',
      previous: '3.6',
      actual: '13.1',
      surprise: 1,
      symbols: ['EURUSD', 'GER40'],
    ),
    _event(
      base + 3,
      start,
      0,
      '17:00',
      'USD',
      'us',
      'ISM Services PMI',
      3,
      forecast: '51.7',
      previous: '51.5',
      actual: '50.9',
      surprise: -1,
      symbols: ['EURUSD', 'US30', 'XAUUSD'],
    ),
    _event(
      base + 4,
      start,
      1,
      '09:00',
      'GBP',
      'gb',
      'CPI y/y',
      3,
      forecast: '2.1%',
      previous: '2.2%',
      actual: '1.7%',
      surprise: -1,
      symbols: ['GBPUSD', 'UK100'],
      lowerIsBetter: true,
    ),
    _event(base + 5, start, 1, '15:30', 'USD', 'us', 'Building Permits', 1, forecast: '1.43M', previous: '1.47M', actual: '1.43M', symbols: ['US30']),
    _event(base + 6, start, 2, '12:00', 'EUR', 'eu', 'ECB President Lagarde Speaks', 3, symbols: ['EURUSD']),
    _event(
      base + 7,
      start,
      2,
      '15:30',
      'USD',
      'us',
      'Unemployment Claims',
      2,
      forecast: '231K',
      previous: '225K',
      symbols: ['EURUSD', 'XAUUSD'],
      lowerIsBetter: true,
    ),
    _event(base + 8, start, 2, '21:00', 'USD', 'us', 'FOMC Meeting Minutes', 3, symbols: ['EURUSD', 'XAUUSD', 'NAS100']),
    _event(base + 9, start, 3, '02:30', 'JPY', 'jp', 'National Core CPI y/y', 2, forecast: '2.3%', previous: '2.8%', symbols: ['USDJPY', 'JP225']),
    _event(base + 10, start, 3, '15:30', 'USD', 'us', 'Core Retail Sales m/m', 3, forecast: '0.1%', previous: '0.4%', symbols: ['EURUSD', 'US30']),
    _event(base + 11, start, 3, '15:30', 'CAD', 'ca', 'CPI m/m', 2, forecast: '-0.1%', previous: '0.4%', symbols: ['USDCAD']),
    _event(base + 12, start, 4, '09:00', 'GBP', 'gb', 'Retail Sales m/m', 2, forecast: '-0.3%', previous: '1.0%', symbols: ['GBPUSD']),
    _event(
      base + 13,
      start,
      4,
      '15:30',
      'USD',
      'us',
      'Non-Farm Employment Change',
      3,
      forecast: '140K',
      previous: '254K',
      symbols: ['EURUSD', 'XAUUSD', 'US30'],
    ),
  ];
}

Map<String, dynamic> _calendar(DateTime start) => {
  'events': _week(start),
  'from': start.toIso8601String(),
  'to': start.add(const Duration(days: 7)).toIso8601String(),
  'serverOffset': _offset,
  'now': DateTime.now().toUtc().toIso8601String(),
  'updatedAt': DateTime.now().toUtc().subtract(const Duration(minutes: 7)).toIso8601String(),
  'source': {'name': 'Forex Factory', 'url': 'https://www.forexfactory.com/calendar', 'lastOkAt': null, 'lastError': null},
};

(int, Object)? previewCalendar(String method, String path, Map<String, dynamic> body, Map<String, String> query) {
  if (path == 'news/calendar') {
    final from = DateTime.tryParse(query['from'] ?? '');
    return (200, _calendar(from == null ? _weekStart(DateTime.now()) : _weekStart(from.add(const Duration(hours: 12)))));
  }
  if (path == 'news/calendar/next') {
    final now = DateTime.now().toUtc();
    final next = [
      ..._week(_weekStart(now)),
      ..._week(_weekStart(now).add(const Duration(days: 7))),
    ].where((e) => e['impact'] == 3 && DateTime.parse(e['startsAt'] as String).isAfter(now)).firstOrNull;
    return (200, {'event': next});
  }
  if (path == 'news/me/calendar') return (200, {'reminders': _reminders, 'alerts': _alerts});
  if (path == 'news/me/calendar/reminders' && method == 'POST') {
    final id = (body['eventId'] as num?)?.toInt();
    if (id != null && !_reminders.contains(id)) _reminders.add(id);
    return (200, {'ok': true});
  }
  if (path.startsWith('news/me/calendar/reminders/') && method == 'DELETE') {
    _reminders.remove(int.tryParse(path.split('/').last));
    return (200, {'ok': true});
  }
  if (path == 'news/me/calendar/alerts') {
    _alerts = method == 'DELETE' ? null : {'highImpact': true, 'currencies': body['currencies'] ?? <String>[], 'minutes': body['minutes'] ?? 15};
    return (200, {'ok': true});
  }
  final detail = RegExp(r'^news/calendar/(\d+)$').firstMatch(path);
  if (detail != null) {
    final now = DateTime.now().toUtc();
    final values = ['2.4%', '2.6%', '2.9%', '2.5%', '2.2%', '2.0%'];
    return (
      200,
      {
        'event': null,
        'history': [
          for (var i = 0; i < values.length; i++)
            {'startsAt': now.subtract(Duration(days: 30 * (values.length - i))).toIso8601String(), 'actual': values[i], 'forecast': '', 'previous': ''},
        ],
      },
    );
  }
  return null;
}
