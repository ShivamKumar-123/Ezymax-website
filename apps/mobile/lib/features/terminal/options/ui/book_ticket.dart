// The ticket's order-book part (web: components/options/book-ticket.tsx; a single option while the broker's book is
// live):
//   Limit   a price in USD per contract (sent per unit on the premium tick), time in force GTC / IOC / FOK / GTD (a
//           date and time), Post-only (GTC) and Reduce-only
//   Market  fills now against the book inside the price band around the mark, never rests
//   Stop    stop market / stop limit, triggered by the option's mark or the underlying's price crossing a level
// The book preview shows what fills now at what average price, what rests, the fee or rebate and the order margin
// held; the answer shows the fills, partial fills and what rests.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/api_error.dart';
import '../../../../core/notifications/notifications.dart';
import '../../../../i18n/i18n.dart';
import '../../../../ui/ui.dart';
import '../../core/terminal_controller.dart';
import '../../core/trade_math.dart';
import '../../widgets/kit.dart';
import '../core/errors.dart';
import '../core/format.dart';
import '../core/math.dart';
import '../core/models.dart';
import '../core/preview_loop.dart';
import '../core/pricer.dart';
import '../core/store.dart';
import 'actions.dart';
import 'bits.dart';
import 'nav.dart';

/// Units of a series: USD per contract for one unit of premium, the premium tick, the tick in USD (web useSeriesUnits).
({double k, double tick, double tickUsd}) seriesUnits(OptState s, String code) {
  final q = s.quoteOf(code);
  final p = parseSeriesBase(code);
  final chainK = p != null && s.chain?.underlying == p.underlying ? usdPerUnitOf(s.chain) : 0.0;
  final spec = p == null ? null : optionSpecs[p.underlying];
  var k = usdPerUnitOfQuote(q);
  if (!(k > 0)) k = chainK;
  if (!(k > 0)) k = spec?.quoteCcy == 'USD' ? spec!.contractSize : 0;
  final tick = p == null
      ? 0.00001
      : premiumTickOf(p.underlying, under: s.underlyingOf(p.underlying), chainBook: s.chain?.underlying == p.underlying ? s.chain?.book : null);
  return (k: k, tick: tick, tickUsd: (tick * k * 1e6).round() / 1e6);
}

/// The ticket as a book order (prices per unit on the tick), or the key of what is still missing (web bookRequest).
({Map<String, Object?>? req, String? missing}) bookRequest(Ticket ticket, TicketLeg leg, ({double k, double tick, double tickUsd}) units) {
  final base = <String, Object?>{'series': leg.series, 'side': leg.side, 'qty': leg.contracts, if (ticket.reduceOnly) 'reduceOnly': true};
  double? unit(String usdText) {
    final v = double.tryParse(usdText) ?? 0;
    return v > 0 && units.k > 0 ? toTick(v / units.k, units.tick) : null;
  }

  String? expireAt() => ticket.gtd?.toUtc().toIso8601String();
  if (ticket.bookType == 'market') return (req: {...base, 'type': 'market', 'tif': 'ioc'}, missing: null);
  if (ticket.bookType == 'limit') {
    final price = unit(ticket.limit);
    if (price == null) return (req: null, missing: 'trader.opt.bt.needPrice');
    final tif = ticket.bookTif;
    if (tif == 'gtd' && expireAt() == null) return (req: null, missing: 'trader.opt.bt.needGtd');
    return (
      req: {
        ...base,
        'type': 'limit',
        'price': price,
        'tif': tif,
        if (tif == 'gtd') 'expireAt': expireAt(),
        if (ticket.postOnly && tif == 'gtc') 'postOnly': true,
      },
      missing: null,
    );
  }
  final raw = double.tryParse(ticket.trigPrice) ?? 0;
  final trigPrice = ticket.trigSource == 'mark' ? unit(ticket.trigPrice) : (raw > 0 ? raw : null);
  if (trigPrice == null) return (req: null, missing: 'trader.opt.bt.needTrigger');
  final trigger = {'source': ticket.trigSource, 'op': ticket.trigOp, 'price': trigPrice};
  if (ticket.stopKind == 'market') return (req: {...base, 'type': 'stop_market', 'tif': 'ioc', 'trigger': trigger}, missing: null);
  final price = unit(ticket.limit);
  if (price == null) return (req: null, missing: 'trader.opt.bt.needPrice');
  final tif = ticket.bookTif == 'gtd' ? 'gtd' : 'gtc';
  if (tif == 'gtd' && expireAt() == null) return (req: null, missing: 'trader.opt.bt.needGtd');
  return (req: {...base, 'type': 'stop_limit', 'price': price, 'tif': tif, if (tif == 'gtd') 'expireAt': expireAt(), 'trigger': trigger}, missing: null);
}

