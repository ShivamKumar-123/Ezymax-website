// Contest pieces shared by /rewards and /rewards/contests/:id (port of apps/crm/components/growth/contests.tsx): the
// join flow (sheet, demo credentials), the leaderboard with its podium, the prize card, the featured contest hero,
// contest tiles, the rewards shortcuts and My results.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/notifications/notifications.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../rewards_api.dart';
import 'growth_ui.dart';

/* ------------------------------------------------------------------ helpers */

/// Main score of a standing in the contest's unit (volume: lots in a CFD contest, contracts in an options one).
String scoreText(GrowthFmt f, Contest c, Standing s) => switch (c.scoring) {
  'profit' => f.usd(s.profit),
  'lots' => f.t('rewards.value.lots', {'lots': f.lots(s.lots)}),
  'contracts' => f.t('rewards.value.contracts', {'contracts': f.contracts(s.contracts ?? s.score)}),
  _ => f.pct((s.returnPct * 100).round() / 100, signed: true),
};

/// Contracts in an options contest, lots otherwise.
String volumeText(GrowthFmt f, Contest c, Standing s) => c.options ? f.contracts(s.contracts ?? 0) : f.lots(s.lots);

Color scoreColor(BuildContext context, Contest c, Standing s) {
  final k = context.k;
  if (c.scoring == 'lots' || c.scoring == 'contracts') return k.fg;
  final v = c.scoring == 'profit' ? s.profit : s.returnPct;
  return v > 0 ? k.up : (v < 0 ? k.down : k.fg);
}

/// "Needs 3 more trades to rank" when an entry is below the contest's minimum.
String? tradesHint(T t, Contest c, Standing s) {
  if (s.qualified || c.minTrades <= 0) return null;
  final n = c.minTrades - s.trades;
  return n > 0 ? t('rewards.contest.needsTrades', {'count': n}) : t('rewards.contest.qualifiesNext');
}

/// Opens Ezymex Trader on `login` (or the default account).
void openTrader(BuildContext context, [int? login]) => context.push(login == null ? '/trader' : '/trader?login=$login');

/* ------------------------------------------------------------------ join flow */

/// The Join / Register button of a contest: opens the entry sheet (web JoinContestButton).
class JoinContestButton extends StatelessWidget {
  const JoinContestButton({
    super.key,
    required this.contest,
    required this.onJoined,
    this.size = KButtonSize.md,
    this.variant = KButtonVariant.ember,
    this.expand = false,
  });
  final Contest contest;
  final VoidCallback onJoined;
  final KButtonSize size;
  final KButtonVariant variant;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return KButton(
      label: contest.upcoming ? t('rewards.join.register') : t('rewards.join.join'),
      trailingIcon: Directionality.of(context) == TextDirection.rtl ? LucideIcons.arrowUpLeft : LucideIcons.arrowUpRight,
      size: size,
      variant: variant,
      expand: expand,
      onPressed: () => showKSheet<void>(
        context,
        builder: (_) => JoinContestSheet(contest: contest, onJoined: onJoined),
      ),
    );
  }
}

class JoinContestSheet extends ConsumerStatefulWidget {
  const JoinContestSheet({super.key, required this.contest, required this.onJoined});
  final Contest contest;
  final VoidCallback onJoined;

  @override
  ConsumerState<JoinContestSheet> createState() => _JoinContestSheetState();
}

class _JoinContestSheetState extends ConsumerState<JoinContestSheet> {
  int? _login;
  bool _busy = false;
  ContestCredentials? _creds;

  Contest get c => widget.contest;

