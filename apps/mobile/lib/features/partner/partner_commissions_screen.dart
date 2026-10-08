// Partner › Commissions (web components/partner/live/commissions.tsx LivePartnerCommissions), in the phone order:
// header · rate card (levels x symbol groups, scrolls sideways) · rebates and splits (two sliders, the worked
// example, Reset / Save -> PUT settings) · multi-tier shares · CPA bonus · qualification rules · the commission
// ledger (status and type filters, pages; a line opens its details).
import 'dart:math' as math;

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/format/format.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'partner_api.dart';
import 'widgets/partner_widgets.dart';

/// 2 -> 2, 2.5 -> 2.5 (web `+v.toFixed(1)`).
num _clean(double v) => v == v.roundToDouble() ? v.round() : double.parse(v.toStringAsFixed(1));

String _groupHint(T t, PSymbolGroup g) {
  if (g.symbols.isNotEmpty) return g.symbols.take(3).join(', ') + (g.symbols.length > 3 ? ' +${g.symbols.length - 3}' : '');
  if (g.assetClass == 'forex') return t('partner.com.otherForex');
  return g.assetClass != null ? t('partner.com.allClassSymbols', {'cls': g.assetClass}) : '';
}

class PartnerCommissionsScreen extends ConsumerStatefulWidget {
  const PartnerCommissionsScreen({super.key, this.section});

  /// `rebates` scrolls to the rebates card (web /partner/commissions#rebates).
  final String? section;

  @override
  ConsumerState<PartnerCommissionsScreen> createState() => _PartnerCommissionsScreenState();
}

class _PartnerCommissionsScreenState extends ConsumerState<PartnerCommissionsScreen> {
  final _rebatesKey = GlobalKey();
  bool _scrolled = false;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final async = ref.watch(partnerDashboardProvider);
    final d = async.value;
    if (d == null) {
      return PartnerPageFallback(
        title: t('partner.com.title'),
        subtitle: t('partner.com.subtitle'),
        error: async.hasError ? async.error : null,
        onRetry: () => ref.invalidate(partnerDashboardProvider),
        skeleton: const [440, 440, 320],
      );
    }
    if (widget.section == 'rebates' && !_scrolled) {
      _scrolled = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final ctx = _rebatesKey.currentContext;
        if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 400), curve: Curves.easeOutCubic);
      });
    }
    final p = d.programme;
    final level = d.level;
    return KPageScroll(
      onRefresh: () async {
        ref.invalidate(partnerDashboardProvider);
        await ref.read(partnerDashboardProvider.future).then((_) {}, onError: (Object _) {});
      },
      children: [
        KPageHeader(title: t('partner.com.title'), subtitle: Text(t('partner.com.subtitle'))),
        const SizedBox(height: 20),
        _RateCard(p: p, levelKey: level?.key),
        kGap,
        _RebatesCard(key: _rebatesKey, p: p, d: d),
        kGap,
        _TiersCard(p: p, level: level),
        kGap,
        _CpaCard(p: p, level: level),
        kGap,
        _RulesCard(p: p),
        kGap,
        const _LedgerCard(),
      ],
    );
  }
}

/* ------------------------------------------------------------------ rate card */

class _RateCard extends StatelessWidget {
  const _RateCard({required this.p, this.levelKey});
  final PProgramme p;
  final String? levelKey;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final levels = [...p.levels]..sort((a, b) => a.rank.compareTo(b.rank));
    final curIdx = levels.indexWhere((l) => l.key == levelKey);
    final nextKey = curIdx >= 0 && curIdx + 1 < levels.length ? levels[curIdx + 1].key : null;
    final cur = curIdx >= 0 ? levels[curIdx] : null;
    const firstW = 136.0, colW = 82.0, headH = 40.0, rowH = 54.0;
    final head = context.text.caption.copyWith(fontSize: 10.5, letterSpacing: 0.4, fontWeight: FontWeight.w600);

    Color? colBg(PLevel l) => l.key == levelKey
        ? k.ember.withValues(alpha: 0.06)
        : l.key == nextKey
        ? k.gold.withValues(alpha: 0.05)
        : null;

