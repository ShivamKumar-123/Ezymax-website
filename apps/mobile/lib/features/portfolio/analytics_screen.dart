// Portfolio › Analytics (port of apps/crm/components/reports/live-analytics.tsx LiveAnalyticsPage, D91) on the reports
// service (GET reports/analytics?login=all|<login>&from&to). Header actions in the web's phone order: the account
// menu (all live accounts or one account), the period (7D … ALL) and Statements (all accounts) or Export (one
// account: PDF / XLSX / CSV statement for the period, through the share sheet). Then AnalyticsBody.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/auth_controller.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'analytics_model.dart';
import 'portfolio_data.dart';
import 'portfolio_logic.dart';
import 'widgets/analytics_panel.dart';
import 'widgets/portfolio_bits.dart';

class AnalyticsScreen extends ConsumerStatefulWidget {
  const AnalyticsScreen({super.key, this.query = const {}});

  /// The route's query parameters (the web page's search params; `account` / `login` preselects an account).
  final Map<String, String> query;

  @override
  ConsumerState<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends ConsumerState<AnalyticsScreen> {
  late String _account = wantedLogin(widget.query)?.toString() ?? 'all';
  AnPeriod _period = AnPeriod.d90;
  Analytics? _last;
  bool _busy = false;

  AnalyticsArgs get _args => (login: _account, period: _period);

  Future<void> _pickAccount(List<AnAccount> accounts) async {
    final t = context.t;
    final v = await showKPicker<String>(
      context,
      title: t('common.account'),
      selected: _account,
      options: [
        KPickOption('all', t('portfolio.an.allLive')),
        for (final a in accounts) KPickOption('${a.login}', '#${a.login}', subtitle: '${a.type == 'demo' ? '${t('common.demo')} · ' : ''}${a.groupName}'),
      ],
    );
    if (v != null && v != _account) setState(() => _account = v);
  }

  Future<void> _export() async {
    final t = context.t;
    final f = await showKActionSheet<StFormat>(
      context,
      actions: [
        for (final f in const [StFormat.pdf, StFormat.xlsx, StFormat.csv])
          KAction(label: t('portfolio.an.statementFormat', {'format': f.ext.toUpperCase()}), value: f, icon: LucideIcons.download),
      ],
    );
    if (f == null || !mounted) return;
    final login = int.parse(_account);
    final r = periodRange(_period);
    setState(() => _busy = true);
    await ref.read(downloaderProvider)(
      path: statementPath(login),
      query: statementQuery(r.from, r.to, f),
      fallbackName: 'statement-$login.${f.ext}',
      ok: t('portfolio.st.downloadStarted'),
      fail: t('portfolio.st.downloadFailed'),
      description: '#$login · ${periodLabel(t, _period)} · ${f.label}',
    );
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    final args = _args;
    final v = ref.watch(analyticsProvider(args));
    if (v.hasValue) _last = v.value;
    final data = v.value ?? _last;
    final label = _account == 'all' ? t('portfolio.an.allLive') : '#$_account';
    final accounts = data?.accounts ?? const <AnAccount>[];

    return KPageScroll(
      onRefresh: () async {
        ref.invalidate(analyticsProvider(args));
        await ref.read(analyticsProvider(args).future).then((_) {}, onError: (Object _) {});
      },
      children: [
        KPageHeader(title: t('portfolio.an.title'), subtitle: Text(t('portfolio.an.subtitle'))),
        // web PageHeader actions: one wrapping row of the account menu, the period and Statements / Export
        PageActions(
          children: [
            KButton(
              label: label,
              trailingIcon: LucideIcons.chevronsUpDown,
              variant: KButtonVariant.surface,
              size: KButtonSize.sm,
              onPressed: () => _pickAccount(accounts),
            ),
            PeriodChips(value: _period, onChanged: (p) => setState(() => _period = p)),
            if (_account == 'all')
              KButton(label: t('portfolio.st.title'), icon: LucideIcons.fileText, size: KButtonSize.sm, onPressed: () => context.go('/portfolio/statements'))
            else
              KButton(label: t('common.export'), icon: LucideIcons.download, size: KButtonSize.sm, loading: _busy, onPressed: _export),
          ],
        ),
        const SizedBox(height: 16),
        if (data == null && !v.hasError) const AnalyticsLoading(),
        if (data == null && v.hasError) AnalyticsFailed(error: v.error, onRetry: () => ref.invalidate(analyticsProvider(args))),
        if (data != null && data.accounts.isEmpty) NoAccounts(text: t('portfolio.an.noAccountsText'), readOnly: readOnly, icon: false),
        if (data != null && data.accounts.isNotEmpty)
          AnimatedOpacity(
            duration: const Duration(milliseconds: 150),
            opacity: v.isLoading && !v.hasValue ? 0.6 : 1,
            child: AnalyticsBody(data: data, label: label, periodLabel: periodLabel(t, _period)),
          ),
      ],
    );
  }
}
