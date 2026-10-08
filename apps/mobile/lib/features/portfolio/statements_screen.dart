// Portfolio › Statements (port of apps/crm/components/trading/portfolio.tsx LiveStatementsPage / Statements, D48 /
// D50): the account picker, then for that account
//   1 Generate a statement: period (Day / Month / Year / Custom), format (PDF / Excel / CSV), sections (open
//     positions, charges, deals) and Download statement (GET reports/accounts/{login}/statement, web stUrl)
//   2 What's in your statement
//   3 Monthly statements (GET reports/accounts/{login}/months) with PDF / XLSX / CSV per month
// The web's file download is the share sheet here (lib/core/files.dart shareFile).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/models/account.dart';
import '../../core/models/trading.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'analytics_model.dart';
import 'portfolio_data.dart';
import 'portfolio_logic.dart';
import 'widgets/account_picker.dart';
import 'widgets/portfolio_bits.dart';

class StatementsScreen extends StatelessWidget {
  const StatementsScreen({super.key, this.query = const {}});

  /// The route's query parameters (the web page's search params): `account` (or `login`) picks the account.
  final Map<String, String> query;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return PickerPage(
      query: query,
      title: t('portfolio.st.title'),
      subtitle: t('portfolio.st.subtitle'),
      onRefresh: (ref) => ref.invalidate(statementMonthsProvider),
      builder: (a) => StatementsPanel(account: a),
    );
  }
}

const Map<StFormat, (IconData, String)> _formats = {
  StFormat.pdf: (LucideIcons.fileText, 'portfolio.st.format.pdf'),
  StFormat.xlsx: (LucideIcons.fileSpreadsheet, 'portfolio.st.format.xlsx'),
  StFormat.csv: (LucideIcons.sheet, 'portfolio.st.format.csv'),
};

/// One account's statements (web Statements).
class StatementsPanel extends ConsumerStatefulWidget {
  const StatementsPanel({super.key, required this.account});
  final EngineAccount account;

  @override
  ConsumerState<StatementsPanel> createState() => _StatementsPanelState();
}

class _StatementsPanelState extends ConsumerState<StatementsPanel> {
  static final String _today = isoDay(DateTime.now());
  StPeriod _period = StPeriod.month;
  String _day = _today;
  String _month = _today.substring(0, 7);
  String _year = _today.substring(0, 4);
  String _from = '${_today.substring(0, 7)}-01';
  String _to = _today;
  StFormat _format = StFormat.pdf;
  bool _open = true, _charges = true, _deals = true;

  /// The download in progress: `main` or `<month>-<format>`.
  String? _busy;

