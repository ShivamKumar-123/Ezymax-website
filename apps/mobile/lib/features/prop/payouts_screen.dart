// Prop › Payouts (/prop/payouts): the port of LivePropPayouts (apps/crm/components/prop-live/payouts.tsx) in the
// phone order: header (+ My challenges), the identity check banner, available / pending / paid KPIs, each funded
// account with its payout quote and Request payout (sheet), the payout history, the scaling plan. Polls every 15 s.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'prop_api.dart';
import 'widgets/csv_export.dart';
import 'widgets/prop_ui.dart';

class PropPayoutsScreen extends ConsumerWidget {
  const PropPayoutsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    final data = ref.watch(propPayoutsProvider);
    final challenges = ref.watch(propChallengesProvider(0)).value;
    Plan? planOf(int id) => challenges?.where((c) => c.id == id).firstOrNull?.plan;

    return KPageScroll(
      onRefresh: () async {
        ref
          ..invalidate(propPayoutsProvider)
          ..invalidate(propChallengesProvider(0));
        await ref.read(propPayoutsProvider.future).then((_) {}, onError: (Object _) {});
      },
      children: [
        KPageHeader(title: t('prop.payouts.title'), subtitle: Text(t('prop.payouts.subtitle'))),
        const SizedBox(height: 14),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: KButton(label: t('prop.myChallenges'), icon: LucideIcons.trophy, variant: KButtonVariant.surface, onPressed: () => context.go('/prop/mine')),
        ),
        const SizedBox(height: 20),
        KAsync<PayoutsData>(
          value: data,
          onRetry: () => ref.invalidate(propPayoutsProvider),
          error: (e) => PropLoadError(error: e, onRetry: () => ref.invalidate(propPayoutsProvider)),
          loading: const Column(children: [KSkeleton(height: 60, radius: 16), SizedBox(height: 16), KSkeletonCard(height: 300, lines: 5)]),
          builder: (d) {
            final paid = d.payouts.where((p) => p.status == 'paid').fold<double>(0, (s, p) => s + p.total);
            final open = d.payouts.where((p) => p.status == 'pending' || p.status == 'approved').toList();
            final pending = open.fold<double>(0, (s, p) => s + p.total);
            final eligible = d.funded.where((f) => f.quote.eligible).toList();
            final available = eligible.fold<double>(0, (s, f) => s + f.quote.total);
            final first = d.funded.firstOrNull;
            final scalingPlan = first == null ? null : planOf(first.challengeId);
            final width = (MediaQuery.sizeOf(context).width - 2 * KSpace.page) * 0.78;
            final style = context.text.moneyL;
            final kpis = [
              KKpiCard(
                width: width,
                label: t('prop.payouts.available'),
                icon: LucideIcons.wallet,
                value: KMoney(available, style: style),
                chip: KChip(label: t('prop.payouts.eligibleCount', {'eligible': eligible.length, 'count': d.funded.length})),
              ),
              KKpiCard(
                width: width,
                label: t('prop.payoutStatus.pending'),
                icon: LucideIcons.clock,
                value: KMoney(pending, style: style),
                chip: KChip(label: t('prop.payouts.requests', {'count': open.length}), tone: KChipTone.warn),
              ),
              KKpiCard(
                width: width,
                label: t('prop.payouts.paidToDate'),
                icon: LucideIcons.check,
                value: KMoney(paid, style: style),
                chip: KChip(label: t('prop.payouts.payoutsCount', {'count': d.payouts.where((p) => p.status == 'paid').length}), tone: KChipTone.up),
              ),
            ];
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _KycBanner(status: d.kycStatus),
                const SizedBox(height: 16),
                SizedBox(
                  height: 186,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    clipBehavior: Clip.none,
                    itemCount: kpis.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 12),
                    itemBuilder: (_, i) => kpis[i],
                  ),
                ),
                const SizedBox(height: 16),
                if (d.funded.isEmpty)
                  KCard(
                    child: KEmptyState(
                      art: KIllustrationName.propPassed,
                      title: t('prop.payouts.emptyTitle'),
                      text: t('prop.payouts.emptyText'),
                      action: KButton(
                        label: t('prop.myChallenges'),
                        trailingIcon: arrowEnd(context),
                        variant: KButtonVariant.surface,
                        size: KButtonSize.sm,
                        onPressed: () => context.go('/prop/mine'),
                      ),
                    ),
                  )
                else
                  for (var i = 0; i < d.funded.length; i++) ...[
                    if (i > 0) const SizedBox(height: 16),
                    _FundedCard(f: d.funded[i], plan: planOf(d.funded[i].challengeId), kyc: d.kycStatus, readOnly: readOnly),
                  ],
                const SizedBox(height: 16),
                _History(rows: d.payouts),
                if (scalingPlan != null && first != null) ...[const SizedBox(height: 16), _ScalingCard(plan: scalingPlan, size: first.size)],
              ],
            );
          },
        ),
      ],
    );
  }
}

