// Ezymex FX Options mode of Ezymex Trader on phones (web: apps/terminal/components/options/mobile.tsx), under the shared
// terminal header, with its own bottom bar:
//   Markets    pick the underlying
//   Chart      the selected option's premium, or the underlying (and Book while the order book is live, Analytics)
//   Chain      pick a strike's call or put (Simple: call price | strike | put price; more columns one side at a time)
//   Trade      Quick trade (the guided Up or Down → date → strike → contracts → outcome) or the full order ticket
//   Positions  open options as cards, working book orders, closed trades and settlements
// The expiry chips sit over the chart and the chain; once an option is selected a bar with its sell / buy prices
// follows at the bottom, and Sell / Buy there opens the ticket with that side chosen. Like the web (dir="ltr") the
// body keeps its left-to-right layout in Arabic, Urdu and Persian.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/notifications/notifications.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../core/models.dart' show isOptionEntry;
import '../core/terminal_controller.dart';
import 'core/format.dart';
import 'core/store.dart';
import 'ui/actions.dart';
import 'ui/analytics.dart';
import 'ui/bits.dart';
import 'ui/book_pane.dart';
import 'ui/builder.dart';
import 'ui/chain.dart';
import 'ui/chart_pane.dart';
import 'ui/closed.dart';
import 'ui/header.dart';
import 'ui/markets.dart';
import 'ui/nav.dart';
import 'ui/positions.dart';
import 'ui/selection_bar.dart';
import 'ui/simple.dart';
import 'ui/ticket.dart';

/// The body of the terminal in Options mode, under the shared header, with its own bottom bar.
class OptionsTerminal extends ConsumerStatefulWidget {
  const OptionsTerminal({super.key});

  @override
  ConsumerState<OptionsTerminal> createState() => _OptionsTerminalState();
}

