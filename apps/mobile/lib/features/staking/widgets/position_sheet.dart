// One position in a sheet: plan and status, the payment notes (still confirming, failed with the reason), the lock
// note, its figures and dates, the monthly returns (month, rate, days active, amount, paid / awaiting approval /
// processing) and the terms the client accepted (with the date, the description and the plan's disclosure).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../staking_api.dart';
import 'staking_ui.dart';

Future<void> showPositionSheet(BuildContext context, {required int id}) => showKSheet<void>(context, builder: (_) => StakingPositionSheet(id: id));

class StakingPositionSheet extends ConsumerWidget {
  const StakingPositionSheet({super.key, required this.id});
  final int id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final async = ref.watch(stakingPositionProvider(id));
    return KAsync<StakingPositionDetail>(
      value: async,
      error: (e) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: StakingLoadError(error: e, onRetry: () => ref.invalidate(stakingPositionProvider(id))),
      ),
      loading: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [const KSkeleton(height: 22, width: 200), const SizedBox(height: 16), KSkeleton.lines(6)],
        ),
      ),
      builder: (d) {
        final p = d.position;
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(20, 0, 8, 12),
              child: Row(
                children: [
                  Expanded(child: Text(t('staking.position.title', {'plan': p.planName, 'id': p.id}), style: context.text.title2)),
                  const SizedBox(width: 8),
                  StakingStatusChip(p.status),
                  KIconButton(icon: LucideIcons.x, size: 36, semanticLabel: t('common.close'), onPressed: () => Navigator.of(context).pop()),
                ],
              ),
            ),
            Flexible(child: KSheetContent(children: _body(context, d))),
          ],
        );
      },
    );
  }

  List<Widget> _body(BuildContext context, StakingPositionDetail d) {
    final t = context.t;
    final k = context.k;
    final p = d.position;
    final cur = p.currency;
    final returns = [...d.returns]..sort((a, b) => b.period.compareTo(a.period));
    return [
      if (p.status == 'pending_payment') ...[KNotice(icon: LucideIcons.hourglass, text: t('staking.position.pendingText')), stakingGap],
      if (p.status == 'payment_failed') ...[
        KNotice(tone: KChipTone.down, text: t('staking.position.failed', {'reason': p.failureReason ?? t('staking.error.paymentFailed')})),
        stakingGap,
      ],
      if (p.status == 'active') ...[KNotice(tone: KChipTone.neutral, icon: LucideIcons.lock, text: t('staking.position.locked')), stakingGap],
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: k.line),
        ),
        child: KKeyValues([
          KKV(t('staking.col.principal'), stakingAmount(t, p.principal, cur)),
          KKV(t('staking.col.term'), stakingTerm(t, p.termMonths)),
          KKV(t('staking.position.started'), stakingDate(t, p.startedAt)),
          if (p.status == 'matured')
            KKV(t('staking.position.matured'), stakingDate(t, p.maturedAt ?? p.maturesAt))
          else
            KKV(t('staking.position.matures'), stakingDate(t, p.maturesAt)),
          KKV(t('staking.col.returnsPaid'), stakingAmount(t, p.returnsPaid, cur), tone: p.returnsPaid > 0 ? k.up : null),
        ], dense: true),
      ),
      if (p.status == 'active' && p.daysTotal > 0) ...[
        const SizedBox(height: 12),
        Text(t('staking.term.progress', {'elapsed': p.daysElapsed, 'total': p.daysTotal}), style: context.text.footnote.copyWith(color: k.fg3)),
        const SizedBox(height: 6),
        KProgressBar(value: p.progress, color: k.up),
      ],
      const SizedBox(height: 18),
      StakingLabel(t('staking.position.returns')),
      const SizedBox(height: 8),
      if (returns.isEmpty)
        Text(t('staking.position.noReturns'), style: context.text.footnote.copyWith(color: k.fg3))
      else
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: k.line),
          ),
          child: Column(
            children: [
              for (var i = 0; i < returns.length; i++) ...[if (i > 0) const KDivider(), _ReturnRow(r: returns[i], currency: cur)],
            ],
          ),
        ),
      const SizedBox(height: 18),
      StakingLabel(t('staking.position.terms')),
      const SizedBox(height: 4),
      if (p.termsAcceptedAt != null)
        Text(t('staking.position.acceptedAt', {'date': stakingDate(t, p.termsAcceptedAt)}), style: context.text.footnote.copyWith(color: k.fg3)),
      const SizedBox(height: 8),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: k.line),
        ),
        child: KKeyValues([
          KKV(t('staking.col.plan'), d.terms.name.isEmpty ? p.planName : d.terms.name),
          KKV(t('staking.plan.minimum'), stakingAmount(t, d.terms.minAmount, d.terms.currency)),
          KKV(t('staking.plan.maximum'), d.terms.maxAmount == null ? t('staking.plan.noLimit') : stakingAmount(t, d.terms.maxAmount!, d.terms.currency)),
          KKV(t('staking.subscribe.earlyWithdrawal'), t('staking.subscribe.notAvailable')),
        ], dense: true),
      ),
      if (d.terms.description.trim().isNotEmpty) ...[
        const SizedBox(height: 12),
        Text(d.terms.description.trim(), style: context.text.footnote.copyWith(color: k.fg2, height: 1.45)),
      ],
      const SizedBox(height: 12),
      StakingDisclosure(riskText: d.terms.riskText),
    ];
  }
}

class _ReturnRow extends StatelessWidget {
  const _ReturnRow({required this.r, required this.currency});
  final StakingReturn r;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(stakingMonth(t, r.period), style: context.text.label.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(
                  '${stakingRate(t, r.ratePct)} · ${t('staking.history.days', {'count': r.daysActive})}',
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                stakingAmount(t, r.amount, currency),
                textDirection: TextDirection.ltr,
                style: context.text.figure.copyWith(fontSize: 14, color: r.status == 'paid' ? k.up : k.fg),
              ),
              const SizedBox(height: 4),
              KChip(label: stakingReturnLabel(t, r.status), tone: stakingReturnTone(r.status), small: true),
            ],
          ),
        ],
      ),
    );
  }
}
