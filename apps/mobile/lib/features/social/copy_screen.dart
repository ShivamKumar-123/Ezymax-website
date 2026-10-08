// Copy & PAMM › Copy trading (/social/copy): my copy subscriptions — KPIs, current / stopped list with pause /
// resume, settings, stop wizard, add / withdraw funds, details, the master's new terms, and How it works. Port of
// the phone layout of apps/crm/components/social-live/subscriptions.tsx (LiveCopyPage, GET subscriptions every 5 s).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'social_api.dart';
import 'widgets/bits.dart';
import 'widgets/copy_sheets.dart';

class CopyScreen extends ConsumerStatefulWidget {
  const CopyScreen({super.key});

  @override
  ConsumerState<CopyScreen> createState() => _CopyScreenState();
}

class _CopyScreenState extends ConsumerState<CopyScreen> {
  String _view = 'current';

  void _reload() => ref.invalidate(subscriptionsProvider);

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    final q = ref.watch(subscriptionsProvider);
    final items = q.value;
    final width = MediaQuery.sizeOf(context).width;
    final kpiWidth = (width - 2 * KSpace.page) * 0.72;

    final children = <Widget>[
      KPageHeader(title: t('social.subs.title'), subtitle: Text(t('social.subs.subtitle'))),
      const SizedBox(height: 14),
      Align(
        alignment: AlignmentDirectional.centerStart,
        child: KButton(label: t('social.subs.findMaster'), icon: LucideIcons.compass, onPressed: () => context.go('/social')),
      ),
      const SizedBox(height: 18),
    ];

    if (q.hasError && items == null) {
      children.add(SocialErrorCard(error: q.error, onRetry: _reload));
    } else if (items == null) {
      children.add(const BlockSkeleton(h: 140));
    } else if (items.isEmpty) {
      children.addAll([
        KCard(
          child: KEmptyState(
            art: KIllustrationName.copyTrading,
            title: t('social.subs.empty.title'),
            text: t('social.subs.empty.text'),
            action: KButton(
              label: t('social.lb.title'),
              icon: LucideIcons.compass,
              size: KButtonSize.sm,
              variant: KButtonVariant.surface,
              onPressed: () => context.go('/social'),
            ),
          ),
        ),
        const SizedBox(height: 16),
        const _HowItWorks(),
      ]);
    } else {
      final current = items.where((s) => s.status != 'stopped').toList();
      final stopped = items.where((s) => s.status == 'stopped').toList();
      final list = _view == 'current' ? current : stopped;
      final equity = current.fold<double>(0, (a, s) => a + s.equity);
      final profit = current.fold<double>(0, (a, s) => a + s.profit);
      final deposits = current.fold<double>(0, (a, s) => a + s.netDeposits);
      final feesPending = items.fold<double>(0, (a, s) => a + s.feesPending);
      final feesPaid = items.fold<double>(0, (a, s) => a + s.feesPaid);
      children.addAll([
        SizedBox(
          height: 168,
          child: ListView(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            children: [
              KKpiCard(
                width: kpiWidth,
                label: t('social.subs.kpi.copyEquity'),
                icon: LucideIcons.wallet,
                value: KMoney(equity, style: context.text.moneyL),
                chip: KChip(label: t('social.subs.kpi.activeOrPaused', {'count': current.length})),
              ),
              const SizedBox(width: 12),
              KKpiCard(
                width: kpiWidth,
                label: t('social.profit'),
                icon: LucideIcons.repeat,
                value: KMoney(profit, signed: true, tone: KMoneyTone.auto, style: context.text.moneyL),
                chip: KChip(
                  label: deposits > 0 ? t('social.subs.kpi.onNetDeposits', {'pct': pct(profit / deposits * 100)}) : '—',
                  tone: profit >= 0 ? KChipTone.up : KChipTone.down,
                ),
              ),
              const SizedBox(width: 12),
              KKpiCard(
                width: kpiWidth,
                label: t('social.feesPending'),
                icon: LucideIcons.shieldCheck,
                value: KMoney(feesPending, style: context.text.moneyL),
                chip: KChip(label: t('social.subs.kpi.awaitingApproval'), tone: KChipTone.warn),
              ),
              const SizedBox(width: 12),
              KKpiCard(
                width: kpiWidth,
                label: t('social.inv.kpi.feesPaid'),
                icon: LucideIcons.layers,
                value: KMoney(feesPaid, style: context.text.moneyL),
                chip: KChip(label: t('social.subs.kpi.allSubs')),
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        Text(t('social.mySubscriptions'), style: context.text.title1.copyWith(fontSize: 18, fontWeight: FontWeight.w500)),
        const SizedBox(height: 2),
        Text(t('social.subs.listHint'), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13)),
        const SizedBox(height: 10),
        KSegmented<String>(
          values: const ['current', 'stopped'],
          labels: [
            t('social.subs.tabCurrent', {'n': current.length}),
            t('social.subs.tabStopped', {'n': stopped.length}),
          ],
          selected: _view,
          height: 34,
          onChanged: (v) => setState(() => _view = v),
        ),
        const SizedBox(height: 12),
        if (list.isEmpty)
          KCard(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text(
                _view == 'current' ? t('social.subs.noActive') : t('social.subs.noStopped'),
                textAlign: TextAlign.center,
                style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13),
              ),
            ),
          )
        else
          for (final s in list) ...[_SubCard(s: s, readOnly: readOnly, onChanged: _reload), const SizedBox(height: 14)],
        const SizedBox(height: 4),
        const _HowItWorks(),
      ]);
    }

    return KPageScroll(
      onRefresh: () async {
        _reload();
        await ref.read(subscriptionsProvider.future).then((_) {}, onError: (Object _) {});
      },
      children: children,
    );
  }
}