  Future<void> _download(String key, String from, String to, StFormat f, String label, {bool options = false}) async {
    final t = context.t;
    final login = widget.account.login;
    setState(() => _busy = key);
    await ref.read(downloaderProvider)(
      path: statementPath(login),
      query: options ? statementQuery(from, to, f, open: _open, charges: _charges, deals: _deals) : statementQuery(from, to, f),
      fallbackName: 'statement-$login-$from.${f.ext}',
      ok: t('portfolio.st.downloadStarted'),
      fail: t('portfolio.st.downloadFailed'),
      description: '#$login · $label · ${f.label}',
    );
    if (mounted) setState(() => _busy = null);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final a = widget.account;
    final range = stRange(t, _period, day: _day, month: _month, year: _year, from: _from, to: _to);
    final years = statementYears(a.createdAt);
    final monthParts = _month.split('-');
    final fieldLabel = context.text.label.copyWith(color: k.fg2);

    Widget periodInput() {
      switch (_period) {
        case StPeriod.day:
          return DateInput(
            label: t('common.date'),
            value: _day,
            onTap: () async {
              final d = await pickDay(context, title: t('common.date'), value: _day, max: _today);
              if (d != null) setState(() => _day = d);
            },
          );
        case StPeriod.month:
          return DateInput(
            label: t('portfolio.st.month'),
            mono: false,
            value: monthParts.length == 2 ? monthLabel(t.locale, int.parse(monthParts[0]), int.parse(monthParts[1])) : _month,
            onTap: () async {
              final d = await pickDay(context, title: t('portfolio.st.month'), value: '$_month-01', max: _today, month: true);
              if (d != null) setState(() => _month = d);
            },
          );
        case StPeriod.year:
          return Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final y in years)
                KPressable(
                  onTap: () => setState(() => _year = y),
                  pressedScale: 0.96,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 160),
                    height: 40,
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    decoration: BoxDecoration(
                      color: y == _year ? k.emberSoft : k.surface2,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: y == _year ? k.ember.withValues(alpha: 0.4) : k.line),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          y,
                          style: context.text.label.copyWith(color: y == _year ? k.ember : k.fg2, fontFeatures: kTabular),
                        ),
                        if (y == _today.substring(0, 4)) ...[
                          const SizedBox(width: 4),
                          Text(t('portfolio.st.ytd'), style: context.text.label.copyWith(color: k.fg3)),
                        ],
                      ],
                    ),
                  ),
                ),
            ],
          );
        case StPeriod.custom:
          return Row(
            children: [
              Expanded(
                child: DateInput(
                  label: t('portfolio.st.from'),
                  value: _from,
                  onTap: () async {
                    final d = await pickDay(context, title: t('portfolio.st.from'), value: _from, max: _today);
                    if (d != null) setState(() => _from = d);
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: DateInput(
                  label: t('portfolio.st.to'),
                  value: _to,
                  onTap: () async {
                    final d = await pickDay(context, title: t('portfolio.st.to'), value: _to, max: _today);
                    if (d != null) setState(() => _to = d);
                  },
                ),
              ),
            ],
          );
      }
    }

    final generate = KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            icon: LucideIcons.fileText,
            title: t('portfolio.st.generate.title'),
            subtitle: t('portfolio.st.generate.subtitle', {'login': a.login, 'account': accountTitle(t, a)}),
          ),
          const SizedBox(height: 18),
          Text(t('portfolio.st.period'), style: fieldLabel),
          const SizedBox(height: 8),
          KSegmented<StPeriod>(
            values: StPeriod.values,
            labels: [t('portfolio.st.period.day'), t('portfolio.st.period.month'), t('portfolio.st.period.year'), t('portfolio.st.period.custom')],
            selected: _period,
            onChanged: (p) => setState(() => _period = p),
          ),
          const SizedBox(height: 12),
          periodInput(),
          const SizedBox(height: 18),
          Text(t('portfolio.st.formatLabel'), style: fieldLabel),
          const SizedBox(height: 8),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final f in StFormat.values) ...[
                  if (f != StFormat.pdf) const SizedBox(width: 8),
                  Expanded(
                    child: KPressable(
                      pressedScale: 0.97,
                      semanticLabel: f.label,
                      onTap: () => setState(() => _format = f),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 160),
                        padding: const EdgeInsets.fromLTRB(11, 11, 9, 11),
                        decoration: BoxDecoration(
                          color: f == _format ? k.emberSoft : k.surface2.withValues(alpha: 0.7),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: f == _format ? k.ember.withValues(alpha: 0.4) : k.line),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(_formats[f]!.$1, size: 16, color: f == _format ? k.ember : k.fg2),
                            const SizedBox(height: 6),
                            Text(
                              f.label,
                              style: context.text.label.copyWith(fontWeight: FontWeight.w700, color: k.fg),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              t(_formats[f]!.$2),
                              style: context.text.micro.copyWith(color: k.fg3, fontWeight: FontWeight.w400, height: 1.25),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsetsDirectional.fromSTEB(14, 4, 8, 4),
            decoration: BoxDecoration(
              color: k.surface2.withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: k.line),
            ),
            child: Column(
              children: [
                for (final (label, value, set) in [
                  (t('portfolio.st.opt.open'), _open, (bool v) => setState(() => _open = v)),
                  (t('portfolio.st.opt.charges'), _charges, (bool v) => setState(() => _charges = v)),
                  (t('portfolio.st.opt.deals'), _deals, (bool v) => setState(() => _deals = v)),
                ])
                  SizedBox(
                    height: 46,
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(label, style: context.text.callout.copyWith(color: k.fg2)),
                        ),
                        KSwitch(value: value, semanticLabel: label, onChanged: set),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const KDivider(),
          const SizedBox(height: 14),
          if (range != null)
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: range.label,
                    style: TextStyle(color: k.fg2),
                  ),
                  TextSpan(text: ' · ${_format.label}'),
                ],
              ),
              style: context.text.footnote.copyWith(color: k.fg3),
            )
          else
            Text(t('portfolio.st.invalidPeriod'), style: context.text.footnote.copyWith(color: k.fg3)),
          const SizedBox(height: 12),
          KButton(
            label: t('portfolio.st.download'),
            icon: LucideIcons.download,
            size: KButtonSize.lg,
            expand: true,
            loading: _busy == 'main',
            onPressed: range == null || _busy != null ? null : () => _download('main', range.from, range.to, _format, range.label, options: true),
          ),
        ],
      ),
    );

    final contents = KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('portfolio.st.contents.title')),
          const SizedBox(height: 12),
          for (final key in const ['account', 'trades', 'open', 'funding', 'charges', 'totals'])
            Padding(
              padding: const EdgeInsets.only(bottom: 9),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 1),
                    child: Icon(LucideIcons.check, size: 16, color: k.ember),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(t('portfolio.st.contents.$key'), style: context.text.callout.copyWith(color: k.fg2)),
                  ),
                ],
              ),
            ),
        ],
      ),
    );

    final months = ref.watch(statementMonthsProvider(a.login));
    final monthly = KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('portfolio.st.monthly.title'), subtitle: t('portfolio.st.monthly.subtitle', {'currency': a.currencyPrefix.trim()})),
          const SizedBox(height: 14),
          if (!months.hasValue && !months.hasError) const KSkeleton(height: 120, radius: 14),
          if (!months.hasValue && months.hasError)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(t('portfolio.st.monthly.unavailable'), style: context.text.footnote.copyWith(color: k.fg3)),
            ),
          if (months.hasValue)
            for (final m in months.requireValue) ...[_MonthRow(m: m, account: a, busy: _busy, onDownload: _download), const SizedBox(height: 8)],
        ],
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [generate, const SizedBox(height: 14), contents, const SizedBox(height: 14), monthly],
    );
  }
}