/* ------------------------------------------------------------------ KYC */

class _KycBanner extends StatelessWidget {
  const _KycBanner({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    if (status == 'verified') {
      final (bg, fg, border) = context.k.chip(KChipTone.up);
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: border),
        ),
        child: Row(
          children: [
            Icon(LucideIcons.badgeCheck, size: 18, color: fg),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                t('prop.kyc.verified'),
                style: context.text.label.copyWith(fontWeight: FontWeight.w600, color: fg),
              ),
            ),
          ],
        ),
      );
    }
    final text = status == 'pending' ? t('prop.kyc.pendingText') : (status == 'rejected' ? t('prop.kyc.rejectedText') : t('prop.kyc.requiredText'));
    return PropBanner(
      tone: KChipTone.warn,
      icon: LucideIcons.shieldAlert,
      title: status == 'pending' ? t('prop.kyc.pendingTitle') : t('prop.kyc.requiredTitle'),
      text: text,
      action: status == 'pending'
          ? null
          : KButton(
              label: t('prop.errorLink.verify'),
              trailingIcon: arrowEnd(context),
              variant: KButtonVariant.surface,
              size: KButtonSize.sm,
              onPressed: () => context.go('/profile/verification'),
            ),
    );
  }
}

/* ------------------------------------------------------------------ funded account + quote */

