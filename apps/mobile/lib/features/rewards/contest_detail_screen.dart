// Contests & Rewards › a contest (/rewards/contests/:id). Port of the web's LiveContestDetail
// (apps/crm/components/growth/contest-detail.tsx) in its phone order:
//   All contests  ·  header (name + description)  ·  pool, countdown and join  ·  your entry  ·  prizes
//   ·  leaderboard (full, no podium)  ·  rules
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/auth_controller.dart';
import '../../data/client_data.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'rewards_api.dart';
import 'widgets/contest_widgets.dart';
import 'widgets/growth_ui.dart';

class ContestDetailScreen extends ConsumerWidget {
  const ContestDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    final v = ref.watch(contestDetailProvider(id));
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final back = Align(
      alignment: AlignmentDirectional.centerStart,
      child: KPressable(
        onTap: () => context.canPop() ? context.pop() : context.go('/rewards'),
        child: Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(rtl ? LucideIcons.arrowRight : LucideIcons.arrowLeft, size: 14, color: k.fg3),
              const SizedBox(width: 6),
              Text(t('rewards.detail.allContests'), style: context.text.footnote.copyWith(color: k.fg3)),
            ],
          ),
        ),
      ),
    );
    if (!v.hasValue) {
      return GrowthFallback(
        leading: back,
        title: t('rewards.detail.fallbackTitle'),
        subtitle: t('rewards.detail.fallbackSubtitle'),
        error: v.hasError ? v.error : null,
        onRetry: () => ref.invalidate(contestDetailProvider(id)),
        heights: const [220, 320, 320],
        banner: false,
      );
    }
    final d = v.requireValue;
    final c = d.contest;
    final running = c.running;
    void reload() {
      ref
        ..invalidate(contestDetailProvider(id))
        ..invalidate(contestsProvider)
        ..invalidate(accountsProvider);
    }

    return KPageScroll(
      onRefresh: () async {
        ref.invalidate(contestDetailProvider(id));
        await ref.read(contestDetailProvider(id).future).then((_) {}, onError: (Object _) {});
      },
      children: [
        back,
        KPageHeader(
          title: c.name,
          subtitle: Text(
            c.description.isNotEmpty
                ? c.description
                : t(c.live ? 'rewards.detail.subtitleLive' : 'rewards.detail.subtitleDemo', {'scoring': f.scoring(c.scoring).toLowerCase()}),
          ),
        ),
        const SizedBox(height: 20),
        KCard(
          hot: true,
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  GrowthStatus(c.status),
                  ...contestKindChips(context, c),
                  KChip(label: '${f.date(c.startsAt, year: false)} – ${f.date(c.endsAt)}', small: true),
                  KChip(label: t('rewards.value.joined', {'count': f.count(d.entrants)}), icon: LucideIcons.users, small: true),
                ],
              ),
              const SizedBox(height: 18),
              Text(t('rewards.detail.prizePool'), style: context.text.label.copyWith(color: k.fg2)),
              const SizedBox(height: 4),
              KMoney(
                c.prizePool,
                decimals: 0,
                style: context.text.moneyXL.copyWith(fontSize: 40, color: k.gold, fontWeight: FontWeight.w600),
              ),
              if (running || c.upcoming) ...[
                const SizedBox(height: 16),
                Row(
                  children: [
                    Icon(LucideIcons.timer, size: 14, color: k.fg2),
                    const SizedBox(width: 6),
                    Text(running ? t('rewards.hero.endsIn') : t('rewards.hero.startsIn'), style: context.text.label.copyWith(color: k.fg2)),
                  ],
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: CountdownBoxes(until: running ? c.endsAt : c.startsAt),
                ),
              ],
              const SizedBox(height: 18),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: d.myEntry != null
                    ? DonePill(label: d.myEntry!.login != null ? t('rewards.detail.joinedLogin', {'login': d.myEntry!.login}) : t('rewards.hero.joined'))
                    : c.canJoin
                    ? (readOnly ? const SizedBox.shrink() : JoinContestButton(contest: c, onJoined: reload))
                    : KButton(
                        label: c.past ? t('rewards.detail.contestEnded') : t('rewards.hero.entriesClosed'),
                        variant: KButtonVariant.surface,
                        onPressed: null,
                      ),
              ),
            ],
          ),
        ),
        const SizedBox(height: kBlockGap),
        _MyEntry(d: d, readOnly: readOnly),
        const SizedBox(height: kBlockGap),
        _PrizesTable(c: c),
        const SizedBox(height: kBlockGap),
        Leaderboard(d: d, title: running ? t('rewards.board.title') : t('rewards.board.titleFinal'), podium: false),
        const SizedBox(height: kBlockGap),
        _Rules(d: d),
      ],
    );
  }
}

