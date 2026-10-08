// Analytics on the reports service (port of apps/crm/components/reports/live-analytics.tsx): AnalyticsBody (everything
// under the page header, shared by Portfolio › Analytics and the account detail's Analytics tab) and
// AccountAnalyticsPanel (that tab). CONTRACT — keep AccountAnalyticsPanel's name and parameters.
// Phone order (the web's grids collapse to one column): KPIs (2 per row) · equity vs balance + drawdown · trade
// statistics · by symbol · by weekday · long vs short · by hour · by session · money flow · charges · insights.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/format/format.dart';
import '../../../core/models/account.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../analytics_model.dart';
import '../portfolio_data.dart';
import '../portfolio_logic.dart';
import 'analytics_charts.dart';
import 'portfolio_bits.dart';

const List<String> _days = [
  'portfolio.an.day.mon',
  'portfolio.an.day.tue',
  'portfolio.an.day.wed',
  'portfolio.an.day.thu',
  'portfolio.an.day.fri',
  'portfolio.an.day.sat',
  'portfolio.an.day.sun',
];

String _money(num v) => Fmt.money(v);

/// One account's analytics with its period and the PDF statement (web AccountAnalyticsPanel).
class AccountAnalyticsPanel extends ConsumerStatefulWidget {
  const AccountAnalyticsPanel({super.key, required this.account});
  final EngineAccount account;

  @override
  ConsumerState<AccountAnalyticsPanel> createState() => _AccountAnalyticsPanelState();
}

class _AccountAnalyticsPanelState extends ConsumerState<AccountAnalyticsPanel> {
  AnPeriod _period = AnPeriod.d90;
  Analytics? _last;
  bool _busy = false;

  Future<void> _pdf() async {
    final t = context.t;
    final login = widget.account.login;
    final r = periodRange(_period);
    setState(() => _busy = true);
    await ref.read(downloaderProvider)(
      path: statementPath(login),
      query: statementQuery(r.from, r.to, StFormat.pdf),
      fallbackName: 'statement-$login.pdf',
      ok: t('portfolio.st.downloadStarted'),
      fail: t('portfolio.st.downloadFailed'),
      description: '#$login · ${periodLabel(t, _period)} · PDF',
    );
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final login = widget.account.login;
    final AnalyticsArgs args = (login: '$login', period: _period);
    final v = ref.watch(analyticsProvider(args));
    if (v.hasValue) _last = v.value;
    final data = v.value ?? _last;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: PeriodChips(value: _period, onChanged: (p) => setState(() => _period = p)),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            KButton(
              label: t('portfolio.an.pdfStatement'),
              icon: LucideIcons.download,
              variant: KButtonVariant.surface,
              size: KButtonSize.sm,
              loading: _busy,
              onPressed: _pdf,
            ),
            KButton(
              label: t('portfolio.an.allAccounts'),
              icon: LucideIcons.gauge,
              variant: KButtonVariant.ghost,
              size: KButtonSize.sm,
              onPressed: () => context.go('/portfolio/analytics'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (data == null && !v.hasError) const AnalyticsLoading(),
        if (data == null && v.hasError) AnalyticsFailed(error: v.error, onRetry: () => ref.invalidate(analyticsProvider(args))),
        if (data != null)
          AnimatedOpacity(
            duration: const Duration(milliseconds: 150),
            opacity: v.isLoading && !v.hasValue ? 0.6 : 1,
            child: AnalyticsBody(data: data, label: '#$login', periodLabel: periodLabel(t, _period)),
          ),
      ],
    );
  }
}

/// 7D / 30D / 90D / 1Y / ALL (web Segmented): a segmented control as wide as its labels need, never wider than
/// the space it's given, so it sits in the web's wrapping row of header actions.
class PeriodChips extends StatelessWidget {
  const PeriodChips({super.key, required this.value, required this.onChanged});
  final AnPeriod value;
  final ValueChanged<AnPeriod> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final labels = [for (final p in AnPeriod.values) t('portfolio.an.period.${p.key}')];
    // KSegmented's labels: 13 px semibold; each segment gets the widest label plus 11 px a side, the track 3 px a side
    final style = context.text.label.copyWith(fontWeight: FontWeight.w600, fontSize: 13);
    final scaler = MediaQuery.textScalerOf(context);
    var widest = 0.0;
    for (final l in labels) {
      final tp = TextPainter(
        text: TextSpan(text: l, style: style),
        textDirection: Directionality.of(context),
        textScaler: scaler,
        maxLines: 1,
      )..layout();
      widest = math.max(widest, tp.width);
      tp.dispose();
    }
    final natural = (widest + 22) * labels.length + 8;
    return LayoutBuilder(
      builder: (context, c) => SizedBox(
        width: c.hasBoundedWidth ? math.min(natural, c.maxWidth) : natural,
        child: KSegmented<AnPeriod>(values: AnPeriod.values, labels: labels, selected: value, onChanged: onChanged, height: 34),
      ),
    );
  }
}

