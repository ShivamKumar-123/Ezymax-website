// The Chart view of the options mode (web: components/options/premium-chart.tsx OptionChartPane + PremiumChart,
// underlying-chart.tsx). By default it charts the SELECTED OPTION'S PREMIUM in USD per contract: candles from the
// options service (`trade/options/candles`), the last bar moved by the chain's mark; the legend shows the option,
// its strike and breakeven and the time left to the cut. "Premium | Underlying" switches to the underlying's chart
// with the strike / breakeven / barrier lines of the selected option, the ticket's legs and the open positions on it
// (the focused one bolder). Without a selected option, or while the premium candles aren't served, the underlying shows
// with a note.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/api_error.dart';
import '../../../../i18n/i18n.dart';
import '../../../../ui/ui.dart';
import '../../chart/chart_bridge.dart';
import '../../chart/terminal_chart.dart';
import '../../core/market.dart';
import '../../core/terminal_controller.dart';
import '../../core/workspace.dart' show kTfSeconds;
import '../core/api.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/pricer.dart';
import '../core/store.dart';
import 'bits.dart';
import 'nav.dart';

/// Premium candles of one series (USD per contract), the forming bar moved by the series' mark.
class PremiumChartSource extends ChartSource {
  PremiumChartSource({required this.api, required this.code, required this.onUnavailable, required this.subscribeMark});
  final OptionsApi? api;
  final String code;
  final VoidCallback onUnavailable;

  /// Calls back with the mark in USD per contract; returns the unsubscribe.
  final void Function() Function(void Function(double markUsd) fn) subscribeMark;
  Candle? _last;

  @override
  String get key => 'opt:$code';

  @override
  int get digits => 2;

  @override
  Future<List<Candle>> history(String tf, {int? to}) async {
    final api = this.api;
    if (api == null) return const [];
    try {
      final r = await api.candles(code, tfMinutes[tf] ?? 15, limit: to == null ? 600 : 1000, to: to);
      final list = [
        for (final c in jsonList(r['candles']))
          if ((numOf(c['t']) ?? 0) > 0) Candle(numOf(c['t'])!.toInt(), numOr(c['o']), numOr(c['h']), numOr(c['l']), numOr(c['c']), 0),
      ]..sort((a, b) => a.t.compareTo(b.t));
      if (to == null && list.isNotEmpty) _last = list.last;
      return list;
    } on ApiException catch (e) {
      if (e.status == 404 || e.status == 405 || e.status == 501) onUnavailable();
      return const [];
    }
  }

  @override
  void Function()? bars(String tf, void Function(Candle bar) onBar) {
    final sec = kTfSeconds[tf] ?? 900;
    return subscribeMark((m) {
      if (!(m > 0)) return;
      final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      final t0 = now - now % sec;
      final last = _last;
      if (last != null && last.t > t0) return;
      final bar = last != null && last.t == t0
          ? Candle(t0, last.o, math.max(last.h, m), math.min(last.l, m), m, 0)
          : Candle(t0, last?.c ?? m, math.max(last?.c ?? m, m), math.min(last?.c ?? m, m), m, 0);
      _last = bar;
      onBar(bar);
    });
  }
}

/// Premium is off for this session (the service didn't serve candles): the underlying shows with a note.
final _premiumOffProvider = NotifierProvider<OptValue<bool>, bool>(() => OptValue<bool>(false));