    return KCard(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            title: t('partner.com.rateCard'),
            subtitle: t('partner.com.rateCardSubtitle'),
            action: cur == null ? null : KChip(label: t('partner.com.you', {'name': cur.name}), tone: KChipTone.ember),
          ),
          const SizedBox(height: 14),
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: k.line),
            ),
            clipBehavior: Clip.antiAlias,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // the symbol group column stays; the levels scroll sideways
                SizedBox(
                  width: firstW,
                  child: Column(
                    children: [
                      Container(
                        height: headH,
                        color: k.surface2,
                        alignment: AlignmentDirectional.centerStart,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Text(
                          t('partner.com.symbolGroup').toUpperCase(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: head.copyWith(color: k.fg3),
                        ),
                      ),
                      for (final g in p.symbolGroups)
                        Container(
                          height: rowH,
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          alignment: AlignmentDirectional.centerStart,
                          decoration: BoxDecoration(
                            border: Border(top: BorderSide(color: k.line, width: 0.6)),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                g.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: context.text.label.copyWith(color: k.fg),
                              ),
                              Text(
                                _groupHint(t, g),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: context.text.caption.copyWith(fontSize: 10.5, color: k.fg3, fontWeight: FontWeight.w400),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        for (final l in levels)
                          SizedBox(
                            width: colW,
                            child: Column(
                              children: [
                                Container(
                                  height: headH,
                                  color: l.key == levelKey
                                      ? k.emberSoft
                                      : l.key == nextKey
                                      ? k.goldSoft
                                      : k.surface2,
                                  alignment: AlignmentDirectional.centerEnd,
                                  padding: const EdgeInsets.symmetric(horizontal: 10),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        levelGlyph(l.icon).$1,
                                        size: 12,
                                        color: l.key == levelKey
                                            ? k.ember
                                            : l.key == nextKey
                                            ? k.gold
                                            : k.fg3,
                                      ),
                                      const SizedBox(width: 4),
                                      Flexible(
                                        child: Text(
                                          l.name.toUpperCase(),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: head.copyWith(
                                            color: l.key == levelKey
                                                ? k.ember
                                                : l.key == nextKey
                                                ? k.gold
                                                : k.fg3,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                for (final g in p.symbolGroups)
                                  Container(
                                    height: rowH,
                                    alignment: AlignmentDirectional.centerEnd,
                                    padding: const EdgeInsets.symmetric(horizontal: 10),
                                    decoration: BoxDecoration(
                                      color: colBg(l),
                                      border: Border(top: BorderSide(color: k.line, width: 0.6)),
                                    ),
                                    child: Text(
                                      l.rates[g.key] == null ? '—' : fmtRate(l.rates[g.key]!),
                                      textDirection: TextDirection.ltr,
                                      style: context.text.label.copyWith(
                                        fontFeatures: kTabular,
                                        fontWeight: l.key == levelKey ? FontWeight.w700 : FontWeight.w500,
                                        color: l.key == levelKey
                                            ? k.fg
                                            : l.key == nextKey
                                            ? k.gold
                                            : k.fg2,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 1),
                child: Icon(LucideIcons.info, size: 14, color: k.fg3),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  t('partner.com.rateNote'),
                  style: context.text.caption.copyWith(fontSize: 12, color: k.fg3, fontWeight: FontWeight.w400),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ rebates and splits */

const Map<String, String> _short = {
  'fx-major': 'partner.com.short.fxMajor',
  'fx-minor': 'partner.com.short.fxMinor',
  'metals': 'partner.com.short.metals',
  'indices': 'partner.com.short.indices',
  'energies': 'partner.com.short.energies',
  'crypto': 'partner.com.short.crypto',
  'stocks': 'partner.com.short.stocks',
};

List<int> _ticks(double max) {
  final step = max <= 20 ? 5 : (max <= 50 ? 10 : 25);
  final out = <int>[for (var v = 0; v <= max; v += step) v];
  if (out.isEmpty || out.last != max) out.add(max.round());
  return out;
}

class _RebatesCard extends ConsumerStatefulWidget {
  const _RebatesCard({super.key, required this.p, required this.d});
  final PProgramme p;
  final PDashboard d;

  @override
  ConsumerState<_RebatesCard> createState() => _RebatesCardState();
}

class _RebatesCardState extends ConsumerState<_RebatesCard> {
  late double _baseRebate = widget.d.rebatePct, _baseSplit = widget.d.splitPct;
  late double _rebate = _baseRebate, _split = _baseSplit;
  bool _saving = false;
  String? _gk;

  Future<void> _save() async {
    final t = context.t;
    final notes = ref.read(notificationsProvider.notifier);
    setState(() => _saving = true);
    try {
      final r = await savePartnerSettings(ref.read(apiProvider), _rebate, _split);
      if (!mounted) return;
      setState(() {
        _baseRebate = _rebate = r.rebate;
        _baseSplit = _split = r.split;
      });
      KHaptics.success();
      notes.toast(
        NotificationKind.success,
        t('partner.com.savedToast'),
        description: t('partner.com.savedToastText', {'rebate': fmtPct(r.rebate), 'split': fmtPct(r.split)}),
      );
      ref.invalidate(partnerDashboardProvider);
    } on ApiException catch (e) {
      notes.toast(NotificationKind.error, t('partner.com.saveFailed'), description: partnerError(e, t));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final p = widget.p;
    final level = widget.d.level;
    final readOnly = ref.watch(meProvider)?.readOnly ?? true;
    final groups = p.symbolGroups.where((g) => level != null && level.rates.containsKey(g.key)).toList();
    const pref = ['metals', 'fx-major', 'indices', 'crypto'];
    final exOptions = [for (final key in pref) ...groups.where((g) => g.key == key), ...groups.where((g) => !pref.contains(g.key))].take(4).toList();
    final gk = _gk ?? (exOptions.any((g) => g.key == 'metals') ? 'metals' : (exOptions.isEmpty ? '' : exOptions.first.key));
    const lots = 10;
    final rate = level?.rates[gk] ?? 0;
    final t1 = p.tierPct(1) ?? 100;
    final t2 = p.tierPct(2);
    final gross1 = lots * rate * t1 / 100;
    final toClient = gross1 * _rebate / 100;
    final gross2 = t2 != null ? lots * rate * t2 / 100 : 0.0;
    final toSub = gross2 * _split / 100;
    final dirty = _rebate != _baseRebate || _split != _baseSplit;

    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            title: t('partner.com.rebatesTitle'),
            subtitle: t('partner.com.rebatesSubtitle'),
            action: dirty
                ? KChip(label: t('partner.com.unsaved'), tone: KChipTone.warn, dot: true)
                : KChip(label: t('partner.com.saved'), tone: KChipTone.up, dot: true),
          ),
          const SizedBox(height: 18),
          _SliderBlock(
            label: t('partner.com.rebateToClients'),
            value: _rebate,
            max: p.maxRebatePct,
            color: k.ember,
            hint: t('partner.com.rebateHint', {'max': fmtPct(p.maxRebatePct)}),
            onChanged: readOnly ? null : (v) => setState(() => _rebate = v),
          ),
          const SizedBox(height: 18),
          _SliderBlock(
            label: t('partner.com.splitWithSubs'),
            value: _split,
            max: p.maxSplitPct,
            color: k.gold,
            hint: t('partner.com.splitHint', {'max': fmtPct(p.maxSplitPct)}),
            onChanged: readOnly ? null : (v) => setState(() => _split = v),
          ),
          if (level != null && exOptions.isNotEmpty) ...[
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: k.surface2,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: k.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  KRichText(
                    t('partner.com.example', {'lots': lots, 'rate': fmtRate(rate)}),
                    style: context.text.footnote.copyWith(color: k.fg2),
                    tags: {
                      'num': KTag(
                        style: TextStyle(color: k.fg, fontWeight: FontWeight.w500, fontFeatures: kTabular),
                      ),
                    },
                  ),
                  const SizedBox(height: 10),
                  KSegmented<String>(
                    values: [for (final g in exOptions) g.key],
                    labels: [for (final g in exOptions) _short[g.key] != null ? t(_short[g.key]!) : g.name.split(' ').first],
                    selected: gk,
                    plain: true,
                    height: 32,
                    onChanged: (v) => setState(() => _gk = v),
                  ),
                  _SplitRow(
                    title: t('partner.com.directTrades'),
                    gross: gross1,
                    parts: [(t('partner.com.clientRebate'), toClient, k.ember.withValues(alpha: 0.7)), (t('partner.com.youKeep'), gross1 - toClient, k.up)],
                  ),
                  if (t2 != null)
                    _SplitRow(
                      title: t('partner.com.subTrades', {'pct': fmtPct(t2)}),
                      gross: gross2,
                      parts: [(t('partner.network.subIb'), toSub, k.gold), (t('partner.com.youKeep'), gross2 - toSub, k.up)],
                    ),
                ],
              ),
            ),
          ],
          if (!readOnly) ...[
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                KButton(
                  label: t('common.reset'),
                  icon: LucideIcons.rotateCcw,
                  variant: KButtonVariant.ghost,
                  size: KButtonSize.sm,
                  onPressed: !dirty || _saving
                      ? null
                      : () => setState(() {
                          _rebate = _baseRebate;
                          _split = _baseSplit;
                        }),
                ),
                const SizedBox(width: 8),
                KButton(
                  label: _saving ? t('partner.com.saving') : t('common.save'),
                  icon: LucideIcons.save,
                  size: KButtonSize.sm,
                  loading: _saving,
                  onPressed: !dirty || _saving ? null : _save,
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _SliderBlock extends StatelessWidget {
  const _SliderBlock({required this.label, required this.value, required this.max, required this.color, required this.hint, this.onChanged});
  final String label, hint;
  final double value, max;
  final Color color;
  final ValueChanged<double>? onChanged;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final ticks = _ticks(max);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(
              child: Text(label, style: context.text.label.copyWith(color: k.fg2)),
            ),
            Text(
              fmtPct(value),
              textDirection: TextDirection.ltr,
              style: context.text.figure.copyWith(fontSize: 18, color: color),
            ),
          ],
        ),
        SizedBox(
          height: 44,
          child: CupertinoSlider(
            value: value.clamp(0, math.max(max, 0.0001)),
            max: math.max(max, 0.0001),
            divisions: math.max(1, max.round()),
            activeColor: color,
            onChanged: onChanged == null
                ? null
                : (v) {
                    final r = v.roundToDouble();
                    if (r != value) KHaptics.selection();
                    onChanged!(r);
                  },
          ),
        ),
        Directionality(
          textDirection: TextDirection.ltr,
          child: LayoutBuilder(
            builder: (context, c) => SizedBox(
              height: 14,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  for (final v in ticks)
                    Positioned(
                      left: 14 + (c.maxWidth - 28) * (max <= 0 ? 0 : v / max) - 14,
                      width: 28,
                      child: Text(
                        '$v%',
                        textAlign: TextAlign.center,
                        style: context.text.caption.copyWith(fontSize: 10, color: k.fg3, fontWeight: FontWeight.w400, fontFeatures: kTabular),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          hint,
          style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
        ),
      ],
    );
  }
}

class _SplitRow extends StatelessWidget {
  const _SplitRow({required this.title, required this.gross, required this.parts});
  final String title;
  final double gross;
  final List<(String, double, Color)> parts;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.footnote.copyWith(color: k.fg3),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                Fmt.money(gross),
                textDirection: TextDirection.ltr,
                style: context.text.footnote.copyWith(fontWeight: FontWeight.w600, color: k.fg),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(5),
            child: SizedBox(
              height: 10,
              child: ColoredBox(
                color: k.surface3,
                child: gross <= 0
                    ? const SizedBox.expand()
                    : Row(
                        children: [
                          for (final (i, part) in parts.indexed) ...[
                            if (i > 0) const SizedBox(width: 2),
                            Expanded(
                              flex: math.max(0, (part.$2 / gross * 1000).round()),
                              child: AnimatedContainer(duration: const Duration(milliseconds: 300), color: part.$3),
                            ),
                          ],
                        ],
                      ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            spacing: 12,
            runSpacing: 4,
            children: [
              for (final part in parts)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(color: part.$3, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      part.$1,
                      style: context.text.caption.copyWith(fontSize: 12, color: k.fg3, fontWeight: FontWeight.w400),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      Fmt.money(part.$2),
                      textDirection: TextDirection.ltr,
                      style: context.text.caption.copyWith(fontSize: 12, color: k.fg, fontFeatures: kTabular),
                    ),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ tiers, CPA, rules */

class _TiersCard extends StatelessWidget {
  const _TiersCard({required this.p, this.level});
  final PProgramme p;
  final PLevel? level;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final lv = level;
    final exKey = lv == null ? null : (lv.rates.containsKey('metals') ? 'metals' : lv.rates.keys.firstOrNull);
    final exRate = exKey != null && lv != null ? lv.rates[exKey] : null;
    final exName = p.symbolGroups.where((g) => g.key == exKey).firstOrNull?.name ?? exKey;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('partner.com.tiersTitle'), subtitle: t('partner.com.tiersSubtitle'), icon: LucideIcons.layers),
          const SizedBox(height: 14),
          for (final (i, tier) in p.tiers.indexed) ...[
            if (i > 0) const SizedBox(height: 10),
            PartnerRow(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      TierChip(tier.tier),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(t('partner.tierN', {'n': tier.tier}), style: context.text.label.copyWith(color: k.fg)),
                      ),
                      Text(fmtPct(tier.pct), textDirection: TextDirection.ltr, style: context.text.figure.copyWith(fontSize: 16)),
                    ],
                  ),
                  const SizedBox(height: 9),
                  KProgressBar(
                    value: math.min(100, tier.pct) / 100,
                    color: tier.tier == 1
                        ? k.ember
                        : tier.tier == 2
                        ? k.gold
                        : k.up,
                  ),
                  const SizedBox(height: 7),
                  KRichText(
                    '${tier.tier >= 1 && tier.tier <= 3 ? t.dyn('partner.com.tierNote${tier.tier}') : t('partner.levelsBelow', {'n': tier.tier - 1})}'
                    '${exRate != null ? ' · ${t('partner.com.pays', {'name': exName ?? '', 'rate': fmtRate(double.parse((exRate * tier.pct / 100).toStringAsFixed(2)))})}' : ''}',
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                    tags: {
                      'num': KTag(
                        style: TextStyle(color: k.fg2, fontWeight: FontWeight.w500, fontFeatures: kTabular),
                      ),
                    },
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _CpaCard extends StatelessWidget {
  const _CpaCard({required this.p, this.level});
  final PProgramme p;
  final PLevel? level;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final levels = [...p.levels]..sort((a, b) => a.rank.compareTo(b.rank));
    final mins = p.minTradeSeconds / 60;
    final amounts = levels.map((l) => l.cpaAmount).toSet();
    final steps = [
      for (var i = 0; i < levels.length; i++)
        if (i == 0 || levels[i].cpaAmount != levels[i - 1].cpaAmount)
          t('partner.cpa.amountFrom', {'amount': money0(levels[i].cpaAmount), 'name': levels[i].name}),
    ];
    final rows = <(IconData, String, String)>[
      (LucideIcons.target, t('partner.cpa.firstDeposit'), t('partner.cpa.orMore', {'amount': money0(p.cpaMinFirstDeposit)})),
      if (p.cpaRequireFirstTrade)
        (
          LucideIcons.timer,
          t('partner.cpa.firstTrade'),
          t('partner.cpa.heldOrMore', {
            'duration': mins >= 1 ? t('partner.unit.min', {'n': _clean(mins)}) : t('partner.unit.sec', {'n': p.minTradeSeconds}),
          }),
        ),
      (LucideIcons.hourglass, t('partner.cpa.holdPeriod'), t('partner.cpa.days', {'count': p.cpaHoldDays})),
    ];
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            title: t('partner.cpa.title'),
            subtitle: t('partner.cpa.subtitle'),
            action: p.cpaEnabled ? null : KChip(label: t('partner.cpa.notOffered')),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            crossAxisAlignment: WrapCrossAlignment.end,
            children: [
              KMoney(level?.cpaAmount ?? 0, decimals: 0, style: context.text.moneyL.copyWith(fontSize: 30)),
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Text(t('partner.cpa.atLevel', {'name': level?.name ?? t('partner.yourLevel')}), style: context.text.footnote.copyWith(color: k.fg3)),
              ),
            ],
          ),
          if (amounts.length > 1) ...[
            const SizedBox(height: 4),
            Text(
              steps.join(' · '),
              style: context.text.caption.copyWith(fontSize: 12, color: k.fg3, fontWeight: FontWeight.w400),
            ),
          ],
          const SizedBox(height: 14),
          for (final (i, r) in rows.indexed) ...[
            if (i > 0) const SizedBox(height: 8),
            Opacity(
              opacity: p.cpaEnabled ? 1 : 0.6,
              child: PartnerRow(
                child: Row(
                  children: [
                    RoundIcon(r.$1, bg: k.goldSoft, fg: k.gold),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(r.$2, style: context.text.footnote.copyWith(color: k.fg2)),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        r.$3,
                        textAlign: TextAlign.end,
                        style: context.text.footnote.copyWith(fontWeight: FontWeight.w600, color: k.fg, fontFeatures: kTabular),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _RulesCard extends StatelessWidget {
  const _RulesCard({required this.p});
  final PProgramme p;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final mins = p.minTradeSeconds / 60;
    final rules = <(IconData, String, String)>[
      (
        LucideIcons.timer,
        t('partner.rules.minDuration'),
        t('partner.rules.minDurationText', {
          'duration': mins >= 1 ? t('partner.unit.minutes', {'count': _clean(mins)}) : t('partner.unit.seconds', {'count': p.minTradeSeconds}),
        }),
      ),
      (LucideIcons.ban, t('partner.rules.liveOnly'), t('partner.rules.liveOnlyText')),
      if (p.excludedGroups.isNotEmpty)
        (LucideIcons.clock, t('partner.rules.excluded'), t('partner.rules.excludedText', {'groups': p.excludedGroups.join(', ')})),
      (LucideIcons.userX, t('partner.rules.selfReferral'), t('partner.rules.selfReferralText')),
      (LucideIcons.infinity, t('partner.rules.permanent'), t('partner.rules.permanentText')),
    ];
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('partner.rules.title'), subtitle: t('partner.rules.subtitle'), icon: LucideIcons.shieldAlert),
          const SizedBox(height: 14),
          for (final (i, r) in rules.indexed) ...[
            if (i > 0) const SizedBox(height: 8),
            PartnerRow(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(padding: const EdgeInsets.only(top: 1), child: RoundIcon(r.$1)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(r.$2, style: context.text.label.copyWith(color: k.fg)),
                        const SizedBox(height: 2),
                        Text(
                          r.$3,
                          style: context.text.caption.copyWith(fontSize: 12, color: k.fg3, fontWeight: FontWeight.w400, height: 1.4),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ ledger */

String _rateText(T t, PCommission e) {
  if (e.kind == 'cpa') return t('partner.com.rateFixed');
  if (e.kind == 'split') return t('partner.com.rateSplit', {'pct': fmtPct(e.sharePct)});
  if (e.kind == 'rebate') return t('partner.com.rateRebate', {'pct': fmtPct(e.sharePct)});
  if (e.kind == 'lot') {
    final option = isOptionLine(symbolGroup: e.symbolGroup, contracts: e.contracts, symbol: e.symbol);
    final rate = option ? t('partner.com.ratePerContract', {'rate': fmtRate(e.rate)}) : fmtRate(e.rate);
    return '$rate${e.sharePct != 100 ? ' × ${fmtPct(e.sharePct)}' : ''}';
  }
  return '—';
}

/// "Lot commission", or "Options commission" for a per-contract line on an option deal.
String _lineKind(T t, PCommission e) =>
    e.kind == 'lot' && isOptionLine(symbolGroup: e.symbolGroup, contracts: e.contracts, symbol: e.symbol) ? t('partner.kind.option') : kindLabel(t, e.kind);

IconData _kindIcon(String kind) => switch (kind) {
  'cpa' => LucideIcons.target,
  'clawback' => LucideIcons.rotateCcw,
  'adjustment' => LucideIcons.slidersHorizontal,
  'split' => LucideIcons.gitFork,
  _ => LucideIcons.coins,
};

class _LedgerCard extends ConsumerStatefulWidget {
  const _LedgerCard();

  @override
  ConsumerState<_LedgerCard> createState() => _LedgerCardState();
}

class _LedgerCardState extends ConsumerState<_LedgerCard> {
  String _status = 'all';
  String _kind = 'all';
  int _page = 1;
  PCommissions? _last;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final q = (page: _page, status: _status, kind: _kind);
    final async = ref.watch(partnerCommissionsProvider(q));
    if (async.hasValue) _last = async.value;
    final data = async.value ?? _last;
    final stale = !async.hasValue;
    final filtered = _status != 'all' || _kind != 'all';
    final pages = data == null ? 1 : math.max(1, (data.total / kLedgerLimit).ceil());

    return KCard(
      padding: const EdgeInsets.fromLTRB(14, 18, 14, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child: KCardHeader(title: t('partner.com.ledger'), subtitle: t('partner.com.ledgerSubtitle')),
          ),
          if (data != null) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                KChip(label: '${t('partner.commissionStatus.pending')} ${Fmt.money(data.totals['pending'] ?? 0)}', tone: KChipTone.warn),
                KChip(label: '${t('partner.commissionStatus.approved')} ${Fmt.money(data.totals['approved'] ?? 0)}', tone: KChipTone.info),
                KChip(label: '${t('partner.commissionStatus.paid')} ${Fmt.money(data.totals['paid'] ?? 0)}', tone: KChipTone.up),
              ],
            ),
          ],
          const SizedBox(height: 12),
          KChoiceChips<String>(
            values: const ['all', 'pending', 'approved', 'paid', 'rejected', 'void'],
            labels: [
              t('common.all'),
              t('partner.commissionStatus.pending'),
              t('partner.commissionStatus.approved'),
              t('partner.commissionStatus.paid'),
              t('partner.commissionStatus.rejected'),
              t('partner.commissionStatus.void'),
            ],
            selected: _status,
            onChanged: (v) => setState(() {
              _status = v;
              _page = 1;
            }),
          ),
          const SizedBox(height: 4),
          KChoiceChips<String>(
            values: const ['all', 'lot', 'split', 'rebate', 'cpa', 'clawback', 'adjustment'],
            labels: [
              t('partner.com.allTypes'),
              t('partner.lots'),
              t('partner.com.splits'),
              t('partner.com.rebates'),
              'CPA',
              t('partner.com.clawbacks'),
              t('partner.com.adjustments'),
            ],
            selected: _kind,
            onChanged: (v) => setState(() {
              _kind = v;
              _page = 1;
            }),
          ),
          const SizedBox(height: 8),
          if (data == null && async.hasError)
            PartnerLoadProblem(error: async.error!, onRetry: () => ref.invalidate(partnerCommissionsProvider(q)))
          else if (data == null)
            Column(
              children: [
                for (var i = 0; i < 5; i++) ...[if (i > 0) const SizedBox(height: 8), const KSkeleton(height: 48, radius: 14)],
              ],
            )
          else
            AnimatedOpacity(
              duration: const Duration(milliseconds: 150),
              opacity: stale ? 0.6 : 1,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (data.items.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: filtered
                          ? CardEmpty(title: t('partner.com.noMatch'), text: t('partner.com.noMatchText'))
                          : CardEmpty(title: t('partner.noCommission'), text: t('partner.com.ledgerEmptyText')),
                    )
                  else
                    for (final (i, e) in data.items.indexed) ...[if (i > 0) const KDivider(), _LedgerRow(e: e)],
                  if (data.total > 0) ...[
                    const SizedBox(height: 10),
                    PartnerPager(
                      from: (data.page - 1) * kLedgerLimit + 1,
                      to: math.min(data.total, data.page * kLedgerLimit),
                      total: data.total,
                      page: _page,
                      pages: pages,
                      onPrev: _page <= 1 || stale ? null : () => setState(() => _page -= 1),
                      onNext: _page >= pages || stale ? null : () => setState(() => _page += 1),
                    ),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _LedgerRow extends StatelessWidget {
  const _LedgerRow({required this.e});
  final PCommission e;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final pf = PartnerFmt(t);
    final struck = e.status == 'rejected' || e.status == 'void';
    final option = isOptionLine(symbolGroup: e.symbolGroup, contracts: e.contracts, symbol: e.symbol);
    final title = e.symbol != null ? symbolLabel(t, e.symbol!) : kindLabel(t, e.kind);
    final detail = e.symbol != null ? _lineKind(t, e) : e.note;
    final size = option ? optionsLabel(t, e.contracts) : (e.lots != 0 ? t('partner.lotsN', {'lots': pf.lots(e.lots)}) : null);
    final via = e.source == 'pamm'
        ? t('partner.com.viaPamm')
        : e.source == 'copy'
        ? t('partner.com.viaCopy')
        : null;
    return KPressable(
      onTap: () => _openLine(context, e),
      pressedScale: 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          children: [
            SizedBox(width: 38, child: Center(child: e.symbol != null ? TradeSymbolAvatar(e.symbol!) : RoundIcon(_kindIcon(e.kind), size: 30))),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.label.copyWith(color: k.fg),
                  ),
                  Text(
                    [?detail, ?size].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.caption.copyWith(fontSize: 11, color: k.fg3, fontWeight: FontWeight.w400),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    [e.clientName, ?via, pf.dateTime(e.createdAt)].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.caption.copyWith(fontSize: 11, color: k.fg2, fontWeight: FontWeight.w400, fontFeatures: kTabular),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${e.amount >= 0 ? '+' : '-'}${Fmt.money(e.amount.abs())}',
                  textDirection: TextDirection.ltr,
                  style: context.text.label.copyWith(
                    fontWeight: FontWeight.w600,
                    fontFeatures: kTabular,
                    decoration: struck ? TextDecoration.lineThrough : null,
                    color: struck
                        ? k.fg3
                        : e.amount >= 0
                        ? k.up
                        : k.down,
                  ),
                ),
                const SizedBox(height: 4),
                CommissionStatusChip(e.status),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// All of the web table's columns for one line (phones hide tier and rate in the list).
  static void _openLine(BuildContext context, PCommission e) {
    final t = context.t;
    final pf = PartnerFmt(t);
    final option = isOptionLine(symbolGroup: e.symbolGroup, contracts: e.contracts, symbol: e.symbol);
    showKSheet<void>(
      context,
      title: _lineKind(t, e),
      builder: (ctx) => KSheetContent(
        children: [
          PersonCell(
            name: e.clientName,
            country: e.clientCountry,
            size: 40,
            sub: e.source == 'pamm'
                ? t('partner.com.viaPamm')
                : e.source == 'copy'
                ? t('partner.com.viaCopy')
                : null,
          ),
          const SizedBox(height: 12),
          KKeyValues([
            KKV(t('common.date'), pf.dateTime(e.createdAt), mono: true),
            KKV('#', e.dealId != null ? '#${e.dealId}' : 'C-${e.id}', mono: true),
            KKV(t('common.type'), e.symbol != null ? '${symbolLabel(t, e.symbol!)} · ${_lineKind(t, e)}' : kindLabel(t, e.kind)),
            if (e.note != null) KKV(t('common.type'), e.note),
            KKV(t('partner.lots'), option ? optionsLabel(t, e.contracts) : (e.lots != 0 ? pf.lots(e.lots) : '—'), mono: !option),
            KKV(t('partner.tier'), null, valueWidget: e.tier != 0 ? TierChip(e.tier) : const Text('—')),
            KKV(t('partner.com.rate'), _rateText(t, e), mono: true),
            KKV(
              t('common.amount'),
              '${e.amount >= 0 ? '+' : '-'}${Fmt.money(e.amount.abs())}',
              mono: true,
              tone: e.status == 'rejected' || e.status == 'void'
                  ? ctx.k.fg3
                  : e.amount >= 0
                  ? ctx.k.up
                  : ctx.k.down,
            ),
            KKV(t('common.status'), null, valueWidget: CommissionStatusChip(e.status)),
          ]),
        ],
      ),
    );
  }
}
