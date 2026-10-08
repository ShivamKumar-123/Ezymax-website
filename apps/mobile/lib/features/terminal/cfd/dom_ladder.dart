// Depth-of-market ladder with click-to-trade (web components/order/dom-ladder.tsx, D97): a limit order at the tapped
// level, market orders from the buttons, through the same order path as the order sheet (one-click on = instant, off
// = the prefilled order sheet). Levels come from market data: provider depth when the feed carries it, otherwise an
// indicative ladder from the live bid / ask with the account group's spread, labelled so.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../core/market.dart';
import '../core/market_hours.dart';
import '../core/order.dart';
import '../core/terminal_controller.dart';
import '../core/trade_actions.dart';
import '../core/trade_math.dart';
import '../core/workspace.dart';
import '../widgets/kit.dart';
import 'order_sheet.dart';

class DomLadder extends ConsumerStatefulWidget {
  const DomLadder({super.key, required this.symbol});
  final String symbol;

  @override
  ConsumerState<DomLadder> createState() => _DomLadderState();
}

class _DomLadderState extends ConsumerState<DomLadder> {
  Map<String, dynamic>? _book;
  void Function()? _unsub;
  late String _vol = ref.read(workspaceProvider).lot.toStringAsFixed(2);

  @override
  void initState() {
    super.initState();
    _sub();
  }

  @override
  void didUpdateWidget(DomLadder old) {
    super.didUpdateWidget(old);
    if (old.symbol != widget.symbol) {
      _unsub?.call();
      _book = null;
      _sub();
    }
  }

  void _sub() {
    _unsub = ref.read(marketFeedProvider).subscribeDepth(widget.symbol, (d) {
      if (mounted && d['s'] == widget.symbol) setState(() => _book = d);
    });
  }

  @override
  void dispose() {
    _unsub?.call();
    super.dispose();
  }

  double get _v => math.max(0.01, double.tryParse(_vol) ?? 0.01);

  Future<void> _trade(String side, double px, {bool market = false}) async {
    final st = ref.read(terminalProvider);
    final spec = ref.read(symbolBookProvider)[widget.symbol];
    if (st.readOnly || !isMarketOpen(spec)) return;
    final oneClick = ref.read(workspaceProvider).oneClick;
    KHaptics.medium();
    if (market) {
      if (oneClick) {
        await ref.read(tradeActionsProvider).quickTrade(widget.symbol, side, _v);
      } else {
        await showOrderSheet(context, symbol: widget.symbol, side: side, volume: _v);
      }
      return;
    }
    if (oneClick) {
      await ref.read(tradeActionsProvider).placeOrder(OrderRequest(symbol: widget.symbol, side: side, type: 'limit', volume: _v, price: px));
    } else {
      await showOrderSheet(context, symbol: widget.symbol, side: side, type: 'limit', price: px, volume: _v);
    }
  }

