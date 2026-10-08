// The order sheet = the web order form (apps/terminal/components/order/order-ticket.tsx, dialog variant), exchange
// style: Sell | Buy with live prices · order type (Market / Limit / Stop / Stop limit, each explained) · price, limit
// price, expiry · volume with presets and sizing by risk · Stop loss and Take profit by price, pips or money · More
// options (trailing stop, OCO, comment, max price change) · summary (margin, pip value, size, free margin after, swap
// as % a year or points) · ONE confirm button that names the trade. With one-click trading on, Sell / Buy send at once.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/notifications/notifications.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../core/market.dart';
import '../core/market_hours.dart';
import '../core/models.dart';
import '../core/order.dart';
import '../core/terminal_controller.dart';
import '../core/trade_actions.dart';
import '../core/trade_math.dart';
import '../core/workspace.dart';
import '../widgets/kit.dart';
import 'symbol_search.dart';

/// Opens the order sheet for `symbol` with an optional side / type / price filled in (chart Buy / Sell with one-click
/// off, the ladder, a chart long-press, the watchlist).
Future<void> showOrderSheet(BuildContext context, {required String symbol, String? side, String type = 'market', double? price, double? volume}) =>
    showKSheet<void>(
      context,
      expand: true,
      builder: (_) => OrderForm(symbol: symbol, side: side, type: type, price: price, volume: volume),
    );

const List<double> _presets = [0.01, 0.1, 0.5, 1, 2];

class OrderForm extends ConsumerStatefulWidget {
  const OrderForm({super.key, required this.symbol, this.side, this.type = 'market', this.price, this.volume, this.onDone});
  final String symbol;
  final String? side;
  final String type;
  final double? price;
  final double? volume;
  final VoidCallback? onDone;

  @override
  ConsumerState<OrderForm> createState() => _OrderFormState();
}

