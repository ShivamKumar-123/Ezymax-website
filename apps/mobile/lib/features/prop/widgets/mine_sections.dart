// The sections of one challenge on My challenges (apps/crm/components/prop-live/mine.tsx), in the phone order:
// banners, overview (+ trading account and Trade), daily reset, KPIs, the six rule tiles, equity, drawdown, trading
// statistics, rule events and the trade history.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/app_config.dart';
import '../../../i18n/i18n.dart';
import '../../../shell/nav.dart';
import '../../../ui/ui.dart';
import '../../accounts/widgets/account_bits.dart' show TradeSymbolAvatar, symbolLabel;
import '../prop_api.dart';
import 'csv_export.dart';
import 'prop_ui.dart';

const _gap = SizedBox(height: 16);

Color _loadTone(KTokens k, double p) => p >= 90 ? k.down : (p >= 50 ? k.warn : k.up);

/* ------------------------------------------------------------------ banners */

class ChallengeBanners extends ConsumerWidget {
  const ChallengeBanners({super.key, required this.c, required this.a, required this.v});
  final Challenge c;
  final PhaseAccount a;
  final RuleView v;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final appUrl = ref.watch(configProvider).appUrl;
    final cert =
        c.certificates.where((x) => !x.revoked && x.kind == 'pass' && x.phase == a.phase).firstOrNull ??
        (a.funded ? c.certificates.where((x) => !x.revoked && x.kind == 'funded').firstOrNull : null);
    final live = tradable(c, a);
    final items = <Widget>[
      if (c.status == 'pending_payment' || c.status == 'provisioning')
        PropBanner(tone: KChipTone.info, icon: LucideIcons.info, title: t('prop.banner.openingTitle'), text: t('prop.banner.openingText')),
      if (c.status == 'payment_failed')
        PropBanner(
          tone: KChipTone.down,
          icon: LucideIcons.triangleAlert,
          title: t('prop.status.paymentFailed'),
          text: c.failureReason ?? t('prop.error.paymentFailed'),
        ),
      if (a.status == 'failed')
        PropBanner(
          tone: KChipTone.down,
          icon: LucideIcons.shieldAlert,
          title: a.endedAt != null
              ? t('prop.banner.failedOn', {'phase': a.phase, 'date': fmtDateTime(t, a.endedAt)})
              : t('prop.banner.failed', {'phase': a.phase}),
          text: t('prop.banner.failedText', {'reason': a.endReason ?? c.failureReason ?? t('prop.banner.ruleBreached')}),
          action: KButton(label: t('prop.banner.startNew'), variant: KButtonVariant.surface, size: KButtonSize.sm, onPressed: () => context.go('/prop')),
        ),
      if (a.status == 'passed')
        PropBanner(
          tone: KChipTone.up,
          icon: LucideIcons.shieldCheck,
          title: a.endedAt != null ? t('prop.banner.passedOn', {'phase': a.phase, 'date': fmtDate(t, a.endedAt)}) : t('prop.banner.passed', {'phase': a.phase}),
          text: c.current != null && c.current!.id != a.id
              ? (c.current!.login != null
                    ? t('prop.banner.nextOpenLogin', {'phase': c.current!.phase, 'login': '${c.current!.login}'})
                    : t('prop.banner.nextOpen', {'phase': c.current!.phase}))
              : t('prop.banner.nextOpening'),
          action: cert == null
              ? null
              : KButton(
                  label: t('prop.verify.row.certificate'),
                  icon: LucideIcons.award,
                  variant: KButtonVariant.surface,
                  size: KButtonSize.sm,
                  onPressed: () => launchUrl(Uri.parse('$appUrl/verify/${cert.code}'), mode: LaunchMode.externalApplication),
                ),
        ),
      if (live && v.live && v.dailyLimit > 0 && v.dailyUsed / v.dailyLimit >= 0.5)
        PropBanner(
          tone: KChipTone.warn,
          icon: LucideIcons.triangleAlert,
          title: t('prop.banner.lossUsed', {'pct': (v.dailyUsed / v.dailyLimit * 100).round()}),
          text: t('prop.banner.lossUsedText', {'floor': usd(v.dailyFloor), 'left': usd(math.max(0, v.dailyLimit - v.dailyUsed))}),
        ),
      if (live && v.weekendWindow && !c.plan.weekendHolding)
        PropBanner(tone: KChipTone.info, icon: LucideIcons.info, title: t('prop.banner.weekendTitle'), text: t('prop.banner.weekendText')),
      if (a.funded && a.status == 'active' && c.payout != null)
        PropBanner(
          tone: KChipTone.gold,
          icon: LucideIcons.banknote,
          title: c.payout!.eligible ? t('prop.banner.payoutAvailable', {'amount': usd(c.payout!.total)}) : t('prop.mine.payouts'),
          text: c.payout!.eligible
              ? t('prop.banner.payoutProfit', {'profit': usd(c.payout!.profit), 'pct': numText(c.payout!.split)})
              : (c.payout!.eligibleFrom != null ? t('prop.banner.payoutNext', {'date': fmtDate(t, c.payout!.eligibleFrom)}) : t('prop.banner.payoutLater')),
          action: KButton(label: t('prop.mine.payouts'), variant: KButtonVariant.surface, size: KButtonSize.sm, onPressed: () => context.go('/prop/payouts')),
        ),
    ];
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < items.length; i++) ...[if (i > 0) const SizedBox(height: 8), items[i]],
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ overview + daily reset */

