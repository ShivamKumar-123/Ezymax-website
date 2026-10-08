// A10: side-by-side comparison of 2–3 masters from the leaderboard (each column from GET masters/{id}).
// Port of apps/crm/components/social-live/compare.tsx; on phones the table scrolls sideways.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/format/format.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../social_api.dart';
import 'bits.dart';
import 'follow_sheet.dart';

const int compareMax = 3;

Future<void> showCompareSheet(BuildContext context, {required List<MasterView> masters, required ValueChanged<int> onRemove}) => showKSheet<void>(
  context,
  builder: (_) => CompareSheet(masters: masters, onRemove: onRemove),
);

class CompareSheet extends ConsumerStatefulWidget {
  const CompareSheet({super.key, required this.masters, required this.onRemove});
  final List<MasterView> masters;
  final ValueChanged<int> onRemove;

  @override
  ConsumerState<CompareSheet> createState() => _CompareSheetState();
}

typedef _Col = ({MasterView m, double minAllocation, bool loading, bool failed});
typedef _Row = ({String key, String label, double? Function(_Col c) value, Widget Function(_Col c) render, String? better});

class _CompareSheetState extends ConsumerState<CompareSheet> {
  late final List<MasterView> _masters = [...widget.masters];

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final cols = <_Col>[
      for (final m in _masters)
        () {
          final p = ref.watch(masterOnceProvider(m.id));
          final pm = p.value?.master ?? m;
          return (
            m: pm,
            minAllocation: p.value?.termsMinAllocation ?? m.minAllocationEffective ?? m.minAllocation,
            loading: p.isLoading && !p.hasValue,
            failed: p.hasError && !p.hasValue,
          );
        }(),
    ];
    Widget ret(double v) => Num(
      pct(v, 1),
      color: toneColor(context, v),
      style: const TextStyle(fontWeight: FontWeight.w600),
    );
    final rows = <_Row>[
      (
        key: 'r1m',
        label: t('social.lb.col.return', {'period': t('social.lb.period.1m')}),
        value: (c) => c.m.stats.return1m,
        render: (c) => ret(c.m.stats.return1m),
        better: 'high',
      ),
      (
        key: 'r3m',
        label: t('social.lb.col.return', {'period': t('social.lb.period.3m')}),
        value: (c) => c.m.stats.return3m,
        render: (c) => ret(c.m.stats.return3m),
        better: 'high',
      ),
      (
        key: 'r1y',
        label: t('social.lb.col.return', {'period': t('social.lb.period.1y')}),
        value: (c) => c.m.stats.return1y,
        render: (c) => ret(c.m.stats.return1y),
        better: 'high',
      ),
      (key: 'rall', label: t('social.returnAll'), value: (c) => c.m.stats.returnAll, render: (c) => ret(c.m.stats.returnAll), better: 'high'),
      (
        key: 'dd',
        label: t('social.maxDd'),
        value: (c) => c.m.stats.maxDd,
        render: (c) => Num(ddText(c.m.stats.maxDd), color: c.m.stats.maxDd > 0 ? k.down : k.fg2),
        better: 'low',
      ),
      (
        key: 'risk',
        label: t('social.risk'),
        value: (c) => c.m.stats.riskScore.toDouble(),
        render: (c) => RiskBadge(risk: c.m.stats.riskScore, showLabel: true),
        better: 'low',
      ),
      (
        key: 'fol',
        label: t('social.followers'),
        value: (c) => c.m.stats.followers.toDouble(),
        render: (c) => Num(LocaleFormat(t.locale).number(c.m.stats.followers, 0)),
        better: 'high',
      ),
      (key: 'aum', label: t('social.aum'), value: (c) => c.m.stats.aum, render: (c) => Num(compactUsd(c.m.stats.aum)), better: 'high'),
      (
        key: 'fee',
        label: t('social.performanceFee'),
        value: (c) => c.m.perfFeePct,
        render: (c) => Num('${numText(c.m.perfFeePct)}% · ${periodLabel(t, c.m.feePeriod).toLowerCase()}'),
        better: 'low',
      ),
      (key: 'min', label: t('social.profile.minAllocation'), value: (c) => c.minAllocation, render: (c) => Num(usd(c.minAllocation, 0)), better: 'low'),
      (
        key: 'tr',
        label: t('social.profile.closedTrades'),
        value: (c) => c.m.stats.trades.toDouble(),
        render: (c) => Num(LocaleFormat(t.locale).number(c.m.stats.trades, 0)),
        better: null,
      ),
      (
        key: 'wr',
        label: t('social.profile.winRate'),
        value: (c) => c.m.stats.trades > 0 ? c.m.stats.winRate : null,
        render: (c) => Num(c.m.stats.trades > 0 ? '${c.m.stats.winRate.toStringAsFixed(1)}%' : '—'),
        better: 'high',
      ),
      (key: 'age', label: t('social.lb.col.age'), value: (c) => c.m.ageDays.toDouble(), render: (c) => Num(formatAge(t, c.m.ageDays)), better: 'high'),
      (
        key: 'open',
        label: t('social.compare.accepting'),
        value: (_) => null,
        render: (c) => c.m.acceptingNew == false
            ? KChip(label: t('common.no'), tone: KChipTone.warn, small: true)
            : KChip(label: t('common.yes'), tone: KChipTone.up, small: true),
        better: null,
      ),
    ];