/// A8: the master changed the fee terms; this follower accepts them or stops copying.
class _TermsBanner extends ConsumerStatefulWidget {
  const _TermsBanner({required this.s, required this.onAccepted, required this.onStop, required this.readOnly});
  final SubscriptionView s;
  final VoidCallback onAccepted;
  final VoidCallback onStop;
  final bool readOnly;

  @override
  ConsumerState<_TermsBanner> createState() => _TermsBannerState();
}

class _TermsBannerState extends ConsumerState<_TermsBanner> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final s = widget.s;
    final p = s.pendingTerms!;
    final paused = s.status == 'paused' && s.pauseReason == 'terms';
    final period = periodLabel(t, strOf(p['feePeriod'])).toLowerCase();
    final vars = {
      'name': s.masterName,
      'fee': numText(numOf(p['perfFeePct'])),
      'period': period,
      'current': numText(s.perfFeePct),
      'currentPeriod': periodLabel(t, s.feePeriod).toLowerCase(),
      'date': serverTime(t, strOrNull(p['deadline']), withYear: false),
    };
    Future<void> accept() async {
      setState(() => _busy = true);
      try {
        await socialPost(ref, 'subscriptions/${s.id}/accept-terms');
        okToast(
          ref,
          t('social.subs.terms.accepted'),
          t(paused ? 'social.subs.terms.acceptedResumed' : 'social.subs.terms.acceptedDesc', {'fee': vars['fee'], 'period': period}),
        );
        widget.onAccepted();
      } on ApiException catch (e) {
        if (context.mounted) errToast(ref, context, t('social.subs.terms.acceptFailed'), e);
      } finally {
        if (mounted) setState(() => _busy = false);
      }
    }

    return InfoBox(
      tone: KChipTone.warn,
      icon: LucideIcons.fileText,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(t(paused ? 'social.subs.terms.bannerPaused' : 'social.subs.terms.banner', vars), style: TextStyle(color: k.fg2)),
          if (!widget.readOnly) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                KButton(label: t('social.subs.terms.accept'), icon: LucideIcons.check, size: KButtonSize.sm, loading: _busy, onPressed: accept),
                KButton(
                  label: t('social.subs.stopCopying'),
                  icon: LucideIcons.square,
                  variant: KButtonVariant.danger,
                  size: KButtonSize.sm,
                  onPressed: widget.onStop,
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _SubCard extends ConsumerStatefulWidget {
  const _SubCard({required this.s, required this.readOnly, required this.onChanged});
  final SubscriptionView s;
  final bool readOnly;
  final VoidCallback onChanged;

  @override
  ConsumerState<_SubCard> createState() => _SubCardState();
}

class _SubCardState extends ConsumerState<_SubCard> {
  bool _busy = false;

  Future<void> _togglePause() async {
    final t = context.t;
    final s = widget.s;
    final pause = s.status != 'paused';
    setState(() => _busy = true);
    try {
      await socialPatch(ref, 'subscriptions/${s.id}', {'paused': pause});
      okToast(
        ref,
        pause ? t('social.subs.toast.paused') : t('social.subs.toast.resumed'),
        pause ? t('social.subs.toast.pausedDesc') : t('social.subs.toast.resumedDesc', {'name': s.masterName}),
      );
      widget.onChanged();
    } on ApiException catch (e) {
      if (mounted) errToast(ref, context, pause ? t('social.subs.toast.pauseFailed') : t('social.subs.toast.resumeFailed'), e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _stop() => showStopSheet(context, widget.s, onStopped: widget.onChanged);
  void _funds(String dir) => showSubFundsSheet(context, widget.s, direction: dir, onDone: widget.onChanged);
  void _detail([String tab = 'positions']) => showSubDetailSheet(context, widget.s.id, tab: tab);

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final s = widget.s;
    final ro = widget.readOnly;
    final stopped = s.status == 'stopped';
    final masterStopped = !stopped && s.attention == 'master_stopped';
    final pausedForTerms = s.status == 'paused' && s.pauseReason == 'terms';
    final canWithdraw = s.withdrawableNow > 0;
    final chips = <Widget>[
      KChip(label: t('social.subs.feeChip', {'fee': numText(s.perfFeePct), 'period': periodLabel(t, s.feePeriod).toLowerCase()}), small: true),
      if (s.maxDdPct != null)
        KChip(label: t('social.subs.ddStopChip', {'dd': numText(s.maxDdPct!)}), tone: KChipTone.down, icon: LucideIcons.shieldAlert, small: true),
      if (s.equityStop != null) KChip(label: t('social.subs.equityStopChip', {'amount': usd(s.equityStop, 0)}), tone: KChipTone.down, small: true),
      if (s.maxLot != null) KChip(label: t('social.subs.maxLotChip', {'lot': s.maxLot!.toStringAsFixed(2)}), small: true),
      if (s.autoSlPips != null)
        KChip(label: t('social.subs.autoSlChip', {'pips': pips1(s.autoSlPips)}), tone: KChipTone.down, icon: LucideIcons.target, small: true),
      if (s.excludedSymbols.isNotEmpty)
        KChip(
          label:
              '${t('social.subs.exclChip', {'list': s.excludedSymbols.take(3).join(', ')})}'
              '${s.excludedSymbols.length > 3 ? ' +${s.excludedSymbols.length - 3}' : ''}',
          small: true,
        )
      else
        KChip(label: t('social.subs.allSymbols'), small: true),
    ];
    final buttons = <Widget>[
      if (!stopped && !ro) ...[
        KButton(
          label: s.status == 'paused' ? t('social.subs.resume') : t('social.subs.pause'),
          icon: s.status == 'paused' ? LucideIcons.play : LucideIcons.pause,
          variant: KButtonVariant.surface,
          size: KButtonSize.sm,
          expand: true,
          loading: _busy,
          onPressed: _togglePause,
        ),
        KButton(
          label: t('social.subs.settings'),
          icon: LucideIcons.settings2,
          variant: KButtonVariant.surface,
          size: KButtonSize.sm,
          expand: true,
          onPressed: () => showSubSettingsSheet(context, s, onSaved: widget.onChanged),
        ),
        KButton(label: t('social.subs.stop'), icon: LucideIcons.square, variant: KButtonVariant.danger, size: KButtonSize.sm, expand: true, onPressed: _stop),
        KButton(
          label: t('social.subs.funds.add'),
          icon: LucideIcons.arrowDownToLine,
          variant: KButtonVariant.surface,
          size: KButtonSize.sm,
          expand: true,
          onPressed: () => _funds('add'),
        ),
        KButton(
          label: t('social.subs.funds.withdraw'),
          icon: LucideIcons.arrowUpFromLine,
          variant: KButtonVariant.surface,
          size: KButtonSize.sm,
          expand: true,
          onPressed: () => _funds('withdraw'),
        ),
      ],
      if (stopped && canWithdraw && !ro)
        KButton(
          label: t('social.subs.funds.withdraw'),
          icon: LucideIcons.arrowUpFromLine,
          variant: KButtonVariant.surface,
          size: KButtonSize.sm,
          expand: true,
          onPressed: () => _funds('withdraw'),
        ),
      KButton(
        label: t('common.details'),
        icon: LucideIcons.listChecks,
        variant: KButtonVariant.surface,
        size: KButtonSize.sm,
        expand: true,
        onPressed: _detail,
      ),
    ];
    return Opacity(
      opacity: stopped ? 0.75 : 1,
      child: KCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: KPressable(
                    pressedScale: 1,
                    onTap: () => context.push('/social/masters/${s.masterId}'),
                    child: MasterIdentity(nickname: s.masterName, subText: s.masterStrategy, size: 42),
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    StatusChip(
                      status: s.status,
                      label: t.dyn('social.subStatus.${s.status}', fallback: s.status),
                    ),
                    const SizedBox(height: 6),
                    RiskBadge(risk: s.masterRisk),
                  ],
                ),
              ],
            ),
            if (s.masterHouse) ...[const SizedBox(height: 8), const Align(alignment: AlignmentDirectional.centerStart, child: HouseBadge())],
            const SizedBox(height: 10),
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 6,
              runSpacing: 4,
              children: [
                Text(t('social.subs.copyAccount'), style: context.text.footnote.copyWith(color: k.fg3)),
                KPressable(
                  minSize: 30,
                  onTap: () => kCopy(context, '${s.login}'),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Num('#${s.login}', color: k.fg2, style: context.text.mono(12.5)),
                      const SizedBox(width: 4),
                      Icon(LucideIcons.copy, size: 12, color: k.fg3),
                    ],
                  ),
                ),
                Text(t('social.subs.since', {'date': fmtDate(t, s.createdAt)}), style: context.text.footnote.copyWith(color: k.fg3)),
              ],
            ),
            if (stopped && s.stopReason != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  '${stopReasonText(t, s.stopReason)}${s.stoppedAt != null ? ' · ${fmtDate(t, s.stoppedAt)}' : ''}',
                  style: context.text.footnote.copyWith(color: k.down),
                ),
              ),
            if (!stopped && s.masterFrozen && !masterStopped)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(t('social.subs.frozen'), style: context.text.footnote.copyWith(color: k.warn)),
              ),
            if (masterStopped) ...[
              const SizedBox(height: 10),
              InfoBox(
                tone: KChipTone.down,
                icon: LucideIcons.octagonAlert,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t('social.subs.masterStopped', {'name': s.masterName}), style: TextStyle(color: k.fg2)),
                    if (!ro) ...[
                      const SizedBox(height: 8),
                      KButton(
                        label: t('social.subs.stopCopying'),
                        icon: LucideIcons.square,
                        variant: KButtonVariant.danger,
                        size: KButtonSize.sm,
                        onPressed: _stop,
                      ),
                    ],
                  ],
                ),
              ),
            ],
            if (s.status == 'paused') ...[
              const SizedBox(height: 10),
              InfoBox(
                tone: KChipTone.warn,
                icon: LucideIcons.pause,
                text: pausedForTerms ? t('social.subs.pausedTermsNote', {'name': s.masterName}) : t('social.subs.pausedNote'),
              ),
            ],
            if (!stopped && s.pendingTerms != null) ...[
              const SizedBox(height: 10),
              _TermsBanner(s: s, readOnly: ro, onAccepted: widget.onChanged, onStop: _stop),
            ],
            const SizedBox(height: 14),
            Text(t('common.equity'), style: context.text.footnote.copyWith(color: k.fg3)),
            const SizedBox(height: 2),
            KMoney(s.equity, style: context.text.moneyL.copyWith(fontSize: 26)),
            const SizedBox(height: 2),
            Num(
              '${usd(s.profit, 2, true)} (${pct(s.returnPct)})',
              color: toneColor(context, s.profit),
              style: context.text.footnote.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 14),
            TileGrid(
              tiles: [
                Tile(label: t('social.subs.netDeposits'), value: Num(usd(s.netDeposits, 0))),
                Tile(label: t('social.subs.highWater'), value: Num(usd(s.hwm, 0))),
                Tile(
                  label: t('social.feesPending'),
                  value: Num(usd(s.feesPending), color: s.feesPending > 0 ? k.warn : null),
                ),
                Tile(label: t('social.follow.step.sizing'), value: Text(sizingText(t, s.sizing))),
                Tile(label: t('social.col.open'), value: Num(t('social.subs.openCounts', {'pos': s.positions, 'ord': s.orders}))),
                Tile(label: t('social.inv.kpi.feesPaid'), value: Num(usd(s.feesPaid))),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(spacing: 6, runSpacing: 6, children: chips),
            const SizedBox(height: 8),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: KPressable(
                onTap: () => _detail('log'),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(LucideIcons.circleQuestionMark, size: 14, color: k.ember),
                    const SizedBox(width: 5),
                    Text(
                      t('social.subs.whyNotCopied'),
                      style: context.text.footnote.copyWith(color: k.ember, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            TileGrid(tiles: buttons),
            const SizedBox(height: 8),
            TraderButton(login: s.login, label: 'Ezymex Trader', expand: true),
          ],
        ),
      ),
    );
  }
}

class _HowItWorks extends StatelessWidget {
  const _HowItWorks();

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    const rows = [
      (LucideIcons.layers, 'social.subs.how.mirroredT', 'social.subs.how.mirroredS'),
      (LucideIcons.ban, 'social.subs.how.noSingleT', 'social.subs.how.noSingleS'),
      (LucideIcons.slidersVertical, 'social.subs.how.limitsT', 'social.subs.how.limitsS'),
      (LucideIcons.check, 'social.subs.how.feesT', 'social.subs.how.feesS'),
    ];
    return SectionCard(
      title: t('social.subs.how.title'),
      subtitle: t('social.subs.how.subtitle'),
      icon: LucideIcons.shieldCheck,
      child: Column(
        children: [
          for (final (icon, title, text) in rows)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.fromLTRB(12, 11, 12, 11),
              decoration: BoxDecoration(
                color: k.surface2,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: k.line),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(shape: BoxShape.circle, color: k.surface3),
                    child: Icon(icon, size: 14, color: k.fg2),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          t(title),
                          style: context.text.label.copyWith(color: k.fg, fontWeight: FontWeight.w600),
                        ),
                        Text(t(text), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12)),
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
