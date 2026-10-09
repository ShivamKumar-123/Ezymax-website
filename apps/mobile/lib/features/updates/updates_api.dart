// Brand promotions (growth service banners of kind banner / event / post) for the app, through the Client Area's
// growth BFF (web apps/crm/components/growth/promo.tsx, updates.tsx):
// - `growth/banners?placement=dashboard`: the dashboard's banner slot, hero items (layout "hero") for the carousel;
// - `growth/posts?kind=&limit=`: Events & updates (events and brand posts targeted at the client, upcoming events
//   first, then the newest);
// - `growth/posts/{id}`: an event / post page with its markdown body.
// Uploaded images are served by the Client Area at `/api/growth/media/<id>` (public): relative image URLs are loaded
// from the broker's app URL; the web's own photo library (/assets/photos/…) comes from the app's assets.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_providers.dart';
import '../../core/config/app_config.dart';
import '../../core/format/format.dart';
import '../../i18n/locales.dart';

DateTime? _time(Object? v) => v is String && v.isNotEmpty ? DateTime.tryParse(v) : null;
String? _str(Object? v) => v is String && v.trim().isNotEmpty ? v : null;

@immutable
class PromoItem {
  const PromoItem({
    required this.id,
    required this.title,
    this.kind = 'banner',
    this.layout = 'card',
    this.body = '',
    this.tone = 'neutral',
    this.ctaLabel,
    this.ctaUrl,
    this.imageUrl,
    this.dismissible = false,
    this.eventStartsAt,
    this.eventEndsAt,
    this.eventState,
    this.location,
    this.publishedAt,
    this.content,
  });

  final String id, kind, layout, title, body, tone;
  final String? ctaLabel, ctaUrl, imageUrl, location;

  /// upcoming / live / ended (events only).
  final String? eventState;
  final bool dismissible;
  final DateTime? eventStartsAt, eventEndsAt, publishedAt;

  /// The markdown body of an event / post page (`posts/{id}` only).
  final String? content;

  bool get hero => layout == 'hero';
  bool get isEvent => kind == 'event' && eventStartsAt != null;

  /// Events and posts open their own page.
  bool get hasPage => kind == 'event' || kind == 'post';

  /// An online event's link (https:// only).
  bool get online => location != null && location!.startsWith('https://');

  /// Where a tap goes: the button's link, else (events, posts) the page.
  String? get href => ctaUrl ?? (hasPage ? '/updates/$id' : null);

  static PromoItem fromJson(Map<String, dynamic> j) => PromoItem(
    id: '${j['id']}',
    kind: '${j['kind'] ?? 'banner'}',
    layout: '${j['layout'] ?? 'card'}',
    title: '${j['title'] ?? ''}',
    body: '${j['body'] ?? ''}',
    tone: '${j['tone'] ?? 'neutral'}',
    ctaLabel: _str(j['ctaLabel']),
    ctaUrl: _str(j['ctaUrl']),
    imageUrl: _str(j['imageUrl']),
    dismissible: j['dismissible'] == true,
    eventStartsAt: _time(j['eventStartsAt']),
    eventEndsAt: _time(j['eventEndsAt']),
    eventState: _str(j['eventState']),
    location: _str(j['location']),
    publishedAt: _time(j['publishedAt']),
    content: j['content'] is String ? j['content'] as String : null,
  );
}

List<Map<String, dynamic>> _maps(Object? v) => [
  for (final x in (v is List ? v : const []))
    if (x is Map) x.cast<String, dynamic>(),
];

@immutable
class PostsPage {
  const PostsPage(this.items, this.total);
  final List<PromoItem> items;
  final int total;
}

/// Events & updates: `(kind or null, limit)`.
final postsProvider = FutureProvider.autoDispose.family<PostsPage, (String?, int)>((ref, q) async {
  final (kind, limit) = q;
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('growth/posts', query: {'kind': ?kind, 'limit': '$limit'});
  final total = j['total'];
  final items = [for (final m in _maps(j['items'])) PromoItem.fromJson(m)];
  return PostsPage(items, total is num ? total.toInt() : items.length);
});

/// One event / post page (404 when it ended or isn't meant for this client).
final postProvider = FutureProvider.autoDispose.family<PromoItem, String>((ref, id) async {
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('growth/posts/$id');
  final p = j['post'];
  return PromoItem.fromJson(p is Map ? p.cast<String, dynamic>() : const {});
});

/// Counts an impression / click / dismissal (fire and forget, one per client per item per day on the service).
void trackPromo(ApiClient api, String id, String kind) {
  unawaited(api.post<Object?>('growth/banners/$id/events', body: {'kind': kind}).then((_) {}, onError: (Object _) {}));
}

/* ------------------------------------------------------------------ */
/* Images                                                               */
/* ------------------------------------------------------------------ */

/// The web's photo library that ships with the app (assets/photos): no download for those.
const Set<String> kBundledPhotos = {
  'analytics.jpg',
  'bitcoin.jpg',
  'charts.jpg',
  'crypto-coins.jpg',
  'crypto.jpg',
  'dashboard.jpg',
  'dubai.jpg',
  'finance.jpg',
  'gold.jpg',
  'london.jpg',
  'money.jpg',
  'nyc.jpg',
  'singapore.jpg',
  'skyline.jpg',
  'skyscrapers.jpg',
  'stock-market.jpg',
  'trader.jpg',
  'trading-screen.jpg',
};

/// The image of an item: a bundled photo, a page of the broker's Client Area (uploads: `/api/growth/media/<id>`) or an
/// https:// URL. Null when there is none or the URL isn't one of those.
ImageProvider? promoImage(String? url, AppConfig config) {
  if (url == null || url.isEmpty) return null;
  final photo = RegExp(r'^/assets/photos/([a-z0-9-]+\.jpg)$').firstMatch(url);
  if (photo != null && kBundledPhotos.contains(photo.group(1))) return AssetImage('assets/photos/${photo.group(1)}');
  if (url.startsWith('/') && !url.startsWith('//')) return NetworkImage('${config.appUrl.replaceAll(RegExp(r'/+$'), '')}$url');
  if (url.startsWith('https://')) return NetworkImage(url);
  return null;
}

/* ------------------------------------------------------------------ */
/* Dates (the reader's time zone, like the web)                        */
/* ------------------------------------------------------------------ */

/// "Thu 12 Nov, 18:30 – 21:30 GST" in the device's time zone.
String eventWhen(String locale, DateTime start, DateTime? end) {
  final tag = intlLocale(locale);
  final s = start.toLocal();
  final full = DateFormat('EEE d MMM, HH:mm', tag);
  final tz = s.timeZoneName;
  final a = latinDigits(full.format(s));
  if (end == null) return '$a $tz';
  final e = end.toLocal();
  final sameDay = s.year == e.year && s.month == e.month && s.day == e.day;
  final b = latinDigits((sameDay ? DateFormat('HH:mm', tag) : full).format(e));
  return '$a – $b $tz';
}

/// Month and day of an event's badge ("OCT", "14").
(String, String) eventBadge(String locale, DateTime start) {
  final tag = intlLocale(locale);
  final s = start.toLocal();
  return (DateFormat('MMM', tag).format(s).toUpperCase(), latinDigits(DateFormat('d', tag).format(s)));
}

/// A post's publish date ("12 Nov 2026").
String publishedOn(String locale, DateTime d) => latinDigits(DateFormat.yMMMd(intlLocale(locale)).format(d.toLocal()));