class _FundedCard extends StatelessWidget {
  const _FundedCard({required this.f, required this.plan, required this.kyc, required this.readOnly});
  final FundedAccount f;
  final Plan? plan;
  final String kyc;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final q = f.quote;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return KCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              KChip(label: t('prop.fundedBadge'), tone: KChipTone.gold, small: true),
              KChip(label: f.planName, small: true),
            ],
          ),
          const SizedBox(height: 10),
          Text(t('prop.sizeAccount', {'size': sizeLabel(f.size)}), style: context.text.title1.copyWith(fontSize: 22)),
          if (f.login != null)
            Row(
              children: [
                Text(
                  '#${f.login} · Ezymex-Live',
                  textDirection: TextDirection.ltr,
                  style: context.text.mono(12, color: k.fg2),
                ),
                KIconButton(
                  icon: LucideIcons.copy,
                  size: 30,
                  color: k.fg3,
                  semanticLabel: '${t('common.copy')} ${t('prop.cred.login')}',
                  onPressed: () => kCopy(context, '${f.login}'),
                ),
              ],
            ),
          const SizedBox(height: 14),
          PropGrid(
            children: [
              PropTile(label: t('common.balance'), value: usd(f.balance)),
              PropTile(label: t('common.equity'), value: usd(f.equity)),
              PropTile(label: t('prop.funded.eligibleFrom'), value: q.eligibleFrom != null ? fmtDate(t, q.eligibleFrom) : '—'),
              PropTile(label: t('prop.funded.minPayout'), value: usd(q.minPayout, 0)),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              KButton(
                label: t('prop.funded.rulesDashboard'),
                trailingIcon: rtl ? LucideIcons.arrowUpLeft : LucideIcons.arrowUpRight,
                variant: KButtonVariant.surface,
                size: KButtonSize.sm,
                onPressed: () => context.go('/prop/mine?id=${f.challengeId}'),
              ),
              if (!readOnly) PropTradeButton(login: f.login, variant: KButtonVariant.surface),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: k.surface2.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: k.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(t('prop.funded.quote'), style: context.text.headline.copyWith(fontSize: 14, fontWeight: FontWeight.w500)),
                    ),
                    KChip(
                      label: q.eligible ? t('prop.funded.eligibleNow') : t('prop.funded.notEligible'),
                      tone: q.eligible ? KChipTone.up : KChipTone.neutral,
                      small: true,
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.end,
                  children: [
                    KMoney(q.total, style: context.text.moneyXL.copyWith(fontSize: 32)),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 3),
                      child: Text(t('prop.funded.toWallet'), style: context.text.footnote.copyWith(color: k.fg3)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                KKeyValues([
                  KKV(t('prop.profit'), usd(q.profit)),
                  KKV(t('prop.funded.yourSplit'), '${pctText(q.split)} · ${usd(q.traderAmount)}'),
                  KKV(t('prop.funded.firmShare'), usd(q.firmAmount)),
                  KKV(
                    t('prop.feeRefund'),
                    q.feeRefund > 0
                        ? usd(q.feeRefund)
                        : (f.refundFee
                              ? (f.feeRefunded ? t('prop.funded.alreadyRefunded') : t('prop.funded.withFirstPayout'))
                              : t('prop.funded.notRefundable')),
                  ),
                ], dense: true),
                if (q.blockers.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  for (final b in q.blockers)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Icon(LucideIcons.clock, size: 14, color: k.fg3),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              '${blockerText(t, b)}'
                              '${b == 'not_yet_eligible' && q.eligibleFrom != null ? ' ${t('prop.funded.opens', {'date': fmtDateTime(t, q.eligibleFrom)})}' : ''}'
                              '${b == 'below_minimum' ? ' ${t('prop.funded.minimum', {'amount': usd(q.minPayout, 0)})}' : ''}',
                              style: context.text.footnote.copyWith(color: k.fg2),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
                // the prop service refuses a payout request until the identity is verified (kyc_required)
                if (kyc != 'verified' && q.eligible) ...[
                  const SizedBox(height: 10),
                  Text(t('prop.funded.kycNote'), style: context.text.footnote.copyWith(color: k.warn, fontSize: 12)),
                ],
                if (!readOnly) ...[
                  const SizedBox(height: 14),
                  KButton(
                    label: t('prop.requestPayout'),
                    icon: LucideIcons.banknote,
                    variant: KButtonVariant.ink,
                    expand: true,
                    onPressed: q.eligible && kyc == 'verified'
                        ? () => showKSheet<void>(
                            context,
                            title: t('prop.requestPayout'),
                            builder: (_) => _RequestSheet(f: f),
                          )
                        : null,
                  ),
                ],
                if (plan != null) ...[
                  const SizedBox(height: 10),
                  Text(
                    t('prop.funded.cycle', {'freq': payoutFreqLabel(t, plan!.payoutFreq), 'days': daysText(t, plan!.firstPayoutDays)}),
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
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

/// The payout request (web RequestDialog): the quote's figures, the note and Request {amount}. Never retried.
class _RequestSheet extends ConsumerStatefulWidget {
  const _RequestSheet({required this.f});
  final FundedAccount f;

  @override
  ConsumerState<_RequestSheet> createState() => _RequestSheetState();
}

class _RequestSheetState extends ConsumerState<_RequestSheet> {
  bool _busy = false;
  Object? _err;

  Future<void> _submit() async {
    final t = context.t;
    final notes = ref.read(notificationsProvider.notifier);
    final container = ProviderScope.containerOf(context, listen: false);
    final nav = Navigator.of(context);
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      final p = await requestPayout(ref.read(apiProvider), widget.f.challengeId);
      KHaptics.success();
      notes.toast(NotificationKind.success, t('prop.request.toastTitle'), description: t('prop.request.toastText', {'amount': usd(p.total)}));
      container
        ..invalidate(propPayoutsProvider)
        ..invalidate(propChallengesProvider)
        ..invalidate(propChallengeProvider(widget.f.challengeId));
      if (mounted) nav.pop();
    } on Object catch (e) {
      KHaptics.error();
      if (mounted) setState(() => _err = e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final f = widget.f, q = f.quote;
    return PopScope(
      canPop: !_busy,
      child: KSheetContent(
        footer: Row(
          children: [
            KButton(
              label: t('common.cancel'),
              variant: KButtonVariant.surface,
              size: KButtonSize.lg,
              onPressed: _busy ? null : () => Navigator.of(context).pop(),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: KButton(
                label: t('prop.request.submit', {'amount': usd(q.total)}),
                icon: LucideIcons.banknote,
                variant: KButtonVariant.ink,
                size: KButtonSize.lg,
                expand: true,
                loading: _busy,
                onPressed: _submit,
              ),
            ),
          ],
        ),
        children: [
          Text(
            '${f.planName} · ${sizeLabel(f.size)}${f.login != null ? ' · #${f.login}' : ''}',
            textAlign: TextAlign.center,
            style: context.text.footnote.copyWith(color: k.fg3),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: k.line),
            ),
            child: KKeyValues([
              KKV(t('prop.request.profit'), usd(q.profit)),
              KKV(t('prop.request.share', {'pct': numText(q.split)}), usd(q.traderAmount)),
              if (q.feeRefund > 0) KKV(t('prop.request.feeRefund'), usd(q.feeRefund)),
              KKV(t('prop.request.total'), usd(q.total), tone: k.up),
            ]),
          ),
          const SizedBox(height: 12),
          Text(t('prop.request.note'), style: context.text.footnote.copyWith(color: k.fg3)),
          if (_err != null) ...[
            const SizedBox(height: 12),
            PropErrorNote(
              error: _err,
              onNavigate: (href) {
                final router = GoRouter.of(context);
                Navigator.of(context).pop();
                router.go(href);
              },
            ),
          ],
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ scaling plan */

class _ScalingCard extends StatelessWidget {
  const _ScalingCard({required this.plan, required this.size});
  final Plan plan;
  final double size;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final steps = <double>[];
    var s = size;
    for (var i = 0; i < 5 && s < plan.scalingCap; i++) {
      s = math.min(plan.scalingCap, (s * (1 + plan.scalingIncrease / 100)).roundToDouble());
      steps.add(s);
    }
    final arrow = Icon(arrowEnd(context), size: 14, color: k.fg3);
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(icon: LucideIcons.rocket, title: t('prop.scaling.title'), subtitle: t('prop.scaling.subtitle', {'plan': plan.name})),
          const SizedBox(height: 14),
          Text(
            t('prop.scaling.text', {
              'profit': numText(plan.scalingProfit),
              'months': t('prop.months', {'count': plan.scalingEvery}),
              'increase': numText(plan.scalingIncrease),
              'cap': usd(plan.scalingCap, 0),
              'split': numText(plan.split),
              'max': numText(plan.splitMax),
            }),
            style: context.text.callout.copyWith(color: k.fg2),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 6,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              PropRow(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Text(
                  sizeLabel(size),
                  textDirection: TextDirection.ltr,
                  style: context.text.label.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              for (final x in steps) ...[
                arrow,
                PropRow(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Text(
                    sizeLabel(x),
                    textDirection: TextDirection.ltr,
                    style: context.text.label.copyWith(color: k.fg2),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 14),
          PropGrid(
            children: [
              PropTile(label: t('prop.scaling.reviewEvery'), value: t('prop.scaling.monthsShort', {'n': plan.scalingEvery})),
              PropTile(label: t('prop.scaling.profitNeeded'), value: pctText(plan.scalingProfit)),
              PropTile(label: t('prop.scaling.increase'), value: '+${pctText(plan.scalingIncrease)}'),
              PropTile(label: t('prop.scaling.cap'), value: sizeLabel(plan.scalingCap)),
            ],
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ history */

(String, KChipTone) _payoutStatus(T t, String s) => switch (s) {
  'pending' => (t('prop.payoutStatus.pending'), KChipTone.warn),
  'approved' => (t('prop.payoutStatus.approved'), KChipTone.info),
  'paid' => (t('prop.payoutStatus.paid'), KChipTone.up),
  'rejected' => (t('prop.payoutStatus.rejected'), KChipTone.down),
  'failed' => (t('prop.payoutStatus.failed'), KChipTone.down),
  _ => (s, KChipTone.info),
};

class _History extends StatefulWidget {
  const _History({required this.rows});
  final List<Payout> rows;

  @override
  State<_History> createState() => _HistoryState();
}

class _HistoryState extends State<_History> {
  int _shown = 10;

  void _open(Payout r) {
    final t = context.t;
    final (label, _) = _payoutStatus(t, r.status);
    showKSheet<void>(
      context,
      title: '${r.planName} · ${sizeLabel(r.size)}',
      builder: (ctx) => KSheetContent(
        children: [
          KKeyValues([
            KKV(t('prop.history.requested'), fmtDateTime(t, r.requestedAt)),
            if (r.login != null) KKV(t('prop.history.account'), '#${r.login}', mono: true),
            KKV(t('prop.profit'), usd(r.profit)),
            KKV(t('prop.history.split'), pctText(r.split)),
            KKV(t('prop.feeRefund'), r.feeRefund > 0 ? usd(r.feeRefund) : '—'),
            KKV(t('prop.history.toWallet'), usd(r.total)),
            KKV(t('common.status'), label),
          ]),
          if (r.note != null && (r.status == 'rejected' || r.status == 'failed')) ...[
            const SizedBox(height: 8),
            Text(r.note!, style: ctx.text.footnote.copyWith(color: ctx.k.fg3)),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final rows = widget.rows;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            icon: LucideIcons.receipt,
            title: t('prop.history.title'),
            subtitle: t('prop.history.subtitle'),
            action: CsvButton(
              name: 'prop-payouts',
              headers: [
                t('prop.history.requested'),
                t('prop.history.account'),
                t('prop.profit'),
                t('prop.history.split'),
                t('prop.feeRefund'),
                t('prop.history.toWallet'),
                t('common.status'),
              ],
              rows: () => [
                for (final r in rows)
                  [r.requestedAt?.toUtc().toIso8601String(), '${r.planName} ${numText(r.size)}', r.profit, r.split, r.feeRefund, r.total, r.status],
              ],
            ),
          ),
          const SizedBox(height: 10),
          if (rows.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text(
                t('prop.history.empty'),
                textAlign: TextAlign.center,
                style: context.text.footnote.copyWith(color: k.fg3),
              ),
            )
          else ...[
            for (var i = 0; i < rows.length && i < _shown; i++) ...[if (i > 0) const KDivider(), _PayoutRow(r: rows[i], onTap: () => _open(rows[i]))],
            if (rows.length > _shown)
              Center(
                child: KTextButton(label: t('common.showMore'), onPressed: () => setState(() => _shown += 10)),
              ),
          ],
        ],
      ),
    );
  }
}

class _PayoutRow extends StatelessWidget {
  const _PayoutRow({required this.r, required this.onTap});
  final Payout r;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final (label, tone) = _payoutStatus(t, r.status);
    return KPressable(
      onTap: onTap,
      pressedScale: 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 11),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${r.planName} · ${sizeLabel(r.size)}', maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.label),
                  if (r.login != null)
                    Text(
                      '#${r.login}',
                      textDirection: TextDirection.ltr,
                      style: context.text.mono(11, color: k.fg3),
                    ),
                  const SizedBox(height: 2),
                  Text(
                    fmtDateTime(t, r.requestedAt),
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(usd(r.total), textDirection: TextDirection.ltr, style: context.text.figure.copyWith(fontSize: 14)),
                const SizedBox(height: 4),
                KChip(label: label, tone: tone, small: true),
                if (r.note != null && (r.status == 'rejected' || r.status == 'failed'))
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 180),
                    child: Text(
                      r.note!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 11),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