class _OptionsTerminalState extends ConsumerState<OptionsTerminal> with WidgetsBindingObserver {
  bool _chartBuilt = false;
  StreamSubscription<Map<String, dynamic>>? _events;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _events = ref.read(terminalProvider.notifier).frames.listen(_onEngineFrame);
    // the first tab follows the default panel (web: Trade when Quick trade is the default, else Chain), then stays
    Future.microtask(() {
      if (!mounted || ref.read(optTabProvider) != null) return;
      ref.read(optTabProvider.notifier).set(ref.read(optionsProvider).prefs.panel == 'simple' ? 'trade' : 'chain');
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_events?.cancel());
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) ref.read(optionsProvider.notifier).resume();
  }

  /// Expiry settlements and knock-outs the engine reports (web useOptionEvents).
  void _onEngineFrame(Map<String, dynamic> f) {
    if (!mounted || f['type'] != 'deal' || f['deal'] is! Map) return;
    final d = (f['deal'] as Map).cast<String, dynamic>();
    if (!isOptionEntry(d) || (d['entry'] != 'out' && d['entry'] != 'out_by')) return;
    final t = context.t;
    final reason = '${d['reason'] ?? ''}';
    final sym = '${d['symbol'] ?? ''}';
    final cent = ref.read(terminalProvider).account?.cent ?? false;
    final profit = engineUsd(d['profit'], cent) ?? 0;
    if (reason == 'expiry' || reason == 'settlement') {
      optToast(ref, NotificationKind.neutral, t('trader.opt.toast.settled'), description: '$sym · ${moneySigned(profit)}');
    } else if (reason == 'knock_out' || reason == 'knockout') {
      optToast(ref, NotificationKind.warning, t('trader.opt.toast.knockedOut'), description: sym);
    }
  }

  void _go(String tab) {
    if (ref.read(optTabProvider) == tab) return;
    KHaptics.selection();
    ref.optTab(tab);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final avail = ref.watch(optionsProvider.select((s) => s.avail));
    final panel = ref.watch(optionsProvider.select((s) => s.prefs.panel));
    final legs = ref.watch(optionsProvider.select((s) => s.ticket.legs.length));
    final view = ref.watch(optionsProvider.select((s) => s.prefs.view));
    final oneCol = ref.watch(optionsProvider.select(chainOneCol));
    final bookLive = ref.watch(optionsProvider.select((s) => s.isBookLive));
    final positions = ref.watch(optBookProvider.select((b) => b.positions.length));
    final orders = ref.watch(bookOrdersProvider.select((v) => v.open.length));
    final tab = ref.watch(optTabProvider) ?? (panel == 'simple' ? 'trade' : 'chain');
    final chartView0 = ref.watch(optChartViewProvider);
    final chartView = chartView0 == 'book' && !bookLive ? 'chart' : chartView0;
    final posView0 = ref.watch(optPosViewProvider);
    final posView = posView0 == 'orders' && !bookLive ? 'open' : posView0;
    final ctl = ref.read(optionsProvider.notifier);
    if (avail == OptAvail.soon || avail == OptAvail.error) {
      return Directionality(
        textDirection: TextDirection.ltr,
        child: OptionsUnavailable(soon: avail == OptAvail.soon, onRetry: ctl.retry),
      );
    }
    if (tab == 'chart' && chartView == 'chart') _chartBuilt = true;
    final withHeader = tab == 'chart' || tab == 'chain' || tab == 'trade';
    void toTicket() {
      ctl.setPrefs((p) => p.copyWith(panel: 'ticket'));
      ref.optTab('trade');
    }

    final tabs = [
      ('markets', LucideIcons.list, t('trader.opt.m.markets'), 0),
      ('chart', LucideIcons.candlestickChart, t('trader.opt.chart'), 0),
      ('chain', LucideIcons.table2, t('trader.opt.m.chain'), 0),
      ('trade', LucideIcons.shoppingCart, t('trader.mobile.tab.trade'), legs > 1 ? legs : 0),
      ('positions', LucideIcons.layers, t('trader.opt.m.positions'), positions),
    ];
    final mq = MediaQuery.of(context);
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Column(
        children: [
          if (withHeader) OptionsHeader(onPickUnderlying: () => _go('markets'), onBuilder: () => unawaited(showStrategyBuilder(context))),
          if (tab == 'chart' || tab == 'chain') const ExpiryBar(),
          if (tab == 'chart')
            SegRow(
              child: KSegmented<String>(
                plain: true,
                height: 32,
                values: ['chart', if (bookLive) 'book', 'analytics'],
                labels: [t('trader.opt.chart'), if (bookLive) t('trader.opt.book.tab'), t('trader.opt.an.tab')],
                selected: chartView,
                onChanged: ref.optChartView,
              ),
            ),
          if (tab == 'chain')
            SegRow(
              trailing: const ColumnsButton(),
              child: OptSeg<String>(
                values: oneCol ? const ['calls', 'both', 'puts'] : const ['calls', 'puts'],
                labels: oneCol ? [t('trader.opt.calls'), t('trader.opt.both'), t('trader.opt.puts')] : [t('trader.opt.calls'), t('trader.opt.puts')],
                tones: oneCol ? const [1, 0, -1] : const [1, -1],
                selected: oneCol ? view : (view == 'puts' ? 'puts' : 'calls'),
                onChanged: (v) => ctl.setPrefs((p) => p.copyWith(view: v)),
              ),
            ),
          if (tab == 'trade')
            SegRow(
              child: KSegmented<String>(
                plain: true,
                height: 32,
                values: const ['simple', 'ticket'],
                labels: [t('trader.opt.guide.tab'), legs > 1 ? '${t('trader.opt.ticket.tab')} · $legs' : t('trader.opt.ticket.tab')],
                selected: panel,
                onChanged: (v) => ctl.setPrefs((p) => p.copyWith(panel: v)),
              ),
            ),
          if (tab == 'positions')
            SegRow(
              child: KSegmented<String>(
                plain: true,
                height: 32,
                values: ['open', if (bookLive) 'orders', 'closed', 'settled'],
                labels: [
                  positions > 0 ? '${t('trader.opt.m.open')} · $positions' : t('trader.opt.m.open'),
                  if (bookLive) orders > 0 ? '${t('trader.opt.ord.tab')} · $orders' : t('trader.opt.ord.tab'),
                  t('trader.opt.hist.tab'),
                  t('trader.opt.m.settled'),
                ],
                selected: posView,
                onChanged: ref.optPosView,
              ),
            ),
          Expanded(
            child: ColoredBox(
              color: k.bg,
              child: Stack(
                children: [
                  if (_chartBuilt)
                    Offstage(
                      offstage: !(tab == 'chart' && chartView == 'chart'),
                      child: TickerMode(enabled: tab == 'chart' && chartView == 'chart', child: const OptionChartPane()),
                    ),
                  if (tab == 'chart' && chartView == 'book') const BookPane(),
                  if (tab == 'chart' && chartView == 'analytics') const AnalyticsPane(),
                  if (tab == 'markets') OptionsMarkets(onPick: (_) => ref.optTab(panel == 'simple' ? 'trade' : 'chain')),
                  if (tab == 'chain') const OptionChainView(),
                  if (tab == 'trade')
                    panel == 'simple'
                        ? QuickTrade(
                            onDone: () {
                              ref.optPosView('open');
                              ref.optTab('positions');
                            },
                            onTicket: () => ref.optTab('trade'),
                          )
                        : OptionTicketView(
                            onAddLeg: () => ref.optTab('chain'),
                            onOpenChain: () => ref.optTab('chain'),
                            onBuilder: () => unawaited(showStrategyBuilder(context)),
                            onQuick: () => ref.optTab('trade'),
                          ),
                  if (tab == 'positions')
                    switch (posView) {
                      'orders' => const BookOrdersList(),
                      'closed' => const ClosedList(),
                      'settled' => const SettlementsList(),
                      _ => const OptionPositionsList(),
                    },
                  const OptionsMarketWants(),
                ],
              ),
            ),
          ),
          if (tab == 'chain' || (tab == 'chart' && chartView != 'analytics')) SelectionBar(onTrade: toTicket),
          KFrosted(
            color: k.bar,
            border: Border(top: BorderSide(color: k.line, width: 0.6)),
            child: Padding(
              padding: EdgeInsets.only(bottom: mq.padding.bottom),
              child: SizedBox(
                height: 54,
                child: Row(
                  children: [
                    for (final x in tabs)
                      Expanded(
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => _go(x.$1),
                          child: Semantics(
                            selected: x.$1 == tab,
                            button: true,
                            label: x.$3,
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                if (x.$1 == tab)
                                  Positioned(
                                    top: 0,
                                    left: 18,
                                    right: 18,
                                    child: Container(
                                      height: 2,
                                      decoration: BoxDecoration(color: k.ember, borderRadius: BorderRadius.circular(1)),
                                    ),
                                  ),
                                Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(x.$2, size: 19, color: x.$1 == tab ? k.ember : k.fg3),
                                    const SizedBox(height: 3),
                                    Text(
                                      x.$3,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: context.text.micro.copyWith(color: x.$1 == tab ? k.ember : k.fg3, fontWeight: FontWeight.w500),
                                    ),
                                  ],
                                ),
                                if (x.$4 > 0)
                                  Positioned(
                                    top: 5,
                                    right: 14,
                                    child: Container(
                                      constraints: const BoxConstraints(minWidth: 15),
                                      height: 15,
                                      padding: const EdgeInsets.symmetric(horizontal: 4),
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(color: k.ember, borderRadius: BorderRadius.circular(8)),
                                      child: Text(
                                        '${x.$4}',
                                        style: context.text.mono(9, weight: FontWeight.w600, color: Colors.white),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