class _OrderFormState extends ConsumerState<OrderForm> {
  late String _symbol = widget.symbol;
  late String _type = widget.type;
  late String? _side = widget.side;
  late String _volume = (widget.volume ?? ref.read(workspaceProvider).lot).toStringAsFixed(2);
  String _price = '';
  String _stopLimit = '';
  StopInput _sl = const StopInput();
  StopInput _tp = const StopInput();
  bool _trailing = false;
  String _trailPips = '20';
  String _expiry = 'GTC';
  late String _expiryDate = _tomorrow();
  bool _oco = false;
  String _ocoPrice = '';
  String _comment = '';
  bool _more = false;
  bool _calcOpen = false;
  String _riskMode = 'pct';
  String _risk = '1';
  String _riskPips = '25';
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final spec = ref.read(symbolBookProvider)[_symbol];
    if (widget.price != null && spec != null) _price = fmtPrice(spec.digits, widget.price!);
  }

  static String _tomorrow() {
    final d = DateTime.now().add(const Duration(days: 1));
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  bool get _pending => _type != 'market';
  double get _vol {
    final v = double.tryParse(_volume) ?? 0;
    return v < 0.01 ? 0.01 : v;
  }

  void _changeSymbol(String s) {
    if (s == _symbol) return;
    setState(() {
      _symbol = s;
      _price = '';
      _stopLimit = '';
      _ocoPrice = '';
      if (_sl.mode == 'price') _sl = _sl.copyWith(value: '');
      if (_tp.mode == 'price') _tp = _tp.copyWith(value: '');
      _side = null;
    });
  }

  double _entry(String side, TQuote q) {
    if (_pending) {
      final p = double.tryParse(_type == 'stop-limit' && _stopLimit.isNotEmpty ? _stopLimit : _price);
      if (p != null && p > 0) return p;
    }
    return side == 'buy' ? q.ask : q.bid;
  }

  double _pipValue(SymbolSpec s, TQuote q) => pipValuePerLot(s, q.bid, bidOf: ref.read(marketFeedProvider).bidOf) * _vol;

  /// Money at a stop for the current volume (USD), signed: negative for a loss (web stopMoney).
  double? _stopMoney(StopInput st, String which, SymbolSpec s, TQuote q, bool cent) {
    if (!st.on) return null;
    final pv = _pipValue(s, q);
    if (st.mode == 'price') {
      if (_side == null) return null;
      final p = double.tryParse(st.value);
      if (p == null || p <= 0) return null;
      final d = (_side == 'buy' ? p - _entry(_side!, q) : _entry(_side!, q) - p) / s.pipSize;
      return d * pv;
    }
    final d = stopDistancePips(st, pipValue: pv, cent: cent);
    if (d == null) return null;
    return (which == 'sl' ? -1 : 1) * d * pv;
  }

  bool _wrongSide(StopInput st, String which, TQuote q) {
    if (_side == null || !st.on || st.mode != 'price') return false;
    final p = double.tryParse(st.value);
    if (p == null || p <= 0) return false;
    final below = p < _entry(_side!, q);
    return which == 'sl' ? (_side == 'buy' ? !below : below) : (_side == 'buy' ? below : !below);
  }

  void _toggleStop(String which, bool on, SymbolSpec s, TQuote q) {
    // a starting distance: twice the spread, at least 10 pips; take profit twice the stop loss
    final spreadPips = ((q.ask - q.bid) / s.pipSize).clamp(1, 1e9);
    final base = (spreadPips * 2).round() < 10 ? 10 : (spreadPips * 2).round();
    setState(() {
      final st = which == 'sl' ? _sl : _tp;
      final next = st.copyWith(
        on: on,
        mode: on && st.value.isEmpty ? 'pips' : st.mode,
        value: on && st.value.isEmpty ? '${which == 'sl' ? base : base * 2}' : st.value,
      );
      if (which == 'sl') {
        _sl = next;
      } else {
        _tp = next;
      }
    });
  }

  void _changeMode(String which, String mode, SymbolSpec s, TQuote q, bool cent) {
    final st = which == 'sl' ? _sl : _tp;
    final side = _side ?? 'buy';
    final pv = _pipValue(s, q);
    final p = stopPrice(st, which, side, _entry(side, q), s, pipValue: pv, cent: cent);
    final d = st.mode == 'price' ? (p == null ? null : (p - _entry(side, q)).abs() / s.pipSize) : stopDistancePips(st, pipValue: pv, cent: cent);
    var value = '';
    if (mode == 'price') {
      value = p == null ? '' : fmtPrice(s.digits, p);
    } else if (d != null) {
      value = mode == 'pips' ? d.toStringAsFixed(1).replaceAll(RegExp(r'\.0$'), '') : (d * pv * (cent ? 100 : 1)).toStringAsFixed(2);
    }
    setState(() {
      if (which == 'sl') {
        _sl = StopInput(on: st.on, mode: mode, value: value);
      } else {
        _tp = StopInput(on: st.on, mode: mode, value: value);
      }
    });
  }

  Future<void> _submit(String side) async {
    final spec = ref.read(symbolBookProvider)[_symbol];
    final q = ref.read(marketFeedProvider).quote(_symbol);
    if (spec == null || q == null || _busy) return;
    final t = context.t;
    final st = ref.read(terminalProvider);
    if (_pending && _price.isEmpty) {
      ref.read(notificationsProvider.notifier).toast(NotificationKind.error, t('order.toast.enterPendingPrice'));
      return;
    }
    final cent = st.account?.cent ?? false;
    final pv = pipValuePerLot(spec, q.bid, bidOf: ref.read(marketFeedProvider).bidOf) * _vol;
    final entry = _entry(side, q);
    final req = OrderRequest(
      symbol: _symbol,
      side: side,
      type: _type,
      volume: _vol,
      price: _pending ? double.tryParse(_price) : null,
      stopLimit: _type == 'stop-limit' ? (double.tryParse(_stopLimit) ?? double.tryParse(_price)) : null,
      sl: stopPrice(_sl, 'sl', side, entry, spec, pipValue: pv, cent: cent),
      tp: stopPrice(_tp, 'tp', side, entry, spec, pipValue: pv, cent: cent),
      trailingPips: _trailing ? double.tryParse(_trailPips) : null,
      expiry: _pending ? _expiry : 'GTC',
      expiryDate: _pending && _expiry == 'Date' ? _expiryDate : null,
      comment: _comment.isEmpty ? null : _comment,
      ocoPrice: _pending && _oco && _type != 'stop-limit' && _ocoPrice.isNotEmpty ? double.tryParse(_ocoPrice) : null,
    );
    final bad = validateOrder(
      req,
      spec,
      bid: q.bid,
      ask: q.ask,
      account: st.account,
      readOnly: st.readOnly,
      marketOpen: isMarketOpen(spec),
      delayed: q.delayed,
    );
    if (bad != null) {
      KHaptics.error();
      ref.read(notificationsProvider.notifier).toast(NotificationKind.error, t(bad));
      return;
    }
    setState(() => _busy = true);
    final ok = await ref.read(tradeActionsProvider).placeOrder(req);
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      ref.read(workspaceProvider.notifier).update((w) => w.copyWith(lot: _vol));
      widget.onDone?.call();
      if (widget.onDone == null) Navigator.of(context).maybePop();
    }
  }

  void _onSide(String s) {
    setState(() => _side = s);
    if (ref.read(workspaceProvider).oneClick) unawaited(_submit(s));
  }

  String _typeWord(T t, String ty) => switch (ty) {
    'market' => t('desk.op.market'),
    'limit' => t('desk.op.type.limit'),
    'stop' => t('desk.op.type.stop'),
    _ => t('desk.op.type.stopLimit'),
  };

  Future<void> _pickType() async {
    final t = context.t;
    final ty = await showKActionSheet<String>(
      context,
      title: t('desk.op.typeTitle'),
      actions: [for (final x in kOrderTypes) KAction(label: '${_typeWord(t, x)} · ${x == 'market' ? t('desk.op.typeNow') : t('desk.op.typeLater')}', value: x)],
    );
    if (ty != null && mounted) setState(() => _type = ty);
  }

  Future<void> _pickExpiry() async {
    final t = context.t;
    final v = await showKActionSheet<String>(
      context,
      title: t('desk.op.expiry'),
      actions: [
        KAction(label: t('order.expiry.gtc'), value: 'GTC'),
        KAction(label: t('order.expiry.today'), value: 'Today'),
        KAction(label: t('order.expiry.date'), value: 'Date'),
      ],
    );
    if (v == null || !mounted) return;
    setState(() => _expiry = v);
    if (v == 'Date') await _pickDate();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final d = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(_expiryDate) ?? now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (d != null && mounted) setState(() => _expiryDate = '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}');
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final spec = ref.watch(symbolBookProvider.select((b) => b[_symbol]));
    final acc = ref.watch(terminalProvider.select((s) => s.account));
    final readOnly = ref.watch(terminalProvider.select((s) => s.readOnly));
    final oneClick = ref.watch(workspaceProvider.select((w) => w.oneClick));
    if (spec == null || acc == null) return const SizedBox(height: 200);
    if (readOnly) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: KEmptyState(icon: LucideIcons.lock, title: t('order.ticket.readOnlyTitle'), text: t('order.ticket.readOnlyText', {'login': acc.login})),
      );
    }
    final open = isMarketOpen(spec);
    return QuoteBuilder(
      symbol: _symbol,
      throttle: const Duration(milliseconds: 600),
      builder: (context, q) {
        if (q == null || !q.valid) {
          return const Center(
            child: Padding(padding: EdgeInsets.all(40), child: KSkeleton(width: 200)),
          );
        }
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Row(
                children: [
                  Icon(LucideIcons.shoppingCart, size: 16, color: k.fg3),
                  const SizedBox(width: 8),
                  Text(t('order.dialog.title'), style: context.text.title2.copyWith(fontSize: 16)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${acc.login} · ${acc.server} · ${t.dyn('order.mode.${acc.mode}', fallback: acc.mode)}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.end,
                      style: context.text.mono(11, color: k.fg3),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(padding: const EdgeInsets.fromLTRB(14, 0, 14, 12), children: _body(context, spec, acc, q, open)),
            ),
            _footer(context, spec, q, open, oneClick),
          ],
        );
      },
    );
  }

  List<Widget> _body(BuildContext context, SymbolSpec spec, TAccount acc, TQuote q, bool open) {
    final t = context.t;
    final k = context.k;
    final explain = _pending
        ? (_side != null ? t.dyn('desk.op.explain.$_side.${_type == 'stop-limit' ? 'stopLimit' : _type}') : t('desk.op.explain.pickSide'))
        : t('desk.op.marketTip');
    final cent = acc.cent;
    final slMoney = _stopMoney(_sl, 'sl', spec, q, cent);
    final tpMoney = _stopMoney(_tp, 'tp', spec, q, cent);
    final stepPrice = priceStep(spec);
    return [
      // symbol
      KPressable(
        pressedScale: 1,
        onTap: () => showSymbolSearch(context, onPick: _changeSymbol),
        child: Container(
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: k.surface2,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: k.line),
          ),
          child: Row(
            children: [
              SymbolAvatar(_symbol, size: 18),
              const SizedBox(width: 8),
              Text(_symbol, style: context.text.label.copyWith(fontWeight: FontWeight.w600, fontSize: 13.5)),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  spec.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.footnote.copyWith(color: k.fg3),
                ),
              ),
              Icon(LucideIcons.chevronDown, size: 15, color: k.fg3),
            ],
          ),
        ),
      ),
      const SizedBox(height: 8),
      // side: Sell | Buy with live prices
      Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: k.surface2,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: k.line),
        ),
        child: Row(
          children: [
            for (final s in ['sell', 'buy']) ...[if (s == 'buy') const SizedBox(width: 4), Expanded(child: _sideButton(context, spec, s, open))],
          ],
        ),
      ),
      const SizedBox(height: 8),
      // order type and the spread
      Row(
        children: [
          KPressable(
            minSize: 34,
            onTap: _pickType,
            child: Container(
              height: 30,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              decoration: BoxDecoration(
                color: k.surface2,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: k.line),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _typeWord(t, _type),
                    style: context.text.label.copyWith(color: k.fg, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(width: 4),
                  Icon(LucideIcons.chevronDown, size: 14, color: k.fg3),
                ],
              ),
            ),
          ),
          const SizedBox(width: 4),
          THelp(title: t('desk.op.typeTitle'), text: explain),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(color: k.surface2, borderRadius: BorderRadius.circular(6)),
            child: Text('${t('desk.op.spread')} ${spreadPoints(spec, q.bid, q.ask)}', style: context.text.mono(11.5, color: k.fg2)),
          ),
        ],
      ),
      if (_pending) ...[
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          decoration: BoxDecoration(color: k.surface2.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(9)),
          child: Text(explain, style: context.text.footnote.copyWith(color: k.fg2, fontSize: 12)),
        ),
      ],
      if (!open) ...[
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          decoration: BoxDecoration(
            color: k.warnSoft,
            borderRadius: BorderRadius.circular(9),
            border: Border.all(color: k.warn.withValues(alpha: 0.3)),
          ),
          child: Row(
            children: [
              Icon(LucideIcons.lock, size: 13, color: k.warn),
              const SizedBox(width: 7),
              Expanded(
                child: Text(t('order.ticket.marketClosedNote', {'symbol': _symbol}), style: context.text.footnote.copyWith(color: k.warn, fontSize: 12)),
              ),
            ],
          ),
        ),
      ],
      if (_pending) ...[
        const SizedBox(height: 8),
        TFieldRow(
          label: Text(_type == 'limit' ? t('desk.op.orderPrice') : t('desk.op.stopPrice')),
          child: SizedBox(
            width: 150,
            child: TStepper(
              value: _price,
              onChanged: (v) => setState(() => _price = v),
              step: stepPrice,
              decimals: spec.digits,
              placeholder: fmtPrice(spec.digits, _side == 'sell' ? q.bid : q.ask),
              semanticLabel: t('order.ticket.orderPrice'),
            ),
          ),
        ),
        if (_type == 'stop-limit') ...[
          const SizedBox(height: 6),
          TFieldRow(
            label: Text(t('desk.op.limitPrice')),
            child: SizedBox(
              width: 150,
              child: TStepper(
                value: _stopLimit,
                onChanged: (v) => setState(() => _stopLimit = v),
                step: stepPrice,
                decimals: spec.digits,
                placeholder: _price.isNotEmpty ? _price : fmtPrice(spec.digits, q.ask),
                semanticLabel: t('order.ticket.stopLimitPrice'),
              ),
            ),
          ),
        ],
        const SizedBox(height: 6),
        TFieldRow(
          label: Text(t('desk.op.expiry')),
          child: KPressable(
            minSize: 32,
            onTap: _pickExpiry,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _expiry == 'Date' ? _expiryDate : (_expiry == 'Today' ? t('order.expiry.today') : t('order.expiry.gtc')),
                  style: context.text.mono(12.5, color: k.fg),
                ),
                const SizedBox(width: 4),
                Icon(LucideIcons.chevronDown, size: 14, color: k.fg3),
              ],
            ),
          ),
        ),
      ],
      const SizedBox(height: 8),
      // volume
      TFieldRow(
        label: Text(t('desk.op.volume')),
        help: THelp(title: t('desk.g.lot.t'), text: t('desk.g.lot')),
        child: SizedBox(
          width: 150,
          child: TStepper(
            value: _volume,
            onChanged: (v) => setState(() => _volume = v),
            step: spec.lotStep,
            min: spec.lotMin,
            max: spec.lotMax,
            semanticLabel: t('order.ticket.volume'),
          ),
        ),
      ),
      const SizedBox(height: 6),
      Row(
        children: [
          Expanded(
            child: TQuickStrip<double>(
              options: _presets,
              labels: [for (final p in _presets) p < 1 ? '$p' : p.toStringAsFixed(0)],
              selected: _presets.where((p) => (p - _vol).abs() < 1e-9).firstOrNull,
              onPick: (v) => setState(() => _volume = v.toStringAsFixed(2)),
            ),
          ),
          const SizedBox(width: 6),
          KPressable(
            minSize: 32,
            semanticLabel: t('desk.op.byRisk'),
            onTap: () => setState(() => _calcOpen = !_calcOpen),
            child: Container(
              width: 32,
              height: 30,
              decoration: BoxDecoration(
                color: _calcOpen ? k.emberSoft : k.surface2,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: k.line),
              ),
              child: Icon(LucideIcons.calculator, size: 15, color: _calcOpen ? k.ember : k.fg2),
            ),
          ),
        ],
      ),
      if (_calcOpen) ...[const SizedBox(height: 8), _calculator(context, spec, acc, q)],
      const SizedBox(height: 8),
      _stopRow(context, 'sl', spec, q, cent, slMoney),
      const SizedBox(height: 6),
      _stopRow(context, 'tp', spec, q, cent, tpMoney),
      const SizedBox(height: 6),
      // more options
      KPressable(
        pressedScale: 1,
        onTap: () => setState(() => _more = !_more),
        child: SizedBox(
          height: 34,
          child: Row(
            children: [
              Icon(_more ? LucideIcons.chevronDown : LucideIcons.chevronRight, size: 14, color: k.fg3),
              const SizedBox(width: 6),
              Text(
                t('desk.op.more'),
                style: context.text.label.copyWith(color: k.fg2, fontWeight: FontWeight.w600),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  [t('desk.op.trailing'), if (_pending && _type != 'stop-limit') 'OCO', t('desk.op.comment'), t('desk.op.maxDev')].join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12),
                ),
              ),
            ],
          ),
        ),
      ),
      if (_more) ...[
        TFieldRow(
          label: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              TSmallSwitch(value: _trailing, onChanged: (v) => setState(() => _trailing = v), semanticLabel: t('desk.op.trailing')),
              const SizedBox(width: 8),
              Flexible(child: Text(t('desk.op.trailing'), maxLines: 1, overflow: TextOverflow.ellipsis)),
            ],
          ),
          help: THelp(title: t('desk.op.trailing'), text: t('desk.op.trailingHint')),
          child: _trailing
              ? SizedBox(
                  width: 110,
                  child: TStepper(
                    value: _trailPips,
                    onChanged: (v) => setState(() => _trailPips = v),
                    step: 1,
                    min: 1,
                    decimals: 0,
                    semanticLabel: t('order.ticket.trailingPips'),
                  ),
                )
              : Text(t('desk.op.off'), style: context.text.footnote.copyWith(color: k.fg3)),
        ),
        if (_pending && _type != 'stop-limit') ...[
          const SizedBox(height: 6),
          TFieldRow(
            label: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                TSmallSwitch(value: _oco, onChanged: (v) => setState(() => _oco = v), semanticLabel: t('desk.op.oco')),
                const SizedBox(width: 8),
                const Text('OCO'),
              ],
            ),
            help: THelp(title: 'OCO', text: t('desk.op.oco')),
            child: _oco
                ? SizedBox(
                    width: 140,
                    child: TStepper(
                      value: _ocoPrice,
                      onChanged: (v) => setState(() => _ocoPrice = v),
                      step: stepPrice,
                      decimals: spec.digits,
                      placeholder: fmtPrice(spec.digits, q.bid),
                      semanticLabel: t('desk.op.ocoPrice'),
                    ),
                  )
                : Text(t('desk.op.off'), style: context.text.footnote.copyWith(color: k.fg3)),
          ),
        ],
        const SizedBox(height: 6),
        TFieldRow(
          label: Text(t('desk.op.comment')),
          child: SizedBox(
            width: 160,
            child: TextField(
              maxLength: 31,
              textAlign: TextAlign.end,
              style: context.text.callout.copyWith(fontSize: 13),
              decoration: InputDecoration(
                isCollapsed: true,
                border: InputBorder.none,
                counterText: '',
                hintText: t('common.optional'),
                hintStyle: context.text.callout.copyWith(fontSize: 13, color: k.fg3),
              ),
              onChanged: (v) => _comment = v,
            ),
          ),
        ),
        const SizedBox(height: 6),
        Consumer(
          builder: (context, ref, _) {
            final dev = ref.watch(workspaceProvider.select((w) => w.maxDeviation));
            return TFieldRow(
              label: Text(t('desk.op.maxDev')),
              help: THelp(title: t('desk.set.maxDeviation'), text: t('desk.set.maxDeviationHint')),
              child: SizedBox(
                width: 130,
                child: TStepper(
                  value: dev == null ? '' : '$dev',
                  placeholder: t('order.ticket.anyPrice'),
                  step: 1,
                  decimals: 0,
                  semanticLabel: t('order.ticket.maxDeviation'),
                  onChanged: (v) => ref
                      .read(workspaceProvider.notifier)
                      .update(
                        (w) =>
                            v.trim().isEmpty ? w.copyWith(clearDeviation: true) : w.copyWith(maxDeviation: (double.tryParse(v) ?? 0).round().clamp(0, 1 << 20)),
                      ),
                ),
              ),
            );
          },
        ),
      ],
      const SizedBox(height: 10),
      const KDivider(),
      const SizedBox(height: 6),
      _summary(context, spec, acc, q),
      if (_sl.on && _tp.on && slMoney != null && tpMoney != null && slMoney < 0)
        TSummaryRow(
          label: t('desk.op.ratioLabel'),
          value: Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: accMoney(cent, slMoney, signed: true),
                  style: TextStyle(color: k.down),
                ),
                TextSpan(
                  text: ' / ',
                  style: TextStyle(color: k.fg3),
                ),
                TextSpan(
                  text: accMoney(cent, tpMoney, signed: true),
                  style: TextStyle(color: k.up),
                ),
                TextSpan(
                  text: '  · ${(tpMoney / slMoney.abs()).toStringAsFixed(1)}×',
                  style: TextStyle(color: k.fg2),
                ),
              ],
            ),
          ),
        ),
    ];
  }

  Widget _sideButton(BuildContext context, SymbolSpec spec, String s, bool open) {
    final t = context.t;
    final k = context.k;
    final buy = s == 'buy';
    final chosen = _side == s;
    final armed = ref.watch(workspaceProvider.select((w) => w.oneClick));
    final fixed = _pending ? double.tryParse(_price) : null;
    final col = buy ? k.up : k.down;
    return KPressable(
      onTap: !open || _busy ? null : () => _onSide(s),
      semanticLabel: buy ? t('desk.pos.buy') : t('desk.pos.sell'),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        height: 50,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: chosen ? (buy ? k.upSoft : k.downSoft) : Colors.transparent,
          borderRadius: BorderRadius.circular(9),
          border: Border.all(color: chosen ? col.withValues(alpha: 0.45) : (armed ? col.withValues(alpha: 0.25) : Colors.transparent)),
        ),
        child: Opacity(
          opacity: open ? 1 : 0.5,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  if (armed) Icon(LucideIcons.zap, size: 11, color: col),
                  if (armed) const SizedBox(width: 3),
                  Flexible(
                    child: Text(
                      buy ? t('desk.pos.buy') : t('desk.pos.sell'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.text.label.copyWith(color: col, fontWeight: FontWeight.w700, fontSize: 12.5),
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Spacer(),
                  if (fixed != null && fixed > 0)
                    PriceText(fixed, digits: spec.digits, size: 13.5)
                  else
                    QuoteBuilder(
                      symbol: _symbol,
                      builder: (context, q) => PriceText(buy ? (q?.ask ?? 0) : (q?.bid ?? 0), digits: spec.digits, size: 13.5, dir: q?.dir ?? 0),
                    ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                buy ? t('desk.op.buyHint') : t('desk.op.sellHint'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.text.footnote.copyWith(color: k.fg3, fontSize: 11.5),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _stopRow(BuildContext context, String which, SymbolSpec spec, TQuote q, bool cent, double? money) {
    final t = context.t;
    final k = context.k;
    final st = which == 'sl' ? _sl : _tp;
    final name = which == 'sl' ? t('desk.op.sl') : t('desk.op.tp');
    final tone = which == 'sl' ? k.down : k.up;
    final pv = _pipValue(spec, q);
    final at = _side == null ? null : stopPrice(st, which, _side!, _entry(_side!, q), spec, pipValue: pv, cent: cent);
    final d = !st.on
        ? null
        : (st.mode == 'price'
              ? (at != null && _side != null ? (at - _entry(_side!, q)).abs() / spec.pipSize : null)
              : stopDistancePips(st, pipValue: pv, cent: cent));
    final bad = _wrongSide(st, which, q);
    final modeLabel = st.mode == 'price' ? t('desk.op.mode.price') : (st.mode == 'pips' ? t('desk.op.mode.pips') : accCcy(cent));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TFieldRow(
          tone: st.on ? tone : null,
          label: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              TSmallSwitch(value: st.on, onChanged: (v) => _toggleStop(which, v, spec, q), semanticLabel: name),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: st.on ? k.fg : k.fg2),
                ),
              ),
            ],
          ),
          help: THelp(title: which == 'sl' ? t('desk.g.sl.t') : t('desk.g.tp.t'), text: which == 'sl' ? t('desk.op.slHint') : t('desk.op.tpHint')),
          child: st.on
              ? Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: 116,
                      child: TStepper(
                        value: st.value,
                        tone: tone,
                        step: st.mode == 'price' ? spec.pipSize : (st.mode == 'pips' ? 1 : ((pv * (cent ? 100 : 1)).round().clamp(1, 1 << 20)).toDouble()),
                        decimals: st.mode == 'price' ? spec.digits : (st.mode == 'pips' ? 1 : 2),
                        placeholder: st.mode == 'price' ? fmtPrice(spec.digits, _side == 'sell' ? q.ask : q.bid) : '0',
                        semanticLabel: which == 'sl' ? t('order.ticket.stopLoss') : t('order.ticket.takeProfit'),
                        onChanged: (v) => setState(() {
                          if (which == 'sl') {
                            _sl = _sl.copyWith(value: v);
                          } else {
                            _tp = _tp.copyWith(value: v);
                          }
                        }),
                      ),
                    ),
                    const SizedBox(width: 4),
                    KPressable(
                      minSize: 32,
                      onTap: () async {
                        final m = await showKActionSheet<String>(
                          context,
                          title: name,
                          actions: [
                            KAction(label: t('desk.op.mode.price'), value: 'price'),
                            KAction(label: t('desk.op.mode.pips'), value: 'pips'),
                            KAction(label: '${t('desk.op.mode.money')} (${accCcy(cent)})', value: 'money'),
                          ],
                        );
                        if (m != null && mounted) _changeMode(which, m, spec, q, cent);
                      },
                      child: Container(
                        height: 26,
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        decoration: BoxDecoration(
                          color: k.surface,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: k.line),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(modeLabel, style: context.text.caption.copyWith(color: k.fg2)),
                            Icon(LucideIcons.chevronDown, size: 12, color: k.fg3),
                          ],
                        ),
                      ),
                    ),
                  ],
                )
              : Text(t('desk.op.off'), style: context.text.footnote.copyWith(color: k.fg3)),
        ),
        if (st.on)
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 4, 4, 0),
            child: Wrap(
              spacing: 6,
              children: [
                if (money != null)
                  Text(
                    which == 'sl'
                        ? t('desk.op.risk', {'amount': accMoney(cent, money, signed: true)})
                        : t('desk.op.reward', {'amount': accMoney(cent, money, signed: true)}),
                    style: context.text.mono(11.5, weight: FontWeight.w600, color: tone),
                  ),
                if (at != null)
                  Text('· ${t('desk.op.atPrice', {'price': fmtPrice(spec.digits, at)})}', style: context.text.mono(11.5, color: k.fg3))
                else if (_side == null)
                  Text('· ${t('desk.op.pickSideForPrice')}', style: context.text.footnote.copyWith(color: k.fg3, fontSize: 11.5)),
                if (d != null && st.mode != 'pips')
                  Text('· ${t('desk.op.pipsAway', {'n': d.toStringAsFixed(1)})}', style: context.text.footnote.copyWith(color: k.fg3, fontSize: 11.5)),
                if (bad)
                  SizedBox(
                    width: double.infinity,
                    child: Text(
                      t.dyn('desk.op.check.$which${_side == 'buy' ? 'Buy' : 'Sell'}'),
                      style: context.text.footnote.copyWith(color: k.down, fontSize: 11.5),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _calculator(BuildContext context, SymbolSpec spec, TAccount acc, TQuote q) {
    final t = context.t;
    final k = context.k;
    final cent = acc.cent;
    final m = ref.read(terminalProvider).metrics;
    final riskUsd = _riskMode == 'pct' ? m.balance * (double.tryParse(_risk) ?? 0) / 100 : (double.tryParse(_risk) ?? 0) / (cent ? 100 : 1);
    final pvLot = pipValuePerLot(spec, q.bid, bidOf: ref.read(marketFeedProvider).bidOf);
    final lots = riskLots(riskUsd: riskUsd, pips: double.tryParse(_riskPips) ?? 1, pipValuePerLot: pvLot);
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: k.surface2.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: k.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text(
                t('desk.op.calc.title'),
                style: context.text.label.copyWith(fontWeight: FontWeight.w600, color: k.fg),
              ),
              const SizedBox(width: 4),
              THelp(text: t('desk.op.calc.text')),
            ],
          ),
          const SizedBox(height: 6),
          TFieldRow(
            label: Text(t('order.calc.risk')),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 74,
                  child: KSegmented<String>(
                    plain: true,
                    height: 28,
                    values: const ['pct', 'usd'],
                    labels: ['%', cent ? '¢' : r'$'],
                    selected: _riskMode,
                    onChanged: (v) => setState(() => _riskMode = v),
                  ),
                ),
                const SizedBox(width: 6),
                SizedBox(
                  width: 96,
                  child: TStepper(
                    value: _risk,
                    onChanged: (v) => setState(() => _risk = v),
                    step: _riskMode == 'pct' ? 0.25 : 25,
                    decimals: _riskMode == 'pct' ? 2 : 0,
                    semanticLabel: t('order.calc.risk'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          TFieldRow(
            label: Text(t('order.calc.slDistancePips')),
            child: SizedBox(
              width: 96,
              child: TStepper(
                value: _riskPips,
                onChanged: (v) => setState(() => _riskPips = v),
                step: 1,
                decimals: 0,
                semanticLabel: t('order.calc.slDistance'),
              ),
            ),
          ),
          TSummaryRow(label: t('order.calc.lots'), value: Text(lots.toStringAsFixed(2))),
          const SizedBox(height: 4),
          KButton(
            label: t('order.calc.apply', {'lots': lots.toStringAsFixed(2), 'sl': _riskPips, 'tp': ((double.tryParse(_riskPips) ?? 0) * 2).toStringAsFixed(0)}),
            variant: KButtonVariant.surface,
            size: KButtonSize.sm,
            expand: true,
            onPressed: () {
              setState(() {
                _volume = lots.toStringAsFixed(2);
                _sl = StopInput(on: true, value: _riskPips);
                _tp = StopInput(on: true, value: ((double.tryParse(_riskPips) ?? 0) * 2).toStringAsFixed(0));
                _calcOpen = false;
              });
              ref
                  .read(notificationsProvider.notifier)
                  .toast(
                    NotificationKind.success,
                    t('order.toast.volumeSet', {'lots': lots.toStringAsFixed(2)}),
                    description: t('order.toast.volumeSetDesc', {'amount': accMoney(cent, riskUsd), 'ccy': accCcy(cent), 'pips': _riskPips}),
                  );
            },
          ),
        ],
      ),
    );
  }

  /// Margin, pip value, size, free margin after, swap (web LiveSummary).
  Widget _summary(BuildContext context, SymbolSpec spec, TAccount acc, TQuote q) {
    final t = context.t;
    final k = context.k;
    final m = ref.watch(terminalProvider.select((s) => s.metrics));
    final bidOf = ref.read(marketFeedProvider).bidOf;
    final margin = marginRequired(spec, _vol, q.ask, acc.leverage, bidOf: bidOf);
    final pipV = pipValuePerLot(spec, q.bid, bidOf: bidOf) * _vol;
    final pct = m.free > 0 ? margin / m.free * 100 : double.infinity;
    final short = margin > m.free;
    final ccy = accCcy(acc.cent);
    final size = _vol * spec.contractSize;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TSummaryRow(
          label: t('desk.op.summary.margin'),
          help: THelp(title: t('desk.g.margin.t'), text: t('desk.g.margin')),
          value: Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: '${accMoney(acc.cent, margin)} $ccy',
                  style: TextStyle(color: short ? k.down : k.fg),
                ),
                TextSpan(
                  text: '  · ${pct.isFinite ? '${pct < 0.1 ? pct.toStringAsFixed(2) : pct.toStringAsFixed(1)}%' : '—'}',
                  style: TextStyle(color: k.fg3),
                ),
              ],
            ),
          ),
        ),
        TSummaryRow(
          label: t('desk.op.summary.pip'),
          help: THelp(title: t('desk.g.pip.t'), text: t('desk.g.pip')),
          value: Text('${accMoney(acc.cent, pipV)} $ccy'),
        ),
        TSummaryRow(
          label: t('desk.op.summary.size'),
          value: Text.rich(
            TextSpan(
              children: [
                TextSpan(text: Fmt2.compactNumber(size)),
                TextSpan(
                  text: ' ${unitLabel(t, spec)}',
                  style: TextStyle(color: k.fg3),
                ),
              ],
            ),
          ),
        ),
        TSummaryRow(
          label: t('desk.op.summary.free'),
          value: Text('${accMoney(acc.cent, m.free - margin)} $ccy', style: TextStyle(color: short ? k.down : null)),
        ),
        TSummaryRow(
          label: t('desk.sw.title'),
          ltr: false,
          help: THelp(title: t('desk.g.swap.t'), text: t('desk.g.swap')),
          value: Text(swapSummary(t, spec), style: context.text.footnote.copyWith(color: k.fg2, fontSize: 11.5)),
        ),
        if (short)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              t('desk.op.notEnough'),
              style: context.text.footnote.copyWith(color: k.down, fontWeight: FontWeight.w600),
            ),
          ),
      ],
    );
  }

  Widget _footer(BuildContext context, SymbolSpec spec, TQuote q, bool open, bool oneClick) {
    final t = context.t;
    final k = context.k;
    final delayed = q.delayed && !_pending;
    final String confirm;
    if (delayed) {
      confirm = t('desk.side.delayedTip');
    } else if (!open) {
      confirm = t('desk.op.confirm.closed');
    } else if (_busy) {
      confirm = t('desk.op.confirm.sending');
    } else if (_side == null) {
      confirm = t('desk.op.confirm.pickSide');
    } else if (_pending && _price.isEmpty) {
      confirm = t('desk.op.confirm.enterPrice');
    } else if (_pending) {
      confirm = t('desk.op.confirm.pending', {
        'label': t('order.pending.$_side.$_type'),
        'lots': fmtVol(_vol),
        'symbol': _symbol,
        'price': fmtPrice(spec.digits, double.tryParse(_price) ?? 0),
      });
    } else {
      confirm = t('desk.op.confirm.market', {'side': _side == 'buy' ? t('desk.pos.buy') : t('desk.pos.sell'), 'lots': fmtVol(_vol), 'symbol': _symbol});
    }
    final canConfirm = !delayed && open && !_busy && _side != null && (!_pending || _price.isNotEmpty);
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: k.line, width: 0.6)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (oneClick)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: k.ember.withValues(alpha: 0.07),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: k.ember.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Icon(LucideIcons.zap, size: 13, color: k.ember),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(t('desk.op.oneClickNote'), style: context.text.footnote.copyWith(color: k.fg2, fontSize: 12)),
                  ),
                ],
              ),
            )
          else
            KButton(
              label: confirm,
              size: KButtonSize.lg,
              expand: true,
              loading: _busy,
              variant: canConfirm
                  ? (_side == 'sell' ? KButtonVariant.sell : (_side == 'buy' ? KButtonVariant.buy : KButtonVariant.ember))
                  : KButtonVariant.surface,
              onPressed: canConfirm ? () => unawaited(_submit(_side!)) : null,
            ),
          const SizedBox(height: 6),
          Row(
            children: [
              TSmallSwitch(
                value: oneClick,
                semanticLabel: t('desk.op.oneClick'),
                onChanged: (v) => ref.read(workspaceProvider.notifier).update((w) => w.copyWith(oneClick: v)),
              ),
              const SizedBox(width: 6),
              Text(
                t('desk.op.oneClick'),
                style: context.text.footnote.copyWith(color: k.fg2, fontWeight: FontWeight.w500),
              ),
              const SizedBox(width: 4),
              THelp(title: t('desk.op.oneClick'), text: oneClick ? t('desk.op.oneClickOn') : t('desk.op.oneClickOff')),
              const Spacer(),
              Text(oneClick ? t('trader.oneClick.on') : t('trader.oneClick.off'), style: context.text.caption.copyWith(color: oneClick ? k.ember : k.fg3)),
            ],
          ),
        ],
      ),
    );
  }
}

/// "100,000" / "1,250.5" (the order summary's position size).
abstract final class Fmt2 {
  static String compactNumber(double v) {
    final whole = v == v.roundToDouble();
    final s = v.toStringAsFixed(whole ? 0 : 2).replaceAll(RegExp(r'0+$'), '').replaceAll(RegExp(r'\.$'), '');
    final parts = s.split('.');
    final i = parts[0].replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
    return parts.length > 1 ? '$i.${parts[1]}' : i;
  }
}
