// Dashboard › Overview: the reference screen of the design system, on real data. Port of the web's phone layout
// (apps/crm/components/dashboard/live-dashboard.tsx in OverviewLayout's phone order):
//   1 header (Overview + greeting + Verified)      1 Ask Kalks AI pill            [later: agent C1]
//   2 total balance + Deposit / Withdraw / Transfer
//   3 KPI cards (equity, today's P&L, wallet, rewards)
//   4 your accounts (carousel, details, Trade / Fund / Refill / ⋯)
//   5 quick actions
//   6 statistics (equity / P&L curve)                                                  [later: agent C1]
//   7 notifications (prompts + latest)
//   8 activity tabs (history / funding / linked)                                       [later: agent C1]
//   9 getting started checklist                                                        [later: agent C1]
//   then Markets (movers, heatmap, calendar, news, world) and More for you (Kalks Trader, account, sessions,
//   support)                                                                            [later: agent C1]
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/models/account.dart';
import '../../core/models/user.dart';
import '../../core/notifications/notifications.dart';
import '../../core/prefs.dart';
import '../../data/client_data.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'widgets/accounts_panel.dart';
import 'widgets/balance_panel.dart';
import 'widgets/notifications_panel.dart';

/// Whether balances are hidden (the dashboard's eye), remembered on the device.
class HideBalances extends Notifier<bool> {
  @override
  bool build() => ref.read(prefsProvider).hideBalances;
  void toggle() {
    state = !state;
    unawaited(ref.read(prefsProvider).setHideBalances(state));
  }
}

final hideBalancesProvider = NotifierProvider<HideBalances, bool>(HideBalances.new);

/// The "Verify your identity" step from the real KYC status (web kycStep).
({String state, String text}) kycStep(SessionUser me, T t) {
  if (me.kycStatus == KycStatus.verified) return (state: 'done', text: t('dashboard.steps.kyc.verified'));
  switch (me.kycCaseStatus) {
    case 'more_info':
      return (state: 'todo', text: t('dashboard.steps.kyc.moreInfo'));
    case 'submitted':
    case 'in_review':
      return (state: 'review', text: t('dashboard.steps.kyc.review'));
    case 'draft':
      return (state: 'todo', text: t('dashboard.steps.kyc.draft'));
    case 'rejected':
      return (state: 'rejected', text: t('dashboard.steps.kyc.rejected'));
  }
  if (me.kycStatus == KycStatus.pending) return (state: 'review', text: t('dashboard.steps.kyc.review'));
  if (me.kycStatus == KycStatus.rejected) return (state: 'rejected', text: t('dashboard.steps.kyc.rejected'));
  return (state: 'todo', text: t('dashboard.steps.kyc.todo'));
}