/// The skeleton while analytics load (web Loading): six KPI tiles and a chart.
class AnalyticsLoading extends StatelessWidget {
  const AnalyticsLoading({super.key});

  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (var r = 0; r < 3; r++) ...[
        const Row(
          children: [
            Expanded(child: KSkeleton(height: 112, radius: 20)),
            SizedBox(width: 12),
            Expanded(child: KSkeleton(height: 112, radius: 20)),
          ],
        ),
        const SizedBox(height: 12),
      ],
      const KSkeleton(height: 380, radius: 20),
    ],
  );
}

/// "Analytics couldn't be loaded" with Try again (web Failed).
class AnalyticsFailed extends StatelessWidget {
  const AnalyticsFailed({super.key, required this.error, required this.onRetry});
  final Object? error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return KCard(
      child: KEmptyState(
        compact: true,
        art: KIllustrationName.connectionLost,
        title: t('portfolio.an.failed'),
        text: error == null ? t('portfolio.an.unavailable') : errorText(error, t),
        action: KButton(label: t('common.retry'), icon: LucideIcons.refreshCw, variant: KButtonVariant.surface, onPressed: onRetry),
      ),
    );
  }
}

/// Everything below the header (web AnalyticsBody).
class AnalyticsBody extends StatelessWidget {
  const AnalyticsBody({super.key, required this.data, required this.label, required this.periodLabel});
  final Analytics data;
  final String label;
  final String periodLabel;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final d = data;
    if (d.empty) {
      return KCard(
        child: KEmptyState(art: KIllustrationName.emptyHistory, title: t('portfolio.an.empty.title'), text: t('portfolio.an.empty.text')),
      );
    }
    const gap = SizedBox(height: 14);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Kpis(d: d),
        gap,
        _Curves(d: d, label: label),
        gap,
        _StatsCard(s: d.stats, curve: d.curve),
        gap,
        _SymbolCard(d: d),
        gap,
        _WeekdayCard(d: d),
        gap,
        _SideCard(d: d),
        gap,
        _HourCard(d: d),
        gap,
        _SessionCard(d: d),
        gap,
        _FlowCard(d: d, periodLabel: periodLabel),
        gap,
        _ChargesCard(d: d),
        gap,
        _Insights(d: d, periodLabel: periodLabel),
      ],
    );
  }
}

