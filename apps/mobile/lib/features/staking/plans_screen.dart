// Staking › Plans (/staking): header (+ My staking with the count of active positions), How staking works (four
// steps), the risk disclosure, then one card per plan: name and term, its limits (minimum, maximum per subscription,
// what this client can still add, capacity left, what they already hold), the past monthly returns (settled months
// only, never a promise), the paused / full states and Subscribe (the subscribe sheet). Plans refresh every 60 s.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'staking_api.dart';
import 'widgets/staking_ui.dart';
import 'widgets/subscribe_sheet.dart';

class StakingPlansScreen extends ConsumerWidget {
  const StakingPlansScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    final plans = ref.watch(stakingPlansProvider);
    final active = ref.watch(stakingPortfolioProvider).value?.summary.activePositions ?? 0;

    Future<void> refresh() async {
      ref
        ..invalidate(stakingPlansProvider)
        ..invalidate(stakingPortfolioProvider);
      await ref.read(stakingPlansProvider.future).then((_) {}, onError: (Object _) {});
    }

    return KPageScroll(
      onRefresh: refresh,
      children: [
        KPageHeader(title: t('staking.plans.title'), subtitle: Text(t('staking.plans.subtitle'))),
        const SizedBox(height: 14),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: StakingHeaderButton(
            label: t('staking.plans.myStaking'),
            icon: LucideIcons.chartPie,
            count: active,
            onTap: () => context.go('/staking/portfolio'),
          ),
        ),
        const SizedBox(height: 20),
        const _HowCard(),
        stakingGap,
        KNotice(tone: KChipTone.warn, icon: LucideIcons.shieldAlert, title: t('staking.risk.title'), text: t('staking.risk.text')),
        stakingGap,
        KAsync<StakingPlans>(
          value: plans,
          onRetry: () => ref.invalidate(stakingPlansProvider),
          error: (e) => StakingLoadError(
            error: e,
            text: e is ApiException && (e.isNetwork || e.status >= 500) ? stakingErrorText(e, t) : t('staking.plans.loadError'),
            onRetry: () => ref.invalidate(stakingPlansProvider),
          ),
          loading: const Column(children: [KSkeletonCard(height: 320, lines: 5), SizedBox(height: 16), KSkeletonCard(height: 320, lines: 5)]),
          builder: (data) {
            if (data.plans.isEmpty) {
              return KCard(
                child: KEmptyState(art: KIllustrationName.emptyPosition, title: t('staking.plans.emptyTitle'), text: t('staking.plans.emptyText')),
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < data.plans.length; i++) ...[if (i > 0) stakingGap, StakingPlanCard(plan: data.plans[i], readOnly: readOnly)],
              ],
            );
          },
        ),
      ],
    );
  }
}

/* ------------------------------------------------------------------ how it works */

