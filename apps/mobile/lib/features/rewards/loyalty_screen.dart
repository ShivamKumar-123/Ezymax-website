// Contests & Rewards › Loyalty (/rewards/loyalty). Port of the web's LiveLoyaltyPage
// (apps/crm/components/growth/loyalty.tsx) in its phone order:
//   header (Loyalty + How it works)  ·  banner slot  ·  points balance  ·  loyalty tiers  ·  how you earn (+ estimate)
//   ·  rewards catalogue (redeem sheet, voucher)  ·  points history  ·  vouchers  ·  redemptions
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/notifications/notifications.dart';
import '../../data/client_data.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'rewards_api.dart';
import 'widgets/growth_ui.dart';

const Map<String, IconData> _kindIcon = {'cashback': LucideIcons.banknote, 'bonus_credit': LucideIcons.gift, 'fee_discount': LucideIcons.receipt};
const Map<String, KTone> _kindTone = {'cashback': KTone.mint, 'bonus_credit': KTone.coral, 'fee_discount': KTone.lavender};

int _tierRank(List<Tier> tiers, String? key) => key == null ? 0 : (tiers.where((t) => t.key == key).firstOrNull?.rank ?? 0);
String _tierName(List<Tier> tiers, String? key) => key == null ? '' : (tiers.where((t) => t.key == key).firstOrNull?.name ?? titleCase(key));

String _itemValue(GrowthFmt f, CatalogueItem it) {
  if (it.kind == 'fee_discount') return f.t('rewards.item.feeDiscount', {'pct': GrowthFmt.plain(it.value)});
  if (it.kind == 'bonus_credit') return f.t('rewards.item.tradingBonus', {'amount': f.usd0(it.value)});
  return f.t('rewards.item.toWallet', {'amount': f.usd0(it.value)});
}

/// After a redemption: the balance, the history, vouchers and redemptions (and the dashboard's points).
void _invalidateLoyalty(WidgetRef ref) {
  ref
    ..invalidate(growthRewardsProvider)
    ..invalidate(pointsHistoryProvider)
    ..invalidate(vouchersProvider)
    ..invalidate(redemptionsProvider)
    ..invalidate(rewardsProvider);
}

class LoyaltyScreen extends ConsumerStatefulWidget {
  const LoyaltyScreen({super.key});

  @override
  ConsumerState<LoyaltyScreen> createState() => _LoyaltyScreenState();
}