class _Kpis extends StatelessWidget {
  const _Kpis({required this.d});
  final Analytics d;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final s = d.stats;
    final pf = s.profitFactor;
    Widget pct(String v, {Color? color}) => Text.rich(
      TextSpan(
        children: [
          TextSpan(text: v),
          TextSpan(
            text: '%',
            style: TextStyle(color: (color ?? k.fg).withValues(alpha: 0.4)),
          ),
        ],
      ),
      textDirection: TextDirection.ltr,
      style: TextStyle(color: color),
    );
    Widget plain(String v, {Color? color}) => Text(
      v,
      textDirection: TextDirection.ltr,
      style: TextStyle(color: color),
    );
    final cards = <Widget>[
      KKpiCard(
        label: t('portfolio.an.kpi.winRate'),
        icon: LucideIcons.target,
        value: pct(s.winRate.toStringAsFixed(1)),
        chip: KChip(
          label: t('portfolio.an.kpi.winsLosses', {'wins': s.wins, 'losses': s.losses}),
          tone: s.winRate >= 50 ? KChipTone.up : KChipTone.neutral,
          small: true,
        ),
      ),
      KKpiCard(
        label: t('portfolio.an.kpi.profitFactor'),
        icon: LucideIcons.scale,
        value: plain(pf == null ? (s.wins > 0 ? '∞' : '—') : pf.toStringAsFixed(2)),
        chip: KChip(
          label: pf == null
              ? (s.wins > 0 ? t('portfolio.an.kpi.noLosing') : t('portfolio.an.kpi.noTrades'))
              : (pf >= 1.5 ? t('portfolio.an.kpi.strongEdge') : (pf >= 1 ? t('portfolio.an.kpi.thinEdge') : t('portfolio.an.kpi.losingEdge'))),
          tone: pf == null || pf >= 1.5 ? KChipTone.up : (pf >= 1 ? KChipTone.warn : KChipTone.down),
          small: true,
        ),
      ),
      KKpiCard(
        label: t('portfolio.an.kpi.avgRR'),
        icon: LucideIcons.percent,
        value: plain('1 : ${s.rewardRisk?.toStringAsFixed(2) ?? '—'}'),
        chip: KChip(
          label: t('portfolio.an.kpi.expPerTrade', {'amount': _money(s.expectancy)}),
          tone: s.expectancy >= 0 ? KChipTone.up : KChipTone.down,
          small: true,
        ),
      ),
      KKpiCard(
        label: t('portfolio.an.kpi.maxDrawdown'),
        icon: LucideIcons.trendingDown,
        value: plain('${d.curve.maxDrawdown.toStringAsFixed(2)}%', color: k.down),
        chip: KChip(label: t('portfolio.an.kpi.nowDrawdown', {'value': d.curve.currentDrawdown.toStringAsFixed(2)}), small: true),
      ),
      KKpiCard(
        label: t('portfolio.an.kpi.avgHold'),
        icon: LucideIcons.clock3,
        value: plain(fmtHold(t, s.avgHoldSecs)),
        chip: KChip(label: s.avgHoldSecs < 86400 ? t('portfolio.an.kpi.intraday') : t('portfolio.an.kpi.multiDay'), small: true),
      ),
      KKpiCard(
        label: t('portfolio.an.kpi.trades'),
        icon: LucideIcons.activity,
        value: plain('${s.trades}'),
        chip: KChip(label: t('portfolio.an.kpi.lots', {'value': s.lots.toStringAsFixed(2)}), tone: KChipTone.ember, small: true),
      ),
    ];
    return Column(
      children: [
        for (var i = 0; i < cards.length; i += 2) ...[
          if (i > 0) const SizedBox(height: 12),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: cards[i]),
                const SizedBox(width: 12),
                Expanded(child: cards[i + 1]),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _Curves extends StatelessWidget {
  const _Curves({required this.d, required this.label});
  final Analytics d;
  final String label;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final pts = d.curve.points;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('portfolio.an.curves.title'), subtitle: t('portfolio.an.curves.subtitle', {'label': label})),
          const SizedBox(height: 14),
          if (pts.length < 2)
            Text(t('portfolio.an.curves.empty'), style: context.text.footnote.copyWith(color: k.fg3))
          else ...[
            EquityCurvesChart(
              days: [for (final p in pts) p.day],
              equity: [for (final p in pts) p.equity],
              balance: [for (final p in pts) p.balance],
              equityLabel: t('common.equity'),
              balanceLabel: t('common.balance'),
            ),
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(t('portfolio.an.curves.drawdown'), style: context.text.caption.copyWith(color: k.fg3)),
                ),
                const SizedBox(width: 8),
                KChip(label: t('portfolio.an.curves.max', {'value': d.curve.maxDrawdown.toStringAsFixed(2)}), tone: KChipTone.down, small: true),
              ],
            ),
            const SizedBox(height: 8),
            DrawdownChart(days: [for (final p in pts) p.day], values: [for (final p in pts) p.drawdown], worstLabel: t('portfolio.an.kpi.maxDrawdown')),
          ],
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.child, this.color, this.border});
  final Widget child;
  final Color? color, border;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: color ?? k.surface2.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border ?? k.line),
      ),
      child: child,
    );
  }
}