class _MyEntry extends StatelessWidget {
  const _MyEntry({required this.d, required this.readOnly});
  final ContestDetail d;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final c = d.contest;
    final me = d.myEntry;
    if (me == null) {
      return KCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            KCardHeader(title: t('rewards.detail.entryTitle'), subtitle: t('rewards.detail.notJoined')),
            const SizedBox(height: 14),
            CardEmpty(
              title: c.canJoin ? t('rewards.detail.joinToRank') : (c.past ? t('rewards.detail.ended') : t('rewards.detail.entriesClosed')),
              text: c.canJoin ? t('rewards.detail.joinText') : null,
            ),
          ],
        ),
      );
    }
    final dq = me.disqualified;
    final hint = tradesHint(t, c, me);
    Color good(double v) => v > 0 ? k.up : (v < 0 ? k.down : k.fg);
    return KCard(
      key: const ValueKey('contest-my-entry'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            title: t('rewards.detail.entryTitle'),
            subtitle: me.login != null
                ? t('rewards.detail.accountUpdated', {'login': me.login, 'date': f.dateTime(me.updatedAt)})
                : t('rewards.detail.updated', {'date': f.dateTime(me.updatedAt)}),
            action: dq
                ? const GrowthStatus('disqualified')
                : (c.projectedPrize(me) != null ? KChip(label: t('rewards.hero.prizeZone'), tone: KChipTone.gold) : null),
          ),
          const SizedBox(height: 14),
          if (dq) ...[KNotice(text: t('rewards.detail.dqText'), tone: KChipTone.down, icon: LucideIcons.shieldAlert), const SizedBox(height: 10)],
          TileGrid(
            children: [
              StatTile(label: t('rewards.hero.rank'), value: dq || me.rank == null ? '—' : '#${me.rank}'),
              StatTile(
                label: f.scoring(c.scoring),
                value: scoreText(f, c, me),
                color: c.scoring == 'lots' || c.scoring == 'contracts' ? null : good(c.scoring == 'profit' ? me.profit : me.returnPct),
              ),
              StatTile(label: t('rewards.detail.return'), value: f.pct((me.returnPct * 100).round() / 100, signed: true), color: good(me.returnPct)),
              StatTile(label: t('rewards.detail.profit'), value: f.usd(me.profit), color: good(me.profit)),
              StatTile(label: t('rewards.hero.trades'), value: '${me.trades}'),
              StatTile(label: c.options ? t('rewards.detail.contracts') : t('rewards.detail.lots'), value: volumeText(f, c, me)),
            ],
          ),
          if (c.options && (me.selfTrades ?? 0) > 0) ...[
            const SizedBox(height: 10),
            ToneLine(text: t('rewards.options.excludedSelf', {'count': me.selfTrades}), tone: KChipTone.warn),
          ],
          if (c.options && (me.smallTrades ?? 0) > 0) ...[
            const SizedBox(height: 10),
            ToneLine(text: t('rewards.options.excludedSmall', {'count': me.smallTrades, 'amount': f.usd(c.minPremium ?? 0)}), tone: KChipTone.neutral),
          ],
          if (hint != null && !dq) ...[
            const SizedBox(height: 10),
            ToneLine(text: t('rewards.detail.belowMin', {'hint': hint}), tone: KChipTone.warn),
          ],
          if ((me.prize ?? 0) > 0) ...[
            const SizedBox(height: 10),
            ToneLine(
              text:
                  '${t('rewards.detail.prize', {'amount': f.usd(me.prize!, 0)})}'
                  '${me.prizeStatus != null ? ' · ${t.dyn('rewards.status.${me.prizeStatus}', fallback: me.prizeStatus!.replaceAll('_', ' ')).toLowerCase()}' : ''}',
              tone: KChipTone.gold,
              icon: LucideIcons.trophy,
            ),
          ],
          if (c.running && !dq && !readOnly) ...[
            const SizedBox(height: 12),
            KButton(
              label: t('rewards.hero.trade'),
              trailingIcon: LucideIcons.arrowUpRight,
              variant: KButtonVariant.surface,
              expand: true,
              onPressed: () => openTrader(context, me.login),
            ),
          ],
        ],
      ),
    );
  }
}