class ChallengeOverview extends ConsumerWidget {
  const ChallengeOverview({super.key, required this.c, required this.a, required this.v, required this.readOnly});
  final Challenge c;
  final PhaseAccount a;
  final RuleView v;
  final bool readOnly;

  Widget _stateChip(T t) {
    if (tradable(c, a)) return KChip(label: t('prop.account.enabled'), tone: KChipTone.up, small: true);
    if (a.status == 'passed') return KChip(label: t('prop.account.passed'), tone: KChipTone.up, small: true);
    if (a.status == 'failed') return KChip(label: t('prop.account.failed'), tone: KChipTone.down, small: true);
    if (a.status == 'provisioning') return KChip(label: t('prop.account.opening'), tone: KChipTone.info, small: true);
    return KChip(label: t('prop.status.closed'), small: true);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final live = tradable(c, a);
    // the support chat may be switched off by the broker (module support)
    final support = pageOn(ref.watch(configProvider), '/support');
    final pills = [
      (LucideIcons.coins, t('prop.mine.initialBalance'), usd(a.initialBalance, 0)),
      (LucideIcons.gauge, t('prop.mine.drawdown'), '${ddTypeLabel(t, c.plan.ddType)} ${pctText(c.plan.maxDD)}'),
      (LucideIcons.candlestickChart, t('prop.leverage'), '1:${c.leverage}'),
      (LucideIcons.coins, t('prop.history.split'), pctText(c.split)),
    ];
    Widget dateTile(IconData icon, String label, String value) => PropRow(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          Icon(icon, size: 16, color: k.fg3),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.micro.copyWith(color: k.fg3, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 2),
                Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.label),
              ],
            ),
          ),
        ],
      ),
    );
    return KCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              KChip(label: challengeStatusLabel(t, c.status), tone: challengeTone(c.status), small: true),
              KChip(label: a.phase, small: true),
            ],
          ),
          const SizedBox(height: 10),
          Text('${c.planName} · ${sizeLabel(c.size)}', style: context.text.title1.copyWith(fontWeight: FontWeight.w500)),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final p in pills)
                Container(
                  padding: const EdgeInsetsDirectional.fromSTEB(5, 5, 14, 5),
                  decoration: BoxDecoration(
                    color: k.surface2,
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(color: k.line),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(shape: BoxShape.circle, color: k.surface3),
                        child: Icon(p.$1, size: 14, color: k.fg2),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            p.$2,
                            style: context.text.micro.copyWith(color: k.fg3, fontWeight: FontWeight.w500, fontSize: 9.5),
                          ),
                          Text(
                            p.$3,
                            style: context.text.caption.copyWith(fontSize: 12.5, color: k.fg, fontFeatures: kTabular),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 20),
          PropLabel(t('prop.mine.progress')),
          const SizedBox(height: 12),
          KStepIndicator(steps: planSteps(t, c.plan), current: stepIndex(c)),
          const SizedBox(height: 18),
          PropPair(
            dateTile(LucideIcons.calendarDays, t('prop.mine.phaseStarted'), fmtDate(t, a.startedAt)),
            dateTile(
              LucideIcons.calendarCheck,
              a.endedAt != null ? t('prop.mine.ended') : t('prop.mine.deadline'),
              a.endedAt != null ? fmtDate(t, a.endedAt) : (v.deadline != null ? fmtDate(t, v.deadline) : t('prop.noTimeLimit')),
            ),
          ),
          const SizedBox(height: 18),
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
                      child: Text(t('prop.mine.tradingAccount'), style: context.text.headline.copyWith(fontSize: 14, fontWeight: FontWeight.w500)),
                    ),
                    _stateChip(t),
                  ],
                ),
                const SizedBox(height: 14),
                PropPair(
                  CredentialField(label: t('prop.cred.login'), value: a.login != null ? '${a.login}' : '—', copy: a.login != null),
                  CredentialField(label: t('prop.cred.server'), value: 'Ezymex-Live', mono: false, copy: false),
                  gap: 10,
                ),
                const SizedBox(height: 12),
                Text(
                  live
                      ? t('prop.account.tradableText')
                      : a.status == 'passed'
                      ? t('prop.account.passedText')
                      : a.status == 'failed'
                      ? t('prop.account.failedText')
                      : t('prop.account.unavailableText'),
                  style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (!readOnly) PropTradeButton(login: a.login, disabled: !live),
                    if (support)
                      KButton(label: t('prop.mine.support'), variant: KButtonVariant.surface, size: KButtonSize.sm, onPressed: () => context.go('/support')),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ResetCard extends StatelessWidget {
  const ResetCard({super.key, required this.v, required this.active});
  final RuleView v;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final left = math.max(0.0, v.dailyLimit - v.dailyUsed);
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(icon: LucideIcons.timer, title: t('prop.reset.title'), subtitle: t('prop.reset.subtitle')),
          const SizedBox(height: 18),
          Text(
            active ? t('prop.reset.todayIn') : t('prop.reset.nextIn'),
            textAlign: TextAlign.center,
            style: context.text.footnote.copyWith(color: k.fg2),
          ),
          const SizedBox(height: 6),
          Center(
            child: ResetCountdown(
              target: v.nextReset,
              style: context.text.mono(36, weight: FontWeight.w600, color: k.fg),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            t('prop.reset.note'),
            textAlign: TextAlign.center,
            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
          ),
          const SizedBox(height: 18),
          PropPair(
            PropTile(label: t('prop.reset.permitted'), value: usd(v.dailyLimit)),
            PropTile(label: t('prop.reset.remaining'), value: usd(left), tone: left <= 0 ? k.down : k.up),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ KPIs */

class ChallengeKpis extends StatelessWidget {
  const ChallengeKpis({super.key, required this.c, required this.a, required this.v});
  final Challenge c;
  final PhaseAccount a;
  final RuleView v;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final live = tradable(c, a);
    final today = v.equity - v.dailyRef;
    final vsStart = (v.balance - v.initial) / (v.initial == 0 ? 1 : v.initial) * 100;
    final width = (MediaQuery.sizeOf(context).width - 2 * KSpace.page) * 0.78;
    final style = context.text.moneyL;
    final cards = [
      KKpiCard(
        width: width,
        label: t('common.balance'),
        icon: LucideIcons.wallet,
        value: KMoney(v.balance, style: style),
        chip: KChip(
          label: t('prop.kpi.vsStart', {'pct': '${v.balance >= v.initial ? '+' : ''}${vsStart.toStringAsFixed(2)}'}),
          tone: v.balance >= v.initial ? KChipTone.up : KChipTone.down,
        ),
      ),
      KKpiCard(
        width: width,
        label: t('common.equity'),
        icon: LucideIcons.chartLine,
        value: KMoney(v.equity, style: style),
        chip: KChip(label: t('prop.kpi.floating', {'amount': signedUsd(v.equity - v.balance)}), tone: v.equity >= v.balance ? KChipTone.up : KChipTone.down),
      ),
      KKpiCard(
        width: width,
        label: t('prop.profit'),
        icon: LucideIcons.trendingUp,
        value: KMoney(v.profit, signed: true, tone: KMoneyTone.auto, style: style),
        chip: KChip(
          label: a.funded
              ? t('prop.kpi.yours', {'pct': numText(c.split)})
              : (v.targetAmount != null && v.targetAmount! > 0
                    ? t('prop.kpi.ofTarget', {'pct': math.min(999, ratio(math.max(0, v.profit), v.targetAmount!)).toStringAsFixed(0)})
                    : '—'),
          tone: a.funded ? KChipTone.gold : KChipTone.ember,
        ),
      ),
      KKpiCard(
        width: width,
        label: t('prop.kpi.todayPl'),
        icon: LucideIcons.circleDollarSign,
        value: KMoney(live ? today : 0, signed: true, tone: KMoneyTone.auto, style: style),
        chip: KChip(label: '${t('prop.kpi.open', {'count': a.openPositions})} · ${t('prop.kpi.tradingDays', {'count': v.tradingDays})}'),
      ),
    ];
    return SizedBox(
      height: 186,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        itemCount: cards.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (_, i) => cards[i],
      ),
    );
  }
}

/* ------------------------------------------------------------------ rules */

class ChallengeRules extends StatelessWidget {
  const ChallengeRules({super.key, required this.c, required this.a, required this.v});
  final Challenge c;
  final PhaseAccount a;
  final RuleView v;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final ended = a.status != 'active';
    final failedRule = a.status == 'failed' ? (a.endReason ?? '').toLowerCase() : '';
    final dailyPct = ratio(v.dailyUsed, v.dailyLimit);
    final ddPct = ratio(v.ddUsed, v.ddLimit);
    final target = v.targetAmount ?? 0;
    final tPct = target > 0 ? ratio(math.max(0, v.profit), target) : 0.0;
    final now = DateTime.now();
    final left = v.deadline == null ? null : (v.deadline!.isAfter(now) ? v.deadline!.difference(now) : Duration.zero);
    final cons = c.plan.consistency > 0;
    RuleState st(bool breached, bool met) => breached ? RuleState.failed : (met ? RuleState.passed : (ended ? RuleState.off : RuleState.ok));

    final tiles = <Widget>[
      RuleTile(
        icon: LucideIcons.gauge,
        title: t('prop.dailyLossLimit'),
        state: st(failedRule.contains('daily'), false),
        progress: dailyPct,
        tone: _loadTone(k, dailyPct),
        left: PropTrans(t('prop.tile.used', {'v': usd(v.dailyUsed), 'max': usd(v.dailyLimit)})),
        right: '${dailyPct.toStringAsFixed(1)}%',
        rows: [
          (t('prop.tile.limit'), '${pctText(c.plan.dailyLoss)} · ${usd(v.dailyLimit)}', null),
          (t('prop.tile.reference'), '${usd(v.dailyRef)} · ${basisLabel(t, c.plan.dailyBasis)}', null),
          (t('prop.tile.breachLevel'), usd(v.dailyFloor), k.down),
        ],
      ),
      RuleTile(
        icon: LucideIcons.shieldAlert,
        title: t('prop.rule.maxDrawdown'),
        state: st(failedRule.contains('drawdown'), false),
        progress: ddPct,
        tone: _loadTone(k, ddPct),
        left: PropTrans(t('prop.tile.used', {'v': usd(v.ddUsed), 'max': usd(v.ddLimit)})),
        right: '${ddPct.toStringAsFixed(1)}%',
        rows: [
          (
            t('common.type'),
            c.plan.ddType == 'trailing' ? (c.plan.trailingLock ? t('prop.tile.trailingLocks') : t('prop.tile.trailing')) : t('prop.tile.static'),
            null,
          ),
          (t('prop.tile.hwm'), usd(v.hwm), null),
          (t('prop.tile.breachLevel'), usd(v.ddFloor), k.down),
        ],
      ),
      if (a.funded)
        RuleTile(
          icon: LucideIcons.wallet,
          title: t('prop.verify.kind.payout'),
          state: c.payout?.eligible == true ? RuleState.passed : (ended ? RuleState.off : RuleState.ok),
          rows: [
            (t('prop.profit'), signedUsd(v.profit), v.profit >= 0 ? k.up : k.down),
            (t('prop.funded.yourSplit'), pctText(c.split), null),
            (t('prop.funded.eligibleFrom'), c.payout?.eligibleFrom != null ? fmtDate(t, c.payout!.eligibleFrom) : '—', null),
          ],
          footer: KButton(
            label: t('prop.mine.payouts'),
            variant: KButtonVariant.surface,
            size: KButtonSize.sm,
            expand: true,
            onPressed: () => context.go('/prop/payouts'),
          ),
        )
      else
        RuleTile(
          icon: LucideIcons.target,
          title: t('prop.rule.profitTarget'),
          state: st(false, v.targetReached || a.status == 'passed'),
          progress: tPct,
          tone: v.targetReached ? k.up : k.ember,
          left: PropTrans(t('prop.tile.of', {'v': usd(v.profit), 'max': usd(target)})),
          right: '${math.min(100, tPct).toStringAsFixed(1)}%',
          rows: [
            (t('prop.tile.target'), '${pctText(a.targetPct ?? 0)} · ${usd(target)}', null),
            (t('prop.tile.mustReach'), usd(v.initial + target), null),
            (v.profit >= target ? t('prop.tile.exceededBy') : t('prop.tile.leftToTarget'), usd((target - v.profit).abs()), null),
          ],
        ),
      RuleTile(
        icon: LucideIcons.calendarDays,
        title: t('prop.tile.tradingDays'),
        state: v.minDays == 0 ? RuleState.off : st(false, v.daysOk),
        progress: v.minDays > 0 ? ratio(math.min(v.tradingDays, v.minDays).toDouble(), v.minDays.toDouble()) : 100,
        tone: v.daysOk ? k.up : k.ember,
        left: PropTrans(t('prop.tile.daysOf', {'v': v.tradingDays, 'min': v.minDays})),
        right: v.daysOk ? t('prop.ruleState.passed') : t('prop.tile.toGo', {'n': math.max(0, v.minDays - v.tradingDays)}),
        rows: [
          (t('prop.tile.minimum'), v.minDays > 0 ? daysText(t, v.minDays) : t('prop.none'), null),
          (t('prop.tile.traded'), daysText(t, v.tradingDays), v.daysOk ? k.up : null),
          (t('prop.tile.countsWhen'), t('prop.tile.countsWhenText'), null),
        ],
      ),
      RuleTile(
        icon: LucideIcons.clock,
        title: t('prop.rule.timeLimit'),
        state: v.deadline != null ? st(failedRule.contains('time'), false) : RuleState.off,
        progress: v.deadline != null && a.timeLimitDays > 0
            ? ratio((a.timeLimitDays * 86400000 - (left?.inMilliseconds ?? 0)).toDouble(), (a.timeLimitDays * 86400000).toDouble())
            : null,
        tone: k.ember,
        left: v.deadline != null ? Text(t('prop.tile.timeUsed')) : null,
        right: left != null ? t('prop.tile.timeLeft', {'d': left.inDays, 'h': left.inHours % 24}) : null,
        rows: [
          (t('prop.rule.timeLimit'), a.timeLimitDays > 0 ? daysText(t, a.timeLimitDays) : t('prop.noTimeLimit'), null),
          (t('prop.tile.started'), fmtDate(t, a.startedAt), null),
          (t('prop.mine.deadline'), v.deadline != null ? fmtDateTime(t, v.deadline) : '—', null),
        ],
      ),
      RuleTile(
        icon: LucideIcons.chartLine,
        title: t('prop.rule.consistency'),
        state: cons ? st(false, v.consistencyOk && v.profit > 0) : RuleState.off,
        progress: cons && v.consistencyLimit != null ? ratio(math.max(0, v.bestDay ?? 0), v.consistencyLimit!) : null,
        tone: v.consistencyOk ? k.up : k.warn,
        left: cons ? Text(t('prop.tile.bestVsLimit')) : null,
        right: cons && v.consistencyLimit != null ? '${usd(v.bestDay ?? 0, 0)} / ${usd(v.consistencyLimit, 0)}' : null,
        rows: cons
            ? [
                (t('prop.compare.rule'), t('prop.rules.consistencyValue', {'pct': numText(c.plan.consistency)}), null),
                (t('prop.tile.bestDay'), usd(v.bestDay ?? 0), null),
                (t('common.status'), v.consistencyOk ? t('prop.tile.withinLimit') : t('prop.tile.holdsPass'), v.consistencyOk ? k.up : k.warn),
              ]
            : [
                (t('prop.compare.rule'), t('prop.tile.noConsistency'), null),
                (t('prop.newsTrading'), c.plan.newsTrading ? t('prop.allowed') : t('prop.tile.newsBlocked', {'min': c.plan.newsWindow}), null),
                (t('prop.rule.weekendHolding'), c.plan.weekendHolding ? t('prop.allowed') : t('prop.tile.weekendClosed'), null),
              ],
      ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < tiles.length; i++) ...[if (i > 0) const SizedBox(height: 12), tiles[i]],
      ],
    );
  }
}