class _StatsCard extends StatelessWidget {
  const _StatsCard({required this.s, required this.curve});
  final TradeStats s;
  final AnCurve curve;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    String sh(double? v) => v?.toStringAsFixed(2) ?? '—';
    final commSwap = s.swap - s.commission;
    final rows = <KKV>[
      KKV(
        t('portfolio.an.stats.net'),
        null,
        valueWidget: KMoney(
          s.net,
          signed: true,
          tone: KMoneyTone.auto,
          dimDecimals: false,
          style: context.text.callout.copyWith(fontWeight: FontWeight.w600),
        ),
      ),
      KKV(t('portfolio.an.stats.avgWin'), '+${_money(s.avgWin)}', tone: k.up, mono: true),
      KKV(t('portfolio.an.stats.avgLoss'), '-${_money(s.avgLoss)}', tone: k.down, mono: true),
      KKV(t('portfolio.an.stats.expectancy'), _money(s.expectancy), mono: true),
      KKV(t('portfolio.an.stats.commSwap'), _money(commSwap), tone: commSwap < 0 ? k.down : null, mono: true),
      KKV(t('portfolio.an.stats.holding'), '${fmtHold(t, s.avgHoldWinSecs)} / ${fmtHold(t, s.avgHoldLossSecs)}'),
      KKV(t('portfolio.an.stats.streaks'), '${s.maxConsecWins} / ${s.maxConsecLosses}', mono: true),
      KKV(t('portfolio.an.stats.sharpe'), '${sh(curve.sharpe)} · ${sh(curve.sortino)}', mono: true),
      KKV(
        t('portfolio.an.stats.return'),
        '${curve.returnPct >= 0 ? '+' : ''}${curve.returnPct.toStringAsFixed(2)}%',
        tone: curve.returnPct >= 0 ? k.up : k.down,
        mono: true,
      ),
    ];
    Widget gross(String label, double v, Color c) => _Tile(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
          ),
          const SizedBox(height: 4),
          KMoney(v, tone: c == k.up ? KMoneyTone.up : KMoneyTone.down, style: context.text.figure.copyWith(fontSize: 16)),
        ],
      ),
    );
    Widget trade(String label, IconData icon, Color ic, TradeRef? r) {
      return _Tile(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 14, color: ic),
                const SizedBox(width: 5),
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (r == null)
              Text('—', style: context.text.footnote.copyWith(color: k.fg3))
            else ...[
              Row(
                children: [
                  TradeSymbolAvatar(symbol: r.symbol, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      symbolLabel(t, r.symbol),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.text.label.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '${r.net >= 0 ? '+' : '-'}${_money(r.net.abs())}',
                textDirection: TextDirection.ltr,
                style: context.text.figure.copyWith(color: r.net >= 0 ? k.up : k.down),
              ),
              Text('#${r.ticket} · ${r.login}', style: context.text.mono(10.5, color: k.fg3)),
            ],
          ],
        ),
      );
    }

    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('portfolio.an.stats.title'), subtitle: t('portfolio.closedTrades', {'count': s.trades})),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: gross(t('portfolio.an.stats.grossProfit'), s.grossProfit, k.up)),
              const SizedBox(width: 10),
              Expanded(child: gross(t('portfolio.an.stats.grossLoss'), -s.grossLoss, k.down)),
            ],
          ),
          const SizedBox(height: 4),
          KKeyValues(rows, dense: true),
          const SizedBox(height: 8),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: trade(t('portfolio.an.stats.best'), LucideIcons.arrowUpRight, k.up, s.best)),
                const SizedBox(width: 10),
                Expanded(child: trade(t('portfolio.an.stats.worst'), LucideIcons.arrowDownRight, k.down, s.worst)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SymbolCard extends StatelessWidget {
  const _SymbolCard({required this.d});
  final Analytics d;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('portfolio.an.symbol.title'), subtitle: t('portfolio.an.symbol.subtitle')),
          const SizedBox(height: 14),
          if (d.bySymbol.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Text(
                t('portfolio.an.symbol.empty'),
                textAlign: TextAlign.center,
                style: context.text.footnote.copyWith(color: k.fg3),
              ),
            )
          else
            PnlBars(
              rows: [
                for (final g in d.bySymbol.take(9))
                  (
                    key: g.key,
                    value: g.net,
                    sub: t('portfolio.an.symbol.sub', {'count': g.trades, 'rate': g.winRate.round()}),
                    label: Row(
                      children: [
                        TradeSymbolAvatar(symbol: g.key, size: 20),
                        const SizedBox(width: 7),
                        Expanded(
                          child: Text(
                            symbolLabel(t, g.key),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: context.text.label.copyWith(fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

class _WeekdayCard extends StatelessWidget {
  const _WeekdayCard({required this.d});
  final Analytics d;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final byDay = [
      for (var i = 0; i < 7; i++)
        () {
          final g = d.byWeekday.where((x) => x.key == '$i').firstOrNull;
          return (label: t(_days[i]), value: g?.net ?? 0.0, sub: g == null ? null : t('portfolio.an.weekday.sub', {'count': g.trades}));
        }(),
    ];
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('portfolio.an.weekday.title'), subtitle: t('portfolio.an.weekday.subtitle')),
          const SizedBox(height: 10),
          ColumnBars(data: byDay, height: 220),
        ],
      ),
    );
  }
}

class _SideCard extends StatelessWidget {
  const _SideCard({required this.d});
  final Analytics d;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final all = d.stats.trades < 1 ? 1 : d.stats.trades;
    final longPct = d.long.trades / all, shortPct = d.short.trades / all;
    Widget side(String label, TradeStats st, KChipTone tone) => _Tile(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              KChip(label: label.toUpperCase(), tone: tone, small: true),
              const Spacer(),
              Text(
                t('portfolio.trades', {'count': st.trades}),
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
              ),
            ],
          ),
          const SizedBox(height: 8),
          KMoney(st.net, signed: true, tone: KMoneyTone.auto, style: context.text.figure.copyWith(fontSize: 17)),
          const SizedBox(height: 2),
          Text(
            t('portfolio.an.side.winPf', {'rate': st.winRate.toStringAsFixed(0), 'pf': st.profitFactor?.toStringAsFixed(2) ?? (st.wins > 0 ? '∞' : '—')}),
            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontFeatures: kTabular),
          ),
        ],
      ),
    );
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('portfolio.an.side.title')),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: SizedBox(
              height: 12,
              child: ColoredBox(
                color: k.surface3,
                child: Row(
                  children: [
                    Expanded(
                      flex: (longPct * 1000).round(),
                      child: ColoredBox(color: k.up),
                    ),
                    if (longPct > 0 && shortPct > 0) Container(width: 2, color: k.bg),
                    Expanded(
                      flex: (shortPct * 1000).round(),
                      child: ColoredBox(color: k.down),
                    ),
                    if (longPct + shortPct < 1) Expanded(flex: ((1 - longPct - shortPct) * 1000).round(), child: const SizedBox()),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Text(
                t('portfolio.an.side.longPct', {'value': (longPct * 100).round()}),
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
              ),
              const Spacer(),
              Text(
                t('portfolio.an.side.shortPct', {'value': (shortPct * 100).round()}),
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: side(t('portfolio.an.side.long'), d.long, KChipTone.up)),
              const SizedBox(width: 10),
              Expanded(child: side(t('portfolio.an.side.short'), d.short, KChipTone.down)),
            ],
          ),
        ],
      ),
    );
  }
}