class _LoyaltyScreenState extends ConsumerState<LoyaltyScreen> {
  final _scroll = ScrollController();
  final _catalogueKey = GlobalKey();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final f = GrowthFmt(t);
    final title = t('rewards.loyalty.title');
    final subtitle = t('rewards.loyalty.subtitle');
    final v = ref.watch(growthRewardsProvider);
    if (!v.hasValue) {
      return GrowthFallback(
        title: title,
        subtitle: subtitle,
        error: v.hasError ? v.error : null,
        onRetry: () => ref.invalidate(growthRewardsProvider),
        heights: const [340, 340, 220],
      );
    }
    final r = v.requireValue;
    return KPageScroll(
      controller: _scroll,
      onRefresh: () async {
        _invalidateLoyalty(ref);
        ref.invalidate(bannersProvider('rewards'));
        await ref.read(growthRewardsProvider.future).then((_) {}, onError: (Object _) {});
      },
      children: [
        KPageHeader(title: title, subtitle: Text(subtitle)),
        const SizedBox(height: 12),
        Row(
          children: [
            KButton(
              label: t('rewards.loyalty.howItWorks'),
              icon: LucideIcons.info,
              variant: KButtonVariant.surface,
              onPressed: () => ref
                  .read(notificationsProvider.notifier)
                  .toast(
                    NotificationKind.info,
                    t('rewards.loyalty.howTitle'),
                    description: r.minHoldSeconds > 0
                        ? t('rewards.loyalty.howText', {'seconds': r.minHoldSeconds, 'value': f.usd(r.pointValue), 'months': r.pointsExpiryMonths})
                        : t('rewards.loyalty.howTextNoHold', {'value': f.usd(r.pointValue), 'months': r.pointsExpiryMonths}),
                    keep: false,
                  ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        const BannerSlot(placement: 'rewards'),
        _BalanceHero(r: r, onRedeem: () => scrollToKey(_scroll, _catalogueKey)),
        const SizedBox(height: kBlockGap),
        _TierTrack(r: r),
        const SizedBox(height: kBlockGap),
        _EarnRules(r: r),
        const SizedBox(height: kBlockGap),
        KeyedSubtree(
          key: _catalogueKey,
          child: _Catalogue(r: r),
        ),
        const SizedBox(height: kBlockGap),
        const _PointsHistory(),
        const SizedBox(height: kBlockGap),
        const _Vouchers(),
        const SizedBox(height: kBlockGap),
        const _Redemptions(),
      ],
    );
  }
}

/* ------------------------------------------------------------------ balance */

class _BalanceHero extends StatelessWidget {
  const _BalanceHero({required this.r, required this.onRedeem});
  final Rewards r;
  final VoidCallback onRedeem;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final last7 = r.series.length > 7 ? r.series.sublist(r.series.length - 7) : r.series;
    final week = [for (final d in last7) d.points];
    final exp = r.points.expiringPoints;
    Widget box(List<Widget> children) => Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: k.surface2.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: k.line),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
    );
    final small = context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400);
    return KCard(
      hot: true,
      padding: const EdgeInsets.all(22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(t('rewards.loyalty.balance'), style: context.text.label.copyWith(color: k.fg2)),
              ),
              _TierChip(tier: r.tier, label: '${r.tier.name} · ${f.mult(r.tier.multiplier)}'),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: AlignmentDirectional.centerStart,
                  child: Text(
                    f.points(r.points.balance),
                    key: const ValueKey('points-balance'),
                    textDirection: TextDirection.ltr,
                    style: context.text.moneyXL.copyWith(fontSize: 50, fontWeight: FontWeight.w600, letterSpacing: -1.5),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(t('rewards.unit.pts'), style: context.text.body.copyWith(fontSize: 16, color: k.fg2)),
            ],
          ),
          const SizedBox(height: 6),
          Text.rich(
            TextSpan(
              children: [
                const TextSpan(text: '≈ '),
                TextSpan(
                  text: f.usd(r.points.balance * r.pointValue),
                  style: TextStyle(fontWeight: FontWeight.w600, color: k.fg, fontFeatures: kTabular),
                ),
                TextSpan(text: ' ${t('rewards.loyalty.redeemable')}'),
              ],
            ),
            style: context.text.body.copyWith(color: k.fg2, fontSize: 14),
          ),
          const SizedBox(height: 20),
          TileRow(
            children: [
              box([
                Text(t('rewards.loyalty.thisMonth'), style: small),
                const SizedBox(height: 4),
                Text(
                  '${r.points.earnedThisMonth > 0 ? '+' : ''}${f.points(r.points.earnedThisMonth)}',
                  textDirection: TextDirection.ltr,
                  style: context.text.figure.copyWith(fontSize: 16, color: r.points.earnedThisMonth > 0 ? k.up : k.fg),
                ),
                const SizedBox(height: 8),
                if (week.any((v) => v > 0)) MiniBars(week) else SizedBox(height: 24, child: Text(t('rewards.loyalty.noTradesWeek'), style: small)),
              ]),
              box([
                Text(t('rewards.loyalty.lifetime'), style: small),
                const SizedBox(height: 4),
                Text(f.points(r.points.lifetime), textDirection: TextDirection.ltr, style: context.text.figure.copyWith(fontSize: 16)),
                const SizedBox(height: 8),
                Text(t('rewards.loyalty.lotsThisMonth', {'lots': r.points.lotsThisMonth.toStringAsFixed(2)}), style: small),
              ]),
            ],
          ),
          const SizedBox(height: 20),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              KButton(
                label: t('rewards.loyalty.redeemPoints'),
                trailingIcon: Directionality.of(context) == TextDirection.rtl ? LucideIcons.arrowUpLeft : LucideIcons.arrowUpRight,
                onPressed: onRedeem,
              ),
              if (exp != null && exp > 0)
                KChip(
                  label: t('rewards.loyalty.expire', {'points': f.points(exp), 'date': f.date(r.points.expiringAt, year: false)}),
                  tone: KChipTone.warn,
                  icon: LucideIcons.clock,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TierChip extends StatelessWidget {
  const _TierChip({required this.tier, required this.label});
  final Tier tier;
  final String label;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, border) = context.k.chip(KChipTone.gold);
    return Container(
      height: 24,
      padding: const EdgeInsets.symmetric(horizontal: 9),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          TierOrb(tier: tier.key, name: tier.name, size: 14),
          const SizedBox(width: 6),
          Text(
            label,
            style: context.text.caption.copyWith(color: fg, fontFeatures: kTabular),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ tiers */

class _TierTrack extends StatefulWidget {
  const _TierTrack({required this.r});
  final Rewards r;

  @override
  State<_TierTrack> createState() => _TierTrackState();
}

class _TierTrackState extends State<_TierTrack> {
  int? _sel;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final r = widget.r;
    final tiers = [...r.tiers]..sort((a, b) => a.rank.compareTo(b.rank));
    final idx = tiers.indexWhere((x) => x.key == r.tier.key).clamp(0, tiers.isEmpty ? 0 : tiers.length - 1);
    final cur = tiers.isEmpty ? r.tier : tiers[idx];
    final next = r.nextTier;
    final q = r.points.earned12m;
    final segPct = next != null ? ((q - cur.minPoints) / ((next.minPoints - cur.minPoints) < 1 ? 1 : next.minPoints - cur.minPoints)).clamp(0.0, 1.0) : 1.0;
    final overall = tiers.length > 1 ? ((idx + (next != null ? segPct : 0)) / (tiers.length - 1)).clamp(0.0, 1.0) : 1.0;
    final sel = (_sel ?? idx).clamp(0, tiers.isEmpty ? 0 : tiers.length - 1);
    final selTier = tiers.isEmpty ? cur : tiers[sel];
    String kfmt(double v) => v >= 1000 ? '${GrowthFmt.plain(((v / 1000) * 10).round() / 10)}k' : GrowthFmt.plain(v);
    final rtl = Directionality.of(context) == TextDirection.rtl;

    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            title: t('rewards.tiers.title'),
            subtitle: t('rewards.tiers.subtitle'),
            action: KChip(label: t('rewards.tiers.member', {'tier': r.tier.name}), tone: KChipTone.gold, dot: true),
          ),
          const SizedBox(height: 24),
          if (tiers.isNotEmpty)
            LayoutBuilder(
              builder: (context, c) {
                final span = c.maxWidth - 48;
                return Stack(
                  children: [
                    PositionedDirectional(
                      start: 24,
                      end: 24,
                      top: 17,
                      child: Container(
                        height: 6,
                        decoration: BoxDecoration(color: k.surface3, borderRadius: BorderRadius.circular(3)),
                      ),
                    ),
                    PositionedDirectional(
                      start: 24,
                      top: 17,
                      child: Container(
                        width: span * overall,
                        height: 6,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(3),
                          gradient: LinearGradient(
                            colors: [const Color(0xFFD98B4A), const Color(0xFFE9B949), k.ember2],
                            begin: rtl ? Alignment.centerRight : Alignment.centerLeft,
                            end: rtl ? Alignment.centerLeft : Alignment.centerRight,
                          ),
                        ),
                      ),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        for (var i = 0; i < tiers.length; i++)
                          KPressable(
                            onTap: () => setState(() => _sel = i),
                            semanticLabel: tiers[i].name,
                            child: SizedBox(
                              width: 48,
                              child: Column(
                                children: [
                                  Container(
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      boxShadow: [
                                        if (i == idx) BoxShadow(color: k.gold.withValues(alpha: 0.25), spreadRadius: 4),
                                        if (i == sel && i != idx) BoxShadow(color: k.line, spreadRadius: 2),
                                      ],
                                    ),
                                    child: i <= idx
                                        ? TierOrb(tier: tiers[i].key, name: tiers[i].name)
                                        : Container(
                                            width: 40,
                                            height: 40,
                                            decoration: BoxDecoration(
                                              color: k.surface2,
                                              shape: BoxShape.circle,
                                              border: Border.all(color: k.line),
                                            ),
                                            child: Icon(LucideIcons.lock, size: 14, color: k.fg3),
                                          ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    tiers[i].name,
                                    maxLines: 1,
                                    softWrap: false,
                                    overflow: TextOverflow.visible,
                                    style: context.text.caption.copyWith(
                                      fontSize: 12,
                                      color: i == idx ? k.gold : (i <= idx ? k.fg : k.fg3),
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  Text(
                                    kfmt(tiers[i].minPoints),
                                    textDirection: TextDirection.ltr,
                                    style: context.text.micro.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontFeatures: kTabular),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                );
              },
            ),
          const SizedBox(height: 22),
          RowBox(
            padding: const EdgeInsets.all(16),
            child: next != null
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              t('rewards.tiers.progressTo', {'tier': next.name}),
                              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                            ),
                          ),
                          Text(
                            '${f.points(q)} / ${f.points(next.minPoints)}',
                            textDirection: TextDirection.ltr,
                            style: context.text.caption.copyWith(color: k.fg2, fontFeatures: kTabular),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      KProgressBar(value: segPct, color: k.gold, height: 8),
                      const SizedBox(height: 10),
                      Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: t('rewards.value.pts', {'points': f.points(next.pointsToGo)}),
                              style: TextStyle(color: k.gold, fontWeight: FontWeight.w700, fontFeatures: kTabular),
                            ),
                            TextSpan(text: t('rewards.tiers.toTier', {'tier': next.name})),
                          ],
                        ),
                        style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13),
                      ),
                    ],
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        t('rewards.tiers.top'),
                        style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                      ),
                      const SizedBox(height: 6),
                      KRichText(
                        t('rewards.tiers.topText', {'mult': f.mult(r.tier.multiplier)}),
                        style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13),
                        tags: {
                          'b': KTag(
                            style: TextStyle(color: k.gold, fontWeight: FontWeight.w700),
                          ),
                        },
                      ),
                    ],
                  ),
          ),
          const SizedBox(height: 10),
          RowBox(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    TierOrb(tier: selTier.key, name: selTier.name, size: 22),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '${selTier.name} · ${f.mult(selTier.multiplier)}',
                        style: context.text.callout.copyWith(fontWeight: FontWeight.w600, color: k.fg),
                      ),
                    ),
                    if (sel <= idx)
                      KChip(label: t('rewards.tiers.unlocked'), tone: KChipTone.up, small: true)
                    else
                      KChip(label: t('rewards.tiers.locked'), small: true),
                  ],
                ),
                const SizedBox(height: 10),
                if (selTier.perks.isNotEmpty)
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final p in selTier.perks) KChip(label: p, icon: LucideIcons.check, tone: sel <= idx ? KChipTone.up : KChipTone.neutral, small: true),
                    ],
                  )
                else
                  Text(t('rewards.tiers.noPerks'), style: context.text.footnote.copyWith(color: k.fg3)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ earn rules */

const Map<String, IconData> _classIcon = {
  'forex': LucideIcons.globe,
  'metals': LucideIcons.coins,
  'metal': LucideIcons.coins,
  'crypto': LucideIcons.bitcoin,
  'indices': LucideIcons.chartLine,
  'index': LucideIcons.chartLine,
  'energy': LucideIcons.flame,
  'commodities': LucideIcons.flame,
  'stocks': LucideIcons.chartColumn,
  'shares': LucideIcons.chartColumn,
};

String _ruleLabel(EarnRule rule, String allLabel) {
  if (rule.name.isNotEmpty) return rule.name;
  if (rule.symbols.isNotEmpty) return rule.symbols.join(', ');
  return rule.assetClass != null && rule.assetClass!.isNotEmpty ? titleCase(rule.assetClass!) : allLabel;
}

class _EarnRules extends StatefulWidget {
  const _EarnRules({required this.r});
  final Rewards r;

  @override
  State<_EarnRules> createState() => _EarnRulesState();
}

class _EarnRulesState extends State<_EarnRules> {
  int _sel = 0;
  final _lots = TextEditingController(text: '10');

  @override
  void dispose() {
    _lots.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final r = widget.r;
    final rules = r.rules;
    final rule = rules.isEmpty ? null : rules[_sel.clamp(0, rules.length - 1)];
    final pts = rule == null ? 0.0 : ((double.tryParse(_lots.text) ?? 0) * rule.pointsPerLot * r.tier.multiplier).floorToDouble();
    final max = rules.fold<double>(1, (m, x) => x.pointsPerLot > m ? x.pointsPerLot : m);
    final all = t('rewards.earn.allInstruments');
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            title: t('rewards.earn.title'),
            subtitle: r.minHoldSeconds > 0
                ? t('rewards.earn.subtitle', {'seconds': r.minHoldSeconds, 'months': r.pointsExpiryMonths})
                : t('rewards.earn.subtitleNoHold', {'months': r.pointsExpiryMonths}),
            icon: LucideIcons.sparkles,
            tone: KTone.amber,
          ),
          const SizedBox(height: 14),
          if (rules.isEmpty)
            CardEmpty(title: t('rewards.earn.emptyTitle'), text: t('rewards.earn.emptyText'))
          else ...[
            TileGrid(
              children: [
                for (var i = 0; i < rules.length; i++)
                  KPressable(
                    onTap: () {
                      KHaptics.selection();
                      setState(() => _sel = i);
                    },
                    child: RowBox(
                      color: _sel == i ? k.emberSoft : null,
                      border: _sel == i ? k.ember.withValues(alpha: 0.4) : null,
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          KIconTile(icon: _classIcon[(rules[i].assetClass ?? '').toLowerCase()] ?? LucideIcons.sparkles, tone: KTone.amber, size: 30),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        _ruleLabel(rules[i], all),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: context.text.footnote.copyWith(fontWeight: FontWeight.w600, color: k.fg, fontSize: 13),
                                      ),
                                    ),
                                    Text(
                                      GrowthFmt.plain(rules[i].pointsPerLot),
                                      textDirection: TextDirection.ltr,
                                      style: context.text.figure.copyWith(fontSize: 14, color: k.gold, fontWeight: FontWeight.w700),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                KProgressBar(value: rules[i].pointsPerLot / max, color: k.gold, height: 4),
                                const SizedBox(height: 5),
                                Text(
                                  '${rules[i].symbols.isNotEmpty ? rules[i].symbols.take(4).join(', ') : (rules[i].assetClass != null && rules[i].assetClass!.isNotEmpty ? t('rewards.earn.allClass', {'assetClass': rules[i].assetClass}) : t('rewards.earn.anyInstrument'))}'
                                  '${rules[i].accountType == 'any' ? t('rewards.earn.demoToo') : ''}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 11),
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
            const SizedBox(height: 12),
            DashedBox(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Icon(LucideIcons.calculator, size: 16, color: k.fg3),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(t('rewards.earn.estimate'), style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13)),
                      ),
                      SizedBox(
                        width: 130,
                        child: KTextField(
                          controller: _lots,
                          ltr: true,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
                          trailing: Padding(
                            padding: const EdgeInsetsDirectional.only(end: 8),
                            child: Text(t('rewards.unit.lots'), style: context.text.caption.copyWith(color: k.fg3)),
                          ),
                          onChanged: (_) => setState(() {}),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    t('rewards.earn.estimateOf', {
                      'rule': rule == null ? '' : _ruleLabel(rule, all).toLowerCase(),
                      'tier': r.tier.name,
                      'mult': f.mult(r.tier.multiplier),
                    }),
                    style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Expanded(
                        child: Text(
                          t('rewards.value.pts', {'points': f.points(pts)}),
                          key: const ValueKey('points-estimate'),
                          style: context.text.figure.copyWith(fontSize: 18, color: k.gold, fontWeight: FontWeight.w700),
                        ),
                      ),
                      Text(
                        '≈ ${f.usd(pts * r.pointValue)}',
                        textDirection: TextDirection.ltr,
                        style: context.text.footnote.copyWith(color: k.fg3, fontFeatures: kTabular),
                      ),
                    ],
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

/* ------------------------------------------------------------------ catalogue */

class _Catalogue extends ConsumerWidget {
  const _Catalogue({required this.r});
  final Rewards r;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    final items = r.catalogue.where((i) => i.active).toList();
    final myRank = _tierRank(r.tiers, r.tier.key);
    final toasts = ref.read(notificationsProvider.notifier);
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(t('rewards.catalogue.title'), style: context.text.title2),
          const SizedBox(height: 3),
          KRichText(
            t('rewards.catalogue.youHave', {'points': f.points(r.points.balance)}),
            style: context.text.footnote.copyWith(color: k.fg3),
            tags: {
              'b': KTag(
                style: TextStyle(color: k.gold, fontWeight: FontWeight.w600, fontFeatures: kTabular),
              ),
            },
          ),
          const SizedBox(height: 16),
          if (items.isEmpty)
            CardEmpty(title: t('rewards.catalogue.emptyTitle'), text: t('rewards.catalogue.emptyText'))
          else
            TileGrid(
              gap: 10,
              children: [
                for (final it in items)
                  Builder(
                    builder: (context) {
                      final lockedTier = it.minTier != null && _tierRank(r.tiers, it.minTier) > myRank;
                      final out = it.stock != null && it.stock! <= 0;
                      final afford = r.points.balance >= it.costPoints;
                      final ok = !lockedTier && !out && afford;
                      return Container(
                        key: ValueKey('catalogue-item-${it.id}'),
                        padding: const EdgeInsets.all(13),
                        decoration: BoxDecoration(
                          color: k.surface2,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: k.line),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                KIconTile(icon: _kindIcon[it.kind] ?? LucideIcons.gift, tone: _kindTone[it.kind] ?? KTone.coral),
                                const Spacer(),
                                if (it.minTier != null)
                                  Flexible(
                                    child: KChip(
                                      label: '${_tierName(r.tiers, it.minTier)}+',
                                      tone: lockedTier ? KChipTone.neutral : KChipTone.gold,
                                      icon: lockedTier ? LucideIcons.lock : null,
                                      small: true,
                                    ),
                                  )
                                else if (it.stock != null)
                                  Flexible(
                                    child: KChip(
                                      label: out ? t('rewards.catalogue.outOfStock') : t('rewards.catalogue.left', {'count': it.stock}),
                                      tone: out ? KChipTone.down : KChipTone.neutral,
                                      small: true,
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              it.name,
                              style: context.text.callout.copyWith(fontWeight: FontWeight.w600, color: k.fg),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              it.description.isNotEmpty ? it.description : _itemValue(f, it),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                            ),
                            const Spacer(),
                            const SizedBox(height: 12),
                            Text(
                              t('rewards.value.pts', {'points': f.points(it.costPoints)}),
                              style: context.text.figure.copyWith(fontSize: 15, color: k.gold, fontWeight: FontWeight.w700),
                            ),
                            Text(
                              _itemValue(f, it),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: context.text.micro.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                            ),
                            if (!readOnly) ...[
                              const SizedBox(height: 10),
                              KButton(
                                key: ValueKey('redeem-${it.id}'),
                                label: t('rewards.catalogue.redeem'),
                                size: KButtonSize.sm,
                                expand: true,
                                variant: ok ? KButtonVariant.outline : KButtonVariant.surface,
                                onPressed: () {
                                  if (lockedTier) {
                                    toasts.toast(
                                      NotificationKind.error,
                                      t('rewards.catalogue.tierRequired', {'tier': _tierName(r.tiers, it.minTier)}),
                                      description: t('rewards.catalogue.tierRequiredText'),
                                      keep: false,
                                    );
                                  } else if (out) {
                                    toasts.toast(
                                      NotificationKind.error,
                                      t('rewards.catalogue.outOfStock'),
                                      description: t('rewards.catalogue.outOfStockText'),
                                      keep: false,
                                    );
                                  } else if (!afford) {
                                    toasts.toast(
                                      NotificationKind.error,
                                      t('rewards.catalogue.notEnough'),
                                      description: t('rewards.catalogue.needMore', {'points': f.points(it.costPoints - r.points.balance)}),
                                      keep: false,
                                    );
                                  } else {
                                    showKSheet<void>(
                                      context,
                                      builder: (_) => _RedeemSheet(item: it, r: r),
                                    );
                                  }
                                },
                              ),
                            ],
                          ],
                        ),
                      );
                    },
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

class _RedeemSheet extends ConsumerStatefulWidget {
  const _RedeemSheet({required this.item, required this.r});
  final CatalogueItem item;
  final Rewards r;

  @override
  ConsumerState<_RedeemSheet> createState() => _RedeemSheetState();
}

class _RedeemSheetState extends ConsumerState<_RedeemSheet> {
  int? _login;
  bool _busy = false;
  Redemption? _done;

  CatalogueItem get it => widget.item;
  bool get _needsAccount => it.kind == 'bonus_credit';

  Future<void> _redeem() async {
    final t = context.t;
    final f = GrowthFmt(t);
    final toasts = ref.read(notificationsProvider.notifier);
    final nav = Navigator.of(context);
    setState(() => _busy = true);
    try {
      final res = await growthPost(ref, 'redeem', _needsAccount ? {'itemId': it.id, 'login': _login} : {'itemId': it.id});
      final red = Redemption.fromJson(res['redemption'] is Map ? (res['redemption'] as Map).cast<String, dynamic>() : const {});
      final balance = res['balance'] is num ? (res['balance'] as num).toDouble() : widget.r.points.balance - it.costPoints;
      KHaptics.success();
      _invalidateLoyalty(ref);
      if (red.voucherCode != null && red.voucherCode!.isNotEmpty) {
        if (mounted) setState(() => _done = red);
      } else {
        nav.maybePop();
        toasts.toast(
          NotificationKind.success,
          t('rewards.redeem.toastRedeemed', {'name': it.name}),
          description: t(red.status == 'pending' ? 'rewards.redeem.toastDeductedPending' : 'rewards.redeem.toastDeducted', {
            'points': f.points(it.costPoints),
            'balance': f.points(balance),
          }),
        );
      }
    } on ApiException catch (e) {
      toasts.toast(NotificationKind.error, t('rewards.redeem.error'), description: growthError(e, t));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final r = widget.r;
    final done = _done;
    final head = [
      Text(
        done != null ? t('rewards.redeem.voucherTitle') : t('rewards.redeem.title', {'name': it.name}),
        textAlign: TextAlign.center,
        style: context.text.title2,
      ),
      const SizedBox(height: 4),
      Text(
        done != null ? t('rewards.redeem.voucherDesc') : t('rewards.redeem.desc'),
        textAlign: TextAlign.center,
        style: context.text.footnote.copyWith(color: k.fg3),
      ),
      const SizedBox(height: 16),
    ];
    if (done != null) {
      return KSheetContent(
        footer: KButton(label: t('common.done'), size: KButtonSize.lg, expand: true, onPressed: () => Navigator.of(context).maybePop()),
        children: [
          ...head,
          Container(
            key: const ValueKey('voucher-code'),
            padding: const EdgeInsetsDirectional.fromSTEB(16, 8, 6, 8),
            decoration: BoxDecoration(
              color: k.emberSoft,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: k.ember.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                Icon(LucideIcons.ticket, size: 20, color: k.ember),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    done.voucherCode!,
                    textDirection: TextDirection.ltr,
                    style: context.text.mono(18, weight: FontWeight.w600, color: k.fg).copyWith(letterSpacing: 1.2),
                  ),
                ),
                KIconButton(icon: LucideIcons.copy, semanticLabel: t('rewards.redeem.voucherCode'), onPressed: () => kCopy(context, done.voucherCode!)),
              ],
            ),
          ),
        ],
      );
    }
    return KSheetContent(
      footer: KButton(
        key: const ValueKey('redeem-confirm'),
        label: t('rewards.redeem.confirm'),
        size: KButtonSize.lg,
        expand: true,
        loading: _busy,
        onPressed: _needsAccount && _login == null ? null : _redeem,
      ),
      children: [
        ...head,
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: k.surface2,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: k.line),
          ),
          child: Row(
            children: [
              KIconTile(icon: _kindIcon[it.kind] ?? LucideIcons.gift, tone: _kindTone[it.kind] ?? KTone.coral, size: 48),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(it.name, style: context.text.headline),
                    Text(it.description.isNotEmpty ? it.description : _itemValue(f, it), style: context.text.footnote.copyWith(color: k.fg3)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        KKeyValues([
          KKV(t('rewards.redeem.reward'), _itemValue(f, it)),
          KKV(t('rewards.redeem.cost'), t('rewards.value.pts', {'points': f.points(it.costPoints)}), tone: k.gold),
          KKV(t('rewards.redeem.currentBalance'), t('rewards.value.pts', {'points': f.points(r.points.balance)})),
          KKV(t('rewards.redeem.balanceAfter'), t('rewards.value.pts', {'points': f.points(r.points.balance - it.costPoints)})),
          KKV(
            t('rewards.redeem.deliveredTo'),
            it.kind == 'cashback' ? t('rewards.redeem.toWallet') : (it.kind == 'bonus_credit' ? t('rewards.redeem.toAccount') : t('rewards.redeem.toVoucher')),
          ),
        ], dense: true),
        if (_needsAccount) ...[
          const SizedBox(height: 12),
          Text(t('rewards.picker.label'), style: context.text.label.copyWith(color: k.fg2)),
          const SizedBox(height: 8),
          LiveAccountPicker(value: _login, onChanged: (v) => setState(() => _login = v), hint: t('rewards.redeem.accountHint')),
        ],
      ],
    );
  }
}

/* ------------------------------------------------------------------ history, vouchers, redemptions */

const Map<String, KChipTone> _txTone = {
  'earn': KChipTone.up,
  'redeem': KChipTone.ember,
  'bonus': KChipTone.gold,
  'promo': KChipTone.gold,
  'expire': KChipTone.neutral,
  'adjust': KChipTone.info,
  'reversal': KChipTone.down,
};
const List<String> _txKinds = ['earn', 'redeem', 'bonus', 'promo', 'expire', 'adjust', 'reversal'];

String _txLabel(T t, String kind) => _txKinds.contains(kind) ? t('rewards.kind.$kind') : titleCase(kind);

class _PointsHistory extends ConsumerStatefulWidget {
  const _PointsHistory();

  @override
  ConsumerState<_PointsHistory> createState() => _PointsHistoryState();
}

class _PointsHistoryState extends ConsumerState<_PointsHistory> {
  String _kind = 'all';
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final v = ref.watch(pointsHistoryProvider(_kind));
    final data = v.value;
    final q = _q.trim().toLowerCase();
    final rows = (data?.items ?? const <PointsTx>[]).where((x) => q.isEmpty || '${x.description} ${x.login ?? ''}'.toLowerCase().contains(q)).toList();
    const kinds = ['all', 'earn', 'redeem', 'bonus', 'promo', 'expire'];
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            title: t('rewards.history.title'),
            subtitle: data != null
                ? '${t('rewards.history.entries', {'count': data.total, 'n': f.count(data.total)})}${data.total > data.items.length ? t('rewards.history.latestShown', {'count': data.items.length}) : ''}'
                : t('rewards.history.subtitle'),
          ),
          const SizedBox(height: 12),
          KChoiceChips<String>(
            values: kinds,
            labels: [for (final x in kinds) x == 'all' ? t('common.all') : t('rewards.kind.$x')],
            selected: _kind,
            onChanged: (x) => setState(() => _kind = x),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: KSearchField(placeholder: t('rewards.history.search'), onChanged: (s) => setState(() => _q = s)),
              ),
              const SizedBox(width: 8),
              CsvButton(
                onPressed: rows.isEmpty
                    ? null
                    : () => shareCsv(
                        context,
                        'ezymex-points-history',
                        [t('common.date'), t('rewards.history.colActivity'), t('common.type'), t('common.account'), t('rewards.history.colPoints')],
                        [
                          for (final x in rows) [x.createdAt?.toIso8601String(), x.description, x.kind, x.login ?? '', GrowthFmt.plain(x.points)],
                        ],
                      ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          PagedRows<PointsTx>(
            rows: rows,
            empty: Padding(
              padding: const EdgeInsets.only(top: 6),
              child: CardEmpty(
                title: !v.hasValue && !v.hasError
                    ? t('common.loading')
                    : (v.hasError && !v.hasValue ? t('rewards.history.unavailable') : t('rewards.history.emptyTitle')),
                text: v.hasError && !v.hasValue ? growthError(v.error!, t) : (!v.hasValue ? null : t('rewards.history.emptyText')),
              ),
            ),
            itemBuilder: (context, x) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 11),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          x.description,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: context.text.callout.copyWith(fontWeight: FontWeight.w600, color: k.fg),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            KChip(label: _txLabel(t, x.kind), tone: _txTone[x.kind] ?? KChipTone.neutral, small: true),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                f.dateTime(x.createdAt),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontFeatures: kTabular),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    '${x.points > 0 ? '+' : ''}${f.points(x.points)}',
                    textDirection: TextDirection.ltr,
                    style: context.text.figure.copyWith(fontSize: 14, color: x.points > 0 ? k.up : (x.kind == 'expire' ? k.fg3 : k.fg)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Vouchers extends ConsumerWidget {
  const _Vouchers();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final v = ref.watch(vouchersProvider);
    final items = v.value ?? const <Voucher>[];
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('rewards.vouchers.title'), subtitle: t('rewards.vouchers.subtitle'), icon: LucideIcons.ticket, tone: KTone.lavender),
          const SizedBox(height: 14),
          if (!v.hasValue && !v.hasError)
            KSkeleton.lines(2)
          else if (items.isEmpty)
            CardEmpty(title: t('rewards.vouchers.emptyTitle'), text: t('rewards.vouchers.emptyText'))
          else
            for (final x in items) ...[
              if (x != items.first) const SizedBox(height: 8),
              Opacity(
                opacity: x.status == 'active' ? 1 : 0.6,
                child: RowBox(
                  padding: const EdgeInsetsDirectional.fromSTEB(14, 8, 12, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Flexible(
                                  child: Text(
                                    x.code,
                                    textDirection: TextDirection.ltr,
                                    style: context.text.mono(13.5, weight: FontWeight.w600, color: k.fg).copyWith(letterSpacing: 0.8),
                                  ),
                                ),
                                if (x.status == 'active')
                                  KIconButton(
                                    icon: LucideIcons.copy,
                                    size: 30,
                                    semanticLabel: t('rewards.redeem.voucherCode'),
                                    onPressed: () => kCopy(context, x.code),
                                  ),
                              ],
                            ),
                            Text(
                              '${t(x.appliesTo == 'any' ? 'rewards.vouchers.offFees' : (x.appliesTo == 'prop' ? 'rewards.vouchers.offProp' : 'rewards.vouchers.offCommission'), {'pct': GrowthFmt.plain(x.pct)})}'
                              ' · ${x.status == 'used' ? t('rewards.vouchers.used', {'date': f.date(x.usedAt)}) : t('rewards.vouchers.expires', {'date': f.date(x.expiresAt)})}',
                              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      GrowthStatus(x.status),
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

class _Redemptions extends ConsumerWidget {
  const _Redemptions();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final v = ref.watch(redemptionsProvider);
    final items = v.value ?? const <Redemption>[];
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('rewards.redemptions.title'), subtitle: t('rewards.redemptions.subtitle')),
          const SizedBox(height: 10),
          if (!v.hasValue && !v.hasError)
            KSkeleton.lines(3)
          else
            PagedRows<Redemption>(
              rows: items,
              pageSize: 6,
              empty: CardEmpty(title: t('rewards.redemptions.emptyTitle'), text: t('rewards.redemptions.emptyText')),
              itemBuilder: (context, x) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            x.itemName,
                            style: context.text.callout.copyWith(fontWeight: FontWeight.w600, color: k.fg),
                          ),
                          if (x.voucherCode != null || x.login != null)
                            Text(
                              x.voucherCode ?? '#${x.login}',
                              textDirection: TextDirection.ltr,
                              style: context.text.mono(11.5, color: k.fg3),
                            ),
                          Text(
                            f.dateTime(x.createdAt),
                            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontFeatures: kTabular),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('-${f.points(x.points)}', textDirection: TextDirection.ltr, style: context.text.figure.copyWith(fontSize: 14)),
                        const SizedBox(height: 4),
                        GrowthStatus(x.status),
                      ],
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
