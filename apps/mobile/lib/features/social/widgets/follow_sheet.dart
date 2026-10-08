// The 4-step follow (copy) dialog as one sheet with a step indicator: sizing, risk limits, amount (with the A9 risk
// preview), review. Port of apps/crm/components/social-live/follow-dialog.tsx (POST subscriptions).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../data/client_data.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../social_api.dart';
import 'bits.dart';
import 'risk_preview.dart';

const List<String> _steps = ['social.follow.step.sizing', 'social.follow.step.risk', 'social.follow.step.amount', 'social.follow.step.review'];

const List<(String, IconData, String)> _modes = [
  ('equity', LucideIcons.scale, 'social.follow.mode.equity'),
  ('fixed_lot', LucideIcons.layers, 'social.follow.mode.fixedLot'),
  ('multiplier', LucideIcons.percent, 'social.follow.mode.multiplier'),
  ('allocation', LucideIcons.coins, 'social.follow.mode.allocation'),
];

/// Follower lot for a master trade of `masterLot` (rounded down to 0.01, capped by max lot). 0 = skipped.
double exampleLot(String mode, double value, double allocation, double masterEquity, double? maxLot, [double masterLot = 1]) {
  final me = masterEquity > 0 ? masterEquity : 0.0;
  var v = switch (mode) {
    'equity' => me > 0 ? allocation / me * masterLot : 0.0,
    'allocation' => me > 0 ? value / me * masterLot : 0.0,
    'multiplier' => value * masterLot,
    _ => value,
  };
  v = (v * 100 + 1e-9).floorToDouble() / 100;
  if (maxLot != null && maxLot > 0 && v > maxLot) v = maxLot;
  return v;
}

String _ratio(double x) => numText(double.parse(x.toStringAsPrecision(3)));

/// The available USDT in the wallet (null while loading).
double? walletAvailable(WidgetRef ref) {
  final w = ref.watch(walletOverviewProvider).value;
  return w == null ? null : double.tryParse(w.usdt.available) ?? 0;
}

/// Opens the follow sheet. `onDone` runs after a subscription was created.
Future<void> showFollowSheet(BuildContext context, {required MasterView master, List<String> suggested = const [], String? inviteCode, VoidCallback? onDone}) =>
    showKSheet<void>(
      context,
      expand: true,
      builder: (_) => FollowSheet(master: master, suggested: suggested, inviteCode: inviteCode, onDone: onDone),
    );

class FollowSheet extends ConsumerStatefulWidget {
  const FollowSheet({super.key, required this.master, this.suggested = const [], this.inviteCode, this.onDone});
  final MasterView master;
  final List<String> suggested;
  final String? inviteCode;
  final VoidCallback? onDone;

  @override
  ConsumerState<FollowSheet> createState() => _FollowSheetState();
}

class _FollowSheetState extends ConsumerState<FollowSheet> {
  int _step = 0;
  String _mode = 'equity';
  final _value = TextEditingController(text: '1');
  late final _allocation = TextEditingController(text: inputText(widget.master.minAllocation > 100 ? widget.master.minAllocation : 100));
  final _maxLot = TextEditingController();
  final _equityStop = TextEditingController();
  final _autoSl = TextEditingController();
  String _query = '';
  bool _ddOn = true;
  double _dd = 30;
  final List<String> _excluded = [];
  bool _agree = false;
  bool _busy = false;
  Map<String, dynamic>? _result;
  double _resultAlloc = 0;

  MasterView get m => widget.master;

  @override
  void dispose() {
    for (final c in [_value, _allocation, _maxLot, _equityStop, _autoSl]) {
      c.dispose();
    }
    super.dispose();
  }

  double get _alloc => parseAmount(_allocation.text) ?? 0;
  double get _val => _mode == 'equity' ? 1 : (parseAmount(_value.text) ?? 0);

  String? _sizingErr(T t) {
    if (_mode == 'equity') return null;
    if (!(_val > 0)) return t('social.follow.err.aboveZero');
    if (_mode == 'fixed_lot' && _val < 0.01) return t('social.follow.err.minLot');
    return null;
  }

