// Strategies on the order book trade by request for quote (web: components/options/rfq.tsx): the legs (sides and
// whole ratios) and a size go out as one RFQ (`POST trade/options/rfq`, open 30 s); the Ezymex market maker answers with
// a firm net bid / ask per strategy unit (valid a few seconds, refreshed after that); accepting
// (`POST …/rfq/{id}/accept {quoteId, side, limitNet}`) fills every leg at once, or nothing. "Buy" trades the strategy
// as built at the ask, "Sell" the reverse at the bid. A barrier leg answers 422 `ezymex_quoted`: the house ticket
// places it. Refusals read in plain words, with "Get a new price" when only the price went stale.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/api_error.dart';
import '../../../../core/notifications/notifications.dart';
import '../../../../i18n/i18n.dart';
import '../../../../ui/ui.dart';
import '../core/api.dart';
import '../core/data.dart';
import '../core/errors.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/pricer.dart';
import '../core/store.dart';
import 'actions.dart';
import 'bits.dart';
import 'book_ticket.dart';

typedef RfqLegSpec = ({String series, String side, int contracts});

class RfqPanel extends ConsumerStatefulWidget {
  const RfqPanel({super.key, required this.legs, this.onDone, this.onEzymexQuoted, this.disabled = false});
  final List<RfqLegSpec> legs;
  final VoidCallback? onDone;
  final VoidCallback? onEzymexQuoted;
  final bool disabled;

  @override
  ConsumerState<RfqPanel> createState() => _RfqPanelState();
}

class _RfqPanelState extends ConsumerState<RfqPanel> {
  /// idle | requesting | live | accepting | expired | done
  String _phase = 'idle';
  Rfq? _rfq;
  RfqQuote? _quote;
  ({String code, String message})? _err;
  String _key = '';
  Timer? _poll, _tick;
  int _gen = 0;

  /// The API of the account on screen (kept for withdrawing the request when the panel leaves).
  OptionsApi? _api;

  ({int qty, List<RfqLeg> legs}) get _spec => toRatios(widget.legs);

  @override
  void dispose() {
    _stopTimers();
    final open = _rfq;
    if (open != null) unawaited(_api?.rfqCancel(open.id));
    super.dispose();
  }

  void _stopTimers() {
    _poll?.cancel();
    _tick?.cancel();
    _poll = _tick = null;
  }

  void _reset() {
    final open = _rfq;
    if (open != null) unawaited(ref.read(optionsApiProvider)?.rfqCancel(open.id));
    _stopTimers();
    _gen++;
    _rfq = null;
    _quote = null;
    _phase = 'idle';
    _err = null;
  }

  void _startPolling() {
    _poll?.cancel();
    final gen = ++_gen;
    _tick ??= Timer.periodic(const Duration(milliseconds: 250), (_) {
      if (mounted) setState(() {});
    });
    Future<void> poll() async {
      final rfq = _rfq;
      final api = ref.read(optionsApiProvider);
      if (rfq == null || api == null || gen != _gen || !mounted || _phase != 'live') return;
      try {
        final r = await api.rfqGet(rfq.id);
        if (!mounted || gen != _gen) return;
        final quotes = [...r.quotes]..sort((a, b) => msOf(b.validUntil).compareTo(msOf(a.validUntil)));
        final st = r.rfq?.status;
        final expired = st == 'expired' || st == 'cancelled' || msOf(r.rfq?.expiresAt ?? rfq.expiresAt) <= DateTime.now().millisecondsSinceEpoch;
        setState(() {
          _quote = quotes.isEmpty ? null : quotes.first;
          if (r.rfq?.note != rfq.note) _rfq = rfq.withNote(r.rfq?.note);
          if (expired) {
            _phase = 'expired';
            _rfq = null;
          }
        });
        if (expired) {
          _stopTimers();
          return;
        }
      } on ApiException {
        // keep polling: a missed answer is not a refusal
      }
      if (gen == _gen && mounted) _poll = Timer(const Duration(milliseconds: 700), () => unawaited(poll()));
    }

    unawaited(poll());
  }

