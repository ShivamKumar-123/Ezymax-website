// Staking › My staking (/staking/portfolio): header (+ Browse plans), the four figures (invested with the active
// count and what awaits payment, returns paid with this year's, the next payout "After <month>", the next maturity
// with the principal coming back), the monthly returns of the last 12 months, then the positions (plan, principal,
// status, the term's progress, maturity, returns paid, last return); a position opens its detail sheet. Polls every
// 30 s.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'staking_api.dart';
import 'widgets/position_sheet.dart';
import 'widgets/staking_ui.dart';

class StakingPortfolioScreen extends ConsumerWidget {
  const StakingPortfolioScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final async = ref.watch(stakingPortfolioProvider);

    Future<void> refresh() async {
      ref.invalidate(stakingPortfolioProvider);
      await ref.read(stakingPortfolioProvider.future).then((_) {}, onError: (Object _) {});
    }

    return KPageScroll(
      onRefresh: refresh,
      children: [
        KPageHeader(title: t('staking.portfolio.title'), subtitle: Text(t('staking.portfolio.subtitle'))),
        const SizedBox(height: 14),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: StakingHeaderButton(label: t('staking.portfolio.browsePlans'), icon: LucideIcons.piggyBank, onTap: () => context.go('/staking')),
        ),
        const SizedBox(height: 20),
        KAsync<StakingPortfolio>(
          value: async,
          onRetry: () => ref.invalidate(stakingPortfolioProvider),
          error: (e) => StakingLoadError(error: e, onRetry: () => ref.invalidate(stakingPortfolioProvider)),
          loading: const Column(
            children: [
              SizedBox(
                height: 170,
                child: Row(
                  children: [
                    Expanded(child: KSkeleton(height: 170, radius: 18)),
                    SizedBox(width: 8),
                    Expanded(child: KSkeleton(height: 170, radius: 18)),
                  ],
                ),
              ),
              SizedBox(height: 16),
              KSkeletonCard(height: 220),
              SizedBox(height: 16),
              KSkeletonCard(height: 260, lines: 5),
            ],
          ),
          builder: (d) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _Kpis(s: d.summary),
              stakingGap,
              _MonthlyCard(monthly: d.monthly, currency: d.summary.currency),
              stakingGap,
              _PositionsCard(positions: d.positions),
            ],
          ),
        ),
      ],
    );
  }
}

/* ------------------------------------------------------------------ figures */

class _Kpis extends StatelessWidget {
  const _Kpis({required this.s});
  final StakingSummary s;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final cur = s.currency;
    final m = s.nextMaturity;
    final invested = [
      t('staking.kpi.active', {'count': s.activePositions}),
      if (s.pending > 0) t('staking.kpi.pending', {'amount': stakingAmount(t, s.pending, cur)}),
    ].join(' · ');
    return StakingGrid(
      children: [
        StakingTile(icon: LucideIcons.lock, label: t('staking.kpi.invested'), value: stakingAmount(t, s.invested, cur), sub: invested),
        StakingTile(
          icon: LucideIcons.coins,
          label: t('staking.kpi.returnsPaid'),
          value: stakingAmount(t, s.returnsPaid, cur),
          tone: s.returnsPaid > 0 ? k.up : null,
          sub: t('staking.kpi.thisYear', {'amount': stakingAmount(t, s.returnsThisYear, cur)}),
        ),
        StakingTile(
          icon: LucideIcons.calendarClock,
          label: t('staking.kpi.nextPayout'),
          value: s.nextPayoutPeriod == null ? t('staking.kpi.none') : t('staking.kpi.nextPayoutValue', {'month': stakingMonth(t, s.nextPayoutPeriod)}),
          sub: s.nextPayoutPeriod == null ? null : t('staking.kpi.nextPayoutText', {'month': stakingMonth(t, s.nextPayoutPeriod)}),
        ),
        StakingTile(
          icon: LucideIcons.calendarCheck,
          label: t('staking.kpi.nextMaturity'),
          value: m == null ? t('staking.kpi.none') : stakingDate(t, m.date),
          sub: m == null ? null : t('staking.kpi.nextMaturityText', {'amount': stakingAmount(t, m.principal, cur)}),
        ),
      ],
    );
  }
}

/* ------------------------------------------------------------------ monthly returns */

