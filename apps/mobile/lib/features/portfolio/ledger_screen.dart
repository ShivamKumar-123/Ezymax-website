// Portfolio › Ledger (port of apps/crm/components/trading/portfolio.tsx LiveLedgerPage): the account picker and that
// account's LedgerPanel (balance, credit and bonus movements, range filter, pager, CSV export).
import 'package:flutter/material.dart';

import '../../i18n/i18n.dart';
import 'portfolio_data.dart';
import 'widgets/account_picker.dart';
import 'widgets/activity_panels.dart';

class LedgerScreen extends StatelessWidget {
  const LedgerScreen({super.key, this.query = const {}});

  /// The route's query parameters (the web page's search params): `account` (or `login`) picks the account.
  final Map<String, String> query;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return PickerPage(
      query: query,
      title: t('portfolio.ledger.title'),
      subtitle: t('portfolio.ledger.subtitle'),
      onRefresh: (ref) => ref.invalidate(ledgerPageProvider),
      builder: (a) => LedgerPanel(account: a, title: t('portfolio.ledger.panelTitle', {'login': a.login})),
    );
  }
}