  Future<void> _request() async {
    final api = ref.read(optionsApiProvider);
    if (api == null) return;
    final spec = _spec;
    setState(() {
      _err = null;
      _phase = 'requesting';
      _quote = null;
    });
    try {
      final r = await api.rfq(legs: spec.legs, qty: spec.qty);
      if (!mounted) return;
      if (r == null) {
        setState(() => _phase = 'idle');
        return;
      }
      setState(() {
        _rfq = r;
        _phase = 'live';
      });
      _startPolling();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _phase = 'idle');
      if (bookMissing(e)) {
        ref.read(optionsProvider.notifier).setBookOff();
        return;
      }
      if (e.code == 'ezymex_quoted') widget.onEzymexQuoted?.call();
      setState(() => _err = (code: optCode(e), message: e.message));
    }
  }

  Future<void> _cancel() async {
    final open = _rfq;
    _stopTimers();
    _gen++;
    setState(() {
      _rfq = null;
      _quote = null;
      _phase = 'idle';
    });
    if (open != null) await ref.read(optionsApiProvider)?.rfqCancel(open.id);
  }

  Future<void> _accept(String side, double usdK) async {
    final t = context.t;
    final rfq = _rfq, quote = _quote;
    final api = ref.read(optionsApiProvider);
    if (rfq == null || quote == null || api == null) return;
    final net = side == 'buy' ? quote.ask : quote.bid;
    if (net == null) return;
    final spec = _spec;
    setState(() {
      _phase = 'accepting';
      _err = null;
    });
    try {
      final r = await api.rfqAccept(rfq.id, quoteId: quote.quoteId, side: side, limitNet: net);
      if (!mounted) return;
      _stopTimers();
      setState(() {
        _phase = 'done';
        _rfq = null;
      });
      final filledNet = r.net ?? net;
      final desc = t('trader.opt.rfq.toast.desc', {
        'count': r.fills.isNotEmpty ? r.fills.length : spec.legs.length,
        'price': usd(filledNet.abs() * usdK * spec.qty),
      });
      KHaptics.success();
      optToast(ref, NotificationKind.success, t('trader.opt.rfq.toast.filled'), description: r.settling ? '$desc · ${t('trader.opt.toast.settling')}' : desc);
      widget.onDone?.call();
    } on ApiException catch (e) {
      if (!mounted) return;
      final code = optCode(e);
      setState(() => _err = (code: code, message: e.message));
      if (code == 'rfq_expired') {
        _stopTimers();
        setState(() {
          _phase = 'expired';
          _rfq = null;
          _quote = null;
        });
      } else {
        setState(() => _phase = 'live');
        if (rfqRequotable(code)) {
          setState(() => _quote = null);
          _startPolling();
        }
      }
      if (!needsOnboarding(code) && !rfqRequotable(code)) {
        KHaptics.error();
        optToast(ref, NotificationKind.error, t('trader.opt.toast.rejected'), description: rfqErrorText(t, code, e.message));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final spec = _spec;
    final key = '${spec.qty}|${spec.legs.map((l) => '${l.series}:${l.side}:${l.ratio}').join(',')}';
    if (key != _key) {
      if (_key.isNotEmpty) _reset();
      _key = key;
    }
    final s = ref.watch(optionsProvider);
    _api = ref.watch(optionsApiProvider);
    final units = widget.legs.isEmpty ? (k: 0.0, tick: 0.0, tickUsd: 0.0) : seriesUnits(s, widget.legs.first.series);
    final now = DateTime.now().millisecondsSinceEpoch;
    final quote = _quote;
    final validMs = quote == null ? 0 : msOf(quote.validUntil) - now;
    final rfqLeft = _rfq == null ? 0 : math.max(0, ((msOf(_rfq!.expiresAt) - now) / 1000).ceil());
    Widget sideButton(String side) {
      final net = quote == null ? null : (side == 'buy' ? quote.ask : quote.bid);
      final total = net == null ? null : net * units.k * spec.qty;
      final pays = net != null && (side == 'buy' ? net > 0 : net < 0);
      final buy = side == 'buy';
      final enabled = quote != null && net != null && validMs > 0 && _phase != 'accepting' && !widget.disabled;
      return Expanded(
        child: Opacity(
          opacity: enabled ? 1 : 0.5,
          child: KPressable(
            minSize: 56,
            onTap: enabled ? () => unawaited(_accept(side, units.k)) : null,
            child: Container(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
              decoration: BoxDecoration(color: buy ? k.up : k.down, borderRadius: BorderRadius.circular(12)),
              child: Column(
                crossAxisAlignment: buy ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                children: [
                  Text(
                    (buy ? t('trader.opt.rfq.buy') : t('trader.opt.rfq.sell')).toUpperCase(),
                    style: context.text.micro.copyWith(fontSize: 10, color: Colors.white.withValues(alpha: 0.9), letterSpacing: 1),
                  ),
                  Text(
                    net != null ? usd(net * units.k) : '—',
                    style: context.text.mono(16, weight: FontWeight.w600, color: Colors.white),
                  ),
                  Text(
                    total != null ? t(pays ? 'trader.opt.rfq.youPay' : 'trader.opt.rfq.youGet', {'amount': usd(total.abs())}) : ' ',
                    style: context.text.mono(9.5, color: Colors.white.withValues(alpha: 0.85)),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final err = _err;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: k.surface2.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: k.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(LucideIcons.messagesSquare, size: 14, color: k.ember),
              const SizedBox(width: 6),
              Text(t('trader.opt.rfq.title').toUpperCase(), style: context.text.micro.copyWith(fontSize: 11, color: k.fg2, letterSpacing: 0.8)),
            ],
          ),
          const SizedBox(height: 8),
          for (final l in spec.legs)
            Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Builder(
                builder: (context) {
                  final p = parseSeriesBase(l.series);
                  final buy = l.side == 'buy';
                  return Row(
                    children: [
                      Container(
                        width: 28,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: buy ? k.upSoft : k.downSoft, borderRadius: BorderRadius.circular(3)),
                        child: Text(buy ? t('trader.opt.b') : t('trader.opt.s'), style: context.text.micro.copyWith(fontSize: 9.5, color: buy ? k.up : k.down)),
                      ),
                      const SizedBox(width: 6),
                      Text('${l.ratio}×', style: context.text.mono(11, color: k.fg3)),
                      const SizedBox(width: 4),
                      if (p != null) ...[RightTag(p.right, size: 15), const SizedBox(width: 4)],
                      Expanded(
                        child: Text(
                          p != null ? '${p.underlying} ${p.strikeLabel}' : l.series,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: context.text.mono(11, color: k.fg2),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          Text(
            t('trader.opt.rfq.size', {'n': qty(spec.qty.toDouble())}),
            style: context.text.caption.copyWith(fontSize: 10.5, color: k.fg3, fontWeight: FontWeight.w400),
          ),
          const SizedBox(height: 10),
          if (_phase == 'idle' || _phase == 'expired' || _phase == 'done') ...[
            if (_phase == 'expired')
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Icon(LucideIcons.hourglass, size: 14, color: k.warn),
                    const SizedBox(width: 6),
                    Text(t('trader.opt.rfq.expired'), style: context.text.caption.copyWith(color: k.warn)),
                  ],
                ),
              ),
            KButton(
              label: _phase == 'idle' ? t('trader.opt.rfq.request') : t('trader.opt.rfq.again'),
              icon: _phase == 'idle' ? LucideIcons.messagesSquare : LucideIcons.refreshCw,
              expand: true,
              onPressed: widget.disabled || widget.legs.isEmpty ? null : () => unawaited(_request()),
            ),
            const SizedBox(height: 6),
            Text(
              t('trader.opt.rfq.note'),
              style: context.text.caption.copyWith(fontSize: 10.5, color: k.fg3, fontWeight: FontWeight.w400, height: 1.4),
            ),
          ] else if (_phase == 'requesting' || (_phase == 'live' && quote == null))
            Container(
              constraints: const BoxConstraints(minHeight: 74),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: k.line),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(LucideIcons.refreshCw, size: 14, color: k.fg3),
                      const SizedBox(width: 6),
                      Text(t('trader.opt.rfq.waiting'), style: context.text.caption.copyWith(color: k.fg3)),
                    ],
                  ),
                  if (_rfq?.note != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        _rfq!.note!,
                        textAlign: TextAlign.center,
                        style: context.text.caption.copyWith(fontSize: 10.5, color: k.warn),
                      ),
                    ),
                ],
              ),
            )
          else ...[
            Row(children: [sideButton('sell'), const SizedBox(width: 6), sideButton('buy')]),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: LinearProgressIndicator(
                      minHeight: 4,
                      value: (validMs / 5000).clamp(0, 1).toDouble(),
                      backgroundColor: k.surface3,
                      color: validMs > 1500 ? k.up : k.warn,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  validMs > 0 ? t('trader.opt.rfq.validFor', {'s': (validMs / 1000).toStringAsFixed(1)}) : t('trader.opt.rfq.refreshing'),
                  style: context.text.mono(10.5, color: k.fg3),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${t('trader.opt.rfq.from', {'who': quote?.responder == 'ezymex' || (quote?.responder.startsWith('ezymex') ?? false) ? t('trader.opt.rfq.ezymexMm') : (quote?.responder ?? '—')})} · ${t('trader.opt.rfq.openFor', {'s': rfqLeft})}',
                    style: context.text.caption.copyWith(fontSize: 10.5, color: k.fg3, fontWeight: FontWeight.w400),
                  ),
                ),
                KTextButton(label: t('common.cancel'), color: k.fg3, onPressed: () => unawaited(_cancel())),
              ],
            ),
          ],
          if (err != null) ...[
            const SizedBox(height: 8),
            if (needsOnboarding(err.code))
              ErrorNote(code: err.code, message: err.message)
            else
              _RfqError(
                code: err.code,
                message: err.message,
                live: _phase == 'live' || _phase == 'accepting',
                onNewPrice: () {
                  setState(() => _err = null);
                  _startPolling();
                },
                onAskAgain: () => unawaited(_request()),
              ),
          ],
        ],
      ),
    );
  }
}

