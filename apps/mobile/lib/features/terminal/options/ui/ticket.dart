// The option order ticket (web: components/options/ticket.tsx). Plain language first:
//   1. the option picked in the chain, in words (Call / Put switch, the expiry and its countdown),
//   2. SELL (you receive the bid) or BUY (you pay the ask), USD per contract,
//   3. contracts,
//   4. "What happens" once a side is chosen,
//   5. "More order options" (folded): market / limit premium, stop loss / take profit on the premium, a trigger on the
//      underlying, time in force,
//   6. "Details" (folded): the preview numbers,
//   7. the order button with the amount.
// A strategy (several legs, all-or-nothing) is built with "Add leg" or the strategy builder. While the broker's order
// book is live a single option trades with book orders (book_ticket.dart) and a strategy by request for quote
// (rfq.dart); barrier legs stay on the house ticket.
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
import 'book_ticket.dart';
import 'outcome.dart';
import 'rfq.dart';

/// A barrier series carries a suffix after C / P (`…-C-UO1.1800`): Kalks-quoted, never on the order book.
bool isBarrierSeries(String code) => RegExp(r'^[A-Z0-9]{3,12}-\d{8}-[0-9.]+-[CP]-[A-Z0-9._]+$').hasMatch(code);

bool hasBarrierLeg(List<TicketLeg> legs) => legs.any((l) => l.barrier != null || isBarrierSeries(l.series));

/// USD per contract for one unit of premium of a quote, else the chain's.
double usdPerUnitFor(OptionQuote? q, OptionChain? chain) {
  if (q != null && q.ask > 0 && q.askUsd > 0) return q.askUsd / q.ask;
  final k = usdPerUnitOfQuote(q);
  if (k > 0) return k;
  return usdPerUnitOf(chain);
}

/// The cut of a leg's expiry (the expiry list of the underlying on screen, or the chain).
int? cutOfLeg(OptState s, String u, String expiry) {
  if (s.u == u) {
    for (final e in s.expiries) {
      if (e.date == expiry) return e.cutMs;
    }
  }
  if (s.chain?.expiry == expiry && s.chain?.underlying == u) return s.chain!.cutMs;
  return null;
}

class OptionTicketView extends ConsumerStatefulWidget {
  const OptionTicketView({super.key, required this.onAddLeg, required this.onOpenChain, required this.onBuilder, required this.onQuick});
  final VoidCallback onAddLeg, onOpenChain, onBuilder, onQuick;

  @override
  ConsumerState<OptionTicketView> createState() => _OptionTicketViewState();
}

class _OptionTicketViewState extends ConsumerState<OptionTicketView> {
  bool _busy = false;
  bool _more = false;
  bool _houseRoute = false;
  ({String code, String message})? _err;
  String _legKey = '';
  String? _single;
  late final PreviewLoop _preview = PreviewLoop(ref, () {
    if (mounted) setState(() {});
  });

  @override
  void dispose() {
    _preview.dispose();
    super.dispose();
  }