  String? _allocErr(T t, double? available) {
    final a = _alloc;
    if (!(a > 0)) return t('social.follow.err.enterAmount');
    if (a < m.minAllocation) return t('social.follow.err.minAllocation', {'amount': usd(m.minAllocation, 0)});
    if (available != null && a > available) return t('social.follow.err.overBalance', {'balance': fmtUsdt(available)});
    return null;
  }

  String? _maxLotErr(T t) {
    if (_maxLot.text.trim().isEmpty) return null;
    final v = parseAmount(_maxLot.text);
    return v == null || v < 0.01 ? t('social.follow.err.minLot') : null;
  }

  String? _stopErr(T t) {
    if (_equityStop.text.trim().isEmpty) return null;
    final v = parseAmount(_equityStop.text);
    if (v == null || v < 0) return t('social.follow.err.enterAmount');
    if (_alloc > 0 && v >= _alloc) return t('social.follow.err.belowAllocation');
    return null;
  }

  String? _autoSlErr(T t) {
    if (_autoSl.text.trim().isEmpty) return null;
    final v = parseAmount(_autoSl.text);
    return v == null || v < 1 || v > 5000 ? t('social.autoSl.err') : null;
  }

  Future<void> _submit() async {
    final t = context.t;
    setState(() => _busy = true);
    try {
      final alloc = _alloc;
      final body = <String, Object?>{
        'masterId': m.id,
        'sizing': {'mode': _mode, 'value': _val},
        'allocation': alloc,
        'excludedSymbols': _excluded,
        if (parseAmount(_maxLot.text) != null) 'maxLot': parseAmount(_maxLot.text),
        if (parseAmount(_equityStop.text) != null) 'equityStop': parseAmount(_equityStop.text),
        if (_ddOn) 'maxDdPct': _dd.round(),
        if (parseAmount(_autoSl.text) != null) 'autoSlPips': parseAmount(_autoSl.text),
        if (widget.inviteCode != null) 'inviteCode': widget.inviteCode,
      };
      final r = await socialPost(ref, 'subscriptions', body);
      final login = intOrNull(mapOf(r['account'])['login']) ?? SubscriptionView(mapOf(r['subscription'])).login;
      if (strOf(mapOf(r['funding'])['status']) == 'done') {
        okToast(ref, t('social.follow.nowCopying', {'name': m.nickname}), t('social.follow.toast.fundedDesc', {'login': login, 'amount': usd(alloc)}));
      } else {
        warnToast(ref, t('social.follow.toast.createdTitle', {'login': login}), t('social.follow.toast.createdDesc'));
      }
      ref.invalidate(subscriptionsProvider);
      ref.invalidate(walletOverviewProvider);
      widget.onDone?.call();
      if (mounted) {
        setState(() {
          _result = r;
          _resultAlloc = alloc;
        });
      }
    } on ApiException catch (e) {
      if (mounted) errToast(ref, context, t('social.follow.toast.failed'), e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _next(double? available) {
    final t = context.t;
    final closed = m.acceptingNew == false;
    if (_step == 0 && _sizingErr(t) != null) return plainError(ref, _sizingErr(t)!);
    if (closed) return plainError(ref, t('social.error.not_accepting'));
    if (_step == 1) {
      final e = _maxLotErr(t) ?? _stopErr(t) ?? _autoSlErr(t);
      if (e != null) return plainError(ref, e);
    }
    if (_step == 2 && _allocErr(t, available) != null) return plainError(ref, _allocErr(t, available)!);
    if (_step < 3) {
      setState(() => _step++);
    } else if (_agree) {
      _submit();
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final available = walletAvailable(ref);
    if (_result != null) return _done(context);
    final closed = m.acceptingNew == false;
    return KSheetContent(
      footer: Row(
        children: [
          KButton(
            label: _step == 0 ? t('common.cancel') : t('common.back'),
            icon: _step == 0 ? null : (Directionality.of(context) == TextDirection.rtl ? LucideIcons.arrowRight : LucideIcons.arrowLeft),
            variant: KButtonVariant.ghost,
            size: KButtonSize.lg,
            onPressed: _busy ? null : () => _step == 0 ? Navigator.of(context).pop() : setState(() => _step--),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: KButton(
              label: _step == 3 ? t('social.follow.confirm') : t('common.continue'),
              trailingIcon: _step == 3 ? null : (Directionality.of(context) == TextDirection.rtl ? LucideIcons.arrowLeft : LucideIcons.arrowRight),
              size: KButtonSize.lg,
              expand: true,
              loading: _busy,
              onPressed: closed || (_step == 3 && !_agree) ? null : () => _next(available),
            ),
          ),
        ],
      ),
      children: [
        SheetTitle(title: t('social.follow.title', {'name': m.nickname}), description: t('social.follow.description')),
        _MasterBox(m: m),
        if (m.house) ...[const SizedBox(height: 10), InfoBox(text: t('social.house.disclosure'))],
        if (closed) ...[const SizedBox(height: 10), InfoBox(text: t('social.notAccepting'), tone: KChipTone.warn, icon: LucideIcons.userX)],
        const SizedBox(height: 14),
        if (_step == 0) ...[_HowCopyWorks(name: m.nickname, fee: m.perfFeePct), const SizedBox(height: 14)],
        // the bar fills the width (its connectors are flexible); four labels don't fit a phone, so only the current
        // step is named (as in the open-account wizard)
        KStepIndicator(steps: [for (var i = 0; i < _steps.length; i++) i == _step ? t(_steps[i]) : ''], current: _step),
        const SizedBox(height: 18),
        ...switch (_step) {
          0 => _sizing(context),
          1 => _risk(context),
          2 => _amount(context, available),
          _ => _review(context),
        },
      ],
    );
  }

  List<Widget> _sizing(BuildContext context) {
    final t = context.t;
    return [
      for (final (key, icon, text) in _modes) ...[
        RadioCard(
          selected: _mode == key,
          icon: icon,
          title: sizingLabel(t, key),
          text: t(text),
          onSelect: () => setState(() {
            _mode = key;
            final v = switch (key) {
              'fixed_lot' => 0.1,
              'multiplier' => 1.0,
              'allocation' => m.minAllocation > (_alloc > 0 ? _alloc : 1000) ? m.minAllocation : (_alloc > 0 ? _alloc : 1000),
              _ => 1.0,
            };
            _value.text = inputText(v);
          }),
        ),
        const SizedBox(height: 10),
      ],
      if (_mode != 'equity') ...[
        NumberField(
          controller: _value,
          label: _mode == 'fixed_lot'
              ? t('social.follow.lotPerTrade')
              : (_mode == 'multiplier' ? t('social.sizing.multiplier') : t('social.follow.allocForSizing')),
          dollar: _mode == 'allocation',
          unit: _mode == 'fixed_lot' ? t('social.lotsUnit') : (_mode == 'multiplier' ? '×' : 'USD'),
          error: _sizingErr(t),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
      ],
      SizingExample(
        mode: _mode,
        val: _val,
        alloc: _alloc,
        masterEq: m.stats.equity,
        maxLot: parseAmount(_maxLot.text),
        symbol: widget.suggested.firstOrNull ?? 'EURUSD',
      ),
    ];
  }

  List<Widget> _risk(BuildContext context) {
    final t = context.t;
    final symbols = ref.watch(socialSymbolsProvider);
    final all = symbols.value ?? const <String>[];
    final ordered = <String>{...widget.suggested, ...all}.toList();
    final q = _query.trim().toLowerCase();
    final shown = (q.isEmpty ? ordered : ordered.where((s) => s.toLowerCase().contains(q))).take(24).where((s) => !_excluded.contains(s)).toList();
    return [
      SwitchBox(
        title: t('social.follow.ddStop'),
        hint: t('social.follow.ddStopHint'),
        on: _ddOn,
        onChanged: (v) => setState(() => _ddOn = v),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TriggerLine(value: t('social.follow.fromPeak', {'dd': _dd.round()})),
            SocialSlider(
              value: _dd,
              min: 5,
              max: 90,
              ticks: const [5, 20, 30, 50, 90],
              format: (v) => '${v.round()}%',
              enabled: _ddOn,
              onChanged: (v) => setState(() => _dd = v),
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      NumberField(
        controller: _equityStop,
        label: t('social.equityStop'),
        hint: t('social.follow.optionalUsd'),
        placeholder: t('social.follow.noEquityStop'),
        dollar: true,
        error: _stopErr(t),
        onChanged: (_) => setState(() {}),
      ),
      const SizedBox(height: 12),
      NumberField(
        controller: _maxLot,
        label: t('social.follow.maxLotPerTrade'),
        hint: t('common.optional'),
        placeholder: t('social.noCap'),
        unit: t('social.lotsUnit'),
        error: _maxLotErr(t),
        onChanged: (_) => setState(() {}),
      ),
      Hint(t('social.follow.limitsNote'), top: 6),
      const SizedBox(height: 14),
      NumberField(
        controller: _autoSl,
        label: t('social.autoSl.label'),
        hint: t('common.optional'),
        placeholder: t('social.autoSl.off'),
        leading: LucideIcons.target,
        unit: t('social.autoSl.pips'),
        integer: true,
        error: _autoSlErr(t),
        onChanged: (_) => setState(() {}),
      ),
      Hint(t('social.autoSl.hint'), top: 6),
      const SizedBox(height: 16),
      GroupLabel(
        t('social.follow.excludeSymbols'),
        trailing: Text(
          _excluded.isNotEmpty ? t('social.follow.excludedCount', {'count': _excluded.length}) : t('social.follow.copyEverything'),
          style: context.text.footnote.copyWith(color: context.k.fg3),
        ),
      ),
      if (_excluded.isNotEmpty) ...[
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [for (final s in _excluded) ToggleChip(label: s, on: true, down: true, removable: true, onTap: () => setState(() => _excluded.remove(s)))],
        ),
        const SizedBox(height: 8),
      ],
      KSearchField(placeholder: t('social.follow.searchSymbols'), onChanged: (v) => setState(() => _query = v)),
      const SizedBox(height: 8),
      if (symbols.isLoading && !symbols.hasValue && widget.suggested.isEmpty) Hint(t('social.follow.loadingSymbols')),
      if (symbols.hasError && ordered.isEmpty) Hint(t('social.follow.symbolsUnavailable')),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [for (final s in shown) ToggleChip(label: s, on: false, down: true, onTap: () => setState(() => _excluded.add(s)))],
      ),
    ];
  }

  List<Widget> _amount(BuildContext context, double? available) {
    final t = context.t;
    final alloc = _alloc;
    final err = _allocErr(t, available);
    final min = t('social.minAmount', {'amount': usd(m.minAllocation, 0)});
    final quick = <double>{
      m.minAllocation,
      500,
      1000,
      2500,
      5000,
    }.where((v) => v >= m.minAllocation && v > 0 && (available == null || v <= available)).toList();
    return [
      NumberField(
        controller: _allocation,
        label: t('social.follow.amountLabel'),
        hint: available != null ? '$min · ${t('social.follow.walletAvailable', {'balance': fmtUsdt(available)})}' : min,
        dollar: true,
        unit: 'USD',
        error: _allocation.text.isNotEmpty ? err : null,
        onChanged: (_) => setState(() {}),
      ),
      const SizedBox(height: 10),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [for (final v in quick) ToggleChip(label: usd(v, 0), on: alloc == v, onTap: () => setState(() => _allocation.text = inputText(v)))],
      ),
      const SizedBox(height: 14),
      InfoBox(tone: KChipTone.gold, text: t('social.follow.amountNote', {'amount': alloc > 0 ? usd(alloc) : t('social.follow.theAmount')})),
      if (alloc > 0) ...[
        const SizedBox(height: 12),
        SizingExample(
          mode: _mode,
          val: _val,
          alloc: alloc,
          masterEq: m.stats.equity,
          maxLot: parseAmount(_maxLot.text),
          symbol: widget.suggested.firstOrNull ?? 'EURUSD',
        ),
      ],
      if (alloc > 0 && err == null) ...[
        const SizedBox(height: 12),
        RiskPreviewBox(
          masterId: m.id,
          allocation: alloc,
          equityStop: parseAmount(_equityStop.text),
          maxDdPct: _ddOn ? _dd : null,
          mode: _mode,
          value: _val,
          invite: widget.inviteCode,
          examples: false,
        ),
      ],
    ];
  }

  List<Widget> _review(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final maxLot = parseAmount(_maxLot.text);
    final stop = parseAmount(_equityStop.text);
    final autoSl = parseAmount(_autoSl.text);
    return [
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: k.emberSoft,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: k.ember.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Icon(LucideIcons.shieldCheck, size: 18, color: k.ember),
            const SizedBox(width: 10),
            Expanded(child: Text(t('social.follow.reviewBanner'), style: context.text.callout)),
          ],
        ),
      ),
      const SizedBox(height: 6),
      KKeyValues([
        KKV(t('social.master'), '${m.nickname} · ${m.strategy}'),
        KKV(t('social.follow.step.sizing'), _mode == 'equity' ? sizingLabel(t, 'equity') : sizingText(t, Sizing(_mode, _val))),
        KKV(t('social.allocation'), usd(_alloc), mono: true),
        KKV(t('social.follow.ddStop'), _ddOn ? t('social.follow.fromPeakEquity', {'dd': _dd.round()}) : t('common.off')),
        KKV(t('social.equityStop'), stop != null ? usd(stop) : t('common.off')),
        KKV(t('social.maxLot'), maxLot != null ? t('social.lotsValue', {'lots': maxLot.toStringAsFixed(2)}) : t('social.noCap')),
        KKV(t('social.autoSl.label'), autoSl != null ? t('social.autoSl.value', {'pips': numText(autoSl)}) : t('common.off')),
        KKV(t('social.follow.excludedSymbols'), _excluded.isNotEmpty ? _excluded.join(', ') : t('common.none')),
        KKV(t('social.performanceFee'), t('social.follow.feeTerms', {'fee': numText(m.perfFeePct), 'period': periodLabel(t, m.feePeriod).toLowerCase()})),
      ]),
      const SizedBox(height: 10),
      RiskPreviewBox(masterId: m.id, allocation: _alloc, equityStop: stop, maxDdPct: _ddOn ? _dd : null, mode: _mode, value: _val, invite: widget.inviteCode),
      const SizedBox(height: 12),
      Container(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        decoration: BoxDecoration(
          color: k.surface2,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: k.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              t('social.follow.rules.title'),
              style: context.text.label.copyWith(fontWeight: FontWeight.w600, color: k.fg),
            ),
            const SizedBox(height: 8),
            _Rule(icon: LucideIcons.check, color: k.up, title: t('social.follow.rules.copiedT'), text: t('social.follow.rules.copied')),
            _Rule(
              icon: LucideIcons.x,
              color: k.down,
              title: t('social.follow.rules.notT'),
              text: '${t('social.follow.rules.noManual')} ${t('social.follow.rules.skipped')}',
            ),
            _Rule(icon: LucideIcons.pause, color: k.warn, title: t('social.follow.rules.pausedT'), text: t('social.follow.rules.paused')),
            _Rule(icon: LucideIcons.square, color: k.fg3, title: t('social.follow.rules.stopT'), text: t('social.follow.rules.stop')),
          ],
        ),
      ),
      const SizedBox(height: 12),
      InfoBox(text: t('social.follow.mirrorNote')),
      const SizedBox(height: 10),
      KCheckRow(
        value: _agree,
        onChanged: (v) => setState(() => _agree = v),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              t('social.follow.understand'),
              style: context.text.label.copyWith(color: k.fg, fontWeight: FontWeight.w600),
            ),
            Text(t('social.follow.agree'), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12)),
          ],
        ),
      ),
    ];
  }

  Widget _done(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final r = _result!;
    final login = intOrNull(mapOf(r['account'])['login']) ?? SubscriptionView(mapOf(r['subscription'])).login;
    final funding = mapOf(r['funding']);
    final ok = strOf(funding['status']) == 'done';
    final accTag = KTag(style: context.text.mono(13.5, color: k.fg));
    return KSheetContent(
      footer: Row(
        children: [
          Expanded(
            child: KButton(
              label: t('social.mySubscriptions'),
              variant: KButtonVariant.surface,
              size: KButtonSize.lg,
              expand: true,
              onPressed: () {
                Navigator.of(context).pop();
                GoRouter.of(context).go('/social/copy');
              },
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: KButton(
              label: t('social.openInTrader'),
              icon: LucideIcons.candlestickChart,
              size: KButtonSize.lg,
              expand: true,
              onPressed: () {
                final router = GoRouter.of(context);
                Navigator.of(context).pop();
                router.push('/trader?login=$login');
              },
            ),
          ),
        ],
      ),
      children: [
        SheetTitle(
          title: ok ? t('social.follow.nowCopying', {'name': m.nickname}) : t('social.follow.done.createdTitle'),
          description: t('social.follow.done.description', {'login': login}),
        ),
        Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: ok ? k.upSoft : k.warnSoft,
                border: Border.all(color: (ok ? k.up : k.warn).withValues(alpha: 0.3)),
              ),
              child: Icon(ok ? LucideIcons.check : LucideIcons.triangleAlert, size: 24, color: ok ? k.up : k.warn),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: DefaultTextStyle.merge(
                style: context.text.callout.copyWith(color: k.fg2),
                child: ok
                    ? KRichText(t('social.follow.done.okText', {'amount': usd(_resultAlloc), 'login': login, 'name': m.nickname}), tags: {'acc': accTag})
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          KRichText(t('social.follow.done.failText', {'login': login}), tags: {'acc': accTag}),
                          Text('${strOf(funding['message']).isNotEmpty ? ': ${strOf(funding['message'])}' : '.'} ${t('social.follow.done.failHint')}'),
                        ],
                      ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        InfoBox(text: t('social.follow.done.exitNote')),
      ],
    );
  }
}

