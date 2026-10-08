// The strategy builder (web: components/options/builder.tsx, a drawer there, a full-height sheet here): templates
// filled around ATM for the selected expiry (long call / put, straddle, strangle, bull call / bear put spread, iron
// condor, butterfly) or custom legs, the payoff at expiry and today (payoff-chart.tsx), the chance of profit, max
// profit / loss, the live preview, and one all-or-nothing order. While the order book is live the strategy trades by
// request for quote (rfq.dart); "To ticket" hands the legs to the order ticket.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/api_error.dart';
import '../../../../core/notifications/notifications.dart';
import '../../../../i18n/i18n.dart';
import '../../../../ui/ui.dart';
import '../../core/terminal_controller.dart';
import '../../widgets/kit.dart';
import '../core/errors.dart';
import '../core/format.dart';
import '../core/math.dart';
import '../core/models.dart';
import '../core/preview_loop.dart';
import '../core/store.dart';
import 'actions.dart';
import 'bits.dart';
import 'nav.dart';
import 'outcome.dart';
import 'rfq.dart';

/// Opens the strategy builder (the header's wand, "Payoff" of a strategy in the ticket, the empty ticket).
Future<void> showStrategyBuilder(BuildContext context) => showKSheet<void>(context, expand: true, builder: (_) => const StrategyBuilder());

/// Payoff shapes of the template cards (40 × 18, zero line at y = 10).
const Map<String, List<Offset>> _glyph = {
  'long_call': [Offset(0, 13), Offset(20, 13), Offset(40, 2)],
  'long_put': [Offset(0, 2), Offset(20, 13), Offset(40, 13)],
  'straddle': [Offset(0, 2), Offset(20, 15), Offset(40, 2)],
  'strangle': [Offset(0, 3), Offset(14, 14), Offset(26, 14), Offset(40, 3)],
  'bull_call': [Offset(0, 14), Offset(14, 14), Offset(26, 5), Offset(40, 5)],
  'bear_put': [Offset(0, 5), Offset(14, 5), Offset(26, 14), Offset(40, 14)],
  'iron_condor': [Offset(0, 15), Offset(8, 15), Offset(15, 6), Offset(25, 6), Offset(32, 15), Offset(40, 15)],
  'butterfly': [Offset(0, 13), Offset(13, 13), Offset(20, 3), Offset(27, 13), Offset(40, 13)],
};

class _BLeg {
  _BLeg({required this.id, required this.right, required this.strikeLabel, required this.side, required this.contracts});
  final int id;
  String right, strikeLabel, side;
  int contracts;
}

class StrategyBuilder extends ConsumerStatefulWidget {
  const StrategyBuilder({super.key});

  @override
  ConsumerState<StrategyBuilder> createState() => _StrategyBuilderState();
}

class _StrategyBuilderState extends ConsumerState<StrategyBuilder> {
  String _tpl = 'straddle';
  int _width = 1, _mult = 1;
  List<_BLeg> _legs = [];
  bool _seeded = false, _busy = false, _houseRoute = false;
  String _chainKey = '', _legKey = '';
  int _uid = 0;
  ({String code, String message})? _err;
  late final PreviewLoop _preview = PreviewLoop(ref, () {
    if (mounted) setState(() {});
  });

  @override
  void dispose() {
    _preview.dispose();
    super.dispose();
  }

  void _apply(String id, int w, int n, OptionChain c) {
    _legs = [
      for (final l in templateLegs(id, c, w, n)) _BLeg(id: _uid++, right: l.right, strikeLabel: l.row.strikeLabel, side: l.side, contracts: l.contracts),
    ];
  }

  void _seed(OptionChain chain, List<TicketLeg> ticketLegs) {
    if (_seeded) return;
    _seeded = true;
    _chainKey = '${chain.underlying}|${chain.expiry}';
    final mine = ticketLegs.where((l) => l.u == chain.underlying && l.expiry == chain.expiry).toList();
    if (mine.isNotEmpty) {
      _legs = [for (final l in mine) _BLeg(id: _uid++, right: l.right, strikeLabel: l.strikeLabel, side: l.side, contracts: l.contracts)];
      _tpl = detectTemplate([for (final l in mine) (right: l.right, side: l.side, strike: l.strike, contracts: l.contracts.toDouble())]) ?? 'custom';
    } else {
      _apply('straddle', 1, 1, chain);
    }
  }

