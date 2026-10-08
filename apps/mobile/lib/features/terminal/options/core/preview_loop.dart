// Live order previews (web: components/options/preview.tsx usePreview, book-ticket.tsx useBookPreview): the engine's
// answer for the legs in the ticket, Quick trade or the strategy builder, asked 350 ms after any change and again
// every 2.5 s while prices move. While the engine doesn't serve options (404 / 405 / 501) the phone's own estimate
// stands in (`estimate: true`, orders stay blocked on live accounts: "trading soon"). The book preview does the same
// for a single book order and switches the book off when the engine doesn't serve it.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_error.dart';
import '../../core/models.dart' show Metrics;
import '../../core/terminal_controller.dart';
import 'errors.dart';
import 'math.dart';
import 'models.dart';
import 'pricer.dart';
import 'store.dart';

/// One leg as the previews and orders take it.
@immutable
class LegSpec {
  const LegSpec({required this.series, required this.u, required this.right, required this.strike, required this.side, required this.contracts, this.barrier});
  final String series, u;
  final OptionRight right;
  final double strike;
  final String side;
  final int contracts;
  final Map<String, Object?>? barrier;

  Map<String, Object?> toReq() => {'series': series, 'side': side, 'contracts': contracts, 'barrier': ?barrier};

  static LegSpec of(TicketLeg l) =>
      LegSpec(series: l.series, u: l.u, right: l.right, strike: l.strike, side: l.side, contracts: l.contracts, barrier: l.barrier);
}

@immutable
class PreviewState {
  const PreviewState({this.preview, this.loading = false, this.error});
  final OptPreview? preview;
  final bool loading;
  final ApiException? error;
}

/// The client-side estimate of a preview (the engine's maths on the phone).
OptPreview localPreview(OptState s, Metrics m, OptBookView book, List<LegSpec> legs, {String type = 'market', double? limitPremium}) {
  final u = legs.first.u;
  final chain = s.chain != null && s.chain!.underlying == u ? s.chain : null;
  final existing = [
    for (final p in book.positions.where((p) => p.option.underlying == u))
      MarginLeg(right: p.option.right, strike: p.option.strike, qty: (p.buy ? 1 : -1) * p.contracts, iv: s.quoteOf(p.option.series)?.iv ?? 0.1),
  ];
  return estimatePreview(
    underlying: u,
    legs: [
      for (final l in legs)
        EstimateLeg(series: l.series, right: l.right, strike: l.strike, side: l.side, contracts: l.contracts.toDouble(), quote: s.quoteOf(l.series)),
    ],
    type: type,
    limitPremium: limitPremium,
    chain: chain,
    account: (cash: m.balance, margin: m.margin, free: m.free),
    existing: existing,
  );
}

/// A debounced, repeating preview of a set of legs. `update` is called from `build` (it never notifies
/// synchronously); answers arrive through `onChange`.
class PreviewLoop {
  PreviewLoop(this.ref, this.onChange);
  final WidgetRef ref;
  final VoidCallback onChange;

  PreviewState state = const PreviewState();
  String _key = '';
  List<LegSpec> _legs = const [];
  Map<String, Object?> _req = const {};
  Timer? _timer;
  int _gen = 0;
  bool _disposed = false;

  void update(List<LegSpec> legs, {String type = 'market', double? limitPremium, bool enabled = true}) {
    final req = <String, Object?>{
      'legs': [for (final l in legs) l.toReq()],
      'type': type,
      if (type == 'limit' && limitPremium != null) 'limitPremium': limitPremium,
    };
    final key = enabled && legs.isNotEmpty ? jsonEncode(req) : '';
    if (key == _key) return;
    _key = key;
    _legs = legs;
    _req = req;
    _timer?.cancel();
    final gen = ++_gen;
    if (key.isEmpty) {
      state = const PreviewState();
      return;
    }
    _timer = Timer(const Duration(milliseconds: 350), () => unawaited(_run(gen)));
  }

  void _notify() {
    if (!_disposed) onChange();
  }

  Future<void> _run(int gen) async {
    if (_disposed || gen != _gen) return;
    state = PreviewState(preview: state.preview, loading: true);
    _notify();
    final api = ref.read(optionsApiProvider);
    final legs = _legs;
    final type = '${_req['type']}';
    final limit = numOf(_req['limitPremium']);
    OptPreview? p;
    ApiException? err;
    if (api == null) {
      p = _local(legs, type, limit);
    } else {
      try {
        p = await api.preview(_req);
      } on ApiException catch (e) {
        if (isLaunchingSoon(e)) {
          p = _estimate(_local(legs, type, limit));
        } else {
          err = e;
        }
      }
    }
    if (_disposed || gen != _gen) return;
    if (p != null) ref.read(optionsProvider.notifier).setTradingSoon(p.estimate);
    state = PreviewState(preview: p, error: err);
    _notify();
    _timer = Timer(const Duration(milliseconds: 2500), () => unawaited(_run(gen)));
  }

  OptPreview _local(List<LegSpec> legs, String type, double? limit) =>
      localPreview(ref.read(optionsProvider), ref.read(terminalProvider).metrics, ref.read(optBookProvider), legs, type: type, limitPremium: limit);

  static OptPreview _estimate(OptPreview p) => p.estimate
      ? p
      : OptPreview(
          ok: p.ok,
          reasons: p.reasons,
          legs: p.legs,
          netPremium: p.netPremium,
          commission: p.commission,
          marginBefore: p.marginBefore,
          marginAfter: p.marginAfter,
          freeMarginAfter: p.freeMarginAfter,
          cashAfter: p.cashAfter,
          maxProfit: p.maxProfit,
          maxLoss: p.maxLoss,
          breakevens: p.breakevens,
          greeks: p.greeks,
          estimate: true,
        );

  void dispose() {
    _disposed = true;
    _timer?.cancel();
  }
}

@immutable
class BookPreviewState {
  const BookPreviewState({this.preview, this.loading = false, this.error});
  final BookPreview? preview;
  final bool loading;
  final ApiException? error;
}

/// The book preview of a single book order (300 ms after a change, then every 2.5 s).
class BookPreviewLoop {
  BookPreviewLoop(this.ref, this.onChange);
  final WidgetRef ref;
  final VoidCallback onChange;

  BookPreviewState state = const BookPreviewState();
  String _key = '';
  Map<String, Object?>? _req;
  Timer? _timer;
  int _gen = 0;
  bool _disposed = false;

  void update(Map<String, Object?>? req, {bool enabled = true}) {
    final key = enabled && req != null ? jsonEncode(req) : '';
    if (key == _key) return;
    _key = key;
    _req = req;
    _timer?.cancel();
    final gen = ++_gen;
    if (key.isEmpty) {
      state = const BookPreviewState();
      return;
    }
    _timer = Timer(const Duration(milliseconds: 300), () => unawaited(_run(gen)));
  }

  Future<void> _run(int gen) async {
    if (_disposed || gen != _gen || _req == null) return;
    state = BookPreviewState(preview: state.preview, loading: true);
    onChange();
    final api = ref.read(optionsApiProvider);
    if (api == null) return;
    BookPreview? p;
    ApiException? err;
    try {
      p = await api.bookPreview(_req!);
    } on ApiException catch (e) {
      err = e;
      if (bookMissing(e)) ref.read(optionsProvider.notifier).setBookOff();
    }
    if (_disposed || gen != _gen) return;
    state = BookPreviewState(preview: p, error: err);
    onChange();
    _timer = Timer(const Duration(milliseconds: 2500), () => unawaited(_run(gen)));
  }

  void dispose() {
    _disposed = true;
    _timer?.cancel();
  }
}