/// A sheet's own title and description (for sheets whose title changes with their state).
class SheetTitle extends StatelessWidget {
  const SheetTitle({super.key, required this.title, this.description});
  final String title;
  final String? description;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: Column(
      children: [
        Text(title, textAlign: TextAlign.center, style: context.text.title2),
        if (description != null && description!.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(
            description!,
            textAlign: TextAlign.center,
            style: context.text.footnote.copyWith(color: context.k.fg3),
          ),
        ],
      ],
    ),
  );
}

class _MasterBox extends StatelessWidget {
  const _MasterBox({required this.m});
  final MasterView m;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: k.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MasterIdentity(
            nickname: m.nickname,
            size: 38,
            subText: t('social.follow.masterSub', {'strategy': m.strategy, 'fee': numText(m.perfFeePct), 'min': usd(m.minAllocation, 0)}),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              if (m.house) const HouseBadge(),
              RiskBadge(risk: m.stats.riskScore, showLabel: true),
            ],
          ),
        ],
      ),
    );
  }
}

/// "How copy works" in four steps, shown at the start of the follow sheet.
class _HowCopyWorks extends StatelessWidget {
  const _HowCopyWorks({required this.name, required this.fee});
  final String name;
  final double fee;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final steps = [
      (LucideIcons.wallet, t('social.follow.how.s1T'), t('social.follow.how.s1S')),
      (LucideIcons.activity, t('social.follow.how.s2T'), t('social.follow.how.s2S', {'name': name})),
      (LucideIcons.copy, t('social.follow.how.s3T'), t('social.follow.how.s3S')),
      (LucideIcons.percent, t('social.follow.how.s4T'), t('social.follow.how.s4S', {'fee': numText(fee)})),
    ];
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: k.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            t('social.follow.how.title'),
            style: context.text.label.copyWith(fontWeight: FontWeight.w600, color: k.fg),
          ),
          const SizedBox(height: 10),
          for (var i = 0; i < steps.length; i++)
            Padding(
              padding: EdgeInsets.only(top: i == 0 ? 0 : 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 34,
                    height: 34,
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: k.emberSoft,
                            border: Border.all(color: k.ember.withValues(alpha: 0.3)),
                          ),
                          child: Icon(steps[i].$1, size: 15, color: k.ember),
                        ),
                        PositionedDirectional(
                          end: -2,
                          top: -3,
                          child: Container(
                            width: 16,
                            height: 16,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(shape: BoxShape.circle, color: k.ember),
                            child: Text('${i + 1}', style: context.text.micro.copyWith(color: k.onEmber, fontSize: 9.5)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          steps[i].$2,
                          style: context.text.label.copyWith(fontSize: 12.5, color: k.fg, fontWeight: FontWeight.w600),
                        ),
                        Text(
                          steps[i].$3,
                          style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, height: 1.35),
                        ),
                      ],
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

