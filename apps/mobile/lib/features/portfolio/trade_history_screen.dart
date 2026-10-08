// Portfolio › Trade history (port of apps/crm/components/trading/portfolio.tsx LiveHistoryPage): the account picker
// and that account's HistoryPanel (deals, instrument and range filters, totals, pager, CSV export, share cards).
import 'package:flutter/material.dart';

import '../../i18n/i18n.dart';
import 'portfolio_data.dart';
import 'widgets/account_picker.dart';
import 'widgets/activity_panels.dart';

class TradeHistoryScreen extends StatelessWidget {
  const TradeHistoryScreen({super.key, this.query = const {}});

  /// The route's query parameters (the web page's search params): `account` (or `login`) picks the account.
  final Map<String, String> query;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return PickerPage(
      query: query,
      title: t('portfolio.history.title'),
      subtitle: t('portfolio.history.subtitle'),
      onRefresh: (ref) => ref.invalidate(historyPageProvider),
      builder: (a) => HistoryPanel(account: a, title: t('portfolio.history.panelTitle', {'login': a.login})),
    );
  }
}