/* ------------------------------------------------------------------ equity + drawdown */

class EquityCard extends ConsumerStatefulWidget {
  const EquityCard({super.key, required this.c, required this.a, required this.v});
  final Challenge c;
  final PhaseAccount a;
  final RuleView v;

  @override
  ConsumerState<EquityCard> createState() => _EquityCardState();
}

class _EquityCardState extends ConsumerState<EquityCard> {
  bool _equity = true;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final c = widget.c, a = widget.a, v = widget.v;
    final live = tradable(c, a);
    final eq = ref.watch(propEquityProvider((id: c.id, phase: a.phaseIndex, live: live)));
    final pts = [for (final p in eq.value ?? const <EquityPoint>[]) (at: p.at, v: _equity ? p.equity : p.balance)];
    // extend with the latest live value so the chart is current between samples
    if (live && pts.isNotEmpty) pts.add((at: DateTime.now(), v: _equity ? v.equity : v.balance));
    final points = pts.where((p) => p.v.isFinite).toList()..sort((x, y) => x.at.compareTo(y.at));
    final lines = [
      PropChartLine(v.ddFloor, '${t('prop.rule.maxDrawdown')} ${usd(v.ddFloor, 0)}', k.down),
      PropChartLine(v.initial, t('prop.chart.startingBalance'), k.fg3),
      if (v.dailyFloor > v.ddFloor && live) PropChartLine(v.dailyFloor, '${t('prop.rule.dailyLoss')} ${usd(v.dailyFloor, 0)}', k.warn),
      if (!a.funded && v.targetAmount != null && v.targetAmount! > 0)
        PropChartLine(v.initial + v.targetAmount!, '${t('prop.rule.profitTarget')} ${usd(v.initial + v.targetAmount!, 0)}', k.gold),
    ];
    final shown = _equity ? v.equity : v.balance;
    final diff = shown - v.initial;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: PropLabel(_equity ? t('prop.chart.accountEquity') : t('prop.chart.accountBalance'))),
              SizedBox(
                width: 168,
                child: KSegmented<bool>(
                  plain: true,
                  height: 32,
                  values: const [true, false],
                  labels: [t('common.equity'), t('common.balance')],
                  selected: _equity,
                  onChanged: (x) => setState(() => _equity = x),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 10,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              KMoney(shown, style: context.text.moneyL),
              KChip(
                label: '${signedUsd(diff)} (${(diff / (v.initial == 0 ? 1 : v.initial) * 100).toStringAsFixed(2)}%)',
                tone: diff >= 0 ? KChipTone.up : KChipTone.down,
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            t('prop.chart.since', {'date': fmtDate(t, a.startedAt)}),
            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
          ),
          const SizedBox(height: 14),
          if (!eq.hasValue && !eq.hasError) const KSkeleton(height: 220, radius: 14) else PropEquityChart(points: points, lines: lines),
        ],
      ),
    );
  }
}