class _Rule extends StatelessWidget {
  const _Rule({required this.icon, required this.color, required this.title, required this.text});
  final IconData icon;
  final Color color;
  final String title;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Icon(icon, size: 15, color: color),
        ),
        const SizedBox(width: 9),
        Expanded(
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: '$title: ',
                  style: TextStyle(color: context.k.fg, fontWeight: FontWeight.w600),
                ),
                TextSpan(text: text),
              ],
            ),
            style: context.text.footnote.copyWith(color: context.k.fg2, height: 1.4),
          ),
        ),
      ],
    ),
  );
}

/// Live sizing example in plain words, from the mode, value and amount the client entered.
class SizingExample extends StatelessWidget {
  const SizingExample({
    super.key,
    required this.mode,
    required this.val,
    required this.alloc,
    required this.masterEq,
    required this.maxLot,
    required this.symbol,
  });
  final String mode;
  final double val, alloc, masterEq;
  final double? maxLot;
  final String symbol;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final me = masterEq > 0 ? masterEq : 0.0;
    if (me == 0 && (mode == 'equity' || mode == 'allocation')) {
      return InfoBox(tone: KChipTone.gold, text: '${t('social.follow.example.why.noEquity')} ${t('social.follow.example.roundingLogged')}');
    }
    final why = switch (mode) {
      'equity' => t('social.follow.example.why.equity', {'alloc': usd(alloc, 0), 'equity': usd(me, 0), 'ratio': _ratio(alloc / me)}),
      'allocation' => t('social.follow.example.why.allocation', {'amount': usd(val, 0), 'equity': usd(me, 0), 'ratio': _ratio(val / me)}),
      'multiplier' => t('social.follow.example.why.multiplier', {'value': numText(val)}),
      _ => t('social.follow.example.why.fixedLot', {'lot': val.toStringAsFixed(2)}),
    };
    final (bg, _, border) = k.chip(KChipTone.gold);
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border),
      ),
      child: DefaultTextStyle.merge(
        style: context.text.footnote.copyWith(color: k.fg2, height: 1.5),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(t('social.follow.example.title').toUpperCase(), style: context.text.micro.copyWith(color: k.fg3, letterSpacing: 0.4)),
            const SizedBox(height: 4),
            for (final ml in const [1.0, 0.1])
              Builder(
                builder: (context) {
                  final lot = exampleLot(mode, val, alloc, masterEq, maxLot, ml);
                  final capped = maxLot != null && lot > 0 && lot == maxLot && mode != 'fixed_lot';
                  return KRichText(
                    t(lot > 0 ? 'social.follow.example.line' : 'social.follow.example.lineSkipped', {
                          'master': ml.toStringAsFixed(2),
                          'symbol': symbol,
                          'lot': lot.toStringAsFixed(2),
                        }) +
                        (capped ? t('social.follow.example.capped') : ''),
                    style: context.text.callout.copyWith(color: k.fg2),
                    tags: {
                      'b': const KTag(),
                      'lot': KTag(
                        style: TextStyle(color: lot > 0 ? k.ember : k.fg3, fontWeight: FontWeight.w700),
                      ),
                    },
                  );
                },
              ),
            const SizedBox(height: 6),
            Text(why),
            const SizedBox(height: 4),
            Text(t('social.follow.example.rounding'), style: TextStyle(color: k.fg3, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
