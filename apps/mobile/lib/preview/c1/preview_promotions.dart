// Sample brand promotions (development previews, widget tests and the in-app demo; never in a shipped build): the
// dashboard's hero items, Events & updates and their pages, the same as the web's demo (packages/mock/src/promotions.ts).
// Pictures are the web's photo library that ships with the app (assets/photos), so nothing is downloaded.

/// `days` from today at `hh:mm` server time (GMT+3), as an ISO instant.
String _at(int days, int hh, [int mm = 0]) {
  final d = DateTime.now().toUtc().add(Duration(days: days));
  return DateTime.utc(d.year, d.month, d.day, hh - 3, mm).toIso8601String();
}

Map<String, dynamic> _item(
  int id,
  String kind,
  String layout,
  String title,
  String body,
  String photo, {
  String? ctaLabel,
  String? ctaUrl,
  String tone = 'ember',
  String? starts,
  String? ends,
  String? location,
  int publishedDaysAgo = 1,
  String content = '',
}) => {
  'id': id,
  'kind': kind,
  'layout': layout,
  'title': title,
  'body': body,
  'ctaLabel': ctaLabel,
  'ctaUrl': ctaUrl,
  'imageUrl': '/assets/photos/$photo',
  'imageMediaId': null,
  'tone': tone,
  'placement': 'dashboard',
  'dismissible': true,
  'eventStartsAt': starts,
  'eventEndsAt': ends,
  'eventState': starts == null ? null : 'upcoming',
  'location': location,
  'publishedAt': _at(-publishedDaysAgo, 10),
  'content': content,
};

List<Map<String, dynamic>> previewPromoItems() => [
  _item(
    9101,
    'banner',
    'hero',
    'Zero spreads on gold, all week',
    "Trade XAUUSD from 0.0 pips on Raw accounts until Friday's close. Commission only.",
    'gold.jpg',
    ctaLabel: 'Trade gold',
    ctaUrl: '/accounts',
    tone: 'gold',
    publishedDaysAgo: 2,
  ),
  _item(
    9102,
    'event',
    'hero',
    'Ezymex Traders Summit · Dubai',
    'An evening with our dealing desk and market strategists at DIFC. Seats are limited.',
    'dubai.jpg',
    ctaLabel: 'Reserve a seat',
    starts: _at(5, 18, 30),
    ends: _at(5, 21, 30),
    location: 'Gate Village 3, DIFC, Dubai',
    content: [
      'Join the Ezymex team for an evening on the markets that moved this quarter, and the ones to watch next.',
      '',
      '## Agenda',
      '',
      '1. **18:30** Welcome and registration',
      '2. **19:00** Gold, oil and the dollar: the quarter ahead',
      '3. **19:45** Live Q&A with the dealing desk',
      '4. **20:30** Networking',
      '',
      '> **Note:** Entry is free for verified clients. Bring the confirmation email and an ID.',
    ].join('\n'),
  ),
  _item(
    9103,
    'event',
    'card',
    'Webinar: Trading the NFP release',
    'A live walk-through of the US jobs report: what moves, how fast, and how to size risk around it.',
    'trading-screen.jpg',
    starts: _at(12, 15),
    ends: _at(12, 16),
    location: 'https://meet.ezymex.com/nfp-live',
    publishedDaysAgo: 3,
    content: [
      'Non-farm payrolls is the most watched number of the month. In 60 minutes we cover:',
      '',
      '- How EURUSD, gold and US indices reacted over the last 12 releases',
      '- Spreads and slippage in the first minute, and why limit orders help',
      '- A simple plan: size, stop and what to do if the number surprises',
    ].join('\n'),
  ),
  _item(
    9104,
    'post',
    'card',
    'New: Ezymex Trader for Android',
    'The full trading terminal now runs natively on Android, with one-tap trading from the chart and price alerts.',
    'charts.jpg',
    tone: 'neutral',
    content: [
      'Ezymex Trader is now a native Android app. Sign in with your Client Area account and everything is there.',
      '',
      '## What\'s in it',
      '',
      '- **One-tap trading** from the chart, with stop loss and take profit you drag into place',
      '- **Price alerts** that reach you even when the app is closed',
      '- **Biometric unlock** and the same two-step verification as the web',
    ].join('\n'),
  ),
  _item(
    9105,
    'post',
    'card',
    'Holiday trading hours for US Thanksgiving',
    'US indices and stocks close early on Friday. Forex and crypto trade as usual.',
    'nyc.jpg',
    tone: 'neutral',
    publishedDaysAgo: 4,
    content: [
      'Trading hours change around the US holiday (server time, GMT+3):',
      '',
      '| Market | Thursday | Friday |',
      '| --- | --- | --- |',
      '| US30, US500, NAS100 | Closed | Closes 20:15 |',
      '| Forex, metals, crypto | Normal | Normal |',
    ].join('\n'),
  ),
];

Map<String, dynamic> _card(Map<String, dynamic> m) => {...m}..remove('content');

/// The dashboard's hero items (the banner slot answer adds its card banner after them).
List<Map<String, dynamic>> previewHeroItems() => [
  for (final m in previewPromoItems())
    if (m['layout'] == 'hero') _card(m),
];

(int, Object)? previewPromotions(String method, String path, Map<String, dynamic> body, Map<String, String> query) {
  if (method == 'POST' && RegExp(r'^growth/banners/\d+/events$').hasMatch(path)) return (200, {'ok': true});
  if (method != 'GET') return null;
  if (path == 'growth/posts') {
    final kind = query['kind'];
    final limit = int.tryParse(query['limit'] ?? '') ?? 20;
    final all = [
      for (final m in previewPromoItems())
        if (m['kind'] != 'banner' && (kind == null || m['kind'] == kind)) _card(m),
    ];
    // upcoming events first (soonest first), then the newest
    all.sort((a, b) {
      final ea = a['eventStartsAt'] as String?, eb = b['eventStartsAt'] as String?;
      if ((ea == null) != (eb == null)) return ea != null ? -1 : 1;
      if (ea != null && eb != null) return ea.compareTo(eb);
      return (b['publishedAt'] as String).compareTo(a['publishedAt'] as String);
    });
    return (200, {'items': all.take(limit).toList(), 'total': all.length, 'page': 1, 'limit': limit});
  }
  final one = RegExp(r'^growth/posts/(\d+)$').firstMatch(path);
  if (one != null) {
    for (final m in previewPromoItems()) {
      if ('${m['id']}' == one.group(1) && m['kind'] != 'banner') return (200, {'post': m});
    }
    return (
      404,
      {
        'error': {'code': 'not_found', 'message': 'Not found.'},
      },
    );
  }
  return null;
}
