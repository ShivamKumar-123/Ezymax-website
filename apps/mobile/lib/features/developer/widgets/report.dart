// Backtest report (port of apps/crm/components/algo/report.tsx, D86): notes, KPIs, equity + drawdown, monthly returns,
// then Trades / All metrics / Data & costs. Phone columns of the trades table: #, side, lots, open, net.
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/format/format.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../developer_api.dart';
import 'algo_widgets.dart';

const _months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/// At most `n` points of a long series (the phone chart doesn't need every bar).
List<double> _thin(List<double> v, [int n = 360]) {
  if (v.length <= n) return v;
  final step = v.length / n;
  return [for (var i = 0; i < n; i++) v[(i * step).floor()], v.last];
}

class BacktestReportView extends StatefulWidget {
  const BacktestReportView({super.key, required this.bt});
  final BacktestDetail bt;

  @override
  State<BacktestReportView> createState() => _BacktestReportViewState();
}

class _BacktestReportViewState extends State<BacktestReportView> {
  String _tab = 'trades';
  int _shown = 15;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final f = LocaleFormat(t.locale);
    final r = widget.bt.report!;
    double m(String key) => r.m(key);
    final net = m('netProfit');
    final pf = r.mn('profitFactor');
    final expectancy = m('expectancy');
    final eq = _thin([for (final p in r.equity) p.equity]);
    final dd = _thin([for (final p in r.equity) p.dd]);
    final cov = r.coverage;
    final costs = jMap(cov['costs']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (r.notes.isNotEmpty) ...[KNotice(text: r.notes.join('\n'), tone: KChipTone.warn), const SizedBox(height: 14)],
        TileGrid(
          children: [
            MiniTile(label: t('developer.report.netProfit'), value: fmtMoney(net), color: net >= 0 ? k.up : k.down, sub: fmtPct(m('returnPct'), 2), big: true),
            MiniTile(label: t('developer.report.profitFactor'), value: fmtNum(pf), color: (pf ?? 0) >= 1 ? k.fg : k.down, big: true),
            MiniTile(label: t('developer.dep.winRate'), value: '${fmtNum(m('winRate'), 1)}%', sub: '${m('wins').toInt()} / ${m('trades').toInt()}', big: true),
            MiniTile(
              label: t('developer.report.maxDrawdown'),
              value: '${fmtNum(m('maxDrawdownPct'))}%',
              color: k.down,
              sub: fmtMoney(m('maxDrawdown')),
              big: true,
            ),
            MiniTile(
              label: t('developer.report.sharpe'),
              value: fmtNum(r.mn('sharpe')),
              sub: t('developer.report.sortino', {'v': fmtNum(r.mn('sortino'))}),
              big: true,
            ),
            MiniTile(
              label: t('developer.market.trades'),
              value: '${m('trades').toInt()}',
              sub: t('developer.report.longShort', {'long': m('longTrades').toInt(), 'short': m('shortTrades').toInt()}),
              big: true,
            ),
            MiniTile(
              label: t('developer.report.expectancy'),
              value: fmtMoney(expectancy),
              color: expectancy >= 0 ? k.up : k.down,
              sub: t('developer.report.perTrade'),
              big: true,
            ),
          ],
        ),
        const SizedBox(height: 14),
        KCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KCardHeader(title: t('developer.report.equityCurve'), subtitle: '${fmtDate(r.firstBar)} → ${fmtDate(r.lastBar)} · ${r.model}'),
              const SizedBox(height: 10),
              if (eq.length > 1)
                KLineChart(
                  values: eq,
                  height: 200,
                  color: net >= 0 ? k.gold : k.down,
                  guides: [KChartGuide(m('initialBalance'), label: t('developer.report.start'))],
                  format: fmtMoney,
                )
              else
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    t('developer.report.noEquity'),
                    textAlign: TextAlign.center,
                    style: context.text.footnote.copyWith(color: k.fg3),
                  ),
                ),
              const SizedBox(height: 12),
              const KDivider(),
              const SizedBox(height: 10),
              SmallLabel(t('developer.report.drawdownPct')),
              const SizedBox(height: 6),
              if (dd.length > 1) KLineChart(values: dd, height: 90, color: k.down, format: (v) => '${fmtNum(v)}%'),
            ],
          ),
        ),
        const SizedBox(height: 14),
        KCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KCardHeader(title: t('developer.report.monthly'), subtitle: t('developer.report.monthlySub')),
              const SizedBox(height: 12),
              _MonthlyTable(rows: r.monthly),
            ],
          ),
        ),
        const SizedBox(height: 14),
        KCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KSegmented<String>(
                values: const ['trades', 'metrics', 'data'],
                labels: ['${t('developer.market.trades')} ${m('trades').toInt()}', t('developer.report.allMetrics'), t('developer.report.dataCosts')],
                selected: _tab,
                plain: true,
                onChanged: (v) => setState(() => _tab = v),
              ),
              const SizedBox(height: 12),
              if (_tab == 'trades') ...[
                if (r.trades.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: Text(
                      t('developer.report.noTrades'),
                      textAlign: TextAlign.center,
                      style: context.text.footnote.copyWith(color: k.fg3),
                    ),
                  ),
                for (var i = 0; i < math.min(_shown, r.trades.length); i++) ...[if (i > 0) const KDivider(), _TradeRow(x: r.trades[i])],
                if (r.trades.length > _shown) ...[
                  const SizedBox(height: 8),
                  Center(
                    child: KButton(
                      label: t('common.showMore'),
                      variant: KButtonVariant.ghost,
                      size: KButtonSize.sm,
                      onPressed: () => setState(() => _shown += 15),
                    ),
                  ),
                ],
              ],
              if (_tab == 'metrics')
                KKeyValues(dense: true, [
                  KKV(t('developer.report.initialFinal'), '${fmtMoney(m('initialBalance'))} → ${fmtMoney(m('finalBalance'))}', mono: true),
                  KKV(t('developer.report.grossPl'), '${fmtMoney(m('grossProfit'))} / ${fmtMoney(m('grossLoss'))}', mono: true),
                  KKV(t('developer.report.cagr'), fmtPct(r.mn('cagrPct'), 2), mono: true),
                  KKV(t('developer.report.expectancyPerTrade'), fmtMoney(expectancy), mono: true),
                  KKV(t('developer.report.avgWinLoss'), '${fmtMoney(m('avgWin'))} / ${fmtMoney(m('avgLoss'))}', mono: true),
                  KKV(t('developer.report.largestWinLoss'), '${fmtMoney(m('largestWin'))} / ${fmtMoney(m('largestLoss'))}', mono: true),
                  KKV(t('developer.report.payoff'), fmtNum(r.mn('payoffRatio')), mono: true),
                  KKV(t('developer.report.longTrades'), '${m('longTrades').toInt()} (${fmtNum(m('longWinRate'), 1)}%)', mono: true),
                  KKV(t('developer.report.shortTrades'), '${m('shortTrades').toInt()} (${fmtNum(m('shortWinRate'), 1)}%)', mono: true),
                  KKV(t('developer.report.maxConsecutive'), '${m('maxConsecutiveWins').toInt()} / ${m('maxConsecutiveLosses').toInt()}', mono: true),
                  KKV(t('developer.report.maxDrawdown'), '${fmtMoney(m('maxDrawdown'))} (${fmtNum(m('maxDrawdownPct'))}%)', mono: true),
                  KKV(t('developer.report.recovery'), fmtNum(r.mn('recoveryFactor')), mono: true),
                  KKV(t('developer.report.sharpeSortino'), '${fmtNum(r.mn('sharpe'))} / ${fmtNum(r.mn('sortino'))}', mono: true),
                  KKV(t('developer.report.avgBars'), fmtNum(m('avgBarsHeld'), 1), mono: true),
                  KKV(t('developer.report.timeInMarket'), '${fmtNum(m('exposurePct'), 1)}%', mono: true),
                  KKV(
                    t('developer.report.costs'),
                    '${fmtMoney(m('totalCommission'))} / ${fmtMoney(m('totalSwap'))} / ${fmtMoney(m('spreadCost'))}',
                    mono: true,
                  ),
                  KKV(t('developer.report.barsTested'), f.number(m('barsTested'), 0), mono: true),
                ]),
              if (_tab == 'data') ...[
                SmallLabel(t('developer.report.historyUsed')),
                const SizedBox(height: 4),
                KKeyValues(dense: true, [
                  for (final s in jList(cov['segments']))
                    KKV('${s['tf']} · ${s['source']}', '${fmtDate(jDn(s['from']))} → ${fmtDate(jDn(s['to']))}', mono: true),
                  KKV(
                    t('developer.report.m1Bars'),
                    '${f.number(jD(cov['m1Bars']), 0)}${jDn(cov['m1From']) != null ? ' ${t('developer.report.fromDate', {'date': fmtDate(jDn(cov['m1From']))})}' : ''}',
                    mono: true,
                  ),
                  KKV(
                    t('developer.report.signals'),
                    '${jI(r.signals['buy'])} / ${jI(r.signals['sell'])} / ${jI(r.signals['exitBuy']) + jI(r.signals['exitSell'])}',
                    mono: true,
                  ),
                ]),
                if (r.skipped.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    '${t('developer.report.skipped')} ${r.skipped.map((s) => '${s['reason']} (${s['count']})').join(' · ')}',
                    style: context.text.footnote.copyWith(color: k.fg3),
                  ),
                ],
                const SizedBox(height: 16),
                SmallLabel(t('developer.report.costsModelled')),
                const SizedBox(height: 4),
                KKeyValues(dense: true, [
                  KKV(t('developer.report.accountGroup'), jS(costs['group'])),
                  KKV(
                    t('developer.bt.spread'),
                    t('developer.report.spreadValue', {'points': fmtNum(jD(costs['spreadPoints']), 1), 'source': jS(costs['spreadSource'])}),
                  ),
                  KKV(t('developer.report.commission'), t('developer.report.perLot', {'amount': fmtMoney(jD(costs['commissionPerLot']))})),
                  KKV(t('developer.report.swaps'), costs['swaps'] == true ? t('developer.report.swapsOn') : t('developer.report.swapsOff')),
                  KKV(
                    t('developer.report.plConversion'),
                    costs['usdBase'] == true
                        ? t('developer.report.usdBase')
                        : (jD(costs['quoteToUsd']) == 1
                              ? t('developer.report.usdQuoted')
                              : t('developer.report.currentRate', {'rate': fmtNum(jD(costs['quoteToUsd']), 5)})),
                  ),
                  KKV(t('developer.report.execution'), t('developer.report.executionValue')),
                ]),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _TradeRow extends StatelessWidget {
  const _TradeRow({required this.x});
  final BtTrade x;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final buy = x.side == 'buy';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        children: [
          SizedBox(
            width: 34,
            child: Text('${x.id}', style: context.text.mono(11.5, color: k.fg3)),
          ),
          KChip(label: (buy ? t('common.buy') : t('common.sell')).toUpperCase(), tone: buy ? KChipTone.up : KChipTone.down, small: true),
          const SizedBox(width: 8),
          Text(numText(x.volume), style: context.text.mono(12, color: k.fg)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              fmtDateTime(x.openTime),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textDirection: TextDirection.ltr,
              style: context.text.mono(11.5, color: k.fg2),
            ),
          ),
          Text(
            fmtSigned(x.net),
            textDirection: TextDirection.ltr,
            style: context.text.mono(12.5, color: x.net >= 0 ? k.up : k.down, weight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

/// Monthly returns heat table (scrolls sideways on phones, like the web's min-w table).
class _MonthlyTable extends StatelessWidget {
  const _MonthlyTable({required this.rows});
  final List<({int year, List<double?> months, double total})> rows;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    (Color, Color) heat(double? v) {
      if (v == null) return (Colors.transparent, k.fg3);
      final a = math.min(1.0, v.abs() / 6);
      final c = v >= 0 ? k.up : k.down;
      return (c.withValues(alpha: a > 0.5 ? 0.35 : (a > 0.15 ? 0.2 : 0.1)), c);
    }

    final head = context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w500);
    return Directionality(
      textDirection: TextDirection.ltr,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                SizedBox(width: 44, child: Text(t('developer.report.year'), style: head)),
                for (final mo in _months)
                  SizedBox(
                    width: 46,
                    child: Text(t('developer.month.$mo'), textAlign: TextAlign.center, style: head),
                  ),
                SizedBox(
                  width: 60,
                  child: Text(t('developer.report.year'), textAlign: TextAlign.end, style: head),
                ),
              ],
            ),
            const SizedBox(height: 6),
            for (final y in rows)
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Row(
                  children: [
                    SizedBox(
                      width: 44,
                      child: Text('${y.year}', style: context.text.mono(12, color: k.fg2)),
                    ),
                    for (var i = 0; i < 12; i++)
                      Builder(
                        builder: (context) {
                          final v = i < y.months.length ? y.months[i] : null;
                          final (bg, fg) = heat(v);
                          return Container(
                            width: 44,
                            height: 26,
                            margin: const EdgeInsets.symmetric(horizontal: 1),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
                            child: Text(v == null ? '·' : fmtNum(v, 1), style: context.text.mono(11, color: fg)),
                          );
                        },
                      ),
                    SizedBox(
                      width: 60,
                      child: Text(
                        fmtPct(y.total),
                        textAlign: TextAlign.end,
                        style: context.text.mono(12, color: y.total >= 0 ? k.up : k.down, weight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