class DrawdownCard extends StatelessWidget {
  const DrawdownCard({super.key, required this.c, required this.v});
  final Challenge c;
  final RuleView v;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final p = ratio(v.ddUsed, v.ddLimit);
    final (KChipTone tone, Color color, String label) = p < 50
        ? (KChipTone.up, k.up, t('prop.dd.safe'))
        : (p < 75 ? (KChipTone.warn, k.warn, t('prop.dd.caution')) : (KChipTone.down, k.down, t('prop.dd.danger')));
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            title: t('prop.mine.drawdown'),
            subtitle: t('prop.dd.subtitle', {
              'type': c.plan.ddType == 'trailing' ? t('prop.tile.trailing') : t('prop.tile.static'),
              'pct': numText(c.plan.maxDD),
            }),
            action: KChip(label: label, tone: tone),
          ),
          const SizedBox(height: 18),
          Center(
            child: PropGauge(
              value: math.min(100, p),
              display: '${p.toStringAsFixed(1)}%',
              label: t('prop.dd.used'),
              sublabel: t('prop.dd.ofLimit', {'used': usd(v.ddUsed, 0), 'limit': usd(v.ddLimit, 0)}),
              color: color,
            ),
          ),
          const SizedBox(height: 16),
          PropPair(
            PropTile(label: t('prop.dd.breachLevel'), value: usd(v.ddFloor, 0), tone: k.down),
            PropTile(label: t('prop.dd.roomLeft'), value: usd(math.max(0, v.equity - v.ddFloor), 0), tone: k.up),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ statistics, events */

class ChallengeObjectives extends StatelessWidget {
  const ChallengeObjectives({super.key, required this.a});
  final PhaseAccount a;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final s = a.stats;
    final stats = [
      (t('prop.stats.trades'), '${s?.trades ?? 0}', null),
      (t('prop.stats.openNow'), '${s?.open ?? a.openPositions}', null),
      (t('prop.stats.winRate'), s?.winRate != null ? pctText(s!.winRate!) : '—', null),
      (t('prop.stats.avgWin'), usd(s?.avgWin ?? 0), k.up),
      (t('prop.stats.avgLoss'), usd(s?.avgLoss ?? 0), k.down),
      (t('prop.stats.profitFactor'), s?.profitFactor != null ? s!.profitFactor!.toStringAsFixed(2) : '—', null),
      (t('prop.stats.lots'), (s?.lots ?? 0).toStringAsFixed(2), null),
    ];
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            icon: LucideIcons.chartLine,
            title: t('prop.stats.title'),
            subtitle: s?.bestDay != null ? t('prop.stats.bestDay', {'date': fmtDate(t, s!.bestDay), 'amount': usd(s.bestDayProfit)}) : t('prop.stats.subtitle'),
          ),
          const SizedBox(height: 14),
          PropGrid(
            children: [for (final x in stats) PropTile(label: x.$1, value: x.$2, tone: x.$3)],
          ),
        ],
      ),
    );
  }
}