class _RfqError extends StatelessWidget {
  const _RfqError({required this.code, required this.message, required this.live, required this.onNewPrice, required this.onAskAgain});
  final String code, message;
  final bool live;
  final VoidCallback onNewPrice, onAskAgain;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final requote = rfqRequotable(code);
    final (Color bg, Color border, Color icon) = code == 'ezymex_quoted'
        ? (k.goldSoft, k.gold.withValues(alpha: 0.35), k.gold)
        : (requote ? (k.warnSoft, k.warn.withValues(alpha: 0.35), k.warn) : (k.downSoft.withValues(alpha: 0.6), k.down.withValues(alpha: 0.3), k.down));
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 1),
                child: Icon(LucideIcons.triangleAlert, size: 14, color: icon),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  rfqErrorText(t, code, message),
                  style: context.text.caption.copyWith(color: k.fg2, fontWeight: FontWeight.w400),
                ),
              ),
            ],
          ),
          if (requote || code == 'rfq_expired') ...[
            const SizedBox(height: 6),
            OptSmallButton(
              icon: LucideIcons.refreshCw,
              label: requote && live ? t('trader.opt.rfq.newPrice') : t('trader.opt.rfq.again'),
              onTap: requote && live ? onNewPrice : onAskAgain,
            ),
          ],
        ],
      ),
    );
  }
}
