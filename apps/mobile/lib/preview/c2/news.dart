// Sample answers for the News page (previews and widget tests only; shapes of components/news-live/api.ts).
String _ago(int minutes) => DateTime.now().toUtc().subtract(Duration(minutes: minutes)).toIso8601String();

Map<String, dynamic> _story(
  int id,
  String title,
  String summary,
  String source,
  int minutesAgo,
  String category,
  String sentiment, {
  List<String> countries = const [],
  List<String> symbols = const [],
  double importance = 0.5,
  bool pinned = false,
}) => {
  'id': id,
  'title': title,
  'summary': summary,
  'link': 'https://example.com/markets/$id',
  'source': {'id': source.toLowerCase().replaceAll(' ', '-'), 'name': source, 'homepage': 'https://example.com'},
  'publishedAt': _ago(minutesAgo),
  'countries': countries,
  'currencies': <String>[],
  'symbols': symbols,
  'category': category,
  'sentiment': sentiment,
  'importance': importance,
  'pinned': pinned,
};

List<Map<String, dynamic>> _stories() => [
  _story(
    9101,
    'Fed holds rates steady, signals patience as inflation cools',
    'Policymakers kept the target range unchanged and said they want more evidence that inflation is moving sustainably toward 2% before cutting.',
    'Federal Reserve',
    18,
    'macro',
    'neutral',
    countries: ['us'],
    symbols: ['EURUSD', 'XAUUSD', 'US30'],
    importance: 0.95,
  ),
  _story(
    9102,
    'Gold climbs to a two-week high as the dollar eases',
    'Bullion extended gains for a third session as Treasury yields slipped after softer US data.',
    'Reuters',
    42,
    'metals',
    'bullish',
    countries: ['us'],
    symbols: ['XAUUSD', 'XAGUSD'],
    importance: 0.7,
  ),
  _story(
    9103,
    'ECB speakers push back on early rate-cut bets',
    'Two Governing Council members said markets were getting ahead of themselves on the timing of the first cut.',
    'ECB',
    75,
    'macro',
    'bearish',
    countries: ['eu', 'de'],
    symbols: ['EURUSD', 'GER40'],
    importance: 0.6,
  ),
  _story(
    9104,
    'Bitcoin steadies above \$63,000 after ETF inflows resume',
    'Spot ETFs recorded their first net inflows in a week, lifting sentiment across major tokens.',
    'CoinDesk',
    110,
    'crypto',
    'bullish',
    countries: ['us'],
    symbols: ['BTCUSD', 'ETHUSD'],
  ),
  _story(
    9105,
    'Oil slips as OPEC+ weighs output plans for next quarter',
    'Crude futures eased after delegates said the group could start unwinding voluntary cuts as planned.',
    'Bloomberg',
    160,
    'energies',
    'bearish',
    countries: ['sa', 'ru'],
    symbols: ['USOIL', 'UKOIL'],
  ),
  _story(
    9106,
    'Bank of Japan keeps policy unchanged, yen little moved',
    'The central bank left its short-term rate target unchanged and repeated it would raise rates if the outlook is realised.',
    'Bank of Japan',
    230,
    'forex',
    'neutral',
    countries: ['jp'],
    symbols: ['USDJPY', 'JP225'],
  ),
  _story(
    9107,
    'Nasdaq futures rise ahead of big tech earnings',
    'Investors positioned for results from the largest US technology companies later this week.',
    'MarketWatch',
    320,
    'indices',
    'bullish',
    countries: ['us'],
    symbols: ['NAS100', 'NVDA', 'META'],
  ),
  _story(
    9108,
    'UK inflation eases more than expected in September',
    'Consumer prices rose at the slowest pace in three years, strengthening the case for a rate cut.',
    'ONS',
    410,
    'macro',
    'bearish',
    countries: ['gb'],
    symbols: ['GBPUSD', 'UK100'],
  ),
];

Map<String, dynamic> get previewNewsFeed => {'pinned': <Map<String, dynamic>>[], 'items': _stories(), 'next': '2026-10-07T00:00:00Z'};