String _greeting(DateTime now) => now.hour < 12 ? 'morning' : (now.hour < 18 ? 'afternoon' : 'evening');

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    ref
      ..invalidate(accountsProvider)
      ..invalidate(walletOverviewProvider)
      ..invalidate(walletActivityProvider)
      ..invalidate(rewardsProvider)
      ..invalidate(equityCurveProvider(14));
    await Future.wait<void>([
      ref.read(accountsProvider.future).then((_) {}, onError: (Object _) {}),
      ref.read(walletOverviewProvider.future).then((_) {}, onError: (Object _) {}),
      ref.read(notificationsProvider.notifier).load(),
    ]);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final me = ref.watch(meProvider);
    if (me == null) return const SizedBox.shrink();
    final readOnly = me.readOnly;
    final hidden = ref.watch(hideBalancesProvider);

    final acc = ref.watch(accountsProvider);
    final all = acc.value;
    // archived / closed accounts live on the Accounts page's Archived tab only
    final accounts = all?.where((a) => !a.archived).toList();
    final totals = AccountTotals(accounts ?? const []);
    final wallet = ref.watch(walletOverviewProvider).value;
    final walletTotal = wallet?.usdt.total;
    final rewards = ref.watch(rewardsProvider).value;

    // today's P&L: today's equity move net of deposits / withdrawals (reports), else the live accounts' floating P&L
    final week = ref.watch(equityCurveProvider(14)).value;
    double? today, todayPct;
    if (week != null && week.length > 1) {
      final last = week[week.length - 1], prev = week[week.length - 2];
      today = last.equity - prev.equity - last.flow;
      todayPct = prev.equity > 0 ? today / prev.equity * 100 : null;
    }
    final hasLive = totals.live.isNotEmpty;

    // carousel: live first, then demo, then prop
    final ordered = [...totals.live, ...totals.demo, ...?accounts?.where((a) => a.prop)];

    // prompts: verification, then funding
    final kyc = kycStep(me, t);
    final prompts = <DashboardPrompt>[
      if (!readOnly && kyc.state != 'done')
        DashboardPrompt(
          id: 'kyc-${kyc.state}',
          title: t('dashboard.steps.kyc.title'),
          text: kyc.text,
          icon: LucideIcons.idCard,
          tone: kyc.state == 'rejected' ? KTone.coral : KTone.amber,
          actionLabel: kyc.state == 'review' ? t('common.details') : t('dashboard.home.verifyNow'),
          href: '/profile/verification',
        ),
      if (!readOnly && wallet != null && walletTotal == 0 && wallet.pendingDeposits.isEmpty)
        DashboardPrompt(
          id: 'fund',
          title: t('dashboard.home.fundTitle'),
          text: t('dashboard.home.fundText'),
          icon: LucideIcons.wallet,
          tone: KTone.mint,
          actionLabel: t('dashboard.home.depositNow'),
          href: '/wallet/deposit',
        ),
    ];

    final width = MediaQuery.sizeOf(context).width;
    final kpiWidth = (width - 2 * KSpace.page) * 0.78;
    final rtl = Directionality.of(context) == TextDirection.rtl;

    return KPageScroll(
      onRefresh: () => _refresh(ref),
      children: [
        // 1. header
        KPageHeader(
          title: t('shell.nav.overview'),
          subtitle: Wrap(
            spacing: 8,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(t.dyn('dashboard.greeting.${_greeting(DateTime.now())}', vars: {'name': me.firstName})),
              if (me.kycStatus == KycStatus.verified) KChip(label: t('common.verified'), tone: KChipTone.up, icon: LucideIcons.badgeCheck, small: true),
            ],
          ),
        ),
        const SizedBox(height: 24),
        // 2. total balance
        BalancePanel(
          total: accounts != null || walletTotal != null ? totals.equity + (walletTotal ?? 0) : null,
          loading: accounts == null && !acc.hasError,
          changePct: todayPct,
          readOnly: readOnly,
          hidden: hidden,
        ),
        const SizedBox(height: 28),
        // 3. KPI cards
        SizedBox(
          height: 186,
          child: ListView(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            physics: const PageScrollPhysics(parent: BouncingScrollPhysics()),
            children: [
              KKpiCard(
                width: kpiWidth,
                label: t('dashboard.equity.title'),
                icon: LucideIcons.trendingUp,
                value: accounts == null ? const Text('—') : KMoney(totals.equity, style: context.text.moneyL, hidden: hidden),
                chip: KChip(
                  label: hasLive
                      ? t('dashboard.home.accountsChip', {'live': totals.live.length, 'positions': totals.positions})
                      : t('dashboard.accounts.openLive.title'),
                ),
                onTap: () => context.go('/accounts'),
              ),
              const SizedBox(width: 12),
              KKpiCard(
                width: kpiWidth,
                label: today != null ? t('dashboard.home.todayPnl') : t('dashboard.home.floating'),
                icon: LucideIcons.chartLine,
                value: accounts == null
                    ? const Text('—')
                    : KMoney(today ?? totals.profit, signed: true, tone: KMoneyTone.auto, style: context.text.moneyL, hidden: hidden),
                chip: todayPct == null
                    ? null
                    : KChip(
                        label: t('dashboard.home.todayPct', {'pct': '${todayPct >= 0 ? '+' : ''}${todayPct.toStringAsFixed(2)}'}),
                        tone: (today ?? totals.profit) >= 0 ? KChipTone.up : KChipTone.down,
                      ),
                onTap: () => context.go('/portfolio/analytics'),
              ),
              const SizedBox(width: 12),
              KKpiCard(
                width: kpiWidth,
                label: t('dashboard.home.walletBalance'),
                icon: LucideIcons.wallet,
                value: walletTotal == null ? const Text('—') : KMoney(walletTotal, style: context.text.moneyL, hidden: hidden),
                footer: Row(
                  children: [
                    const KCoinIcon('usdt', size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'USDT · TRC20 · BEP20',
                      style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                onTap: () => context.go('/wallet'),
              ),
              const SizedBox(width: 12),
              KKpiCard(
                width: kpiWidth,
                label: t('dashboard.home.rewards'),
                icon: LucideIcons.award,
                value: rewards == null ? const Text('—') : KMoney(rewards.points * rewards.pointValue, style: context.text.moneyL, hidden: hidden),
                chip: KChip(
                  label: rewards == null
                      ? t('shell.nav.loyalty')
                      : t('dashboard.home.points', {'points': rewards.points.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',')}),
                  tone: KChipTone.gold,
                ),
                onTap: () => context.go('/rewards/loyalty'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 30),
        // 4. your accounts
        AccountsPanel(
          accounts: accounts == null ? null : ordered.take(8).toList(),
          loading: !acc.hasValue && !acc.hasError,
          failed: acc.hasError,
          onRetry: () => ref.invalidate(accountsProvider),
          hidden: hidden,
          onToggleHidden: ref.read(hideBalancesProvider.notifier).toggle,
          extraCount: (ordered.length - 8).clamp(0, 1 << 20),
          readOnly: readOnly,
          onTrade: (a) => context.push('/trader?login=${a.login}'),
          onMenu: (a) => context.go('/accounts/${a.login}'),
        ),
        const SizedBox(height: 30),
        // 5. quick actions
        QuickActions(
          items: [
            (
              label: t('common.transfer'),
              icon: rtl ? LucideIcons.arrowRightLeft : LucideIcons.arrowLeftRight,
              tone: KTone.lavender,
              onTap: () => context.go('/wallet/transfer'),
            ),
            (label: 'Kalks Trader', icon: LucideIcons.candlestickChart, tone: KTone.accent, onTap: () => context.push('/trader')),
            (label: t('shell.nav.copyTrading'), icon: LucideIcons.copy, tone: KTone.pink, onTap: () => context.go('/social')),
            (label: t('shell.nav.support'), icon: LucideIcons.lifeBuoy, tone: KTone.amber, onTap: () => context.go('/support')),
          ],
        ),
        const SizedBox(height: 30),
        // 7. notifications
        if (!readOnly) NotificationsPanel(prompts: prompts),
      ],
    );
  }
}