class BookOrderForm extends ConsumerStatefulWidget {
  const BookOrderForm({super.key, required this.leg});
  final TicketLeg leg;

  @override
  ConsumerState<BookOrderForm> createState() => _BookOrderFormState();
}

class _BookOrderFormState extends ConsumerState<BookOrderForm> {
  bool _busy = false;
  BookOrderResult? _last;
  ({String code, String message})? _err;
  String _series = '';
  String _armKey = '';
  late final BookPreviewLoop _preview = BookPreviewLoop(ref, () {
    if (mounted) setState(() {});
  });

  @override
  void dispose() {
    _preview.dispose();
    super.dispose();
  }

  void _setType(String v, Ticket ticket, OptionQuote? q, double? spot, int digits) {
    final leg = widget.leg;
    ref.read(optionsProvider.notifier).setTicket((x) {
      var n = x.copyWith(bookType: v);
      if (v == 'stop' && x.trigPrice.isEmpty) {
        n = n.copyWith(trigOp: leg.side == 'sell' ? 'below' : 'above');
        if (x.trigSource == 'mark' && q != null && q.markUsd > 0) {
          n = n.copyWith(trigPrice: q.markUsd.toStringAsFixed(2));
        } else if (spot != null) {
          n = n.copyWith(trigPrice: spot.toStringAsFixed(digits));
        }
      }
      if (v == 'limit' && x.limit.isEmpty && q != null) {
        final join = leg.side == 'buy' ? (q.bidUsd > 0 ? q.bidUsd : q.markUsd) : (q.askUsd > 0 ? q.askUsd : q.markUsd);
        if (join > 0) n = n.copyWith(limit: join.toStringAsFixed(2));
      }
      return n;
    });
  }