class _HourCard extends StatelessWidget {
  const _HourCard({required this.d});
  final Analytics d;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final rows = <HeatRow>[
      for (var i = 0; i < 7; i++)
        (
          day: t(_days[i]),
          cells: [
            for (var h = 0; h < 24; h++)
              (
                pnl: i < d.hourHeatmap.length && h < d.hourHeatmap[i].length ? d.hourHeatmap[i][h] : 0.0,
                trades: i < d.hourTrades.length && h < d.hourTrades[i].length ? d.hourTrades[i][h] : 0,
              ),
          ],
        ),
    ];
    var best = (d: 0, h: 0, v: double.negativeInfinity);
    for (var i = 0; i < rows.length; i++) {
      for (var h = 0; h < 24; h++) {
        final c = rows[i].cells[h];
        if (c.trades > 0 && c.pnl > best.v) best = (d: i, h: h, v: c.pnl);
      }
    }
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('portfolio.an.hour.title'), subtitle: t('portfolio.an.hour.subtitle')),
          if (best.v > 0) ...[
            const SizedBox(height: 10),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: KChip(label: t('portfolio.an.hour.best', {'day': t(_days[best.d]), 'hour': best.h.toString().padLeft(2, '0')}), tone: KChipTone.up),
            ),
          ],
          const SizedBox(height: 14),
          HourHeatmap(rows: rows),
        ],
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({required this.d});
  final Analytics d;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final sessions = [...d.bySession]..sort((a, b) => b.net.compareTo(a.net));
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('portfolio.an.session.title'), subtitle: t('portfolio.an.session.subtitle')),
          const SizedBox(height: 14),
          for (var i = 0; i < sessions.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            _Tile(
              color: i == 0 && sessions[i].net > 0 ? k.upSoft : null,
              border: i == 0 && sessions[i].net > 0 ? k.up.withValues(alpha: 0.3) : null,
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(sessions[i].session, style: context.text.label.copyWith(fontWeight: FontWeight.w600, fontSize: 13.5)),
                            ),
                            if (i == 0 && sessions[i].net > 0) ...[const SizedBox(width: 6), Icon(LucideIcons.trophy, size: 14, color: k.gold)],
                          ],
                        ),
                        Text('${sessions[i].hours} · ${t('portfolio.trades', {'count': sessions[i].trades})}', style: context.text.mono(11, color: k.fg3)),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '${sessions[i].net >= 0 ? '+' : '-'}${_money(sessions[i].net.abs())}',
                        textDirection: TextDirection.ltr,
                        style: context.text.figure.copyWith(fontSize: 14, color: signColor(k, sessions[i].net)),
                      ),
                      Text(
                        sessions[i].trades > 0 ? t('portfolio.an.session.win', {'rate': sessions[i].winRate.round()}) : '—',
                        style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _FlowCard extends StatelessWidget {
  const _FlowCard({required this.d, required this.periodLabel});
  final Analytics d;
  final String periodLabel;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final mf = d.moneyFlow;
    final options = mf.optionPremiums + mf.optionSettlements;
    final steps = <FlowStep>[
      (label: t('portfolio.an.flow.deposits'), value: mf.deposits, total: false),
      (label: t('portfolio.an.flow.tradingPnl'), value: mf.tradingPnl, total: false),
      if (options != 0) (label: t('portfolio.an.flow.options'), value: options, total: false),
      if (mf.bonus != 0) (label: t('portfolio.an.flow.bonus'), value: mf.bonus, total: false),
      if (mf.earnings != 0) (label: t('portfolio.an.flow.earnings'), value: mf.earnings, total: false),
      (label: t('portfolio.an.flow.charges'), value: mf.commission + mf.performanceFees, total: false),
      if (mf.adjustments != 0) (label: t('portfolio.an.flow.adjustments'), value: mf.adjustments, total: false),
      (label: t('portfolio.an.flow.withdrawals'), value: mf.withdrawals, total: false),
      (label: t('portfolio.an.flow.net'), value: 0, total: true),
    ];
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('portfolio.an.flow.title'), subtitle: t('portfolio.an.flow.subtitle', {'period': periodLabel})),
          const SizedBox(height: 10),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: KChip(label: t('portfolio.an.flow.equityNow', {'amount': _money(mf.equityNow)}), tone: KChipTone.gold),
          ),
          const SizedBox(height: 14),
          Waterfall(steps: steps),
        ],
      ),
    );
  }
}