Map<String, dynamic> get previewNewsMap => {
  'hours': 48,
  'total': 214,
  'countries': [
    {'country': 'us', 'name': 'United States', 'count': 86, 'bullish': 31, 'bearish': 22, 'sentiment': 0.12, 'top': null},
    {'country': 'eu', 'name': 'Euro area', 'count': 34, 'bullish': 9, 'bearish': 14, 'sentiment': -0.21, 'top': null},
    {'country': 'gb', 'name': 'United Kingdom', 'count': 22, 'bullish': 6, 'bearish': 10, 'sentiment': -0.25, 'top': null},
    {'country': 'jp', 'name': 'Japan', 'count': 18, 'bullish': 5, 'bearish': 4, 'sentiment': 0.05, 'top': null},
    {'country': 'cn', 'name': 'China', 'count': 15, 'bullish': 7, 'bearish': 3, 'sentiment': 0.3, 'top': null},
    {'country': 'de', 'name': 'Germany', 'count': 12, 'bullish': 3, 'bearish': 6, 'sentiment': -0.28, 'top': null},
    {'country': 'au', 'name': 'Australia', 'count': 9, 'bullish': 4, 'bearish': 2, 'sentiment': 0.22, 'top': null},
    {'country': 'sa', 'name': 'Saudi Arabia', 'count': 7, 'bullish': 1, 'bearish': 4, 'sentiment': -0.4, 'top': null},
    {'country': 'in', 'name': 'India', 'count': 6, 'bullish': 3, 'bearish': 1, 'sentiment': 0.3, 'top': null},
  ],
  'mentions': [
    {'symbol': 'EURUSD', 'count': 41},
    {'symbol': 'XAUUSD', 'count': 33},
    {'symbol': 'USDJPY', 'count': 21},
    {'symbol': 'BTCUSD', 'count': 18},
    {'symbol': 'NAS100', 'count': 12},
  ],
};

Map<String, dynamic> get previewNewsBrief => {
  'brief': {
    'mood': 'cautious',
    'headline': 'Markets wait on central banks as the dollar softens and gold firms.',
    'points': [
      {'text': 'The Fed held rates and asked for patience; Treasury yields slipped.', 'tone': 'neutral'},
      {'text': 'Gold reached a two-week high on the weaker dollar.', 'tone': 'up'},
      {'text': 'Oil eased as OPEC+ weighs next quarter\'s output.', 'tone': 'down'},
    ],
    'watch': ['XAUUSD', 'EURUSD', 'USOIL', 'NAS100'],
    'calendarNote': 'US jobless claims at 15:30 and the ECB minutes at 14:30 server time.',
  },
  'day': DateTime.now().toUtc().toIso8601String().substring(0, 10),
  'model': 'preview',
  'createdAt': _ago(190),
  'configured': true,
};

(int, Object)? previewNews(String method, String path, Map<String, dynamic> body, Map<String, String> query) {
  switch (path) {
    case 'news/feed':
      if (query['before'] != null) {
        return (
          200,
          {
            'pinned': <Map<String, dynamic>>[],
            'items': [
              _story(
                9090,
                'Swiss franc firms as safe-haven demand returns',
                'The franc rose against the euro for a second day.',
                'SNB',
                900,
                'forex',
                'neutral',
                countries: ['ch'],
                symbols: ['USDCHF'],
              ),
            ],
            'next': null,
          },
        );
      }
      var items = _stories();
      final cat = query['category'];
      final country = query['country'];
      final sentiment = query['sentiment'];
      if (cat != null) items = items.where((s) => s['category'] == cat).toList();
      if (country != null) items = items.where((s) => (s['countries'] as List).contains(country)).toList();
      if (sentiment != null) items = items.where((s) => s['sentiment'] == sentiment).toList();
      return (200, {...previewNewsFeed, 'items': items});
    case 'news/map':
      return (200, previewNewsMap);
    case 'news/brief':
      return (200, previewNewsBrief);
  }
  return null;
}