  Future<void> _pickGtd(int? cutMs) async {
    final now = DateTime.now();
    final max = cutMs != null ? DateTime.fromMillisecondsSinceEpoch(cutMs - 120000) : now.add(const Duration(days: 30));
    final cur = ref.read(optionsProvider).ticket.gtd ?? (now.add(const Duration(hours: 1)).isBefore(max) ? now.add(const Duration(hours: 1)) : max);
    var picked = cur;
    await showKSheet<void>(
      context,
      title: context.t('trader.opt.bt.gtdAt'),
      builder: (ctx) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            height: 200,
            child: CupertinoDatePicker(
              initialDateTime: cur.isBefore(now) ? now : cur,
              minimumDate: now.subtract(const Duration(minutes: 1)),
              maximumDate: max.isAfter(now) ? max : null,
              use24hFormat: true,
              onDateTimeChanged: (d) => picked = d,
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: KButton(label: ctx.t('common.done'), expand: true, onPressed: () => Navigator.of(ctx).pop()),
          ),
        ],
      ),
    );
    if (!mounted) return;
    ref.read(optionsProvider.notifier).setTicket((x) => x.copyWith(gtd: picked));
  }

  Future<void> _submit(Map<String, Object?> req, ({double k, double tick, double tickUsd}) units) async {
    final t = context.t;
    final leg = widget.leg;
    final api = ref.read(optionsApiProvider);
    if (api == null) return;
    final ctl = ref.read(optionsProvider.notifier);
    setState(() {
      _busy = true;
      _err = null;
    });
    final send = {...req, 'clientOrderId': clientOrderId('bk')};
    final what = orderWhat(t, side: leg.side, n: leg.contracts, u: leg.u, strikeLabel: leg.strikeLabel, right: leg.right, expiry: leg.expiry);
    BookOrderResult res;
    try {
      res = await api.bookPlace(send);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      if (bookMissing(e)) {
        ctl.setBookOff();
        optToast(ref, NotificationKind.warning, t('trader.opt.bt.bookOff'));
        return;
      }
      KHaptics.error();
      setState(() => _err = (code: optCode(e), message: e.message));
      if (!needsOnboarding(e.code)) optToast(ref, NotificationKind.error, t('trader.opt.toast.rejected'), description: '$what · ${errText(t, e)}');
      return;
    }
    if (!mounted) return;
    setState(() => _busy = false);
    unawaited(ref.read(bookOrdersProvider.notifier).refresh());
    if (res.status == 'rejected') {
      final code = res.reason ?? 'rejected';
      KHaptics.error();
      setState(() => _err = (code: code, message: optionErrorText(t, code)));
      optToast(ref, NotificationKind.error, t('trader.opt.toast.rejected'), description: '$what · ${optionErrorText(t, code)}');
      return;
    }
    setState(() => _last = res);
    final filled = res.fills.fold<double>(0, (n, f) => n + f.qty);
    final avg = filled > 0 ? usd(res.fills.fold<double>(0, (s, f) => s + f.price * f.qty) / filled * units.k) : '';
    if (res.status == 'filled') {
      KHaptics.success();
      optToast(ref, NotificationKind.success, t('trader.opt.bt.toast.filled'), description: '$what · ${t('trader.opt.bt.toast.avg', {'price': avg})}');
    } else if (res.status == 'partially_filled') {
      KHaptics.success();
      optToast(
        ref,
        NotificationKind.success,
        t('trader.opt.bt.toast.partial', {'n': qty(filled), 'total': qty(numOr(send['qty']))}),
        description: '$what · ${t('trader.opt.bt.toast.avg', {'price': avg})}',
      );
    } else if (res.status == 'working') {
      KHaptics.medium();
      optToast(ref, NotificationKind.neutral, res.order?.trigger != null ? t('trader.opt.bt.toast.stop') : t('trader.opt.bt.toast.resting'), description: what);
    } else {
      optToast(
        ref,
        NotificationKind.warning,
        t('trader.opt.bt.toast.notFilled'),
        description: '$what · ${res.reason != null ? optionErrorText(t, res.reason!) : ''}',
      );
    }
    ctl.setTicket((x) => x.copyWith(armed: false, limit: '', trigPrice: '', gtd: null, reduceOnly: false, postOnly: false));
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final leg = widget.leg;
    final s = ref.watch(optionsProvider);
    final ctl = ref.read(optionsProvider.notifier);
    final ticket = s.ticket;
    final readOnly = ref.watch(terminalProvider.select((x) => x.readOnly));
    final q = s.quoteOf(leg.series);
    final units = seriesUnits(s, leg.series);
    final digits = digitsOf(leg.u);
    final spot = s.chain != null && s.chain!.underlying == leg.u ? s.chain!.spot?.mid : null;
    int? cutMs;
    for (final e in s.expiries) {
      if (e.date == leg.expiry && s.u == leg.u) cutMs = e.cutMs;
    }
    cutMs ??= s.chain?.expiry == leg.expiry && s.chain?.underlying == leg.u ? s.chain!.cutMs : null;
    if (_series != leg.series) {
      _series = leg.series;
      _last = null;
      _err = null;
    }
    // Buy / Sell chosen with an empty limit price: start from the price on that button (the best offer / bid)
    final armKey = '${ticket.armed}|${leg.side}|${leg.series}';
    if (armKey != _armKey) {
      _armKey = armKey;
      final touch = q == null ? 0.0 : ((leg.side == 'buy' ? q.askUsd : q.bidUsd) > 0 ? (leg.side == 'buy' ? q.askUsd : q.bidUsd) : q.markUsd);
      if (ticket.armed && ticket.bookType == 'limit' && ticket.limit.isEmpty && touch > 0) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) ctl.setTicket((x) => x.limit.isEmpty ? x.copyWith(limit: touch.toStringAsFixed(2)) : x);
        });
      }
    }
    final armed = ticket.armed;
    final r = bookRequest(ticket, leg, units);
    _preview.update(r.req, enabled: armed);
    final pv = _preview.state.preview;
    final type = ticket.bookType;
    final limitTif = type == 'limit';
    final stopLimit = type == 'stop' && ticket.stopKind == 'limit';
    final priced = limitTif || stopLimit;
    final markUsd = q?.markUsd;
    final stepUsd = math.max(0.01, units.tickUsd > 0 ? units.tickUsd : 0.01);
    final limitV = double.tryParse(ticket.limit) ?? 0;
    final limitUnit = priced && limitV > 0 && units.k > 0 ? toTick(limitV / units.k, units.tick) : null;
    final bandUsd = q != null && q.mark > 0 ? q.markUsd * 0.1 : null;
    final blocked = !armed || readOnly || _busy || r.req == null || (q != null && q.state == 'closed') || (pv != null && !pv.ok);
    final sideWord = leg.side == 'buy' ? t('common.buy') : t('common.sell');
    final rightWord = leg.right == 'call' ? t('trader.opt.call') : t('trader.opt.put');
    final small = context.text.caption.copyWith(fontSize: 10.5, color: k.fg3, fontWeight: FontWeight.w400);
    final tifShown = limitTif ? ticket.bookTif : (ticket.bookTif == 'gtd' ? 'gtd' : 'gtc');
    final tifHint = t.dyn('trader.opt.bt.tif.${tifShown}Hint', fallback: '');
    final typeText = type == 'market'
        ? t('trader.opt.ord.type.market')
        : (type == 'stop'
              ? t(ticket.stopKind == 'market' ? 'trader.opt.ord.type.stop_market' : 'trader.opt.ord.type.stop_limit')
              : '${t('trader.opt.ord.type.limit')} ${ticket.limit.isNotEmpty ? usd(limitV) : ''}');
    final label = !armed ? t('trader.opt.ticket.chooseSide') : '$sideWord ${leg.contracts} × ${leg.strikeLabel} $rightWord · $typeText';
    final box = BoxDecoration(
      color: k.surface2.withValues(alpha: 0.3),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: k.line),
    );
    final tifs = limitTif ? const ['gtc', 'ioc', 'fok', 'gtd'] : const ['gtc', 'gtd'];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        OptLabel(t('trader.opt.ticket.orderType')),
        OptSeg<String>(
          values: const ['limit', 'market', 'stop'],
          labels: [t('trader.opt.ord.type.limit'), t('trader.opt.ord.type.market'), t('trader.opt.bt.stop')],
          selected: type,
          onChanged: (v) => _setType(v, ticket, q, spot, digits),
        ),
        if (type == 'stop') ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: box,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                OptSeg<String>(
                  height: 26,
                  values: const ['market', 'limit'],
                  labels: [t('trader.opt.ord.type.stop_market'), t('trader.opt.ord.type.stop_limit')],
                  selected: ticket.stopKind,
                  onChanged: (v) => ctl.setTicket((x) => x.copyWith(stopKind: v, bookTif: x.bookTif == 'gtd' ? 'gtd' : 'gtc')),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(child: Text(t('trader.opt.bt.trigBy'), style: small.copyWith(fontSize: 11))),
                    SizedBox(
                      width: 150,
                      child: OptSeg<String>(
                        height: 26,
                        values: const ['mark', 'underlying'],
                        labels: [t('trader.opt.col.mark'), leg.u],
                        selected: ticket.trigSource,
                        onChanged: (v) => ctl.setTicket(
                          (x) => x.copyWith(
                            trigSource: v,
                            trigPrice: v == 'mark' ? (markUsd != null ? markUsd.toStringAsFixed(2) : '') : (spot != null ? spot.toStringAsFixed(digits) : ''),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    SizedBox(
                      width: 116,
                      child: OptSeg<String>(
                        height: 32,
                        values: const ['above', 'below'],
                        labels: [t('trader.opt.ticket.above'), t('trader.opt.ticket.below')],
                        selected: ticket.trigOp,
                        onChanged: (v) => ctl.setTicket((x) => x.copyWith(trigOp: v)),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: TStepper(
                        value: ticket.trigPrice,
                        step: ticket.trigSource == 'mark' ? stepUsd : math.pow(10, -digits).toDouble(),
                        decimals: ticket.trigSource == 'mark' ? 2 : digits,
                        placeholder: ticket.trigSource == 'mark' ? markUsd?.toStringAsFixed(2) : spot?.toStringAsFixed(digits),
                        semanticLabel: t('trader.opt.ticket.triggerPrice'),
                        onChanged: (v) => ctl.setTicket((x) => x.copyWith(trigPrice: v)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  ticket.trigSource == 'mark'
                      ? t('trader.opt.bt.trigMarkHint', {'now': markUsd != null ? usd(markUsd) : '—'})
                      : t('trader.opt.bt.trigUnderHint', {'u': leg.u, 'now': px(spot, digits)}),
                  style: small.copyWith(fontSize: 10),
                ),
              ],
            ),
          ),
        ],
        if (priced) ...[
          const SizedBox(height: 10),
          OptLabel(
            stopLimit ? t('trader.opt.bt.limitAfter') : t('trader.opt.bt.limitPrice'),
            trailing: limitUnit != null
                ? Text(t('trader.opt.bt.perUnit', {'price': px(limitUnit, stepDecimals(units.tick))}), style: context.text.mono(10, color: k.fg3))
                : null,
          ),
          TStepper(
            value: ticket.limit,
            step: stepUsd,
            placeholder: markUsd != null ? usd(markUsd) : null,
            semanticLabel: t('trader.opt.bt.limitPrice'),
            onChanged: (v) => ctl.setTicket((x) => x.copyWith(limit: v)),
          ),
          if (q != null && limitTif) ...[
            const SizedBox(height: 6),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: [
                for (final c in [
                  ('bid', q.bidUsd),
                  ('mid', q.bidUsd > 0 && q.askUsd > 0 ? (q.bidUsd + q.askUsd) / 2 : 0.0),
                  ('ask', q.askUsd),
                  ('mark', q.markUsd),
                ])
                  Opacity(
                    opacity: c.$2 > 0 ? 1 : 0.4,
                    child: KPressable(
                      minSize: 30,
                      onTap: c.$2 > 0 ? () => ctl.setTicket((x) => x.copyWith(limit: c.$2.toStringAsFixed(2))) : null,
                      child: Container(
                        height: 24,
                        padding: const EdgeInsets.symmetric(horizontal: 7),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(5),
                          border: Border.all(color: k.line),
                        ),
                        child: Text('${t('trader.opt.bt.chip.${c.$1}')} ${c.$2 > 0 ? usd(c.$2) : '—'}', style: context.text.mono(10.5, color: k.fg3)),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ],
        if (priced || type == 'market') ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: box,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (priced) ...[
                  Row(
                    children: [
                      Expanded(child: Text(t('trader.opt.ticket.tif'), style: small.copyWith(fontSize: 11))),
                      SizedBox(
                        width: limitTif ? 190 : 104,
                        child: OptSeg<String>(
                          height: 26,
                          values: tifs,
                          labels: [for (final v in tifs) t('trader.opt.bt.tif.$v')],
                          selected: tifShown,
                          onChanged: (v) {
                            ctl.setTicket((x) => x.copyWith(bookTif: v, postOnly: v == 'gtc' ? x.postOnly : false));
                            if (v == 'gtd' && ticket.gtd == null) unawaited(_pickGtd(cutMs));
                          },
                        ),
                      ),
                    ],
                  ),
                  if (ticket.bookTif == 'gtd') ...[
                    const SizedBox(height: 8),
                    KPressable(
                      minSize: 36,
                      semanticLabel: t('trader.opt.bt.gtdAt'),
                      onTap: () => unawaited(_pickGtd(cutMs)),
                      child: Container(
                        height: 34,
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        decoration: BoxDecoration(
                          color: k.surface2,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: k.line),
                        ),
                        child: Row(
                          children: [
                            Icon(LucideIcons.calendarClock, size: 14, color: k.fg3),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                ticket.gtd == null ? t('trader.opt.bt.gtdAt') : fmtServer(ticket.gtd!, seconds: false),
                                style: context.text.mono(12, color: ticket.gtd == null ? k.fg3 : k.fg),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  if (tifHint.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(tifHint, style: small.copyWith(fontSize: 10)),
                    ),
                ],
                if (type == 'market') Text(t('trader.opt.bt.marketHint', {'band': bandUsd != null ? usd(bandUsd) : '—'}), style: small.copyWith(color: k.fg2)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 12,
                  runSpacing: 4,
                  children: [
                    if (limitTif)
                      Tooltip(
                        message: t('trader.opt.bt.postOnlyHint'),
                        child: OptCheck(
                          value: ticket.postOnly && ticket.bookTif == 'gtc',
                          onChanged: ticket.bookTif != 'gtc' ? null : (v) => ctl.setTicket((x) => x.copyWith(postOnly: v)),
                          label: Text(t('trader.opt.bt.postOnly')),
                        ),
                      ),
                    Tooltip(
                      message: t('trader.opt.bt.reduceOnlyHint'),
                      child: OptCheck(
                        value: ticket.reduceOnly,
                        onChanged: (v) => ctl.setTicket((x) => x.copyWith(reduceOnly: v)),
                        label: Text(t('trader.opt.bt.reduceOnly')),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
        if (type == 'stop') ...[
          const SizedBox(height: 8),
          Row(
            children: [
              OptCheck(
                value: ticket.reduceOnly,
                onChanged: (v) => ctl.setTicket((x) => x.copyWith(reduceOnly: v)),
                label: Text(t('trader.opt.bt.reduceOnly')),
              ),
              const SizedBox(width: 10),
              Expanded(child: Text(t('trader.opt.bt.stopHint'), style: small.copyWith(fontSize: 10))),
            ],
          ),
        ],
        if (armed && r.missing != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(t(r.missing!), style: small.copyWith(fontSize: 11)),
          ),
        if (armed && r.req != null) ...[const SizedBox(height: 10), _BookPreviewCard(state: _preview.state, req: r.req!, k: units.k)],
        if (_err != null) ...[const SizedBox(height: 10), ErrorNote(code: _err!.code, message: _err!.message)],
        if (_last != null) ...[const SizedBox(height: 10), _ResultCard(r: _last!, k: units.k, onClose: () => setState(() => _last = null))],
        const SizedBox(height: 10),
        if (readOnly)
          const ReadOnlyBox()
        else
          OptPrimaryButton(
            idle: !armed,
            label: _busy ? t('trader.opt.ticket.sending') : label,
            amount: pv != null && pv.reserve > 0 ? '${usd(pv.reserve)} USD' : null,
            onTap: blocked ? null : () => unawaited(_submit(r.req!, units)),
          ),
      ],
    );
  }
}

class _BookPreviewCard extends StatelessWidget {
  const _BookPreviewCard({required this.state, required this.req, required this.k});
  final BookPreviewState state;
  final Map<String, Object?> req;
  final double k;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final kk = context.k;
    final p = state.preview;
    final err = state.error;
    if (p == null && err == null) return const SizedBox.shrink();
    if (p == null) return ErrorNote(code: optCode(err!), message: err.message);
    final type = '${req['type']}';
    final stop = type == 'stop_market' || type == 'stop_limit';
    final total = numOr(req['qty']);
    final price = numOf(req['price']);
    Widget line(String key, String value, {Color? tone, String? sub, bool strong = false}) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              key,
              style: context.text.caption.copyWith(color: kk.fg3, fontWeight: FontWeight.w400),
            ),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  value,
                  textAlign: TextAlign.end,
                  style: context.text.mono(11, weight: strong ? FontWeight.w600 : FontWeight.w500, color: tone ?? (strong ? kk.fg : kk.fg2)),
                ),
                if (sub != null)
                  Text(
                    sub,
                    textAlign: TextAlign.end,
                    style: context.text.caption.copyWith(fontSize: 9.5, color: kk.fg3, fontWeight: FontWeight.w400),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
    final reasons = p.reasons.where((r) => r.code.isNotEmpty).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AnimatedOpacity(
          duration: const Duration(milliseconds: 150),
          opacity: state.loading ? 0.8 : 1,
          child: Container(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
            decoration: BoxDecoration(
              color: kk.surface2.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: kk.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        t('trader.opt.preview.title').toUpperCase(),
                        style: context.text.micro.copyWith(fontSize: 10, color: kk.fg3, letterSpacing: 0.8),
                      ),
                    ),
                    if (p.estimate) Text(t('trader.opt.preview.estimate'), style: context.text.caption.copyWith(fontSize: 9.5, color: kk.fg3)),
                  ],
                ),
                const SizedBox(height: 2),
                if (stop)
                  line(t('trader.opt.bt.pv.onTrigger'), t('trader.opt.bt.pv.nothingHeld'))
                else ...[
                  line(
                    t('trader.opt.bt.pv.fillsNow'),
                    p.estFilled > 0
                        ? t('trader.opt.bt.pv.fillsAt', {
                            'n': qty(p.estFilled),
                            'total': qty(total),
                            'price': p.estAvgPrice != null ? usd(p.estAvgPrice! * k) : '—',
                          })
                        : t('trader.opt.bt.pv.none'),
                    strong: true,
                    tone: p.estFilled > 0 ? null : kk.warn,
                  ),
                  if (p.estResting > 0)
                    line(t('trader.opt.bt.pv.rests'), t('trader.opt.bt.pv.restsAt', {'n': qty(p.estResting), 'price': price != null ? usd(price * k) : '—'})),
                  if ((type != 'limit' || req['tif'] == 'ioc' || req['tif'] == 'fok') && p.estFilled < total)
                    line(t('trader.opt.bt.pv.rest'), t('trader.opt.bt.pv.cancelled', {'n': qty(total - p.estFilled)}), tone: kk.warn),
                ],
                if (p.hasBand && (p.bandMax != null || p.bandMin != null))
                  line(
                    t('trader.opt.bt.pv.band'),
                    p.bandMax != null ? '≤ ${usd(p.bandMax! * k)}' : '≥ ${usd(p.bandMin! * k)}',
                    sub: t('trader.opt.bt.pv.bandSub'),
                  ),
                line(t('trader.opt.bt.pv.fee'), p.fee > 0 ? usd(p.fee) : '0.00'),
                if (p.rebate > 0) line(t('trader.opt.bt.pv.rebate'), '+${usd(p.rebate)}', tone: kk.up, sub: t('trader.opt.bt.pv.rebateSub')),
                if (!stop) ...[
                  Container(height: 0.8, margin: const EdgeInsets.symmetric(vertical: 4), color: kk.line.withValues(alpha: 0.7)),
                  line(t('trader.opt.bt.pv.reserve'), '${usd(p.reserve)} USD', sub: t('trader.opt.bt.pv.reserveSub')),
                ],
                if (p.freeMarginAfter != null)
                  line(t('trader.opt.preview.freeMarginAfter'), usd(p.freeMarginAfter!), tone: p.freeMarginAfter! < 0 ? kk.down : null),
              ],
            ),
          ),
        ),
        for (final r in reasons)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: ErrorNote(code: r.code, message: r.message),
          ),
      ],
    );
  }
}

/// What the last order did: filled, partly filled, resting, not filled; its fills with role and fee / rebate.
class _ResultCard extends ConsumerWidget {
  const _ResultCard({required this.r, required this.k, required this.onClose});
  final BookOrderResult r;
  final double k;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final kk = context.k;
    final o = r.order;
    final fillQty = r.fills.fold<double>(0, (n, f) => n + f.qty);
    final filled = fillQty > 0 ? fillQty : (o?.filled ?? 0);
    final total = o?.qty ?? filled;
    final avg = fillQty > 0 ? r.fills.fold<double>(0, (s, f) => s + f.price * f.qty) / fillQty : null;
    final resting = o != null && o.left > 0 && (o.status == 'working' || o.status == 'partially_filled') ? o.left : 0.0;
    final text = context.text.caption.copyWith(color: kk.fg2, fontWeight: FontWeight.w400);
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 8, 6, 8),
      decoration: BoxDecoration(
        color: kk.surface2.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: kk.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(r.status == 'filled' ? LucideIcons.circleCheckBig : LucideIcons.circleDashed, size: 14, color: r.status == 'filled' ? kk.up : kk.fg3),
              const SizedBox(width: 6),
              Text(
                t('trader.opt.bt.res.title'),
                style: context.text.caption.copyWith(fontWeight: FontWeight.w600, color: kk.fg),
              ),
              const SizedBox(width: 6),
              OrderStatusChip(r.status),
              const Spacer(),
              KIconButton(icon: LucideIcons.x, size: 26, semanticLabel: t('common.close'), onPressed: onClose),
            ],
          ),
          if (filled > 0) Text(t('trader.opt.bt.res.filled', {'n': qty(filled), 'total': qty(total), 'price': avg != null ? usd(avg * k) : '—'}), style: text),
          if (resting > 0) Text(t('trader.opt.bt.res.resting', {'n': qty(resting), 'price': o?.price != null ? usd(o!.price! * k) : '—'}), style: text),
          if (filled == 0 && resting == 0 && r.status != 'working')
            Text(r.reason != null ? optionErrorText(t, r.reason!) : t('trader.opt.bt.res.nothing'), style: text),
          if (r.status == 'working' && o?.trigger != null) Text(t('trader.opt.bt.res.stopArmed'), style: text),
          if (filled > 0 && filled < total && resting == 0)
            Text(t('trader.opt.bt.res.restCancelled', {'n': qty(total - filled)}), style: text.copyWith(color: kk.warn)),
          if (r.fills.isNotEmpty) ...[
            Container(height: 0.8, margin: const EdgeInsets.symmetric(vertical: 6), color: kk.line.withValues(alpha: 0.7)),
            for (final f in r.fills.take(6))
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${qty(f.qty)} @ ${usd(f.price * k)} · ${t.dyn('trader.opt.ord.role.${f.role}', fallback: f.role)}',
                      style: context.text.mono(10.5, color: kk.fg3),
                    ),
                  ),
                  Text(
                    f.rebate > 0 ? '+${usd(f.rebate)}' : (f.fee > 0 ? '−${usd(f.fee)}' : '0.00'),
                    style: context.text.mono(10.5, color: f.rebate > 0 ? kk.up : kk.fg3),
                  ),
                  const SizedBox(width: 4),
                ],
              ),
          ],
          const SizedBox(height: 4),
          KPressable(
            minSize: 30,
            onTap: () {
              ref.optPosView('orders');
              ref.optTab('positions');
            },
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(t('trader.opt.bt.res.viewOrders'), style: context.text.caption.copyWith(color: kk.ember)),
                const SizedBox(width: 3),
                Icon(LucideIcons.arrowUpRight, size: 12, color: kk.ember),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