class _MonthlyCard extends StatelessWidget {
  const _MonthlyCard({required this.monthly, required this.currency});
  final List<({String period, double amount})> monthly;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final any = monthly.any((m) => m.amount > 0);
    final total = monthly.fold<double>(0, (a, m) => a + m.amount);
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(icon: LucideIcons.chartColumn, tone: KTone.mint, title: t('staking.monthly.title'), subtitle: t('staking.monthly.subtitle')),
          const SizedBox(height: 16),
          if (!any)
            Container(
              height: 120,
              alignment: Alignment.center,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: k.line),
              ),
              child: Text(
                t('staking.monthly.empty'),
                textAlign: TextAlign.center,
                style: context.text.footnote.copyWith(color: k.fg3),
              ),
            )
          else ...[
            Text(
              stakingAmount(t, total, currency),
              textDirection: TextDirection.ltr,
              style: context.text.figure.copyWith(fontSize: 20, color: k.up),
            ),
            const SizedBox(height: 12),
            KBarChart(
              values: [for (final m in monthly) m.amount],
              labels: [stakingMonth(t, monthly.first.period), if (monthly.length > 1) stakingMonth(t, monthly.last.period)],
              color: k.up,
              highlightLast: true,
            ),
            const SizedBox(height: 12),
            // the latest months with their amounts (the chart has no tooltips)
            for (final m in monthly.reversed.take(3))
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(stakingMonth(t, m.period), style: context.text.footnote.copyWith(color: k.fg3)),
                    ),
                    Text(
                      stakingAmount(t, m.amount, currency),
                      textDirection: TextDirection.ltr,
                      style: context.text.footnote.copyWith(fontWeight: FontWeight.w600, fontFeatures: kTabular),
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

/* ------------------------------------------------------------------ positions */

class _PositionsCard extends StatelessWidget {
  const _PositionsCard({required this.positions});
  final List<StakingPosition> positions;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    // active first, then awaiting payment, matured, failed; newest first
    int rank(StakingPosition p) => switch (p.status) {
      'active' => 0,
      'pending_payment' => 1,
      'matured' => 2,
      _ => 3,
    };
    final list = [...positions]
      ..sort((a, b) {
        final r = rank(a).compareTo(rank(b));
        return r != 0 ? r : b.id.compareTo(a.id);
      });
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(icon: LucideIcons.layers, title: t('staking.positions.title')),
          const SizedBox(height: 14),
          if (list.isEmpty)
            KEmptyState(
              compact: true,
              art: KIllustrationName.emptyPosition,
              title: t('staking.positions.emptyTitle'),
              text: t('staking.positions.emptyText'),
              action: KButton(label: t('staking.portfolio.browsePlans'), trailingIcon: stakingArrowEnd(context), onPressed: () => context.go('/staking')),
            )
          else
            for (var i = 0; i < list.length; i++) ...[if (i > 0) const SizedBox(height: 10), StakingPositionTile(p: list[i])],
        ],
      ),
    );
  }
}

class StakingPositionTile extends StatelessWidget {
  const StakingPositionTile({super.key, required this.p});
  final StakingPosition p;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final cur = p.currency;
    final last = p.lastReturn;
    return KPressable(
      onTap: () => showPositionSheet(context, id: p.id),
      semanticLabel: t('staking.position.title', {'plan': p.planName, 'id': p.id}),
      child: StakingRow(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.planName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.label.copyWith(fontWeight: FontWeight.w600),
                      ),
                      Text(
                        '#${p.id} · ${stakingTerm(t, p.termMonths)}',
                        style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                StakingStatusChip(p.status),
              ],
            ),
            const SizedBox(height: 10),
            Text(stakingAmount(t, p.principal, cur), textDirection: TextDirection.ltr, style: context.text.figure.copyWith(fontSize: 18)),
            if (p.status == 'active') ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      t('staking.term.progress', {'elapsed': p.daysElapsed, 'total': p.daysTotal}),
                      style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                    ),
                  ),
                  Text(
                    t('staking.term.matures', {'date': stakingDate(t, p.maturesAt)}),
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              KProgressBar(value: p.progress, color: k.up),
            ] else if (p.status == 'matured') ...[
              const SizedBox(height: 6),
              Text(
                t('staking.term.matured', {'date': stakingDate(t, p.maturedAt ?? p.maturesAt)}),
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
              ),
            ] else if (p.status == 'payment_failed' && p.failureReason != null) ...[
              const SizedBox(height: 6),
              Text(
                t('staking.position.failed', {'reason': p.failureReason}),
                style: context.text.caption.copyWith(color: k.down, fontWeight: FontWeight.w400),
              ),
            ],
            if (p.status == 'active' || p.status == 'matured') ...[
              const SizedBox(height: 10),
              KKeyValues([
                KKV(t('staking.col.returnsPaid'), stakingAmount(t, p.returnsPaid, cur), tone: p.returnsPaid > 0 ? k.up : null),
                KKV(
                  t('staking.col.lastReturn'),
                  last == null
                      ? t('staking.lastReturn.none')
                      : t('staking.lastReturn.value', {
                          'month': stakingMonth(t, last.period),
                          'rate': stakingRate(t, last.ratePct),
                          'amount': stakingAmount(t, last.amount, cur),
                        }),
                ),
              ], dense: true),
            ],
          ],
        ),
      ),
    );
  }
}