  Future<void> _join() async {
    final t = context.t;
    final f = GrowthFmt(t);
    final toasts = ref.read(notificationsProvider.notifier);
    final nav = Navigator.of(context);
    final router = GoRouter.of(context);
    if (c.live && _login == null) return;
    setState(() => _busy = true);
    try {
      final r = await growthPost(ref, 'contests/${c.id}/join', c.live ? {'login': _login} : {});
      widget.onJoined();
      KHaptics.success();
      final creds = credentialsOf(r);
      if (creds != null) {
        if (mounted) setState(() => _creds = creds);
      } else {
        nav.maybePop();
        toasts.toast(
          NotificationKind.success,
          t('rewards.join.toastJoined', {'name': c.name}),
          description: c.live ? t('rewards.join.toastLive', {'login': _login, 'date': f.date(c.startsAt)}) : t('rewards.join.toastDemo'),
        );
      }
    } on ApiException catch (e) {
      if (e.code == 'options_intro_required' && mounted) {
        // the options intro is a 1-minute step in the Client Area (/options)
        final go = await showKAlert<bool>(
          context,
          title: t('rewards.join.error'),
          message: growthError(e, t),
          actions: [
            KAction(label: t('common.cancel')),
            KAction(label: t('rewards.options.openIntro'), value: true, primary: true),
          ],
        );
        if (go == true) {
          nav.maybePop();
          router.go('/options');
        }
      } else {
        toasts.toast(NotificationKind.error, t('rewards.join.error'), description: growthError(e, t));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final creds = _creds;
    final title = creds != null ? t('rewards.join.credsTitle') : t('rewards.join.title', {'name': c.name});
    final desc = creds != null ? t('rewards.join.credsDesc') : (c.live ? t('rewards.join.descLive') : t('rewards.join.descDemo'));
    final head = [
      Text(title, textAlign: TextAlign.center, style: context.text.title2),
      const SizedBox(height: 4),
      Text(
        desc,
        textAlign: TextAlign.center,
        style: context.text.footnote.copyWith(color: k.fg3),
      ),
      const SizedBox(height: 16),
    ];

    if (creds != null) {
      final rows = [
        ('login', t('rewards.join.login'), '${creds.login}'),
        ('password', t('rewards.join.password'), creds.password),
        ('investor', t('rewards.join.investorPassword'), creds.investorPassword),
        ('server', t('rewards.join.server'), 'Ezymex-Demo'),
      ];
      return KSheetContent(
        footer: Row(
          children: [
            Expanded(
              child: KButton(
                label: t('common.done'),
                variant: KButtonVariant.ghost,
                size: KButtonSize.lg,
                expand: true,
                onPressed: () => Navigator.of(context).maybePop(),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: KButton(
                label: t('rewards.join.openTerminal'),
                trailingIcon: LucideIcons.arrowUpRight,
                size: KButtonSize.lg,
                expand: true,
                onPressed: () {
                  final router = GoRouter.of(context);
                  Navigator.of(context).maybePop();
                  router.push('/trader?login=${creds.login}');
                },
              ),
            ),
          ],
        ),
        children: [
          ...head,
          KNotice(text: t('rewards.join.saveNow'), tone: KChipTone.warn),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              color: k.surface2,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: k.line),
            ),
            child: Column(
              children: [
                for (final (key, label, value) in rows) ...[
                  if (key != 'login') const KDivider(),
                  Padding(
                    key: ValueKey('credential-$key'),
                    padding: const EdgeInsetsDirectional.only(start: 14, end: 4),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 120,
                          child: Text(label, style: context.text.footnote.copyWith(color: k.fg3)),
                        ),
                        Expanded(
                          child: Text(
                            value,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textDirection: TextDirection.ltr,
                            style: context.text.mono(13.5, color: k.fg),
                          ),
                        ),
                        KIconButton(icon: LucideIcons.copy, size: 34, semanticLabel: label, onPressed: () => kCopy(context, value)),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 10),
          Text(
            '${t('rewards.join.accountFor', {'name': c.name})}'
            '${c.startingBalance != null && c.startingBalance! > 0 ? t('rewards.join.startingBalanceSuffix', {'amount': f.usd(c.startingBalance!, 0)}) : ''}'
            '${t('rewards.join.onlyThisAccount')}',
            style: context.text.footnote.copyWith(color: k.fg3),
          ),
        ],
      );
    }

    bool groupsOk(String g) => (c.accountGroups.isEmpty || c.accountGroups.contains(g)) && !(c.options && optionsSystemGroup(g));
    final minEq = c.minEquity;
    return KSheetContent(
      footer: KButton(label: t('rewards.join.confirm'), size: KButtonSize.lg, expand: true, loading: _busy, onPressed: c.live && _login == null ? null : _join),
      children: [
        ...head,
        KKeyValues([
          KKV(t('rewards.join.runs'), '${f.date(c.startsAt)} – ${f.date(c.endsAt)}'),
          KKV(t('rewards.join.rankedBy'), f.scoring(c.scoring)),
          if (c.options) KKV(t('rewards.detail.instrument'), t('rewards.detail.instrumentOptions')),
          if (c.options && (c.minPremium ?? 0) > 0) KKV(t('rewards.detail.minPremium'), f.usd(c.minPremium!)),
          KKV(t('rewards.join.prizePool'), f.usd(c.prizePool, 0)),
          if (c.minTrades > 0) KKV(t('rewards.join.minTrades'), '${c.minTrades}'),
          if (!c.live && (c.startingBalance ?? 0) > 0) KKV(t('rewards.join.startingBalance'), f.usd(c.startingBalance!, 0)),
          if (c.live && (minEq ?? 0) > 0) KKV(t('rewards.join.minEquity'), f.usd(minEq!, 0)),
        ], dense: true),
        if (c.live) ...[
          const SizedBox(height: 14),
          Text(t('rewards.picker.label'), style: context.text.label.copyWith(color: k.fg2)),
          const SizedBox(height: 8),
          LiveAccountPicker(
            value: _login,
            onChanged: (v) => setState(() => _login = v),
            filter: (a) => groupsOk(a.group) && (minEq == null || a.equity >= minEq),
            hint: (minEq ?? 0) > 0
                ? (c.accountGroups.isNotEmpty
                      ? t('rewards.join.equityHintGroups', {'amount': f.usd(minEq!, 0), 'groups': c.accountGroups.join(', ')})
                      : t('rewards.join.equityHint', {'amount': f.usd(minEq!, 0)}))
                : null,
          ),
          if (c.disqualifyOnBalanceChange) ...[
            const SizedBox(height: 8),
            Text(t('rewards.join.balanceRule'), style: context.text.footnote.copyWith(color: k.fg3)),
          ],
        ],
        if (c.kycRequired) ...[const SizedBox(height: 12), Text(t('rewards.join.kycOnly'), style: context.text.footnote.copyWith(color: k.fg3))],
        if (c.options) ...[
          const SizedBox(height: 12),
          KNotice(
            key: const ValueKey('contest-options-note'),
            text: t('rewards.options.joinNote'),
            action: KRichText(
              '${t('rewards.options.eligibility')} <link>${t('rewards.options.openIntro')}</link>',
              style: context.text.footnote.copyWith(color: k.fg3),
              tags: {
                'link': KTag(
                  onTap: () {
                    final router = GoRouter.of(context);
                    Navigator.of(context).maybePop();
                    router.go('/options');
                  },
                ),
              },
            ),
          ),
        ],
      ],
    );
  }
}

/* ------------------------------------------------------------------ leaderboard */

class _StandingRow extends StatelessWidget {
  const _StandingRow({required this.c, required this.s});
  final Contest c;
  final Standing s;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final dq = s.disqualified;
    final top = s.rank != null && s.rank! <= 3 && s.qualified && !dq;
    final prize = c.projectedPrize(s);
    final hint = tradesHint(t, c, s);
    final sub = <InlineSpan>[
      TextSpan(text: t('rewards.value.trades', {'count': s.trades})),
      if (hint != null)
        TextSpan(
          text: ' · $hint',
          style: TextStyle(color: k.warn),
        ),
      if (s.me && s.login != null) TextSpan(text: ' · #${s.login}'),
    ];
    final row = RowBox(
      key: ValueKey(s.me ? 'leaderboard-row-me' : 'leaderboard-row-${s.entryId}'),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
      color: s.me ? k.emberSoft : (top ? k.goldSoft.withValues(alpha: 0.4) : null),
      border: s.me ? k.ember.withValues(alpha: 0.4) : (top ? k.gold.withValues(alpha: 0.2) : null),
      child: Row(
        children: [
          SizedBox(
            width: 34,
            child: Center(child: RankBadge(rank: dq ? null : s.rank)),
          ),
          const SizedBox(width: 10),
          _PersonAvatar(name: s.initialsName, country: s.country),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        s.me ? t('rewards.board.youName', {'name': s.name}) : s.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.callout.copyWith(fontWeight: FontWeight.w600, color: k.fg),
                      ),
                    ),
                    if (s.me) ...[const SizedBox(width: 6), KChip(label: t('rewards.you'), tone: KChipTone.ember, small: true)],
                    if (dq) ...[const SizedBox(width: 6), const GrowthStatus('disqualified', dot: false)],
                  ],
                ),
                const SizedBox(height: 1),
                Text.rich(
                  TextSpan(children: sub),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontFeatures: kTabular),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                scoreText(f, c, s),
                textDirection: TextDirection.ltr,
                style: context.text.figure.copyWith(fontSize: 14, fontWeight: FontWeight.w700, color: scoreColor(context, c, s)),
              ),
              if (prize != null)
                Text(
                  f.usd(prize, 0),
                  textDirection: TextDirection.ltr,
                  style: context.text.caption.copyWith(color: k.fg3, fontFeatures: kTabular),
                ),
            ],
          ),
        ],
      ),
    );
    return (dq || !s.qualified) && !s.me ? Opacity(opacity: 0.6, child: row) : row;
  }
}