class _HowCard extends StatelessWidget {
  const _HowCard();

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final steps = [
      (LucideIcons.listChecks, t('staking.how.step1.title'), t('staking.how.step1.text')),
      (LucideIcons.lock, t('staking.how.step2.title'), t('staking.how.step2.text')),
      (LucideIcons.calendarCheck, t('staking.how.step3.title'), t('staking.how.step3.text')),
      (LucideIcons.undo2, t('staking.how.step4.title'), t('staking.how.step4.text')),
    ];
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(icon: LucideIcons.piggyBank, tone: KTone.mint, title: t('staking.how.title')),
          const SizedBox(height: 14),
          for (var i = 0; i < steps.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            StakingRow(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(shape: BoxShape.circle, color: k.surface3),
                    child: Text(
                      '${i + 1}',
                      style: context.text.micro.copyWith(color: k.fg2, fontFeatures: kTabular),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(steps[i].$1, size: 14, color: k.fg3),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(steps[i].$2, style: context.text.label.copyWith(fontSize: 13.5, fontWeight: FontWeight.w600)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(steps[i].$3, style: context.text.footnote.copyWith(color: k.fg3, height: 1.4)),
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

/* ------------------------------------------------------------------ plan card */

class StakingPlanCard extends StatelessWidget {
  const StakingPlanCard({super.key, required this.plan, required this.readOnly});
  final StakingPlan plan;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final p = plan;
    final cur = p.currency;
    String limit(double? v) => v == null ? t('staking.plan.noLimit') : stakingAmount(t, v, cur);
    final rates = [...p.recentRates]..sort((a, b) => b.period.compareTo(a.period));
    final rows = [
      KKV(t('staking.plan.minimum'), stakingAmount(t, p.minAmount, cur)),
      KKV(t('staking.plan.maximum'), limit(p.maxAmount)),
      KKV(t('staking.plan.room'), limit(p.maxNow)),
      KKV(t('staking.plan.capacityLeft'), p.full ? stakingAmount(t, 0, cur) : limit(p.capacityLeft)),
      if (p.invested > 0) KKV(t('staking.plan.invested'), stakingAmount(t, p.invested, cur), tone: k.up),
    ];
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const KIconTile(icon: LucideIcons.piggyBank, tone: KTone.mint),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(p.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: context.text.title2),
                    const SizedBox(height: 2),
                    Text(stakingTerm(t, p.termMonths), style: context.text.footnote.copyWith(color: k.fg3)),
                  ],
                ),
              ),
              if (p.paused)
                KChip(label: t('staking.plan.paused'), tone: KChipTone.warn, small: true)
              else if (p.full)
                KChip(label: t('staking.plan.full'), small: true),
            ],
          ),
          if (p.description.trim().isNotEmpty) ...[const SizedBox(height: 12), Text(p.description.trim(), style: context.text.callout.copyWith(color: k.fg2))],
          if (p.paused || p.full) ...[
            const SizedBox(height: 12),
            KNotice(tone: p.paused ? KChipTone.warn : KChipTone.neutral, text: p.paused ? t('staking.plan.pausedText') : t('staking.plan.fullText')),
          ],
          const SizedBox(height: 8),
          KKeyValues(rows, dense: true),
          const SizedBox(height: 12),
          StakingLabel(t('staking.plan.pastReturns')),
          const SizedBox(height: 8),
          if (rates.isEmpty)
            Text(t('staking.plan.noPastReturns'), style: context.text.footnote.copyWith(color: k.fg3))
          else
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [for (final r in rates.take(6)) KChip(label: '${stakingMonth(t, r.period)} · ${stakingRate(t, r.ratePct)}')],
            ),
          const SizedBox(height: 6),
          Text(
            t('staking.plan.pastNote'),
            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Icon(LucideIcons.wallet, size: 14, color: k.fg3),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  t('staking.plan.paidMonthly'),
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              KButton(
                label: t('staking.plan.terms'),
                icon: LucideIcons.fileText,
                variant: KButtonVariant.surface,
                size: KButtonSize.lg,
                onPressed: () => showPlanTermsSheet(context, plan: p),
              ),
              if (!readOnly) ...[
                const SizedBox(width: 10),
                Expanded(
                  child: KButton(
                    label: t('staking.plan.subscribe'),
                    trailingIcon: stakingArrowEnd(context),
                    size: KButtonSize.lg,
                    expand: true,
                    onPressed: p.open ? () => showSubscribeSheet(context, plan: p) : null,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ plan terms */

/// The plan's terms as they stand today: term, limits, description and its disclosure.
Future<void> showPlanTermsSheet(BuildContext context, {required StakingPlan plan}) => showKSheet<void>(
  context,
  title: plan.name,
  builder: (context) {
    final t = context.t;
    final k = context.k;
    final cur = plan.currency;
    return KSheetContent(
      children: [
        StakingLabel(t('staking.plan.terms')),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: k.line),
          ),
          child: KKeyValues([
            KKV(t('staking.col.term'), stakingTerm(t, plan.termMonths)),
            KKV(t('staking.plan.minimum'), stakingAmount(t, plan.minAmount, cur)),
            KKV(t('staking.plan.maximum'), plan.maxAmount == null ? t('staking.plan.noLimit') : stakingAmount(t, plan.maxAmount!, cur)),
            KKV(t('staking.subscribe.returns'), t('staking.subscribe.returnsValue')),
            KKV(t('staking.subscribe.earlyWithdrawal'), t('staking.subscribe.notAvailable'), tone: k.down),
          ], dense: true),
        ),
        if (plan.description.trim().isNotEmpty) ...[
          const SizedBox(height: 14),
          Text(plan.description.trim(), style: context.text.callout.copyWith(color: k.fg2)),
        ],
        const SizedBox(height: 14),
        StakingDisclosure(riskText: plan.riskText),
      ],
    );
  },
);
