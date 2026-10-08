// Wallet › History: port of apps/crm/components/wallet-live/history-page.tsx (LiveHistoryPage): the type tabs
// (All / Deposits / Withdrawals / Transfers / Other), 25 rows a page with the pager, newest first.
// `?type=` and `?page=` open a tab and page (the web's search params).
// Data: GET wallet/activity?type&page&limit=25 every 20 s.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'wallet_api.dart';
import 'widgets/wallet_ui.dart';

const List<String> kHistoryKinds = ['all', 'deposit', 'withdrawal', 'transfer', 'other'];

class WalletHistoryScreen extends ConsumerStatefulWidget {
  const WalletHistoryScreen({super.key, this.query = const {}});

  /// The route's query parameters (the web page's search params).
  final Map<String, String> query;

  @override
  ConsumerState<WalletHistoryScreen> createState() => _WalletHistoryScreenState();
}

class _WalletHistoryScreenState extends ConsumerState<WalletHistoryScreen> {
  late String _kind = _kindOf(widget.query);
  late int _page = _pageOf(widget.query);

  static String _kindOf(Map<String, String> q) => kHistoryKinds.contains(q['type']) ? q['type']! : 'all';
  static int _pageOf(Map<String, String> q) {
    final p = int.tryParse(q['page'] ?? '') ?? 1;
    return p < 1 ? 1 : p;
  }

  @override
  void didUpdateWidget(WalletHistoryScreen old) {
    super.didUpdateWidget(old);
    if (old.query['type'] != widget.query['type'] || old.query['page'] != widget.query['page']) {
      _kind = _kindOf(widget.query);
      _page = _pageOf(widget.query);
    }
  }

  ActivityQuery get _q => (type: _kind, page: _page, limit: kHistoryPer, ms: 20000);

  void _go(String kind, [int page = 1]) => setState(() {
    _kind = kind;
    _page = page;
  });

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final res = ref.watch(walletActivityPageProvider(_q));
    final data = res.value;
    final pages = data == null ? 1 : ((data.total + kHistoryPer - 1) ~/ kHistoryPer).clamp(1, 1 << 30);

    return KPageScroll(
      onRefresh: () async {
        ref.invalidate(walletActivityPageProvider(_q));
        await ref.read(walletActivityPageProvider(_q).future).then((_) {}, onError: (Object _) {});
      },
      children: [
        WalletHeader(title: t('wallet.history.title'), subtitle: t('wallet.history.subtitle'), actions: const [BackToWallet()]),
        if (res.hasError && data == null)
          WalletUnavailable(onRetry: () => ref.invalidate(walletActivityPageProvider(_q)))
        else
          KCard(
            padding: const EdgeInsets.fromLTRB(0, 14, 0, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                KChoiceChips<String>(
                  values: kHistoryKinds,
                  labels: [t('common.all'), t('wallet.tab.deposits'), t('wallet.tab.withdrawals'), t('wallet.tab.transfers'), t('wallet.tab.other')],
                  selected: _kind,
                  onChanged: _go,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                ),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (data == null) const KSkeleton(height: 160, radius: 14),
                      if (data != null && data.items.isEmpty)
                        KEmptyState(compact: true, art: KIllustrationName.emptyHistory, title: t('common.noData'), text: t('wallet.history.emptyText')),
                      if (data != null)
                        for (var i = 0; i < data.items.length; i++) ...[if (i > 0) const SizedBox(height: 8), ActivityRow(data.items[i])],
                      if (data != null && data.total > kHistoryPer) ...[
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                t('wallet.history.range', {
                                  'from': (_page - 1) * kHistoryPer + 1,
                                  'to': data.total < _page * kHistoryPer ? data.total : _page * kHistoryPer,
                                  'total': data.total,
                                }),
                                style: context.text.footnote.copyWith(color: k.fg3, fontFeatures: kTabular),
                              ),
                            ),
                            _PageButton(
                              icon: rtl ? LucideIcons.chevronRight : LucideIcons.chevronLeft,
                              label: t('wallet.history.prevPage'),
                              onPressed: _page <= 1 ? null : () => _go(_kind, _page - 1),
                            ),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                              child: Text(
                                '$_page / $pages',
                                textDirection: TextDirection.ltr,
                                style: context.text.footnote.copyWith(color: k.fg3, fontFeatures: kTabular),
                              ),
                            ),
                            _PageButton(
                              icon: rtl ? LucideIcons.chevronLeft : LucideIcons.chevronRight,
                              label: t('wallet.history.nextPage'),
                              onPressed: _page >= pages ? null : () => _go(_kind, _page + 1),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// The pager's round previous / next button (web IconButton size sm), dimmed when there is no page that way.
class _PageButton extends StatelessWidget {
  const _PageButton({required this.icon, required this.label, required this.onPressed});
  final IconData icon;
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => Opacity(
    opacity: onPressed == null ? 0.4 : 1,
    child: KIconButton(icon: icon, size: 32, filled: true, semanticLabel: label, onPressed: onPressed),
  );
}