  static List<(double, double)> _levels(Object? v) => [
    for (final x in (v is List ? v : const []))
      if (x is List && x.length >= 2) ((x[0] as num).toDouble(), (x[1] as num).toDouble()),
  ];

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final spec = ref.watch(symbolBookProvider.select((b) => b[widget.symbol]));
    final readOnly = ref.watch(terminalProvider.select((s) => s.readOnly));
    final oneClick = ref.watch(workspaceProvider.select((w) => w.oneClick));
    final orders = ref.watch(terminalProvider.select((s) => s.orders.where((o) => o.symbol == widget.symbol).toList()));
    if (spec == null) return const SizedBox.shrink();
    final open = isMarketOpen(spec);
    final digits = spec.digits;
    final pip = spec.pipSize;
    final stepPx = spec.assetClass == 'crypto' && pip == 1 ? 5.0 : (spec.assetClass == 'indices' ? 0.5 : (spec.symbol == 'XAUUSD' ? 0.1 : pip / 2));
    const levels = 10;
    final mine = <String, String>{
      for (final o in orders) fmtPrice(digits, o.price): '${o.buy ? 'B' : 'S'}${o.type == 'limit' ? 'L' : 'S'} ${fmtVol(o.volume)}',
    };
    return QuoteBuilder(
      symbol: widget.symbol,
      builder: (context, q) {
        final bid = q?.bid ?? 0, ask = q?.ask ?? 0;
        final book = _book;
        final sized = book != null;
        final asks = sized
            ? _levels(book['a']).take(levels).toList().reversed.toList()
            : [for (var i = 0; i < levels; i++) (ask + (levels - 1 - i) * stepPx, 0.0)];
        final bids = sized ? _levels(book['b']).take(levels).toList() : [for (var i = 0; i < levels; i++) (bid - i * stepPx, 0.0)];
        final maxSize = [0.01, ...asks.map((a) => a.$2), ...bids.map((b) => b.$2)].reduce(math.max);
        final bidTotal = bids.fold<double>(0, (s, b) => s + b.$2);
        final askTotal = asks.fold<double>(0, (s, a) => s + a.$2);
        final bidPct = bidTotal + askTotal > 0 ? bidTotal / (bidTotal + askTotal) * 100 : 50.0;

        Widget row((double, double) lv, String side, bool best) {
          final key = fmtPrice(digits, lv.$1);
          final my = mine[key];
          Widget cell(bool isBid) {
            final active = isBid ? side == 'bid' : side == 'ask';
            return Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: readOnly || !active ? null : () => unawaited(_trade(isBid ? 'buy' : 'sell', lv.$1)),
                child: Stack(
                  alignment: isBid ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
                  children: [
                    if (active && sized)
                      FractionallySizedBox(
                        widthFactor: (lv.$2 / maxSize).clamp(0, 1),
                        heightFactor: 0.75,
                        child: Container(color: (isBid ? k.up : k.down).withValues(alpha: 0.15)),
                      ),
                    if (active && sized)
                      Padding(
                        padding: EdgeInsets.only(left: isBid ? 0 : 8, right: isBid ? 8 : 0),
                        child: Text(lv.$2.toStringAsFixed(2), style: context.text.mono(12, color: k.fg2)),
                      ),
                  ],
                ),
              ),
            );
          }

          return Container(
            height: 26,
            color: best ? k.surface2.withValues(alpha: 0.7) : null,
            child: Row(
              children: [
                cell(true),
                SizedBox(
                  width: 96,
                  child: Stack(
                    clipBehavior: Clip.none,
                    alignment: Alignment.center,
                    children: [
                      Text(
                        key,
                        style: context.text.mono(12, weight: FontWeight.w600, color: side == 'ask' ? k.down : k.up),
                      ),
                      if (my != null)
                        Positioned(
                          right: -2,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 2),
                            decoration: BoxDecoration(color: k.gold, borderRadius: BorderRadius.circular(3)),
                            child: Text(my, style: context.text.mono(9, color: const Color(0xFF1A1204))),
                          ),
                        ),
                    ],
                  ),
                ),
                cell(false),
              ],
            ),
          );
        }

        return Column(
          children: [
            Container(
              height: 30,
              color: k.surface2,
              child: Row(
                children: [
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Text(
                        sized ? t('order.dom.bidVol') : t('order.dom.buyLimit'),
                        textAlign: TextAlign.right,
                        style: context.text.caption.copyWith(color: k.fg3),
                      ),
                    ),
                  ),
                  SizedBox(
                    width: 96,
                    child: Text(
                      t('order.dom.price'),
                      textAlign: TextAlign.center,
                      style: context.text.caption.copyWith(color: k.fg3),
                    ),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(left: 8),
                      child: Text(sized ? t('order.dom.askVol') : t('order.dom.sellLimit'), style: context.text.caption.copyWith(color: k.fg3)),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 2),
                children: [
                  for (var i = 0; i < asks.length; i++) row(asks[i], 'ask', i == asks.length - 1),
                  Container(
                    height: 28,
                    margin: const EdgeInsets.symmetric(vertical: 2),
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    decoration: BoxDecoration(
                      color: k.surface2,
                      border: Border.symmetric(horizontal: BorderSide(color: k.line, width: 0.6)),
                    ),
                    child: Row(
                      children: [
                        Text(t('order.dom.spread'), style: context.text.mono(12, color: k.fg3)),
                        const Spacer(),
                        Text(t('order.unit.pts', {'n': spreadPoints(spec, bid, ask)}), style: context.text.mono(12)),
                        const Spacer(),
                        Text(t('order.dom.mid', {'price': fmtPrice(digits, (bid + ask) / 2)}), style: context.text.mono(12, color: k.fg3)),
                      ],
                    ),
                  ),
                  for (var i = 0; i < bids.length; i++) row(bids[i], 'bid', i == 0),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: k.line, width: 0.6)),
              ),
              child: Column(
                children: [
                  if (book?['src'] == 'feed') ...[
                    Row(
                      children: [
                        Text(t('order.dom.bids', {'pct': bidPct.toStringAsFixed(0)}), style: context.text.mono(11.5, color: k.up)),
                        const Spacer(),
                        Text(t('order.dom.feed'), style: context.text.caption.copyWith(color: k.fg3)),
                        const Spacer(),
                        Text(t('order.dom.asks', {'pct': (100 - bidPct).toStringAsFixed(0)}), style: context.text.mono(11.5, color: k.down)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(2),
                      child: SizedBox(
                        height: 4,
                        child: Row(
                          children: [
                            Expanded(
                              flex: bidPct.round().clamp(1, 99),
                              child: Container(color: k.up),
                            ),
                            Expanded(
                              flex: (100 - bidPct).round().clamp(1, 99),
                              child: Container(color: k.down),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ] else
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (book != null) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(3),
                              border: Border.all(color: k.line),
                            ),
                            child: Text(t('order.dom.indicative').toUpperCase(), style: context.text.micro.copyWith(color: k.fg2, fontSize: 9)),
                          ),
                          const SizedBox(width: 6),
                        ],
                        Flexible(
                          child: Text(
                            book != null ? t('order.dom.indicativeNote') : t('order.dom.unavailable'),
                            style: context.text.caption.copyWith(color: k.fg3),
                          ),
                        ),
                      ],
                    ),
                  if (!readOnly) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: KButton(
                            label: open ? t('order.dom.sellMkt') : t('order.dom.closed'),
                            variant: KButtonVariant.sell,
                            size: KButtonSize.sm,
                            expand: true,
                            onPressed: open ? () => unawaited(_trade('sell', bid, market: true)) : null,
                          ),
                        ),
                        const SizedBox(width: 6),
                        SizedBox(
                          width: 104,
                          child: TStepper(
                            value: _vol,
                            onChanged: (v) => _vol = v,
                            min: spec.lotMin,
                            max: spec.lotMax,
                            step: spec.lotStep,
                            semanticLabel: t('order.dom.volume'),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: KButton(
                            label: open ? t('order.dom.buyMkt') : t('order.dom.closed'),
                            variant: KButtonVariant.buy,
                            size: KButtonSize.sm,
                            expand: true,
                            onPressed: open ? () => unawaited(_trade('buy', ask, market: true)) : null,
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 6),
                  Text(
                    readOnly ? t('order.dom.readOnly') : (oneClick ? t('order.dom.hintOneClick') : t('order.dom.hintDialog')),
                    textAlign: TextAlign.center,
                    style: context.text.caption.copyWith(color: k.fg3),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