class _PersonAvatar extends StatelessWidget {
  const _PersonAvatar({required this.name, this.country});
  final String name;
  final String? country;
  static const double size = 34;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: size + 2,
    height: size + 2,
    child: Stack(
      clipBehavior: Clip.none,
      children: [
        KAvatar(name: name, size: size),
        if (country != null && country!.isNotEmpty)
          PositionedDirectional(
            end: -2,
            bottom: -2,
            child: Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: context.k.surface2, width: 2),
              ),
              child: KFlag(country!, size: 14),
            ),
          ),
      ],
    ),
  );
}

class _Podium extends StatelessWidget {
  const _Podium({required this.c, required this.rows});
  final Contest c;
  final List<Standing> rows;

  @override
  Widget build(BuildContext context) {
    final ranked = rows.where((r) => r.rank != null && !r.disqualified).toList();
    if (ranked.length < 3) return const SizedBox.shrink();
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final first = ranked[0];
    Widget cell(Standing r) {
      final one = identical(r, first);
      final prize = c.projectedPrize(r);
      return Container(
        padding: EdgeInsets.fromLTRB(6, one ? 18 : 14, 6, 14),
        decoration: BoxDecoration(
          color: one ? k.goldSoft.withValues(alpha: 0.6) : k.surface2,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: one ? k.gold.withValues(alpha: 0.3) : k.line),
        ),
        child: Column(
          children: [
            SizedBox(
              height: (one ? 56 : 46) + 11,
              child: Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.topCenter,
                children: [
                  KAvatar(name: r.initialsName, size: one ? 56 : 46),
                  Positioned(bottom: 0, child: RankBadge(rank: r.rank, size: 22)),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (r.country != null && r.country!.isNotEmpty) ...[KFlag(r.country!, size: 14), const SizedBox(width: 5)],
                Flexible(
                  child: Text(
                    r.me ? t('rewards.you') : r.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.footnote.copyWith(fontWeight: FontWeight.w600, color: k.fg),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              scoreText(f, c, r),
              textDirection: TextDirection.ltr,
              style: context.text.figure.copyWith(fontSize: one ? 17 : 14, fontWeight: FontWeight.w700, color: scoreColor(context, c, r)),
            ),
            if (prize != null)
              Text(
                f.usd(prize, 0),
                textDirection: TextDirection.ltr,
                style: context.text.caption.copyWith(fontWeight: FontWeight.w700, color: one ? k.gold : k.fg2, fontFeatures: kTabular),
              ),
          ],
        ),
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(child: cell(ranked[1])),
        const SizedBox(width: 8),
        Expanded(child: cell(first)),
        const SizedBox(width: 8),
        Expanded(child: cell(ranked[2])),
      ],
    );
  }
}

class _ZoneLine extends StatelessWidget {
  const _ZoneLine(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(child: Container(height: 0.8, color: k.line)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(
              text,
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
            ),
          ),
          Expanded(child: Container(height: 0.8, color: k.line)),
        ],
      ),
    );
  }
}