    int? best(_Row r) {
      if (r.better == null || cols.length < 2) return null;
      final vals = [for (final c in cols) r.value(c)];
      final nums = vals.whereType<double>().where((v) => v.isFinite).toList();
      if (nums.length < 2) return null;
      final target = r.better == 'high' ? nums.reduce((a, b) => a > b ? a : b) : nums.reduce((a, b) => a < b ? a : b);
      if (nums.every((v) => v == target)) return null;
      return vals.indexOf(target);
    }

    const labelW = 116.0, colW = 132.0;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SheetTitle(title: t('social.compare.title'), description: t('social.compare.description')),
          if (cols.length < 2)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Text(
                t('social.compare.pickTwo'),
                textAlign: TextAlign.center,
                style: context.text.footnote.copyWith(color: k.fg3),
              ),
            )
          else ...[
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(width: labelW),
                      for (final c in cols)
                        SizedBox(
                          width: colW,
                          child: Padding(
                            padding: const EdgeInsetsDirectional.only(end: 8, bottom: 10),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      child: KPressable(
                                        onTap: () => _open(c.m.id),
                                        child: MasterIdentity(nickname: c.m.nickname, size: 30, subText: c.m.strategy),
                                      ),
                                    ),
                                    KPressable(
                                      minSize: 32,
                                      semanticLabel: t('social.compare.remove', {'name': c.m.nickname}),
                                      onTap: () {
                                        widget.onRemove(c.m.id);
                                        setState(() => _masters.removeWhere((x) => x.id == c.m.id));
                                      },
                                      child: Icon(LucideIcons.x, size: 15, color: k.fg3),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                KPressable(
                                  onTap: () => _open(c.m.id),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        t('social.compare.profile'),
                                        style: context.text.caption.copyWith(color: k.ember, fontWeight: FontWeight.w600),
                                      ),
                                      const SizedBox(width: 3),
                                      Icon(
                                        Directionality.of(context) == TextDirection.rtl ? LucideIcons.arrowUpLeft : LucideIcons.arrowUpRight,
                                        size: 12,
                                        color: k.ember,
                                      ),
                                    ],
                                  ),
                                ),
                                if (c.failed)
                                  Text(
                                    t('social.compare.partial'),
                                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                                  ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                  for (final r in rows)
                    Container(
                      decoration: BoxDecoration(
                        border: Border(top: BorderSide(color: k.line, width: 0.6)),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 7),
                      child: Row(
                        children: [
                          SizedBox(
                            width: labelW,
                            child: Text(r.label, style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12)),
                          ),
                          for (var i = 0; i < cols.length; i++)
                            SizedBox(
                              width: colW,
                              child: Align(
                                alignment: AlignmentDirectional.centerStart,
                                child: cols[i].loading && r.key == 'min' && cols[i].m.minAllocationEffective == null
                                    ? const KSkeleton(width: 64)
                                    : Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                                        decoration: best(r) == i
                                            ? BoxDecoration(
                                                color: k.goldSoft,
                                                borderRadius: BorderRadius.circular(6),
                                                border: Border.all(color: k.gold.withValues(alpha: 0.3)),
                                              )
                                            : null,
                                        child: DefaultTextStyle.merge(
                                          style: context.text.footnote.copyWith(color: k.fg),
                                          child: r.render(cols[i]),
                                        ),
                                      ),
                              ),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Text(
              t('social.compare.note'),
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
            ),
          ],
        ],
      ),
    );
  }

  void _open(int id) {
    final router = GoRouter.of(context);
    Navigator.of(context).pop();
    router.push('/social/masters/$id');
  }
}