  Future<void> _submit({required Ticket ticket, required double usdPerUnit, required double? limitPremium, required String? u}) async {
    final t = context.t;
    final legs = ticket.legs;
    final single = ticket.single;
    final api = ref.read(optionsApiProvider);
    if (api == null) return;
    final req = <String, Object?>{
      'legs': [for (final l in legs) LegSpec.of(l).toReq()],
      'type': single != null ? ticket.type : 'market',
      'limitPremium': ?limitPremium,
      'clientOrderId': clientOrderId('opt'),
    };
    if (single != null && usdPerUnit > 0) {
      final sl = double.tryParse(ticket.sl) ?? 0;
      final tp = double.tryParse(ticket.tp) ?? 0;
      if (sl > 0) req['sl'] = sl / usdPerUnit;
      if (tp > 0) req['tp'] = tp / usdPerUnit;
    }
    final trig = double.tryParse(ticket.triggerPrice) ?? 0;
    if (ticket.trigger && trig > 0 && u != null) req['trigger'] = {'symbol': u, 'op': ticket.triggerOp, 'price': trig};
    if (ticket.type == 'limit' || req['trigger'] != null) req['tif'] = ticket.tif;
    setState(() {
      _busy = true;
      _err = null;
    });
    final what = single != null
        ? orderWhat(t, side: single.side, n: single.contracts, u: single.u, strikeLabel: single.strikeLabel, right: single.right, expiry: single.expiry)
        : t('trader.opt.ticket.whatCombo', {'n': legs.length, 'u': u ?? ''});
    try {
      final r = await api.order(req);
      if (!mounted) return;
      final placed = r['status'] == 'placed';
      KHaptics.success();
      optToast(ref, NotificationKind.success, placed ? t('trader.opt.toast.placed') : t('trader.opt.toast.filled'), description: what);
      setState(() => _busy = false);
      ref.read(optionsProvider.notifier).afterFill();
    } on ApiException catch (e) {
      if (!mounted) return;
      KHaptics.error();
      setState(() {
        _busy = false;
        _err = (code: optCode(e), message: e.message);
      });
      if (!needsOnboarding(e.code)) optToast(ref, NotificationKind.error, t('trader.opt.toast.rejected'), description: '$what · ${errText(t, e)}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final s = ref.watch(optionsProvider);
    final ctl = ref.read(optionsProvider.notifier);
    final ticket = s.ticket;
    final legs = ticket.legs;
    final single = ticket.single;
    final readOnly = ref.watch(terminalProvider.select((x) => x.readOnly));
    final live = ref.watch(terminalProvider.select((x) => x.account?.live ?? false));
    final legKey = legs.map((l) => '${l.series}:${l.side}:${l.contracts}').join('|');
    if (legKey != _legKey) {
      _legKey = legKey;
      _houseRoute = false;
    }
    if (single?.series != _single) {
      _single = single?.series;
      _err = null;
      if (ticket.type == 'limit' || ticket.sl.isNotEmpty || ticket.tp.isNotEmpty || ticket.trigger) _more = true;
    }
    if (legs.isEmpty) {
      _preview.update(const []);
      return _EmptyTicket(onQuick: widget.onQuick, onOpenChain: widget.onOpenChain, onBuilder: widget.onBuilder);
    }
    final u = legs.first.u;
    final cur = s.underlyingOf(u);
    final chainOfU = s.chain != null && s.chain!.underlying == u ? s.chain : null;
    final digits = s.chain?.digits ?? cur?.digits ?? digitsOf(u);
    final q0 = single == null ? null : s.quoteOf(single.series);
    final usdPerUnit = usdPerUnitFor(q0, s.chain);
    final bookLiveRaw = s.isBookLive;
    final barrierLegs = hasBarrierLeg(legs);
    final book = bookLiveRaw && !barrierLegs && !_houseRoute;
    final spot = chainOfU?.spot?.mid;
    final cutMs = cutOfLeg(s, u, legs.first.expiry);
    final limitUsd = double.tryParse(ticket.limit) ?? 0;
    final limitPremium = ticket.type == 'limit' && single != null && limitUsd > 0 && usdPerUnit > 0 ? limitUsd / usdPerUnit : null;
    final armed = single == null || ticket.armed;
    _preview.update(
      [for (final l in legs) LegSpec.of(l)],
      type: single != null ? ticket.type : 'market',
      limitPremium: limitPremium,
      enabled: armed && !(book && single != null),
    );
    final pv = _preview.state.preview;
    final minC = cur?.minContracts ?? 1, stepC = cur?.contractStep ?? 1, maxC = cur?.maxContracts ?? 100;
    final pipSize = cur?.pipSize ?? math.pow(10, -digits).toDouble();
    double? pipsOf(double amount) => usdPerUnit > 0 && single != null ? amount / single.contracts / usdPerUnit / pipSize : null;
    final blocked =
        !armed ||
        readOnly ||
        _busy ||
        pv == null ||
        !pv.ok ||
        (pv.estimate && live) ||
        (single != null && q0 != null && q0.state != 'open') ||
        (single != null && ticket.type == 'limit' && limitPremium == null);
    final bookLimit = book && single != null && ticket.bookType == 'limit' && limitUsd > 0 && usdPerUnit > 0 ? limitUsd / usdPerUnit : null;
    final pay = [
      for (final l in legs)
        () {
          final q = s.quoteOf(l.series);
          final engine = pv?.legs.where((x) => x.series == l.series).firstOrNull?.price;
          final price = engine != null && engine > 0 ? engine : (q != null ? fillOf(q, l.side, single != null ? (limitPremium ?? bookLimit) : null) : 0.0);
          return PayLeg(right: l.right, strike: l.strike, side: l.side, contracts: l.contracts.toDouble(), premium: price, iv: q?.iv);
        }(),
    ];
    final usdU = single != null
        ? usdPerUnit
        : (usdPerUnitOfQuote(s.quoteOf(legs.first.series)) > 0 ? usdPerUnitOfQuote(s.quoteOf(legs.first.series)) : usdPerUnit);
    final priced = pay.every((p) => p.premium > 0);
    final usePrev = pv != null && !(book && single != null) ? pv : null;
    final marginAdd = usePrev == null ? null : usePrev.marginAfter - usePrev.marginBefore;
    final total = previewTotal(pv);
    final debit = pv == null || pv.netPremium >= 0;
    final rightWord = single?.right == 'call' ? t('trader.opt.call') : t('trader.opt.put');
    final submitLabel = !armed
        ? t('trader.opt.ticket.chooseSide')
        : (single != null
              ? '${single.side == 'buy' ? t('common.buy') : t('common.sell')} ${single.contracts} × ${single.strikeLabel} $rightWord'
              : t('trader.opt.ticket.placeStrategy', {'count': legs.length}));
    final advancedOn = ticket.type == 'limit' || ticket.sl.isNotEmpty || ticket.tp.isNotEmpty || ticket.trigger;
    final hint = Text(
      t('trader.opt.ticket.addHint'),
      style: context.text.caption.copyWith(fontSize: 10.5, color: k.fg3, fontWeight: FontWeight.w400),
    );

    return ListView(
      padding: const EdgeInsets.fromLTRB(10, 10, 10, 24),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                single != null ? t('trader.opt.ticket.single') : t('trader.opt.ticket.strategy', {'count': legs.length}),
                style: context.text.label.copyWith(fontSize: 12.5, fontWeight: FontWeight.w600, color: k.fg2),
              ),
            ),
            if (!readOnly)
              _HeadButton(
                icon: LucideIcons.plus,
                label: t('trader.opt.builder.addLeg'),
                on: ticket.adding,
                onTap: () {
                  final next = !ticket.adding;
                  ctl.setAdding(next);
                  if (next) widget.onAddLeg();
                },
              ),
            if (legs.length > 1) ...[
              const SizedBox(width: 4),
              _HeadButton(icon: LucideIcons.wand2, label: t('trader.opt.ticket.payoff'), onTap: widget.onBuilder),
            ],
            const SizedBox(width: 4),
            KIconButton(icon: LucideIcons.trash2, size: 30, semanticLabel: t('trader.opt.ticket.clear'), onPressed: ctl.clearTicket, filled: true),
          ],
        ),
        const SizedBox(height: 10),
        if (single != null)
          _SelectedOption(leg: single, cutMs: cutMs)
        else
          for (final l in legs)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: _LegRow(leg: l),
            ),
        if (single != null) ...[
          const SizedBox(height: 10),
          _SideButtons(leg: single, armed: ticket.armed, q: q0),
          if (!ticket.armed)
            Container(
              margin: const EdgeInsets.only(top: 6),
              padding: const EdgeInsets.fromLTRB(10, 6, 10, 6),
              decoration: BoxDecoration(color: k.surface2.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(10)),
              child: Column(
                children: [
                  Text(
                    t('trader.opt.ticket.chooseSide'),
                    style: context.text.caption.copyWith(fontWeight: FontWeight.w600, color: k.fg),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    single.right == 'call' ? t('trader.opt.ticket.chooseCall', iso({'u': single.u})) : t('trader.opt.ticket.choosePut', iso({'u': single.u})),
                    textAlign: TextAlign.center,
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 10),
          TFieldRow(
            label: Text(t('trader.opt.ticket.contracts')),
            help: const Explain('contracts', size: 12),
            child: SizedBox(
              width: 132,
              child: TStepper(
                value: '${single.contracts}',
                step: stepC.toDouble(),
                min: minC.toDouble(),
                max: maxC.toDouble(),
                decimals: 0,
                semanticLabel: t('trader.opt.ticket.contracts'),
                onChanged: (v) => ctl.updateLeg(
                  single.id,
                  contracts: clampContracts(double.tryParse(v) ?? minC, min: minC, max: maxC, step: stepC),
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          TQuickStrip<int>(
            options: const [1, 2, 5, 10],
            labels: const ['1', '2', '5', '10'],
            selected: const [1, 2, 5, 10].contains(single.contracts) ? single.contracts : null,
            onPick: (v) => ctl.updateLeg(single.id, contracts: math.min(maxC, v)),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: Text(
                  t('trader.opt.ticket.notional', {'n': qty((cur?.contractSize ?? 0) * single.contracts), 'unit': cur?.contractUnit ?? ''}),
                  style: context.text.caption.copyWith(fontSize: 11, color: k.fg3, fontWeight: FontWeight.w400),
                ),
              ),
              Text(t('trader.opt.ticket.minMax', {'min': minC, 'max': maxC}), style: context.text.mono(11, color: k.fg3)),
            ],
          ),
        ],
        if (armed) ...[
          const SizedBox(height: 10),
          if (priced)
            OutcomeCard(
              u: u,
              legs: pay,
              usdPerUnit: usdU,
              digits: digits,
              cutMs: cutMs,
              spot: spot,
              preview: usePrev,
              commission: commissionOf(chainOfU, pay, usdU, book: book),
              margin: marginAdd,
              loading: _preview.state.loading,
            )
          else
            const OutcomeSkeleton(),
        ],
        const SizedBox(height: 10),
        if (book && single != null) ...[
          BookOrderForm(leg: single),
          const SizedBox(height: 8),
          hint,
        ] else if (book) ...[
          PreviewSummary(state: _preview.state, digits: digits, collapsible: true),
          const SizedBox(height: 10),
          if (readOnly)
            const ReadOnlyBox()
          else
            RfqPanel(
              legs: [for (final l in legs) (series: l.series, side: l.side, contracts: l.contracts)],
              onDone: ctl.afterFill,
              onKalksQuoted: () => setState(() => _houseRoute = true),
            ),
        ] else ...[
          if (bookLiveRaw && (barrierLegs || _houseRoute)) ...[const HouseRouteNote(), const SizedBox(height: 10)],
          Fold(
            title: t('trader.opt.ticket.more'),
            hint: t('trader.opt.ticket.moreHint'),
            open: _more,
            active: advancedOn,
            onToggle: () => setState(() => _more = !_more),
            child: _MoreOptions(
              ticket: ticket,
              single: single,
              q: q0,
              digits: digits,
              pipSize: pipSize,
              spot: spot,
              u: u,
              limitPremium: limitPremium,
              unit: cur?.contractUnit,
            ),
          ),
          if (armed) ...[
            const SizedBox(height: 10),
            PreviewSummary(state: _preview.state, digits: digits, pipsOf: single != null ? pipsOf : null, collapsible: true),
          ],
          if (_err != null) ...[const SizedBox(height: 10), ErrorNote(code: _err!.code, message: _err!.message)],
          const SizedBox(height: 10),
          if (readOnly)
            const ReadOnlyBox()
          else
            OptPrimaryButton(
              idle: !armed,
              label: _busy ? t('trader.opt.ticket.sending') : (s.tradingSoon && live ? t('trader.opt.ticket.soon') : submitLabel),
              amount: total != null && armed
                  ? (debit
                        ? t('trader.opt.ticket.payAmount', iso({'amount': money(math.max(0, total))}))
                        : t('trader.opt.ticket.getAmount', iso({'amount': money(math.max(0, total))})))
                  : null,
              onTap: blocked ? null : () => unawaited(_submit(ticket: ticket, usdPerUnit: usdPerUnit, limitPremium: limitPremium, u: u)),
            ),
          if (single != null) ...[const SizedBox(height: 8), hint],
        ],
      ],
    );
  }
}

class _HeadButton extends StatelessWidget {
  const _HeadButton({required this.icon, required this.label, required this.onTap, this.on = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool on;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return KPressable(
      minSize: 36,
      onTap: onTap,
      child: Container(
        height: 28,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        decoration: BoxDecoration(
          color: on ? k.emberSoft : k.surface2,
          borderRadius: BorderRadius.circular(7),
          border: Border.all(color: on ? k.ember.withValues(alpha: 0.45) : k.line),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: on ? k.ember : k.fg2),
            const SizedBox(width: 4),
            Text(label, style: context.text.label.copyWith(fontSize: 12, color: on ? k.ember : k.fg2)),
          ],
        ),
      ),
    );
  }
}