/// The leaderboard card: podium, rows, the prize-zone line and the client's own row (web Leaderboard).
class Leaderboard extends StatelessWidget {
  const Leaderboard({super.key, required this.d, this.limit, this.title, this.podium = true});
  final ContestDetail d;
  final int? limit;
  final String? title;
  final bool podium;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final f = GrowthFmt(t);
    final c = d.contest;
    final all = d.leaderboard;
    final shown = limit != null ? all.take(limit!).toList() : all;
    final me = d.myEntry;
    final meShown = me != null && shown.any((s) => s.me);
    final zone = c.prizeZone;
    final lastRankShown = shown.fold<int>(0, (m, s) => (s.rank ?? 0) > m ? s.rank! : m);
    final state = c.running ? t('rewards.board.updates') : (c.upcoming ? t('rewards.board.starts', {'date': f.date(c.startsAt)}) : t('rewards.board.final'));
    return KCard(
      key: const ValueKey('contest-leaderboard'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(
            title: title ?? t('rewards.board.title'),
            subtitle:
                '$state · ${t('rewards.board.traders', {'count': d.entrants, 'n': f.count(d.entrants)})} · ${t('rewards.board.rankedBy', {'scoring': f.scoring(c.scoring).toLowerCase()})}',
            action: limit != null
                ? KButton(
                    label: t('rewards.board.full'),
                    trailingIcon: Directionality.of(context) == TextDirection.rtl ? LucideIcons.chevronLeft : LucideIcons.chevronRight,
                    size: KButtonSize.sm,
                    variant: KButtonVariant.surface,
                    onPressed: () => context.push('/rewards/contests/${c.id}'),
                  )
                : null,
          ),
          const SizedBox(height: 16),
          if (all.isEmpty)
            CardEmpty(title: t('rewards.board.emptyTitle'), text: c.upcoming ? t('rewards.board.emptyUpcoming') : t('rewards.board.emptyOpen'))
          else ...[
            if (podium) ...[_Podium(c: c, rows: all), const SizedBox(height: 14)],
            for (var i = 0; i < shown.length; i++) ...[
              if (i > 0) const SizedBox(height: 6),
              _StandingRow(c: c, s: shown[i]),
              if (zone > 0 && shown[i].rank == zone && i < shown.length - 1) _ZoneLine(t('rewards.board.zoneEnds', {'rank': zone})),
            ],
            if (me != null && !meShown) ...[
              _ZoneLine(zone > lastRankShown ? t('rewards.board.zoneTo', {'rank': zone}) : t('rewards.board.yourPosition')),
              _StandingRow(c: c, s: me),
            ],
          ],
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ prize card */

class PrizeCard extends StatelessWidget {
  const PrizeCard({super.key, required this.c});
  final Contest c;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final max = c.prizes.fold<double>(1, (m, p) => p.amount > m ? p.amount : m);
    final wallet = c.prizes.every((p) => p.payout == 'wallet');
    return KCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                KCardHeader(
                  title: t('rewards.prize.title'),
                  subtitle: wallet ? t('rewards.prize.wallet') : t('rewards.prize.mixed'),
                  action: const KIconTile(icon: LucideIcons.handCoins, tone: KTone.amber, size: 36),
                ),
                const SizedBox(height: 14),
                if (c.prizes.isEmpty) CardEmpty(title: t('rewards.prize.noneTitle'), text: t('rewards.prize.noneText')),
                for (var i = 0; i < c.prizes.length; i++) ...[
                  if (i > 0) const SizedBox(height: 6),
                  Row(
                    children: [
                      SizedBox(
                        width: 56,
                        child: Text(
                          c.prizes[i].band,
                          textDirection: TextDirection.ltr,
                          style: context.text.caption.copyWith(color: k.fg2, fontFeatures: kTabular),
                        ),
                      ),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(14),
                          child: SizedBox(
                            height: 28,
                            child: Stack(
                              children: [
                                Positioned.fill(child: ColoredBox(color: k.surface2)),
                                FractionallySizedBox(
                                  widthFactor: (c.prizes[i].amount / max).clamp(0.14, 1.0),
                                  alignment: AlignmentDirectional.centerStart,
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: i == 0 ? k.gold : (i < 3 ? k.gold.withValues(alpha: 0.35) : k.surface3),
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 12),
                                  child: Align(
                                    alignment: AlignmentDirectional.centerStart,
                                    child: Text(
                                      '${f.usd(c.prizes[i].amount, 0)}${c.prizes[i].rankTo > c.prizes[i].rankFrom ? ' ${t('rewards.value.each')}' : ''}',
                                      style: context.text.caption.copyWith(
                                        fontWeight: FontWeight.w700,
                                        color: i == 0 ? const Color(0xFF1A1204) : k.fg,
                                        fontFeatures: kTabular,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      if (!wallet)
                        SizedBox(
                          width: 52,
                          child: Text(
                            (c.prizes[i].payout == 'credit'
                                    ? t('rewards.prize.payout.credit')
                                    : (c.prizes[i].payout == 'wallet' ? t('rewards.prize.payout.wallet') : c.prizes[i].payout))
                                .toUpperCase(),
                            textAlign: TextAlign.end,
                            style: context.text.micro.copyWith(color: k.fg3, fontWeight: FontWeight.w500),
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const KDivider(),
          Padding(
            padding: const EdgeInsets.all(16),
            child: TileRow(
              children: [
                StatTile(label: t('rewards.prize.pool'), value: f.usd(c.prizePool, 0), color: k.gold, size: 14),
                StatTile(label: t('rewards.prize.minTrades'), value: c.minTrades > 0 ? '${c.minTrades}' : t('rewards.prize.none'), size: 14),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ hero */

/// The featured running (or next) contest: pool, countdown, join, and the client's standing (web ContestHero).
class ContestHero extends ConsumerWidget {
  const ContestHero({super.key, required this.card, this.detail, required this.onJoined});
  final ContestCard card;
  final ContestDetail? detail;
  final VoidCallback onJoined;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    final c = card.contest;
    final running = c.running;
    final me = detail?.myEntry ?? card.myEntry;
    final now = DateTime.now();
    final total = c.endsAt.difference(c.startsAt);
    final elapsed = now.difference(c.startsAt);
    final pctTime = total.inMilliseconds <= 0 ? 0.0 : (elapsed.inMilliseconds / total.inMilliseconds).clamp(0.0, 1.0);
    final dayN = (elapsed.inMilliseconds / 86400000).ceil().clamp(1, 1 << 20);
    final days = (total.inMilliseconds / 86400000).round().clamp(1, 1 << 20);
    final zone = c.prizeZone;
    final entrants = detail?.entrants ?? c.entrants;
    final hint = me != null ? tradesHint(t, c, me) : null;
    final prizeZone = me != null && !me.disqualified && c.projectedPrize(me) != null;

    return KCard(
      key: const ValueKey('contest-hero'),
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
            ],
          ),
          const SizedBox(height: 14),
          Text(c.name, style: context.text.largeTitle.copyWith(fontSize: 26, fontWeight: FontWeight.w500)),
          if (c.description.isNotEmpty) ...[const SizedBox(height: 4), Text(c.description, style: context.text.body.copyWith(color: k.fg2, fontSize: 14))],
          const SizedBox(height: 18),
          Text(t('rewards.prize.pool'), style: context.text.label.copyWith(color: k.fg2)),
          const SizedBox(height: 4),
          KMoney(
            c.prizePool,
            decimals: 0,
            style: context.text.moneyXL.copyWith(fontSize: 40, color: k.gold, fontWeight: FontWeight.w600),
          ),
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
          const SizedBox(height: 18),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (me != null)
                DonePill(label: me.login != null ? t('rewards.hero.joinedAccount', {'login': me.login}) : t('rewards.hero.joined'))
              else if (c.canJoin && !readOnly)
                JoinContestButton(contest: c, onJoined: onJoined)
              else if (!c.canJoin)
                KButton(label: t('rewards.hero.entriesClosed'), variant: KButtonVariant.surface, onPressed: null),
              if (me != null && !readOnly)
                KButton(label: t('rewards.hero.trade'), variant: KButtonVariant.surface, onPressed: () => openTrader(context, me.login)),
              KButton(label: t('rewards.hero.rules'), variant: KButtonVariant.ghost, onPressed: () => context.push('/rewards/contests/${c.id}')),
            ],
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: k.surface2.withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: k.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (me != null) ...[
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              t('rewards.hero.standing'),
                              style: context.text.callout.copyWith(fontWeight: FontWeight.w600, color: k.fg),
                            ),
                            Text(
                              me.rank != null
                                  ? t('rewards.hero.rankOf', {'rank': me.rank, 'count': f.count(entrants)})
                                  : (me.disqualified ? t('rewards.hero.dq') : t('rewards.hero.notRanked')),
                              style: context.text.footnote.copyWith(color: k.fg3),
                            ),
                          ],
                        ),
                      ),
                      if (me.disqualified)
                        const GrowthStatus('disqualified')
                      else if (prizeZone)
                        KChip(label: t('rewards.hero.prizeZone'), tone: KChipTone.gold),
                    ],
                  ),
                  const SizedBox(height: 14),
                  TileRow(
                    children: [
                      StatTile(label: t('rewards.hero.rank'), value: me.rank != null ? '#${me.rank}' : '—', size: 20),
                      StatTile(label: f.scoring(c.scoring), value: scoreText(f, c, me), color: scoreColor(context, c, me), size: 17),
                      StatTile(label: t('rewards.hero.trades'), value: '${me.trades}', size: 20),
                    ],
                  ),
                ] else ...[
                  Text(
                    running ? t('rewards.hero.joinRunning') : t('rewards.hero.registerEarly'),
                    style: context.text.callout.copyWith(fontWeight: FontWeight.w600, color: k.fg),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    !c.live
                        ? ((c.startingBalance ?? 0) > 0
                              ? t('rewards.hero.demoTextBalance', {'amount': f.usd(c.startingBalance!, 0)})
                              : t('rewards.hero.demoText'))
                        : t('rewards.hero.liveText'),
                    style: context.text.footnote.copyWith(color: k.fg3),
                  ),
                  const SizedBox(height: 14),
                  TileRow(
                    children: [
                      _IconLine(
                        icon: LucideIcons.users,
                        text: t('rewards.value.joined', {'count': '${f.count(entrants)}${c.maxEntrants != null ? ' / ${f.count(c.maxEntrants!)}' : ''}'}),
                      ),
                      _IconLine(icon: LucideIcons.trophy, text: zone > 0 ? t('rewards.hero.topPaid', {'count': zone}) : t('rewards.hero.rankingOnly')),
                    ],
                  ),
                ],
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        t('rewards.hero.progress'),
                        style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                      ),
                    ),
                    Text(
                      running ? t('rewards.hero.dayOf', {'day': dayN > days ? days : dayN, 'days': days}) : t('rewards.value.days', {'count': days}),
                      style: context.text.caption.copyWith(color: k.fg2, fontFeatures: kTabular),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                KProgressBar(value: running ? pctTime : 0),
                if (hint != null) ...[const SizedBox(height: 10), ToneLine(text: hint, tone: KChipTone.warn, icon: LucideIcons.shieldAlert)],
                if (me != null && !me.disqualified && hint == null && me.rank != null && zone > 0 && me.rank! > zone) ...[
                  const SizedBox(height: 10),
                  ToneLine(text: t('rewards.hero.placesToZone', {'count': me.rank! - zone, 'rank': zone}), tone: KChipTone.gold, icon: LucideIcons.trophy),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _IconLine extends StatelessWidget {
  const _IconLine({required this.icon, required this.text, this.shrink = false});
  final IconData icon;
  final String text;

  /// Size to the text (a non-flex child of a Row) instead of filling the width.
  final bool shrink;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final label = Text(
      text,
      maxLines: shrink ? 1 : null,
      overflow: shrink ? TextOverflow.ellipsis : null,
      style: context.text.footnote.copyWith(color: k.fg, fontFeatures: kTabular),
    );
    return RowBox(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        mainAxisSize: shrink ? MainAxisSize.min : MainAxisSize.max,
        children: [
          Icon(icon, size: 14, color: k.fg3),
          const SizedBox(width: 8),
          if (shrink) label else Expanded(child: label),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ tiles */

/// A contest card of the Open for entry / Past contests grids (web ContestTile).
class ContestTile extends ConsumerWidget {
  const ContestTile({super.key, required this.card, required this.onJoined});
  final ContestCard card;
  final VoidCallback onJoined;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    final c = card.contest;
    final me = card.myEntry;
    final past = c.past;
    final fill = c.maxEntrants != null && c.maxEntrants! > 0 ? (c.entrants / c.maxEntrants!).clamp(0.0, 1.0) : null;
    final join = me == null && c.canJoin && !readOnly;
    final rules = [
      t('rewards.tile.rankedBy', {'scoring': f.scoring(c.scoring).toLowerCase()}),
      if (c.minTrades > 0) t('rewards.tile.minTrades', {'count': c.minTrades}),
      if (!c.live && (c.startingBalance ?? 0) > 0) t('rewards.tile.demoBalance', {'amount': f.usd(c.startingBalance!, 0)}),
      if (c.live && (c.minEquity ?? 0) > 0) t('rewards.tile.minEquity', {'amount': f.usd(c.minEquity!, 0)}),
    ].join();
    void open() => context.push('/rewards/contests/${c.id}');
    return KCard(
      key: ValueKey('contest-card-${c.id}'),
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
            decoration: BoxDecoration(
              color: k.surface2.withValues(alpha: 0.6),
              border: Border(bottom: BorderSide(color: k.line, width: 0.6)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Wrap(spacing: 6, runSpacing: 6, children: [...contestKindChips(context, c), GrowthStatus(c.status)]),
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            t('rewards.tile.prizePool'),
                            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                          ),
                          Text(
                            f.usd(c.prizePool, 0),
                            textDirection: TextDirection.ltr,
                            style: context.text.figure.copyWith(fontSize: 24, fontWeight: FontWeight.w700, color: k.gold, height: 1.2),
                          ),
                        ],
                      ),
                    ),
                    if (!past)
                      Container(
                        height: 24,
                        padding: const EdgeInsets.symmetric(horizontal: 9),
                        decoration: BoxDecoration(
                          color: k.surface3,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: k.line),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(LucideIcons.timer, size: 12, color: k.fg2),
                            const SizedBox(width: 5),
                            CompactCountdown(until: c.running ? c.endsAt : c.startsAt),
                          ],
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                KPressable(
                  onTap: open,
                  pressedScale: 1,
                  child: Text(c.name, style: context.text.headline.copyWith(fontSize: 16, fontWeight: FontWeight.w500)),
                ),
                if (c.description.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    c.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.footnote.copyWith(color: k.fg3),
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _IconLine(icon: LucideIcons.calendarDays, text: '${f.date(c.startsAt, year: false)} – ${f.date(c.endsAt, year: false)}'),
                    ),
                    const SizedBox(width: 8),
                    _IconLine(icon: LucideIcons.users, text: t('rewards.value.joined', {'count': f.count(c.entrants)}), shrink: true),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  rules,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, height: 1.5),
                ),
                if (fill != null && !past) ...[
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          t('rewards.tile.seats'),
                          style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                        ),
                      ),
                      Text(
                        '${f.count(c.entrants)} / ${f.count(c.maxEntrants!)}',
                        textDirection: TextDirection.ltr,
                        style: context.text.caption.copyWith(color: k.fg3, fontFeatures: kTabular),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  KProgressBar(value: fill),
                ],
                if (me != null) ...[
                  const SizedBox(height: 10),
                  RowBox(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    child: Row(
                      children: [
                        RankBadge(rank: me.disqualified ? null : me.rank, size: 26),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                past ? t('rewards.tile.yourResult') : t('rewards.tile.youreIn'),
                                style: context.text.footnote.copyWith(fontWeight: FontWeight.w600, color: k.fg),
                              ),
                              Text(
                                me.disqualified
                                    ? t('rewards.status.disqualified')
                                    : '${scoreText(f, c, me)} · ${t('rewards.value.trades', {'count': me.trades})}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: context.text.footnote.copyWith(color: k.fg3),
                              ),
                            ],
                          ),
                        ),
                        if ((me.prize ?? 0) > 0)
                          Text(
                            f.usd(me.prize!, 0),
                            textDirection: TextDirection.ltr,
                            style: context.text.footnote.copyWith(fontWeight: FontWeight.w700, color: k.gold, fontFeatures: kTabular),
                          ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                Row(
                  children: [
                    if (join) ...[
                      Expanded(
                        child: JoinContestButton(contest: c, onJoined: onJoined, size: KButtonSize.sm, variant: KButtonVariant.outline, expand: true),
                      ),
                      const SizedBox(width: 8),
                    ],
                    Expanded(
                      child: KButton(
                        label: past ? t('rewards.tile.results') : t('rewards.tile.details'),
                        size: KButtonSize.sm,
                        variant: KButtonVariant.surface,
                        expand: true,
                        onPressed: open,
                      ),
                    ),
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

/* ------------------------------------------------------------------ shortcuts, results */

/// Loyalty, cashback and promotions at a glance (web RewardsShortcuts).
class RewardsShortcuts extends ConsumerWidget {
  const RewardsShortcuts({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final r = ref.watch(growthRewardsProvider).value;
    final cash = ref.watch(cashbackProvider).value;
    final items = [
      (
        '/rewards/loyalty',
        LucideIcons.gem,
        KTone.amber,
        r != null ? t('rewards.shortcuts.points', {'points': f.points(r.points.balance)}) : t('rewards.shortcuts.loyalty'),
        r != null
            ? t('rewards.shortcuts.tierValue', {'tier': r.tier.name, 'value': f.usd(r.points.balance * r.pointValue)})
            : t('rewards.shortcuts.loyaltySub'),
        t('rewards.shortcuts.redeem'),
      ),
      (
        '/rewards/cashback',
        LucideIcons.banknote,
        KTone.mint,
        cash != null ? t('rewards.shortcuts.cashbackValue', {'amount': f.usd(cash.lifetime)}) : t('rewards.shortcuts.cashback'),
        cash != null ? t('rewards.shortcuts.cashbackPending', {'amount': f.usd(cash.accrued)}) : t('rewards.shortcuts.cashbackSub'),
        t('rewards.shortcuts.view'),
      ),
      (
        '/rewards/promotions',
        LucideIcons.gift,
        KTone.coral,
        t('rewards.shortcuts.promotions'),
        t('rewards.shortcuts.promotionsSub'),
        t('rewards.shortcuts.open'),
      ),
    ];
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('rewards.shortcuts.title'), subtitle: t('rewards.shortcuts.subtitle')),
          const SizedBox(height: 14),
          for (final (href, icon, tone, title, sub, chip) in items) ...[
            if (href != items.first.$1) const SizedBox(height: 8),
            KPressable(
              pressedScale: 0.99,
              onTap: () => context.go(href),
              child: RowBox(
                child: Row(
                  children: [
                    KIconTile(icon: icon, tone: tone, size: 36),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: context.text.callout.copyWith(fontWeight: FontWeight.w600, color: k.fg, fontFeatures: kTabular),
                          ),
                          Text(
                            sub,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    KChip(label: chip, tone: KChipTone.ember, small: true),
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

/// Every contest the client entered (web MyResults: contest, status, rank, score, prize on phones).
class MyResults extends StatelessWidget {
  const MyResults({super.key, required this.items});
  final List<ContestCard> items;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final f = GrowthFmt(t);
    final rows = items.where((c) => c.myEntry != null).toList();
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KCardHeader(title: t('rewards.results.title'), subtitle: t('rewards.results.subtitle'), icon: LucideIcons.medal),
          const SizedBox(height: 12),
          PagedRows<ContestCard>(
            rows: rows,
            pageSize: 8,
            empty: CardEmpty(title: t('rewards.results.emptyTitle'), text: t('rewards.results.emptyText')),
            itemBuilder: (context, cc) {
              final c = cc.contest;
              final me = cc.myEntry!;
              return KPressable(
                pressedScale: 1,
                onTap: () => context.push('/rewards/contests/${c.id}'),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 11),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                ...contestKindChips(context, c).expand((w) => [w, const SizedBox(width: 6)]),
                                Expanded(
                                  child: Text(
                                    c.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: context.text.callout.copyWith(fontWeight: FontWeight.w600, color: k.fg),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                GrowthStatus(me.disqualified ? 'disqualified' : c.status),
                                const SizedBox(width: 8),
                                Text(
                                  me.rank != null ? '#${me.rank}' : '—',
                                  textDirection: TextDirection.ltr,
                                  style: context.text.footnote.copyWith(fontWeight: FontWeight.w600, color: k.fg, fontFeatures: kTabular),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            scoreText(f, c, me),
                            textDirection: TextDirection.ltr,
                            style: context.text.footnote.copyWith(fontWeight: FontWeight.w600, color: scoreColor(context, c, me), fontFeatures: kTabular),
                          ),
                          const SizedBox(height: 4),
                          if ((me.prize ?? 0) > 0)
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  f.usd(me.prize!, 0),
                                  textDirection: TextDirection.ltr,
                                  style: context.text.footnote.copyWith(fontWeight: FontWeight.w700, color: k.gold, fontFeatures: kTabular),
                                ),
                                if (me.prizeStatus != null) ...[const SizedBox(width: 6), GrowthStatus(me.prizeStatus!, dot: false)],
                              ],
                            )
                          else
                            Text('—', style: context.text.footnote.copyWith(color: k.fg3)),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
