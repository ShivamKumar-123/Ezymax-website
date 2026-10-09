// Sample answers for the Dashboard's own cards (development previews and widget tests only; never in a shipped build):
// the growth banner, headlines, today's calendar and the news map. Only the dashboard's exact queries are answered,
// so the News / Calendar pages keep their own sample data. Shapes are the real API's (the web's /api/news/… and
// /api/growth/… routes); values are made up.

import 'preview_promotions.dart';

String _iso(Duration ago) => DateTime.now().subtract(ago).toUtc().toIso8601String();

Map<String, dynamic> _story(
  int id,
  String title,
  String summary,
  String source,
  Duration ago,
  String category,
  String sentiment,
  List<String> countries,
  List<String> symbols, {
  bool pinned = false,
}) => {
  'id': id,
  'title': title,
  'summary': summary,
  'link': 'https://example.com/markets/$id',
  'source': {'id': source.toLowerCase().replaceAll(' ', '-'), 'name': source, 'homepage': 'https://example.com'},
  'publishedAt': _iso(ago),
  'countries': countries,
  'currencies': const <String>[],
  'symbols': symbols,
  'category': category,
  'sentiment': sentiment,
  'importance': 0.7,
  'pinned': pinned,
};

Map<String, dynamic> _event(
  int id,
  String title,
  String currency,
  String country,
  Duration fromNow,
  int impact, {
  String actual = '',
  String forecast = '',
  String previous = '',
}) {
  final at = DateTime.now().toUtc().add(fromNow);
  final server = at.add(const Duration(hours: 3));
  String two(int n) => n.toString().padLeft(2, '0');
  return {
    'id': id,
    'title': title,
    'currency': currency,
    'country': country,
    'startsAt': at.toIso8601String(),
    'serverDate': '${server.year}-${two(server.month)}-${two(server.day)}',
    'serverTime': '${two(server.hour)}:${two(server.minute)}',
    'allDay': false,
    'impact': impact,
    'impactLabel': impact == 3 ? 'high' : 'medium',
    'forecast': forecast,
    'previous': previous,
    'actual': actual,
    'actualSource': null,
    'surprise': actual.isEmpty ? 0 : 1,
    'lowerIsBetter': false,
    'symbols': const <String>[],
    'updatedAt': _iso(Duration.zero),
  };
}

(int, Object)? previewDashboard(String method, String path, Map<String, dynamic> body, Map<String, String> query) {
  switch (path) {
    case 'growth/banners':
      if (query['placement'] != 'dashboard') return null;
      return (
        200,
        {
          'items': [
            ...previewHeroItems(),
            {
              'id': 41,
              'title': 'Zero-fee USDT deposits this week',
              'body': 'Fund your wallet on TRC20 or BEP20 and we cover the network fee.',
              'tone': 'ember',
              'ctaLabel': 'Deposit now',
              'ctaUrl': '/wallet/deposit',
              'imageUrl': null,
              'dismissible': true,
            },
          ],
        },
      );
    case 'news/feed':
      if (query['limit'] != '6' || query.length != 1) return null;
      return (
        200,
        {
          'pinned': [
            _story(
              5001,
              'Fed holds rates, signals one more cut before year end',
              'Policymakers kept the target range unchanged and pointed to cooling inflation.',
              'Reuters',
              const Duration(minutes: 38),
              'macro',
              'bullish',
              ['us'],
              ['EURUSD', 'XAUUSD'],
              pinned: true,
            ),
          ],
          'items': [
            _story(
              5002,
              'Gold climbs to a two-week high as the dollar slips',
              'Bullion rose for a third day as US yields eased.',
              'Bloomberg',
              const Duration(hours: 2, minutes: 10),
              'metals',
              'bullish',
              ['us'],
              ['XAUUSD'],
            ),
            _story(
              5003,
              'ECB officials split over the pace of easing',
              'Two governing council members urged patience.',
              'FT',
              const Duration(hours: 4),
              'macro',
              'neutral',
              ['eu', 'de'],
              ['EURUSD'],
            ),
            _story(
              5004,
              'Bitcoin steadies above \$63,000 after ETF inflows',
              'Spot ETFs drew a fourth day of inflows.',
              'CoinDesk',
              const Duration(hours: 7),
              'crypto',
              'bullish',
              ['us'],
              ['BTCUSD'],
            ),
          ],
          'next': null,
        },
      );
    case 'news/calendar':
      if (query['impact'] != '2,3') return null;
      return (
        200,
        {
          'events': [
            _event(7001, 'Non-Farm Payrolls', 'USD', 'us', const Duration(hours: 2), 3, forecast: '185K', previous: '142K'),
            _event(7002, 'ECB Press Conference', 'EUR', 'eu', const Duration(hours: 4, minutes: 30), 3),
            _event(7003, 'Retail Sales m/m', 'GBP', 'gb', const Duration(hours: 6), 2, forecast: '0.3%', previous: '-0.2%'),
            _event(7004, 'CPI y/y', 'JPY', 'jp', const Duration(hours: 20), 2, forecast: '2.6%', previous: '2.8%'),
          ],
          'from': '',
          'to': '',
          'serverOffset': 3,
          'now': _iso(Duration.zero),
          'updatedAt': _iso(const Duration(minutes: 5)),
          'source': {'name': 'Calendar', 'url': 'https://example.com', 'lastOkAt': null, 'lastError': null},
        },
      );
    case 'news/map':
      if (query['hours'] != '24') return null;
      return (
        200,
        {
          'hours': 24,
          'total': 64,
          'countries': [
            {'country': 'us', 'name': 'United States', 'count': 22, 'bullish': 12, 'bearish': 5, 'sentiment': 0.32, 'top': null},
            {'country': 'eu', 'name': 'Euro area', 'count': 11, 'bullish': 3, 'bearish': 5, 'sentiment': -0.18, 'top': null},
            {'country': 'gb', 'name': 'United Kingdom', 'count': 8, 'bullish': 2, 'bearish': 4, 'sentiment': -0.25, 'top': null},
            {'country': 'jp', 'name': 'Japan', 'count': 7, 'bullish': 4, 'bearish': 1, 'sentiment': 0.4, 'top': null},
            {'country': 'cn', 'name': 'China', 'count': 6, 'bullish': 2, 'bearish': 2, 'sentiment': 0.05, 'top': null},
            {'country': 'in', 'name': 'India', 'count': 5, 'bullish': 3, 'bearish': 0, 'sentiment': 0.5, 'top': null},
            {'country': 'au', 'name': 'Australia', 'count': 3, 'bullish': 1, 'bearish': 1, 'sentiment': 0, 'top': null},
            {'country': 'sa', 'name': 'Saudi Arabia', 'count': 2, 'bullish': 0, 'bearish': 1, 'sentiment': -0.3, 'top': null},
          ],
          'mentions': const <Object>[],
        },
      );
    case 'growth/banners/41/events':
      return (200, {'ok': true});
  }
  return null;
}