/// The selected option in words: underlying, Call / Put and strike, what it is a bet on, the expiry and its countdown.
class _SelectedOption extends ConsumerWidget {
  const _SelectedOption({required this.leg, required this.cutMs});
  final TicketLeg leg;
  final int? cutMs;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final q = ref.watch(optionsProvider.select((s) => s.quoteOf(leg.series)));
    final flippable = ref.watch(
      optionsProvider.select(
        (s) =>
            s.chain != null &&
            s.chain!.expiry == leg.expiry &&
            s.chain!.underlying == leg.u &&
            s.chain!.rows.any((r) => (r.strike - leg.strike).abs() < 1e-9 && r.call != null && r.put != null),
      ),
    );
    final call = leg.right == 'call';
    return OptCard(
      color: k.surface2.withValues(alpha: 0.5),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
            child: Row(
              children: [
                OptAvatar(leg.u, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(leg.u, style: context.text.label.copyWith(fontSize: 14, fontWeight: FontWeight.w600)),
                          const SizedBox(width: 6),
                          RightChip(leg.right, fontSize: 11),
                          const SizedBox(width: 6),
                          Text(
                            leg.strikeLabel,
                            textDirection: TextDirection.ltr,
                            style: context.text.mono(14, weight: FontWeight.w600),
                          ),
                          const SizedBox(width: 2),
                          Explain(leg.right, size: 12),
                        ],
                      ),
                      Text(
                        call
                            ? t('trader.opt.ticket.betUp', iso({'u': leg.u, 'strike': leg.strikeLabel}))
                            : t('trader.opt.ticket.betDown', iso({'u': leg.u, 'strike': leg.strikeLabel})),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.caption.copyWith(fontSize: 11.5, color: call ? k.up : k.down, fontWeight: FontWeight.w400),
                      ),
                    ],
                  ),
                ),
                if (q != null) StateBadge(q.state),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.fromLTRB(12, 6, 10, 6),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: k.line.withValues(alpha: 0.7))),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Wrap(
                    spacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        cutMs != null ? cutWhen(cutMs, t.locale) : expiryLabel(leg.expiry, t.locale),
                        style: context.text.caption.copyWith(fontSize: 11, color: k.fg2, fontWeight: FontWeight.w400),
                      ),
                      if (cutMs != null) Countdown(toMs: cutMs!),
                    ],
                  ),
                ),
                if (flippable)
                  SizedBox(
                    width: 124,
                    child: OptSeg<String>(
                      height: 28,
                      values: const ['call', 'put'],
                      labels: [t('trader.opt.call'), t('trader.opt.put')],
                      tones: const [1, -1],
                      selected: leg.right,
                      onChanged: (v) => ref.read(optionsProvider.notifier).flipRight(v),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// SELL (you receive the bid) | BUY (you pay the ask), USD per contract (the book's sizes while it is live).
class _SideButtons extends ConsumerWidget {
  const _SideButtons({required this.leg, required this.armed, required this.q});
  final TicketLeg leg;
  final bool armed;
  final OptionQuote? q;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final q = this.q;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: k.surface2.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(11),
        border: Border.all(color: k.line),
      ),
      child: Row(
        children: [
          for (final side in const ['sell', 'buy']) ...[
            if (side == 'buy') const SizedBox(width: 4),
            Expanded(
              child: Builder(
                builder: (context) {
                  final buy = side == 'buy';
                  final on = armed && leg.side == side;
                  final v = q == null ? 0.0 : (buy ? q.askUsd : q.bidUsd);
                  final size = q?.book == true ? (buy ? q!.askQty : q!.bidQty) : null;
                  final tone = buy ? k.up : k.down;
                  final sub = q == null
                      ? ' '
                      : (q.book
                            ? (size != null && size > 0
                                  ? t('trader.opt.book.size', {'count': size})
                                  : (buy ? t('trader.opt.book.noOffers') : t('trader.opt.book.noBids')))
                            : (buy ? t('trader.opt.ticket.youPayEach') : t('trader.opt.ticket.youGetEach')));
                  return Opacity(
                    opacity: q == null ? 0.5 : 1,
                    child: KPressable(
                      minSize: 46,
                      semanticLabel: buy ? t('trader.opt.clickBuy') : t('trader.opt.clickSell'),
                      onTap: q == null
                          ? null
                          : () {
                              KHaptics.selection();
                              ref.read(optionsProvider.notifier).arm(side);
                            },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        height: 46,
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        decoration: BoxDecoration(
                          color: on ? (buy ? k.upSoft : k.downSoft) : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: on ? tone.withValues(alpha: 0.45) : Colors.transparent),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  buy ? t('common.buy') : t('common.sell'),
                                  style: context.text.label.copyWith(fontSize: 12.5, fontWeight: FontWeight.w600, color: tone),
                                ),
                                const Spacer(),
                                Flash(
                                  value: v,
                                  child: Text(
                                    v > 0 ? money(v) : '—',
                                    textDirection: TextDirection.ltr,
                                    style: context.text.mono(14, weight: FontWeight.w600),
                                  ),
                                ),
                              ],
                            ),
                            Text(
                              sub,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: context.text.caption.copyWith(fontSize: 11, color: k.fg3, fontWeight: FontWeight.w400),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// One leg of a strategy: side (tap flips), C / P, strike, expiry, contracts, price, remove.
class _LegRow extends ConsumerWidget {
  const _LegRow({required this.leg});
  final TicketLeg leg;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final ctl = ref.read(optionsProvider.notifier);
    final q = ref.watch(optionsProvider.select((s) => s.quoteOf(leg.series)));
    final price = q == null ? 0.0 : (leg.side == 'buy' ? q.askUsd : q.bidUsd);
    final buy = leg.side == 'buy';
    return Container(
      padding: const EdgeInsets.fromLTRB(6, 6, 2, 6),
      decoration: BoxDecoration(
        color: k.surface2.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: k.line),
      ),
      child: Row(
        children: [
          KPressable(
            minSize: 32,
            semanticLabel: t('trader.opt.ticket.flipSide'),
            onTap: () => ctl.updateLeg(leg.id, side: buy ? 'sell' : 'buy'),
            child: Container(
              width: 44,
              height: 24,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: buy ? k.upSoft : k.downSoft, borderRadius: BorderRadius.circular(6)),
              child: Text(
                (buy ? t('common.buy') : t('common.sell')).toUpperCase(),
                style: context.text.micro.copyWith(fontSize: 10, color: buy ? k.up : k.down),
              ),
            ),
          ),
          const SizedBox(width: 6),
          RightTag(leg.right),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  leg.strikeLabel,
                  textDirection: TextDirection.ltr,
                  style: context.text.mono(12.5, weight: FontWeight.w600),
                ),
                Text(
                  '${leg.right == 'call' ? t('trader.opt.call') : t('trader.opt.put')} · ${expiryLabel(leg.expiry, t.locale, withWeekday: false)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.caption.copyWith(fontSize: 10.5, color: k.fg3, fontWeight: FontWeight.w400),
                ),
              ],
            ),
          ),
          if (q != null) StateBadge(q.state),
          SizedBox(
            width: 84,
            child: TStepper(
              height: 28,
              value: '${leg.contracts}',
              step: 1,
              min: 1,
              decimals: 0,
              semanticLabel: t('trader.opt.ticket.contracts'),
              onChanged: (v) => ctl.updateLeg(leg.id, contracts: math.max(1, (double.tryParse(v) ?? 1).round())),
            ),
          ),
          SizedBox(
            width: 62,
            child: Flash(
              value: price,
              child: Text(
                price > 0 ? money(price) : '—',
                textAlign: TextAlign.end,
                textDirection: TextDirection.ltr,
                style: context.text.mono(12, color: buy ? k.up : k.down),
              ),
            ),
          ),
          KIconButton(icon: LucideIcons.x, size: 28, semanticLabel: t('trader.opt.ticket.removeLeg'), onPressed: () => ctl.removeLeg(leg.id)),
        ],
      ),
    );
  }
}

/// "More order options": market / limit, the limit premium, SL / TP on the premium, a trigger on the underlying, TIF.
class _MoreOptions extends ConsumerWidget {
  const _MoreOptions({
    required this.ticket,
    required this.single,
    required this.q,
    required this.digits,
    required this.pipSize,
    required this.spot,
    required this.u,
    required this.limitPremium,
    required this.unit,
  });
  final Ticket ticket;
  final TicketLeg? single;
  final OptionQuote? q;
  final int digits;
  final double pipSize;
  final double? spot;
  final String u;
  final double? limitPremium;
  final String? unit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final ctl = ref.read(optionsProvider.notifier);
    final single = this.single;
    final small = context.text.caption.copyWith(fontSize: 10.5, color: k.fg3, fontWeight: FontWeight.w400);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        OptLabel(t('trader.opt.ticket.orderType')),
        OptSeg<String>(
          values: const ['market', 'limit'],
          labels: [t('trader.opt.ticket.market'), t('trader.opt.ticket.limit')],
          selected: single != null ? ticket.type : 'market',
          onChanged: (v) {
            if (single != null) ctl.setTicket((x) => x.copyWith(type: v));
          },
        ),
        if (single == null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(t('trader.opt.ticket.comboMarket'), style: small),
          ),
        if (single != null && ticket.type == 'limit') ...[
          const SizedBox(height: 12),
          OptLabel(
            t('trader.opt.ticket.limitPremium'),
            trailing: limitPremium != null ? Text('${px(limitPremium, digits + 2)} / ${unit ?? ''}', style: context.text.mono(10, color: k.fg3)) : null,
          ),
          TStepper(
            value: ticket.limit,
            step: 0.5,
            placeholder: q != null ? usd(single.side == 'buy' ? q!.bidUsd : q!.askUsd) : null,
            semanticLabel: t('trader.opt.ticket.limitPremium'),
            onChanged: (v) => ctl.setTicket((x) => x.copyWith(limit: v)),
          ),
        ],
        if (single != null) ...[
          const SizedBox(height: 12),
          OptLabel(t('trader.opt.ticket.protection')),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t('trader.opt.ticket.slPremium'), style: small.copyWith(color: k.down.withValues(alpha: 0.9))),
                    const SizedBox(height: 4),
                    TStepper(
                      value: ticket.sl,
                      step: 0.5,
                      tone: k.down,
                      placeholder: t('trader.opt.ticket.notSet'),
                      semanticLabel: t('trader.opt.ticket.slPremium'),
                      onChanged: (v) => ctl.setTicket((x) => x.copyWith(sl: v)),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t('trader.opt.ticket.tpPremium'), style: small.copyWith(color: k.up.withValues(alpha: 0.9))),
                    const SizedBox(height: 4),
                    TStepper(
                      value: ticket.tp,
                      step: 0.5,
                      tone: k.up,
                      placeholder: t('trader.opt.ticket.notSet'),
                      semanticLabel: t('trader.opt.ticket.tpPremium'),
                      onChanged: (v) => ctl.setTicket((x) => x.copyWith(tp: v)),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(t('trader.opt.ticket.protectionHint'), style: small),
        ],
        const SizedBox(height: 12),
        OptCheck(
          value: ticket.trigger,
          onChanged: (v) => ctl.setTicket(
            (x) => x.copyWith(trigger: v, triggerPrice: x.triggerPrice.isNotEmpty ? x.triggerPrice : (spot != null ? spot!.toStringAsFixed(digits) : '')),
          ),
          label: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(LucideIcons.crosshair, size: 12, color: k.fg3),
              const SizedBox(width: 4),
              Text(t('trader.opt.ticket.trigger', {'u': u})),
            ],
          ),
        ),
        if (ticket.trigger) ...[
          const SizedBox(height: 6),
          Row(
            children: [
              SizedBox(
                width: 116,
                child: OptSeg<String>(
                  height: 32,
                  values: const ['above', 'below'],
                  labels: [t('trader.opt.ticket.above'), t('trader.opt.ticket.below')],
                  selected: ticket.triggerOp,
                  onChanged: (v) => ctl.setTicket((x) => x.copyWith(triggerOp: v)),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: TStepper(
                  value: ticket.triggerPrice,
                  step: pipSize,
                  decimals: digits,
                  placeholder: spot?.toStringAsFixed(digits),
                  semanticLabel: t('trader.opt.ticket.triggerPrice'),
                  onChanged: (v) => ctl.setTicket((x) => x.copyWith(triggerPrice: v)),
                ),
              ),
            ],
          ),
        ],
        if (ticket.trigger || (single != null && ticket.type == 'limit')) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: Text(t('trader.opt.ticket.tif'), style: small.copyWith(fontSize: 11))),
              SizedBox(
                width: 124,
                child: OptSeg<String>(
                  height: 24,
                  values: const ['gtc', 'day'],
                  labels: [t('trader.opt.ticket.gtc'), t('trader.opt.ticket.day')],
                  selected: ticket.tif,
                  onChanged: (v) => ctl.setTicket((x) => x.copyWith(tif: v)),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _EmptyTicket extends ConsumerWidget {
  const _EmptyTicket({required this.onQuick, required this.onOpenChain, required this.onBuilder});
  final VoidCallback onQuick, onOpenChain, onBuilder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final hidden = ref.watch(introHiddenProvider);
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        if (!hidden) const IntroCard(),
        const SizedBox(height: 32),
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 280),
            child: Column(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: k.surface2,
                    border: Border.all(color: k.line),
                  ),
                  child: Icon(LucideIcons.mousePointerClick, size: 20, color: k.ember),
                ),
                const SizedBox(height: 12),
                Text(
                  t('trader.opt.ticket.emptyTitle'),
                  textAlign: TextAlign.center,
                  style: context.text.label.copyWith(fontSize: 14, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text(
                  t('trader.opt.ticket.emptyText2'),
                  textAlign: TextAlign.center,
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, height: 1.5),
                ),
                const SizedBox(height: 16),
                KButton(
                  label: t('trader.opt.guide.start'),
                  size: KButtonSize.sm,
                  expand: true,
                  onPressed: () {
                    ref.read(optionsProvider.notifier).setPrefs((p) => p.copyWith(panel: 'simple'));
                    onQuick();
                  },
                ),
                const SizedBox(height: 8),
                KButton(
                  label: t('trader.opt.chainTitle'),
                  icon: LucideIcons.table2,
                  size: KButtonSize.sm,
                  expand: true,
                  variant: KButtonVariant.surface,
                  onPressed: onOpenChain,
                ),
                const SizedBox(height: 8),
                KButton(
                  label: t('trader.opt.builder.open'),
                  icon: LucideIcons.wand2,
                  size: KButtonSize.sm,
                  expand: true,
                  variant: KButtonVariant.surface,
                  onPressed: onBuilder,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