  /// Another expiry: keep the strategy, each leg on the nearest listed strike.
  void _follow(OptionChain chain) {
    final key = '${chain.underlying}|${chain.expiry}';
    if (key == _chainKey) return;
    _chainKey = key;
    if (_tpl != 'custom') {
      _apply(_tpl, _width, _mult, chain);
      return;
    }
    for (final l in _legs) {
      if (chain.rows.any((r) => r.strikeLabel == l.strikeLabel) || chain.rows.isEmpty) continue;
      final k = double.tryParse(l.strikeLabel) ?? 0;
      var best = chain.rows.first;
      for (final r in chain.rows) {
        if ((r.strike - k).abs() < (best.strike - k).abs()) best = r;
      }
      l.strikeLabel = best.strikeLabel;
    }
  }

  Future<void> _place(OptionChain chain, List<({_BLeg l, OptionChainRow row, OptionQuote q})> resolved, String name) async {
    final t = context.t;
    final api = ref.read(optionsApiProvider);
    if (api == null) return;
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      await api.order({
        'legs': [
          for (final x in resolved) {'series': x.q.code, 'side': x.l.side, 'contracts': x.l.contracts},
        ],
        'type': 'market',
        'clientOrderId': clientOrderId('stg'),
      });
      if (!mounted) return;
      KHaptics.success();
      optToast(
        ref,
        NotificationKind.success,
        t('trader.opt.toast.strategyFilled', {'name': name}),
        description: '${chain.underlying} · ${expiryLabel(chain.expiry, t.locale)} · ${t('trader.opt.ticket.strategy', {'count': resolved.length})}',
      );
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      KHaptics.error();
      setState(() {
        _busy = false;
        _err = (code: optCode(e), message: e.message);
      });
      if (!needsOnboarding(e.code)) optToast(ref, NotificationKind.error, t('trader.opt.toast.rejected'), description: '$name · ${errText(t, e)}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final s = ref.watch(optionsProvider);
    final chain = s.chainOnScreen;
    final readOnly = ref.watch(terminalProvider.select((x) => x.readOnly));
    final live = ref.watch(terminalProvider.select((x) => x.account?.live ?? false));
    final title = Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Row(
        children: [
          Icon(LucideIcons.wand2, size: 16, color: k.ember),
          const SizedBox(width: 8),
          Text(t('trader.opt.builder.title'), style: context.text.headline),
          const SizedBox(width: 8),
          OptAvatar(s.u, size: 13),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              '${s.u} · ${s.expiry != null ? expiryLabel(s.expiry!, t.locale) : '—'}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: context.text.caption.copyWith(color: k.fg3),
            ),
          ),
        ],
      ),
    );
    if (chain == null) {
      _preview.update(const []);
      return Column(
        children: [
          title,
          Expanded(
            child: Center(
              child: Text(t('trader.opt.loadingChain'), style: context.text.caption.copyWith(color: k.fg3)),
            ),
          ),
        ],
      );
    }
    _seed(chain, s.ticket.legs);
    _follow(chain);
    final rows = chain.rows;
    final resolved = <({_BLeg l, OptionChainRow row, OptionQuote q})>[];
    for (final l in _legs) {
      final row = rows.where((r) => r.strikeLabel == l.strikeLabel).firstOrNull;
      final q = row?.of(l.right);
      if (row != null && q != null) resolved.add((l: l, row: row, q: q));
    }
    final legKey = resolved.map((x) => '${x.q.code}:${x.l.side}:${x.l.contracts}').join('|');
    if (legKey != _legKey) {
      _legKey = legKey;
      _houseRoute = false;
    }
    final bookLiveRaw = s.isBookLive;
    final book = bookLiveRaw && !_houseRoute;
    final usdU = usdPerUnitOf(chain);
    final pay = [
      for (final x in resolved)
        PayLeg(right: x.l.right, strike: x.row.strike, side: x.l.side, contracts: x.l.contracts.toDouble(), premium: fillOf(x.q, x.l.side), iv: x.q.iv),
    ];
    _preview.update([
      for (final x in resolved) LegSpec(series: x.q.code, u: s.u, right: x.l.right, strike: x.row.strike, side: x.l.side, contracts: x.l.contracts),
    ]);
    final pv = _preview.state.preview;
    final now = DateTime.now().millisecondsSinceEpoch;
    final years = math.max(1 / 365 / 24, (chain.cutMs - now) / (365 * 86400000));
    final atmIv = rows.isEmpty ? 0.1 : (rows[atmIndex(chain)].call?.iv ?? 0.1);
    final spot = chain.spot?.mid ?? 0;
    final pop = probProfit(pay, usdU, chain.atmStrike ?? spot, atmIv, years);
    final name = _tpl == 'custom' ? t('trader.opt.tpl.custom.name') : t.dyn('trader.opt.tpl.$_tpl.name', fallback: _tpl);
    final dup = {for (final x in resolved) x.q.code}.length != resolved.length;
    final blocked = readOnly || _busy || resolved.isEmpty || dup || pv == null || !pv.ok || (pv.estimate && live);
    void edit(_BLeg l, void Function() f) => setState(() {
      _tpl = 'custom';
      f();
    });
    final head = context.text.micro.copyWith(fontSize: 10.5, color: k.fg3, letterSpacing: 0.8);

    return Column(
      children: [
        title,
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 16),
            children: [
              Row(
                children: [
                  Expanded(child: Text(t('trader.opt.builder.templates').toUpperCase(), style: head)),
                  KPressable(
                    minSize: 32,
                    semanticLabel: t('trader.opt.expiries'),
                    onTap: () =>
                        showKPicker<String>(
                          context,
                          title: t('trader.opt.expiries'),
                          selected: s.expiry,
                          options: [
                            for (final e in s.expiries)
                              KPickOption(e.date, '${expiryLabel(e.date, t.locale)} · ${math.max(0, ((e.cutMs - now) / 86400000).floor())}D'),
                          ],
                        ).then((v) {
                          if (v != null) ref.read(optionsProvider.notifier).selectExpiry(v);
                        }),
                    child: Container(
                      height: 28,
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      decoration: BoxDecoration(
                        color: k.surface2,
                        borderRadius: BorderRadius.circular(7),
                        border: Border.all(color: k.line),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(s.expiry != null ? expiryLabel(s.expiry!, t.locale) : '—', style: context.text.caption.copyWith(color: k.fg2)),
                          const SizedBox(width: 4),
                          Icon(LucideIcons.chevronDown, size: 12, color: k.fg3),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 6,
                crossAxisSpacing: 6,
                childAspectRatio: 2.25,
                children: [
                  for (final id in strategyTemplates)
                    KPressable(
                      onTap: () => setState(() {
                        _tpl = id;
                        _apply(id, _width, _mult, chain);
                      }),
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: _tpl == id ? k.emberSoft.withValues(alpha: 0.6) : k.surface2.withValues(alpha: 0.4),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: _tpl == id ? k.ember.withValues(alpha: 0.5) : k.line),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SizedBox(width: 40, height: 18, child: CustomPaint(painter: _GlyphPainter(_glyph[id]!, _tpl == id ? k.ember : k.gold, k.fg3))),
                            const SizedBox(height: 3),
                            Text(
                              t.dyn('trader.opt.tpl.$id.name', fallback: id),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: context.text.caption.copyWith(fontWeight: FontWeight.w600, color: k.fg),
                            ),
                            Text(
                              t.dyn('trader.opt.tpl.$id.hint', fallback: ''),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: context.text.caption.copyWith(fontSize: 10, color: k.fg3, fontWeight: FontWeight.w400),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(t('trader.opt.builder.width').toUpperCase(), style: head),
                        const SizedBox(height: 4),
                        TStepper(
                          value: '$_width',
                          step: 1,
                          min: 1,
                          max: 10,
                          decimals: 0,
                          semanticLabel: t('trader.opt.builder.width'),
                          onChanged: (v) => setState(() {
                            _width = math.max(1, math.min(10, (double.tryParse(v) ?? 1).round()));
                            if (_tpl != 'custom') _apply(_tpl, _width, _mult, chain);
                          }),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(t('trader.opt.builder.size').toUpperCase(), style: head),
                        const SizedBox(height: 4),
                        TStepper(
                          value: '$_mult',
                          step: 1,
                          min: 1,
                          max: 100,
                          decimals: 0,
                          semanticLabel: t('trader.opt.builder.size'),
                          onChanged: (v) => setState(() {
                            final n = math.max(1, math.min(100, (double.tryParse(v) ?? 1).round()));
                            if (_tpl != 'custom') {
                              _mult = n;
                              _apply(_tpl, _width, n, chain);
                            } else {
                              for (final l in _legs) {
                                l.contracts = math.max(1, (l.contracts / math.max(1, _mult) * n).round());
                              }
                              _mult = n;
                            }
                          }),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Text(t('trader.opt.builder.legs').toUpperCase(), style: head),
                  if (_tpl == 'custom') ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(color: k.surface3, borderRadius: BorderRadius.circular(4)),
                      child: Text(t('trader.opt.tpl.custom.name'), style: context.text.caption.copyWith(fontSize: 9.5, color: k.fg3)),
                    ),
                  ],
                  const Spacer(),
                  KTextButton(
                    label: '+ ${t('trader.opt.builder.addLeg')}',
                    color: k.fg2,
                    onPressed: _legs.length >= 8 || rows.isEmpty
                        ? null
                        : () => setState(() {
                            _tpl = 'custom';
                            _legs = [..._legs, _BLeg(id: _uid++, right: 'call', strikeLabel: rows[atmIndex(chain)].strikeLabel, side: 'buy', contracts: _mult)];
                          }),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: k.line),
                ),
                child: Column(
                  children: [
                    for (final l in _legs) _legRow(context, l, rows, edit),
                    if (_legs.isEmpty)
                      Padding(
                        padding: const EdgeInsets.all(14),
                        child: Text(
                          t('trader.opt.builder.noLegs'),
                          textAlign: TextAlign.center,
                          style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                        ),
                      ),
                  ],
                ),
              ),
              if (dup)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(t('trader.opt.builder.duplicate'), style: context.text.caption.copyWith(color: k.warn)),
                ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: k.surface.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: k.line),
                ),
                child: PayoffChart(
                  legs: pay,
                  usdPerUnit: usdU,
                  spot: spot,
                  u: s.u,
                  cutAtMs: chain.cutMs.toDouble(),
                  digits: chain.digits,
                  breakevens: pv?.breakevens ?? const [],
                  sigmaT: atmIv * math.sqrt(years),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  for (final f in [
                    (t('trader.opt.builder.pop'), pct(pop, 0), k.fg),
                    (t('trader.opt.preview.maxProfit'), pv == null ? '—' : (pv.maxProfit == null ? t('trader.opt.unlimited') : usd(pv.maxProfit!)), k.up),
                    (t('trader.opt.preview.maxLoss'), pv == null ? '—' : (pv.maxLoss == null ? t('trader.opt.unlimited') : usd(pv.maxLoss!)), k.down),
                  ]) ...[
                    if (f.$1 != t('trader.opt.builder.pop')) const SizedBox(width: 6),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
                        decoration: BoxDecoration(
                          color: k.surface2.withValues(alpha: 0.4),
                          borderRadius: BorderRadius.circular(7),
                          border: Border.all(color: k.line),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              f.$1.toUpperCase(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: context.text.micro.copyWith(fontSize: 9.5, color: k.fg3),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              f.$2,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: context.text.mono(13, weight: FontWeight.w600, color: f.$3),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 10),
              PreviewSummary(state: _preview.state, digits: chain.digits),
              if (bookLiveRaw && _houseRoute) ...[const SizedBox(height: 10), const HouseRouteNote()],
              if (book && !readOnly) ...[
                const SizedBox(height: 10),
                RfqPanel(
                  legs: [for (final x in resolved) (series: x.q.code, side: x.l.side, contracts: x.l.contracts)],
                  disabled: dup || resolved.isEmpty,
                  onEzymexQuoted: () => setState(() => _houseRoute = true),
                  onDone: () => Navigator.of(context).pop(),
                ),
              ],
              if (_err != null) ...[const SizedBox(height: 10), ErrorNote(code: _err!.code, message: _err!.message)],
              const SizedBox(height: 10),
              Text(
                t('trader.opt.builder.note'),
                style: context.text.caption.copyWith(fontSize: 10.5, color: k.fg3, fontWeight: FontWeight.w400, height: 1.5),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
          decoration: BoxDecoration(
            color: k.surface2.withValues(alpha: 0.6),
            border: Border(top: BorderSide(color: k.line)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                book ? t('trader.opt.rfq.builderNote') : t('trader.opt.builder.atomic'),
                style: context.text.caption.copyWith(fontSize: 11, color: k.fg3, fontWeight: FontWeight.w400),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: KButton(
                      label: t('trader.opt.builder.toTicket'),
                      icon: LucideIcons.arrowRightLeft,
                      variant: KButtonVariant.surface,
                      size: KButtonSize.sm,
                      expand: true,
                      onPressed: resolved.isEmpty
                          ? null
                          : () {
                              ref.read(optionsProvider.notifier).setLegs([
                                for (final x in resolved)
                                  TicketLeg(
                                    id: '',
                                    series: x.q.code,
                                    u: s.u,
                                    expiry: chain.expiry,
                                    right: x.l.right,
                                    strike: x.row.strike,
                                    strikeLabel: x.l.strikeLabel,
                                    side: x.l.side,
                                    contracts: x.l.contracts,
                                  ),
                              ]);
                              ref.read(optionsProvider.notifier).setPrefs((p) => p.copyWith(panel: 'ticket'));
                              ref.optTab('trade');
                              optToast(
                                ref,
                                NotificationKind.neutral,
                                t('trader.opt.builder.sentToTicket'),
                                description: t('trader.opt.ticket.strategy', {'count': resolved.length}),
                              );
                              Navigator.of(context).pop();
                            },
                    ),
                  ),
                  if (!book && !readOnly) ...[
                    const SizedBox(width: 8),
                    Expanded(
                      child: KButton(
                        label: _busy ? t('trader.opt.ticket.sending') : (s.tradingSoon && live ? t('trader.opt.ticket.soon') : t('trader.opt.builder.place')),
                        icon: LucideIcons.send,
                        size: KButtonSize.sm,
                        expand: true,
                        loading: _busy,
                        onPressed: blocked ? null : () => unawaited(_place(chain, resolved, name)),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _legRow(BuildContext context, _BLeg l, List<OptionChainRow> rows, void Function(_BLeg, void Function()) edit) {
    final t = context.t;
    final k = context.k;
    final row = rows.where((r) => r.strikeLabel == l.strikeLabel).firstOrNull;
    final q = row?.of(l.right);
    final price = q == null ? 0.0 : (l.side == 'buy' ? q.askUsd : q.bidUsd);
    return Container(
      padding: const EdgeInsets.fromLTRB(6, 6, 2, 6),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: k.line.withValues(alpha: 0.6))),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 58,
            child: OptSeg<String>(
              height: 26,
              values: const ['buy', 'sell'],
              labels: [t('trader.opt.b'), t('trader.opt.s')],
              tones: const [1, -1],
              selected: l.side,
              onChanged: (v) => edit(l, () => l.side = v),
            ),
          ),
          const SizedBox(width: 4),
          SizedBox(
            width: 54,
            child: OptSeg<String>(
              height: 26,
              values: const ['call', 'put'],
              labels: const ['C', 'P'],
              selected: l.right,
              onChanged: (v) => edit(l, () => l.right = v),
            ),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: KPressable(
              minSize: 32,
              semanticLabel: t('trader.opt.col.strike'),
              onTap: () async {
                final v = await showKPicker<String>(
                  context,
                  title: t('trader.opt.col.strike'),
                  selected: l.strikeLabel,
                  options: [for (final r in rows) KPickOption(r.strikeLabel, r.strikeLabel)],
                );
                if (v != null && mounted) edit(l, () => l.strikeLabel = v);
              },
              child: Container(
                height: 28,
                padding: const EdgeInsets.symmetric(horizontal: 6),
                decoration: BoxDecoration(
                  color: k.surface2,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: k.line),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(l.strikeLabel, textDirection: TextDirection.ltr, style: context.text.mono(11.5)),
                    ),
                    Icon(LucideIcons.chevronDown, size: 12, color: k.fg3),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 4),
          SizedBox(
            width: 82,
            child: TStepper(
              height: 28,
              value: '${l.contracts}',
              step: 1,
              min: 1,
              decimals: 0,
              semanticLabel: t('trader.opt.ticket.contracts'),
              onChanged: (v) => edit(l, () => l.contracts = math.max(1, (double.tryParse(v) ?? 1).round())),
            ),
          ),
          SizedBox(
            width: 52,
            child: Flash(
              value: price,
              child: Text(
                price > 0 ? usd(price) : '—',
                textAlign: TextAlign.end,
                style: context.text.mono(11, color: l.side == 'buy' ? k.up : k.down),
              ),
            ),
          ),
          KIconButton(
            icon: LucideIcons.x,
            size: 28,
            semanticLabel: t('trader.opt.ticket.removeLeg'),
            onPressed: () => setState(() {
              _tpl = 'custom';
              _legs = _legs.where((x) => x.id != l.id).toList();
            }),
          ),
        ],
      ),
    );
  }
}

class _GlyphPainter extends CustomPainter {
  _GlyphPainter(this.pts, this.color, this.zero);
  final List<Offset> pts;
  final Color color, zero;

  @override
  void paint(Canvas canvas, Size size) {
    dashLine(canvas, const Offset(0, 10), Offset(size.width, 10), Paint()..color = zero.withValues(alpha: 0.5), on: 2, off: 2);
    final p = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (final o in pts.skip(1)) {
      p.lineTo(o.dx, o.dy);
    }
    canvas.drawPath(
      p,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_GlyphPainter old) => old.color != color;
}

/// The payoff of a set of legs (web payoff-chart.tsx): P&L at expiry and today across prices around spot, profit /
/// loss areas, spot, strikes and breakevens; a finger shows the P&L at that price.
class PayoffChart extends StatefulWidget {
  const PayoffChart({
    super.key,
    required this.legs,
    required this.usdPerUnit,
    required this.spot,
    required this.u,
    required this.cutAtMs,
    required this.digits,
    required this.breakevens,
    this.sigmaT = 0.03,
    this.height = 210,
  });
  final List<PayLeg> legs;
  final double usdPerUnit, spot, cutAtMs, sigmaT, height;
  final String u;
  final int digits;
  final List<double> breakevens;

  @override
  State<PayoffChart> createState() => _PayoffChartState();
}

class _PayoffChartState extends State<PayoffChart> {
  double? _hoverX;

  ({List<double> xs, List<double> exp, List<double>? today, double lo, double hi, double ymin, double ymax})? _data() {
    final legs = widget.legs, spot = widget.spot, usd = widget.usdPerUnit;
    if (legs.isEmpty || !(spot > 0) || !(usd > 0)) return null;
    final ks = legs.map((l) => l.strike);
    final span = [spot * widget.sigmaT * 2.6, ...ks.map((x) => (x - spot).abs() * 1.5), spot * 0.004].reduce(math.max);
    final lo = math.max(spot * 0.2, spot - span), hi = spot + span;
    const n = 120;
    final xs = [for (var i = 0; i <= n; i++) lo + (hi - lo) * i / n, ...ks.where((x) => x > lo && x < hi)]..sort();
    final now = DateTime.now().millisecondsSinceEpoch.toDouble();
    final exp = [for (final x in xs) payoffAt(legs, x, usd)];
    final today = widget.cutAtMs > now ? [for (final x in xs) payoffNow(legs, x, usd, widget.u, widget.cutAtMs, atMs: now)] : null;
    final all = [...exp, ...?today, 0.0];
    var ymin = all.reduce(math.min), ymax = all.reduce(math.max);
    final pad = math.max(1e-9, (ymax - ymin) * 0.12);
    ymin -= pad;
    ymax += pad;
    return (xs: xs, exp: exp, today: today, lo: lo, hi: hi, ymin: ymin, ymax: ymax);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final d = _data();
    if (d == null) {
      return SizedBox(
        height: widget.height,
        child: Center(
          child: Text(t('trader.opt.payoff.empty'), style: context.text.caption.copyWith(color: k.fg3)),
        ),
      );
    }
    return LayoutBuilder(
      builder: (context, c) {
        const l = 8.0, r = 58.0;
        double priceAt(double x) => d.lo + (x - l) / (c.maxWidth - l - r) * (d.hi - d.lo);
        final hx = _hoverX;
        final hp = hx == null ? null : priceAt(hx).clamp(d.lo, d.hi);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Stack(
              children: [
                GestureDetector(
                  onPanStart: (e) => setState(() => _hoverX = e.localPosition.dx),
                  onPanUpdate: (e) => setState(() => _hoverX = e.localPosition.dx),
                  onPanEnd: (_) => setState(() => _hoverX = null),
                  onTapDown: (e) => setState(() => _hoverX = e.localPosition.dx),
                  onTapUp: (_) => setState(() => _hoverX = null),
                  child: Semantics(
                    label: t('trader.opt.payoff.aria'),
                    child: CustomPaint(
                      size: Size(c.maxWidth, widget.height),
                      painter: _PayoffPainter(
                        d: d,
                        legs: widget.legs,
                        spot: widget.spot,
                        bes: widget.breakevens,
                        digits: widget.digits,
                        hoverPrice: hp,
                        k: k,
                        text: context.text,
                      ),
                    ),
                  ),
                ),
                if (hp != null)
                  Positioned(
                    top: 4,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(8, 4, 8, 4),
                      decoration: BoxDecoration(
                        color: k.surface2,
                        borderRadius: BorderRadius.circular(7),
                        border: Border.all(color: k.lineTop),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(px(hp, widget.digits), style: context.text.mono(10.5, weight: FontWeight.w600)),
                          Text(
                            '${t('trader.opt.payoff.atExpiry')} ${moneySigned(payoffAt(widget.legs, hp, widget.usdPerUnit))}',
                            style: context.text.mono(10, color: k.fg2),
                          ),
                          if (d.today != null)
                            Text(
                              '${t('trader.opt.payoff.today')} ${moneySigned(payoffNow(widget.legs, hp, widget.usdPerUnit, widget.u, widget.cutAtMs))}',
                              style: context.text.mono(10, color: k.fg2),
                            ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(width: 12, height: 2, color: k.gold),
                const SizedBox(width: 4),
                Text(
                  t('trader.opt.payoff.atExpiry'),
                  style: context.text.caption.copyWith(fontSize: 10, color: k.fg3, fontWeight: FontWeight.w400),
                ),
                if (d.today != null) ...[
                  const SizedBox(width: 12),
                  SizedBox(width: 12, height: 2, child: CustomPaint(painter: _DashH(k.fg2))),
                  const SizedBox(width: 4),
                  Text(
                    t('trader.opt.payoff.today'),
                    style: context.text.caption.copyWith(fontSize: 10, color: k.fg3, fontWeight: FontWeight.w400),
                  ),
                ],
              ],
            ),
          ],
        );
      },
    );
  }
}

class _DashH extends CustomPainter {
  _DashH(this.c);
  final Color c;

  @override
  void paint(Canvas canvas, Size size) => dashLine(
    canvas,
    Offset(0, size.height / 2),
    Offset(size.width, size.height / 2),
    Paint()
      ..color = c
      ..strokeWidth = 1.5,
  );

  @override
  bool shouldRepaint(_DashH old) => old.c != c;
}

class _PayoffPainter extends CustomPainter {
  _PayoffPainter({
    required this.d,
    required this.legs,
    required this.spot,
    required this.bes,
    required this.digits,
    required this.hoverPrice,
    required this.k,
    required this.text,
  });
  final ({List<double> xs, List<double> exp, List<double>? today, double lo, double hi, double ymin, double ymax}) d;
  final List<PayLeg> legs;
  final double spot;
  final List<double> bes;
  final int digits;
  final double? hoverPrice;
  final KTokens k;
  final KText text;

  @override
  void paint(Canvas canvas, Size size) {
    const l = 8.0, r = 58.0, t = 12.0, b = 22.0;
    final iw = size.width - l - r, ih = size.height - t - b;
    double x(double v) => l + (v - d.lo) / (d.hi - d.lo) * iw;
    double y(double v) => t + (1 - (v - d.ymin) / (d.ymax - d.ymin)) * ih;
    final y0 = y(0);
    final line = Path();
    for (var i = 0; i < d.xs.length; i++) {
      i == 0 ? line.moveTo(x(d.xs[i]), y(d.exp[i])) : line.lineTo(x(d.xs[i]), y(d.exp[i]));
    }
    final area = Path.from(line)
      ..lineTo(x(d.xs.last), y0)
      ..lineTo(x(d.xs.first), y0)
      ..close();
    canvas.save();
    canvas.clipRect(Rect.fromLTRB(l, t, l + iw, y0.clamp(t, t + ih)));
    canvas.drawPath(area, Paint()..color = k.up.withValues(alpha: 0.14));
    canvas.restore();
    canvas.save();
    canvas.clipRect(Rect.fromLTRB(l, y0.clamp(t, t + ih), l + iw, t + ih));
    canvas.drawPath(area, Paint()..color = k.down.withValues(alpha: 0.14));
    canvas.restore();
    dashLine(canvas, Offset(l, y0), Offset(l + iw, y0), Paint()..color = k.fg3.withValues(alpha: 0.6), on: 2);
    for (final s in {for (final g in legs) g.strike}) {
      if (s > d.lo && s < d.hi) dashLine(canvas, Offset(x(s), t), Offset(x(s), t + ih), Paint()..color = k.fg3.withValues(alpha: 0.35), on: 2, off: 4);
    }
    for (final be in bes) {
      if (be > d.lo && be < d.hi) dashLine(canvas, Offset(x(be), t), Offset(x(be), t + ih), Paint()..color = k.ember.withValues(alpha: 0.7), on: 1.5, off: 2.5);
    }
    if (d.today != null) {
      for (var i = 1; i < d.xs.length; i++) {
        if (i % 2 == 0) continue;
        canvas.drawLine(
          Offset(x(d.xs[i - 1]), y(d.today![i - 1])),
          Offset(x(d.xs[i]), y(d.today![i])),
          Paint()
            ..color = k.fg2
            ..strokeWidth = 1.5,
        );
      }
    }
    canvas.drawPath(
      line,
      Paint()
        ..color = k.gold
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeJoin = StrokeJoin.round,
    );
    if (spot > d.lo && spot < d.hi) {
      canvas.drawLine(
        Offset(x(spot), t),
        Offset(x(spot), t + ih),
        Paint()
          ..color = k.ember.withValues(alpha: 0.6)
          ..strokeWidth = 1,
      );
    }
    void label(String s, Offset at, {Color? color, TextAlign align = TextAlign.left}) {
      final tp = TextPainter(
        text: TextSpan(
          text: s,
          style: text.mono(9.5, color: color ?? k.fg3),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      final dx = align == TextAlign.center ? tp.width / 2 : (align == TextAlign.right ? tp.width : 0.0);
      tp.paint(canvas, at - Offset(dx, tp.height / 2));
    }

    for (final v in [d.ymax - (d.ymax - d.ymin) * 0.1, 0.0, d.ymin + (d.ymax - d.ymin) * 0.1]) {
      label(moneySigned(v, 0), Offset(l + iw + 6, y(v)), color: v > 0 ? k.up : (v < 0 ? k.down : k.fg3));
    }
    label(px(d.lo, digits), Offset(l, size.height - 8));
    label(px(spot, digits), Offset(x(spot), size.height - 8), color: k.ember, align: TextAlign.center);
    label(px(d.hi, digits), Offset(l + iw, size.height - 8), align: TextAlign.right);
    final h = hoverPrice;
    if (h != null) {
      dashLine(canvas, Offset(x(h), t), Offset(x(h), t + ih), Paint()..color = k.fg2, on: 2, off: 2);
      final i = d.xs.indexWhere((v) => v >= h);
      if (i >= 0) canvas.drawCircle(Offset(x(h), y(d.exp[i])), 3.5, Paint()..color = k.gold);
    }
  }

  @override
  bool shouldRepaint(_PayoffPainter old) => true;
}
