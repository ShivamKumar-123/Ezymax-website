// The Offers page (web components/growth/offers.tsx): every promotion the broker is running that this client
// qualifies for. An offer is a banner of kind "offer" on the growth service, so it is a PromoItem with the two
// things the page adds: whether this client has been shown it, and when it stops running.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import '../updates/updates_api.dart';

class OfferItem {
  const OfferItem({required this.promo, required this.isNew, this.endsAt, this.content = ''});

  final PromoItem promo;

  /// False once the client has been shown it: what the rail badges, and what the "New" chip marks.
  final bool isNew;

  /// When the offer stops running. Null = open ended.
  final DateTime? endsAt;

  /// The terms, in the Academy's markdown subset.
  final String content;

  static OfferItem fromJson(Map<String, dynamic> j) => OfferItem(
    promo: PromoItem.fromJson(j),
    isNew: j['isNew'] == true,
    endsAt: _endsAt(j['endsAt']),
    content: j['content'] is String ? j['content'] as String : '',
  );

  /// Days until it ends, or null when it is open ended or further out than is worth hurrying anyone about.
  int? get daysLeft {
    final end = endsAt;
    if (end == null) return null;
    final days = end.difference(DateTime.now()).inHours / 24;
    if (days <= 0) return null;
    final whole = days.ceil();
    return whole <= 14 ? whole : null;
  }
}

DateTime? _endsAt(Object? v) => v is String ? DateTime.tryParse(v) : null;

/// Every live offer for this client, highest priority and newest first.
final offersProvider = FutureProvider.autoDispose<List<OfferItem>>((ref) async {
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('growth/offers');
  final items = j['items'];
  return [
    for (final x in (items is List ? items : const []))
      if (x is Map) OfferItem.fromJson(x.cast<String, dynamic>()),
  ];
});

/// How many offers this client has never been shown: the number on the rail.
final unreadOffersProvider = Provider.autoDispose<int>((ref) {
  final offers = ref.watch(offersProvider).value;
  return offers == null ? 0 : offers.where((o) => o.isNew).length;
});