class _PrizesTable extends StatelessWidget {
  const _PrizesTable({required this.c});
  final Contest c;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final head = context.text.micro.copyWith(color: k.fg3, fontWeight: FontWeight.w500, letterSpacing: 0.5);
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            title: t('rewards.detail.prizesTitle'),
            subtitle: t('rewards.detail.prizesSubtitle', {'amount': f.usd(c.prizePool, 0)}),
            icon: LucideIcons.trophy,
            tone: KTone.amber,
          ),
          const SizedBox(height: 14),
          if (c.prizes.isEmpty)
            CardEmpty(title: t('rewards.prize.noneTitle'), text: t('rewards.prize.noneText'))
          else
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: k.line),
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  Container(
                    color: k.surface2,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                    child: Row(
                      children: [
                        Expanded(child: Text(t('rewards.detail.colRank').toUpperCase(), style: head)),
                        Expanded(
                          child: Text(t('rewards.detail.colPrize').toUpperCase(), textAlign: TextAlign.end, style: head),
                        ),
                        Expanded(
                          child: Text(t('rewards.detail.colPaidAs').toUpperCase(), textAlign: TextAlign.end, style: head),
                        ),
                      ],
                    ),
                  ),
                  for (final p in c.prizes) ...[
                    const KDivider(),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      child: Row(
                        children: [
                          Expanded(
                            child: Row(
                              children: [
                                RankBadge(rank: p.rankFrom, size: 22),
                                const SizedBox(width: 8),
                                Text(
                                  p.band,
                                  textDirection: TextDirection.ltr,
                                  style: context.text.footnote.copyWith(fontWeight: FontWeight.w600, color: k.fg, fontFeatures: kTabular),
                                ),
                              ],
                            ),
                          ),
                          Expanded(
                            child: Text.rich(
                              TextSpan(
                                children: [
                                  TextSpan(text: f.usd(p.amount, 0)),
                                  if (p.rankTo > p.rankFrom)
                                    TextSpan(
                                      text: ' ${t('rewards.value.each')}',
                                      style: TextStyle(color: k.fg3, fontWeight: FontWeight.w400),
                                    ),
                                ],
                              ),
                              textAlign: TextAlign.end,
                              style: context.text.footnote.copyWith(fontWeight: FontWeight.w700, color: k.gold, fontFeatures: kTabular),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              p.payout == 'credit' ? t('rewards.detail.paidCredit') : t('rewards.detail.paidWallet'),
                              textAlign: TextAlign.end,
                              style: context.text.footnote.copyWith(color: k.fg2),
                            ),
                          ),
                        ],
                      ),
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

class _Rules extends StatelessWidget {
  const _Rules({required this.d});
  final ContestDetail d;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final c = d.contest;
    final lines = c.rules.split(RegExp(r'\n+')).map((l) => l.replaceFirst(RegExp(r'^\s*[-*•]\s*'), '').trim()).where((l) => l.isNotEmpty);
    final scoring = f.scoring(c.scoring).toLowerCase();
    final ranked = c.options
        ? t(
            c.scoring == 'return_pct'
                ? 'rewards.detail.ruleRankedReturnOptions'
                : (c.scoring == 'profit' ? 'rewards.detail.ruleRankedProfitOptions' : 'rewards.detail.ruleRankedContracts'),
          )
        : t(
            c.scoring == 'return_pct'
                ? 'rewards.detail.ruleRankedReturn'
                : (c.scoring == 'profit' ? 'rewards.detail.ruleRankedProfit' : 'rewards.detail.ruleRankedLots'),
            {'scoring': scoring},
          );
    final auto = <String>[
      ranked,
      if (c.options) ...[
        t('rewards.detail.ruleOptionsOnly'),
        t('rewards.detail.ruleOptionsRealised'),
        if ((c.minPremium ?? 0) > 0) t('rewards.detail.ruleMinPremium', {'amount': f.usd(c.minPremium!)}),
        t('rewards.detail.ruleSelfTrade'),
        t('rewards.detail.ruleOptionsEligibility'),
        t('rewards.detail.ruleOptionsNoRewards'),
      ],
      t('rewards.detail.ruleWindow'),
      if (c.minTrades > 0) t('rewards.detail.ruleMinTrades', {'count': c.minTrades}),
      t('rewards.detail.ruleTies'),
      c.disqualifyOnBalanceChange ? t('rewards.detail.ruleBalanceDq') : t('rewards.detail.ruleBalanceReview'),
      if (c.minHoldSeconds > 0) t('rewards.detail.ruleHold', {'seconds': c.minHoldSeconds.round()}),
      if (c.maxSingleTradePct > 0) t('rewards.detail.ruleMaxTrade', {'pct': GrowthFmt.plain(c.maxSingleTradePct)}),
    ];
    final all = [...lines, ...auto];
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('rewards.detail.rulesTitle'), subtitle: t('rewards.detail.rulesSubtitle'), icon: LucideIcons.listChecks),
          const SizedBox(height: 14),
          for (var i = 0; i < all.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            RowBox(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Icon(LucideIcons.check, size: 14, color: k.up),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(all[i], style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13)),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
          KKeyValues([
            KKV(
              t('rewards.detail.type'),
              !c.live
                  ? ((c.startingBalance ?? 0) > 0
                        ? t('rewards.detail.typeDemoBalance', {'amount': f.usd(c.startingBalance!, 0)})
                        : t('rewards.detail.typeDemo'))
                  : t('rewards.detail.typeLive'),
            ),
            KKV(t('rewards.detail.instrument'), c.options ? t('rewards.detail.instrumentOptions') : t('rewards.detail.instrumentCfd')),
            if (c.options && (c.minPremium ?? 0) > 0) KKV(t('rewards.detail.minPremium'), f.usd(c.minPremium!)),
            KKV(t('rewards.detail.window'), '${f.dateTime(c.startsAt)} – ${f.dateTime(c.endsAt)}'),
            if (c.accountGroups.isNotEmpty) KKV(t('rewards.detail.accountTypes'), c.accountGroups.join(', ')),
            if ((c.minEquity ?? 0) > 0) KKV(t('rewards.detail.minEquity'), f.usd(c.minEquity!, 0)),
            KKV(t('rewards.detail.verification'), c.kycRequired ? t('rewards.detail.verifiedOnly') : t('rewards.detail.notRequired')),
            KKV(
              t('rewards.detail.seats'),
              c.maxEntrants != null
                  ? '${f.count(d.entrants)} / ${f.count(c.maxEntrants!)}'
                  : t('rewards.detail.seatsUnlimited', {'count': f.count(d.entrants)}),
            ),
          ], dense: true),
        ],
      ),
    );
  }
}