class _ChargesCard extends StatelessWidget {
  const _ChargesCard({required this.d});
  final Analytics d;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final ch = d.charges;
    final rows = [
      (label: t('portfolio.an.charges.commission'), value: ch.commission, note: t('portfolio.an.charges.commissionNote'), color: k.ember),
      (
        label: t('portfolio.an.charges.swapPaid'),
        value: ch.swapPaid,
        note:
            '${t('portfolio.an.charges.swapNote')}${ch.swapEarned != 0 ? ' · ${t('portfolio.an.charges.swapEarned', {'amount': _money(ch.swapEarned)})}' : ''}',
        color: k.gold,
      ),
      (label: t('portfolio.an.charges.perfFees'), value: ch.performanceFees, note: t('portfolio.an.charges.perfNote'), color: k.info),
      (label: t('portfolio.an.charges.walletFees'), value: ch.walletFees, note: t('portfolio.an.charges.walletNote'), color: k.fg3),
    ].where((c) => c.value > 0).toList();
    final total = rows.fold<double>(0, (s, c) => s + c.value);
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('portfolio.an.charges.title'), subtitle: t('portfolio.an.charges.subtitle')),
          const SizedBox(height: 14),
          if (rows.isEmpty)
            Text(t('portfolio.an.charges.empty'), style: context.text.footnote.copyWith(color: k.fg3))
          else ...[
            Center(
              child: KDonut(
                size: 150,
                thickness: 16,
                segments: [for (final c in rows) (c.value, c.color)],
                center: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      t('common.total'),
                      style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                    ),
                    Text(_money(total), textDirection: TextDirection.ltr, style: context.text.figure.copyWith(fontSize: 16)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            for (final c in rows)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 5),
                      child: Container(
                        width: 9,
                        height: 9,
                        decoration: BoxDecoration(color: c.color, shape: BoxShape.circle),
                      ),
                    ),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(c.label, style: context.text.label.copyWith(fontWeight: FontWeight.w600)),
                              ),
                              Text(
                                _money(c.value),
                                textDirection: TextDirection.ltr,
                                style: context.text.label.copyWith(fontFeatures: kTabular),
                              ),
                            ],
                          ),
                          Text(
                            c.note,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
          ],
          const SizedBox(height: 8),
          _DashedBox(
            child: Row(
              children: [
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: '${t('portfolio.an.charges.spread')} '),
                        TextSpan(
                          text: t('portfolio.an.charges.spreadNote'),
                          style: TextStyle(color: k.fg2),
                        ),
                      ],
                    ),
                    style: context.text.footnote.copyWith(color: k.fg3),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  _money(ch.spreadEstimate),
                  textDirection: TextDirection.ltr,
                  style: context.text.label.copyWith(color: k.fg2, fontFeatures: kTabular),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DashedBox extends StatelessWidget {
  const _DashedBox({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => CustomPaint(
    painter: _DashPainter(context.k.line),
    child: Padding(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11), child: child),
  );
}

class _DashPainter extends CustomPainter {
  _DashPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()..addRRect(RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(14)));
    final p = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (final m in path.computeMetrics()) {
      for (double d = 0; d < m.length; d += 7) {
        canvas.drawPath(m.extractPath(d, d + 4), p);
      }
    }
  }

  @override
  bool shouldRepaint(_DashPainter old) => old.color != color;
}