class ChallengeEvents extends StatelessWidget {
  const ChallengeEvents({super.key, required this.events});
  final List<RuleEvent> events;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(icon: LucideIcons.shieldAlert, title: t('prop.events.title'), subtitle: t('prop.events.subtitle')),
          const SizedBox(height: 14),
          if (events.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 26),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: k.line),
              ),
              child: Text(
                t('prop.events.empty'),
                textAlign: TextAlign.center,
                style: context.text.footnote.copyWith(color: k.fg3),
              ),
            )
          else
            for (var i = 0; i < events.length; i++) ...[if (i > 0) const SizedBox(height: 8), _EventRow(e: events[i])],
        ],
      ),
    );
  }
}

class _EventRow extends StatelessWidget {
  const _EventRow({required this.e});
  final RuleEvent e;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    const known = {'breach', 'violation', 'warning', 'info'};
    final tone = switch (e.severity) {
      'breach' => KChipTone.down,
      'violation' || 'warning' => KChipTone.warn,
      'info' => KChipTone.info,
      _ => KChipTone.neutral,
    };
    final label = known.contains(e.severity) ? t.dyn('prop.severity.${e.severity}', fallback: e.severity) : e.severity;
    final kind = e.rule == 'banned_strategy' && e.kind != null ? bannedLabel(t, e.kind!) : null;
    final meta = [
      fmtDateTime(t, e.at),
      if (e.login != null) '#${e.login}',
      if (e.equity != null) t('prop.events.equity', {'amount': usd(e.equity)}),
      if (e.threshold != null) t('prop.events.limit', {'amount': usd(e.threshold)}),
    ].join(' · ');
    return PropRow(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          KChip(label: label, tone: tone, small: true),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${ruleLabel(t, e.rule)}${kind != null ? ' · $kind' : ''}', style: context.text.label),
                const SizedBox(height: 2),
                Text(e.message, style: context.text.footnote.copyWith(color: k.fg2)),
                const SizedBox(height: 4),
                Text(
                  meta,
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ trades */

class ChallengeTrades extends ConsumerStatefulWidget {
  const ChallengeTrades({super.key, required this.c, required this.a});
  final Challenge c;
  final PhaseAccount a;

  @override
  ConsumerState<ChallengeTrades> createState() => _ChallengeTradesState();
}

class _ChallengeTradesState extends ConsumerState<ChallengeTrades> {
  String _q = '';
  int _shown = 10;

  void _open(PropTrade r) {
    final t = context.t;
    showKSheet<void>(
      context,
      title: symbolLabel(t, r.symbol, null),
      builder: (ctx) => KSheetContent(
        children: [
          KKeyValues([
            KKV(t('prop.trades.symbol'), r.symbol),
            KKV(t('common.type'), r.side == 'buy' ? t('prop.trades.buy') : t('prop.trades.sell'), tone: r.side == 'buy' ? ctx.k.up : ctx.k.down),
            KKV(t('prop.trades.lots'), r.volume.toStringAsFixed(2), mono: true),
            KKV(t('prop.trades.openTime'), fmtDateTime(t, r.openTime)),
            KKV(t('prop.trades.closeTime'), fmtDateTime(t, r.closeTime)),
            KKV(t('prop.trades.open'), '${r.openPrice}', mono: true),
            KKV(t('prop.trades.close'), '${r.closePrice}', mono: true),
            KKV(t('prop.trades.duration'), fmtDuration(t, r.durationSecs)),
            KKV(t('prop.profit'), signedUsd(r.profit), tone: r.profit >= 0 ? ctx.k.up : ctx.k.down),
            KKV('#', '${r.ticket}', mono: true),
          ]),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final c = widget.c, a = widget.a;
    final tq = ref.watch(propTradesProvider((id: c.id, phase: a.phaseIndex, live: tradable(c, a))));
    final rows = tq.value ?? const <PropTrade>[];
    final net = rows.fold<double>(0, (s, r) => s + r.profit);
    final loading = !tq.hasValue && !tq.hasError;
    final q = _q.trim().toLowerCase();
    final filtered = q.isEmpty ? rows : rows.where((r) => '${r.symbol} ${r.ticket}'.toLowerCase().contains(q)).toList();
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            icon: LucideIcons.history,
            title: t('prop.trades.title'),
            subtitle: loading ? t('common.loading') : t('prop.trades.subtitle', {'count': rows.length, 'net': signedUsd(net)}),
          ),
          const SizedBox(height: 14),
          if (loading)
            const KSkeleton(height: 160, radius: 14)
          else if (tq.hasError && !tq.hasValue)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text(
                propErrorText(tq.error, t),
                textAlign: TextAlign.center,
                style: context.text.footnote.copyWith(color: k.fg3),
              ),
            )
          else ...[
            Row(
              children: [
                Expanded(child: KSearchField(onChanged: (v) => setState(() => _q = v))),
                const SizedBox(width: 8),
                CsvButton(
                  name: a.login != null ? 'prop-${a.login}-trades' : 'prop-trades',
                  headers: [
                    t('prop.trades.symbol'),
                    t('common.type'),
                    t('prop.trades.lots'),
                    t('prop.trades.openTime'),
                    t('prop.trades.closeTime'),
                    t('prop.trades.open'),
                    t('prop.trades.close'),
                    t('prop.trades.duration'),
                    t('prop.profit'),
                  ],
                  rows: () => [
                    for (final r in filtered)
                      [
                        r.symbol,
                        r.side,
                        r.volume,
                        r.openTime?.toUtc().toIso8601String(),
                        r.closeTime?.toUtc().toIso8601String(),
                        r.openPrice,
                        r.closePrice,
                        r.durationSecs,
                        r.profit,
                      ],
                  ],
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (filtered.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Text(
                  t('prop.trades.empty'),
                  textAlign: TextAlign.center,
                  style: context.text.footnote.copyWith(color: k.fg3),
                ),
              )
            else ...[
              for (var i = 0; i < filtered.length && i < _shown; i++) ...[
                if (i > 0) const KDivider(),
                _TradeRow(r: filtered[i], onTap: () => _open(filtered[i])),
              ],
              if (filtered.length > _shown)
                Center(
                  child: KTextButton(label: t('common.showMore'), onPressed: () => setState(() => _shown += 10)),
                ),
            ],
          ],
        ],
      ),
    );
  }
}

class _TradeRow extends StatelessWidget {
  const _TradeRow({required this.r, required this.onTap});
  final PropTrade r;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final buy = r.side == 'buy';
    return KPressable(
      onTap: onTap,
      pressedScale: 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          children: [
            TradeSymbolAvatar(symbol: r.symbol, size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(symbolLabel(t, r.symbol, null), maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.label),
                  Text(
                    '#${r.ticket}',
                    textDirection: TextDirection.ltr,
                    style: context.text.mono(11, color: k.fg3),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  signedUsd(r.profit),
                  textDirection: TextDirection.ltr,
                  style: context.text.figure.copyWith(fontSize: 13.5, color: r.profit >= 0 ? k.up : k.down),
                ),
                const SizedBox(height: 3),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    KChip(label: buy ? t('prop.trades.buy') : t('prop.trades.sell'), tone: buy ? KChipTone.up : KChipTone.down, small: true),
                    const SizedBox(width: 6),
                    Text(
                      r.volume.toStringAsFixed(2),
                      style: context.text.caption.copyWith(color: k.fg2, fontFeatures: kTabular),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Spacing between the dashboard's blocks.
const Widget propGap = _gap;