class _MonthRow extends StatelessWidget {
  const _MonthRow({required this.m, required this.account, required this.busy, required this.onDownload});
  final MonthRow m;
  final EngineAccount account;
  final String? busy;
  final Future<void> Function(String key, String from, String to, StFormat f, String label) onDownload;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final cur = account.currencyPrefix;
    final p = m.from.split('-');
    final label = p.length >= 2 ? monthLabel(t.locale, int.parse(p[0]), int.parse(p[1])) : m.month;
    Widget figure(String name, double v, bool signed) => Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
        ),
        const SizedBox(height: 2),
        Text(
          fmtAmount(v, cur, signed: signed),
          maxLines: 1,
          textDirection: TextDirection.ltr,
          style: context.text.label.copyWith(fontWeight: FontWeight.w600, fontFeatures: kTabular, color: signed ? signColor(k, v) : (v != 0 ? k.fg : k.fg3)),
        ),
      ],
    );
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: k.surface2.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: k.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const KIconTile(icon: LucideIcons.fileText, tone: KTone.neutral),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: context.text.headline.copyWith(fontSize: 14, fontWeight: FontWeight.w500)),
                    Text(
                      t('portfolio.closedTrades', {'count': m.trades}),
                      style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: figure(t('portfolio.st.monthly.net'), m.net, true)),
              const SizedBox(width: 10),
              Expanded(child: figure(t('portfolio.st.monthly.deposits'), m.deposits, false)),
              const SizedBox(width: 10),
              Expanded(child: figure(t('portfolio.st.monthly.withdrawn'), m.withdrawals, false)),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final f in const [StFormat.pdf, StFormat.xlsx, StFormat.csv])
                KButton(
                  label: f == StFormat.xlsx ? 'XLSX' : f.ext.toUpperCase(),
                  icon: f == StFormat.pdf ? LucideIcons.download : null,
                  variant: KButtonVariant.surface,
                  size: KButtonSize.sm,
                  loading: busy == '${m.month}-${f.ext}',
                  onPressed: busy != null ? null : () => onDownload('${m.month}-${f.ext}', m.from, m.to, f, label),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