const Map<String, IconData> _insightIcon = {
  'overtrading': LucideIcons.zap,
  'revenge': LucideIcons.triangleAlert,
  'risk': LucideIcons.shieldCheck,
  'hold_losers': LucideIcons.clock3,
  'stop_out': LucideIcons.trendingDown,
  'sl_tp': LucideIcons.target,
  'session': LucideIcons.trophy,
};

class _Insights extends StatelessWidget {
  const _Insights({required this.d, required this.periodLabel});
  final Analytics d;
  final String periodLabel;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final list = d.behaviour.insights;
    Color tone(String s) => switch (s) {
      'up' => k.up,
      'down' => k.down,
      'warn' => k.warn,
      _ => k.gold,
    };
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            title: t('portfolio.an.insights.title'),
            subtitle: t('portfolio.an.insights.subtitle', {'period': periodLabel}),
            action: KChip(label: t('portfolio.an.insights.count', {'count': list.length}), tone: KChipTone.ember),
          ),
          const SizedBox(height: 14),
          if (list.isEmpty)
            Text(t('portfolio.an.insights.empty'), style: context.text.footnote.copyWith(color: k.fg3))
          else
            for (var i = 0; i < list.length; i++) ...[
              if (i > 0) const SizedBox(height: 10),
              // web k-row + a 1px tone line across the top, clipped by the rounded corners
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  decoration: BoxDecoration(
                    color: k.surface2.withValues(alpha: 0.7),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: k.line),
                  ),
                  foregroundDecoration: BoxDecoration(
                    border: Border(top: BorderSide(color: tone(list[i].tone).withValues(alpha: 0.5))),
                  ),
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: k.surface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: k.line),
                            ),
                            child: Icon(_insightIcon[list[i].id] ?? LucideIcons.activity, size: 17, color: tone(list[i].tone)),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(child: Text(list[i].title, style: context.text.headline.copyWith(fontSize: 14))),
                                    const SizedBox(width: 8),
                                    Text(list[i].stat, style: context.text.figure.copyWith(fontSize: 16, color: tone(list[i].tone))),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(list[i].text, style: context.text.footnote.copyWith(color: k.fg2, height: 1.45)),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      const KDivider(),
                      const SizedBox(height: 8),
                      Text(
                        list[i].tip,
                        style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                      ),
                    ],
                  ),
                ),
              ),
            ],
        ],
      ),
    );
  }
}