class OptionChartPane extends ConsumerWidget {
  const OptionChartPane({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final sel = ref.watch(optionsProvider.select((s) => s.sel));
    final u = ref.watch(optionsProvider.select((s) => s.u));
    final tf = ref.watch(optionsProvider.select((s) => s.prefs.tf));
    final mode = ref.watch(optionsProvider.select((s) => s.prefs.chartMode));
    final off = ref.watch(_premiumOffProvider);
    final p = parseSeriesBase(sel ?? '');
    final own = p != null && p.underlying == u;
    final premium = mode == 'premium' && own && !off;
    final ctl = ref.read(optionsProvider.notifier);
    return Column(
      children: [
        Container(
          height: 38,
          decoration: BoxDecoration(
            color: k.surface,
            border: Border(bottom: BorderSide(color: k.line, width: 0.6)),
          ),
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 6),
            children: [
              Center(
                child: SizedBox(
                  width: 168,
                  child: OptSeg<String>(
                    height: 28,
                    values: const ['premium', 'underlying'],
                    labels: [t('trader.opt.chart.premium'), t('trader.opt.col.underlying')],
                    selected: mode == 'premium' && !off ? 'premium' : 'underlying',
                    onChanged: (m) {
                      if (m == 'premium' && off) ref.read(_premiumOffProvider.notifier).set(false);
                      ctl.setPrefs((x) => x.copyWith(chartMode: m));
                    },
                  ),
                ),
              ),
              Center(
                child: Container(width: 0.8, height: 16, color: k.line, margin: const EdgeInsets.symmetric(horizontal: 6)),
              ),
              for (final x in optionTfs)
                Center(
                  child: KPressable(
                    minSize: 34,
                    pressedScale: 1,
                    onTap: () {
                      KHaptics.selection();
                      ctl.setPrefs((p) => p.copyWith(tf: x));
                    },
                    child: Container(
                      height: 27,
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: tf == x ? k.emberSoft : Colors.transparent, borderRadius: BorderRadius.circular(6)),
                      child: Text(
                        x,
                        style: context.text.mono(11, weight: FontWeight.w600, color: tf == x ? k.ember : k.fg3),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(4),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(9),
              child: DecoratedBox(
                position: DecorationPosition.foreground,
                decoration: BoxDecoration(
                  border: Border.all(color: k.line),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: premium && sel != null
                    ? _PremiumChart(key: ValueKey('$sel|$tf'), code: sel, tf: tf)
                    : Stack(
                        children: [
                          Positioned.fill(
                            child: _UnderlyingChart(u: u, tf: tf),
                          ),
                          if (mode == 'premium' && (!own || off))
                            Positioned(
                              left: 12,
                              right: 12,
                              top: 40,
                              child: Center(child: _Note(fallback: off && own)),
                            ),
                        ],
                      ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// "Pick an option in the chain to see its price" / "premium chart unavailable: the underlying".
class _Note extends ConsumerWidget {
  const _Note({required this.fallback});
  final bool fallback;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    return Container(
      constraints: const BoxConstraints(maxWidth: 460),
      padding: const EdgeInsets.fromLTRB(10, 8, 8, 8),
      decoration: BoxDecoration(
        color: k.surface2.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: k.lineTop),
        boxShadow: k.shadowPop,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(fallback ? LucideIcons.info : LucideIcons.mousePointerClick, size: 16, color: fallback ? k.fg3 : k.ember),
          const SizedBox(width: 8),
          Flexible(
            child: Text(fallback ? t('trader.opt.chart.fallback') : t('trader.opt.chart.selectHint'), style: context.text.caption.copyWith(color: k.fg2)),
          ),
          if (!fallback) ...[
            const SizedBox(width: 8),
            OptSmallButton(label: t('trader.opt.chainTitle'), icon: LucideIcons.table2, filled: true, onTap: () => ref.optTab('chain')),
          ],
        ],
      ),
    );
  }
}

class _PremiumChart extends ConsumerStatefulWidget {
  const _PremiumChart({super.key, required this.code, required this.tf});
  final String code, tf;

  @override
  ConsumerState<_PremiumChart> createState() => _PremiumChartState();
}

class _PremiumChartState extends ConsumerState<_PremiumChart> {
  late final PremiumChartSource _source = PremiumChartSource(
    api: ref.read(optionsApiProvider),
    code: widget.code,
    onUnavailable: () {
      if (mounted) ref.read(_premiumOffProvider.notifier).set(true);
    },
    subscribeMark: (fn) {
      final sub = ref.listenManual(optionsProvider.select((s) => s.quoteOf(widget.code)?.markUsd), (_, next) {
        if (next != null) fn(next);
      });
      return sub.close;
    },
  );

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final p = parseSeriesBase(widget.code);
    final q = ref.watch(optionsProvider.select((s) => s.quoteOf(widget.code)));
    final cutTime = ref.watch(optionsProvider.select((s) => s.chain?.cutTime ?? '10:00'));
    final cutMs = ref.watch(
      optionsProvider.select((s) {
        for (final e in s.expiries) {
          if (e.date == p?.date && s.u == p?.underlying) return e.cutMs;
        }
        return p == null ? 0 : nyCut(p.date);
      }),
    );
    final book = ref.watch(optBookProvider);
    final usdU = usdPerUnitOfQuote(q);
    final lines = <ChartLine>[
      for (final x in book.positions.where((x) => x.option.series == widget.code && usdU > 0))
        ChartLine(id: 'pos:${x.ticket}', kind: 'pos', price: x.openPrice * usdU, side: x.side, label: '#${x.ticket} ${x.buy ? 'B' : 'S'} ${qty(x.contracts)}'),
    ];
    final digits = p == null ? 5 : digitsOf(p.underlying);
    Widget chip(String label, String value, Color tone) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: tone.withValues(alpha: 0.3)),
      ),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: '$label ',
              style: context.text.caption.copyWith(fontSize: 10, color: k.fg3, fontWeight: FontWeight.w400),
            ),
            TextSpan(text: value),
          ],
        ),
        style: context.text.mono(10, color: k.fg2),
      ),
    );
    return Stack(
      children: [
        Positioned.fill(
          child: TerminalChart(symbol: widget.code, tf: widget.tf, source: _source, lines: lines),
        ),
        Positioned(
          left: 8,
          top: 6,
          right: 80,
          child: IgnorePointer(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 6,
                  runSpacing: 2,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (p != null) RightTag(p.right),
                    Text(
                      p != null ? '${p.underlying} ${p.strikeLabel} ${p.right == 'put' ? t('trader.opt.put') : t('trader.opt.call')}' : widget.code,
                      style: context.text.label.copyWith(fontSize: 11.5, fontWeight: FontWeight.w600),
                    ),
                    Text(
                      '· ${p != null ? expiryLabel(p.date, t.locale) : ''}, ${widget.tf}',
                      style: context.text.caption.copyWith(fontSize: 11, color: k.fg3, fontWeight: FontWeight.w400),
                    ),
                    Text(
                      t('trader.opt.chart.unit'),
                      style: context.text.caption.copyWith(fontSize: 10.5, color: k.fg3, fontWeight: FontWeight.w400),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 4,
                  runSpacing: 4,
                  children: [
                    if (p != null) chip(t('trader.opt.line.strike'), p.strikeLabel, k.gold),
                    if (q != null) chip(t('trader.opt.line.be'), px(q.breakeven, digits), k.ember),
                    Tooltip(
                      message: t('trader.opt.cutHint', {'time': cutTime}),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: k.warnSoft.withValues(alpha: 0.5),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: k.warn.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '${t('trader.opt.cutIn')} ',
                              style: context.text.caption.copyWith(fontSize: 10, color: k.fg3, fontWeight: FontWeight.w400),
                            ),
                            Countdown(toMs: cutMs, size: 10),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// The underlying's chart with the option levels as price lines.
class _UnderlyingChart extends ConsumerWidget {
  const _UnderlyingChart({required this.u, required this.tf});
  final String u, tf;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final s = ref.watch(optionsProvider);
    final book = ref.watch(optBookProvider);
    final digits = digitsOf(u);
    final lines = <ChartLine>[];
    final ids = <String>{};
    void add(ChartLine l) {
      if (ids.add(l.id) && l.price.isFinite && l.price > 0) lines.add(l);
    }

    final sp = parseSeriesBase(s.sel ?? '');
    if (s.sel != null && sp != null && sp.underlying == u) {
      final q = s.quoteOf(s.sel);
      add(ChartLine(id: 'sel:${s.sel}', kind: 'strike', price: sp.strike, label: '${sp.right == 'call' ? 'C' : 'P'} ${sp.strikeLabel}'));
      if (q != null) add(ChartLine(id: 'selbe:${s.sel}', kind: 'breakeven', price: q.breakeven, label: t('trader.opt.line.be')));
    }
    final legs = s.ticket.legs.where((l) => l.u == u).toList();
    for (final l in legs) {
      final q = s.quoteOf(l.series);
      add(
        ChartLine(
          id: 'leg:${l.series}',
          kind: 'strike',
          price: l.strike,
          label: '${l.side == 'buy' ? 'B' : 'S'} ${l.right == 'call' ? 'C' : 'P'} ${l.strikeLabel}',
        ),
      );
      if (q != null && legs.length == 1) add(ChartLine(id: 'be:${l.series}', kind: 'breakeven', price: q.breakeven, label: t('trader.opt.line.be')));
    }
    final mine = book.positions.where((p) => p.option.underlying == u).toList();
    for (final p in mine) {
      final bold = s.focus == p.ticket;
      add(
        ChartLine(
          id: 'pos:${p.ticket}',
          kind: 'pos',
          side: p.side,
          price: p.option.strike,
          label: '#${p.ticket} ${p.option.right == 'call' ? 'C' : 'P'} ${strikeOf(p.option.series, p.option.strike, digits)}',
        ),
      );
      if (bold || mine.length <= 4) {
        add(ChartLine(id: 'pbe:${p.ticket}', kind: 'breakeven', price: breakevenOfPos(p), label: t('trader.opt.line.beOf', {'ticket': p.ticket})));
      }
      final b = p.option.barrier;
      if (b?.level != null) {
        add(
          ChartLine(
            id: 'bar:${p.ticket}',
            kind: 'barrier',
            price: b!.level!,
            label: t('trader.opt.line.barrier', {'kind': (b.kind ?? '').replaceAll('_', ' ')}).trim(),
          ),
        );
      }
    }
    return TerminalChart(symbol: u, tf: tf, lines: lines);
  }
}

/// Breakeven of a position: strike ± the premium per unit it was opened at.
double breakevenOfPos(OptPosition p) => p.option.right == 'call' ? p.option.strike + p.openPrice : p.option.strike - p.openPrice;

/// The market feed in Options mode (the CFD body's MarketWants isn't mounted here): started on the account's spread
/// group, the underlying on screen, the positions' underlyings and the USD crosses for currency conversions wanted live.
class OptionsMarketWants extends ConsumerWidget {
  const OptionsMarketWants({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = ref.watch(optionsProvider.select((s) => s.u));
    final feed = ref.watch(marketFeedProvider);
    final symbols = ref.watch(symbolBookProvider);
    final group = ref.watch(terminalProvider.select((s) => s.account?.spreadGroup));
    final pos = ref.watch(optBookProvider).positions.map((p) => p.option.underlying).toSet();
    if (symbols.all.isNotEmpty) {
      feed.symbols = symbols.all.keys.toList();
      if (group != null) feed.setGroup(group);
      feed.start();
    }
    feed.want('options', {
      u,
      ...pos,
      for (final x in optionUnderlyings)
        if (x.quoteCcy != 'USD') 'USD${x.quoteCcy}',
    });
    return const SizedBox.shrink();
  }
}
