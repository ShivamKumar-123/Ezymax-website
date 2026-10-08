// Prop › My challenges (/prop/mine?id=): the port of LivePropMine (apps/crm/components/prop-live/mine.tsx) in the
// phone order: header (+ Payouts, New challenge), the challenge selector (+ New challenge), then the chosen
// challenge: phase switch, banners, overview with the trading account and Trade, daily reset, KPIs, rule tiles,
// equity, drawdown, trading statistics, rule events and trade history. The list polls every 10 s, the challenge
// every 2 s (web usePropPoll).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/auth_controller.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'prop_api.dart';
import 'widgets/mine_sections.dart';
import 'widgets/prop_ui.dart';

class PropMineScreen extends ConsumerStatefulWidget {
  const PropMineScreen({super.key, this.id});

  /// The challenge to show first (`?id=`), else the first of the list.
  final int? id;

  @override
  ConsumerState<PropMineScreen> createState() => _PropMineScreenState();
}

class _PropMineScreenState extends ConsumerState<PropMineScreen> {
  late int? _selected = widget.id;

  @override
  void didUpdateWidget(PropMineScreen old) {
    super.didUpdateWidget(old);
    if (widget.id != old.id && widget.id != null) _selected = widget.id;
  }

  Future<void> _refresh() async {
    ref.invalidate(propChallengesProvider(10));
    if (_selected != null) ref.invalidate(propChallengeProvider(_selected!));
    await ref.read(propChallengesProvider(10).future).then((_) {}, onError: (Object _) {});
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    final listAsync = ref.watch(propChallengesProvider(10));
    return KPageScroll(
      onRefresh: _refresh,
      children: [
        KPageHeader(title: t('prop.myChallenges'), subtitle: Text(t('prop.mine.subtitle'))),
        const SizedBox(height: 14),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            KButton(label: t('prop.mine.payouts'), icon: LucideIcons.banknote, variant: KButtonVariant.surface, onPressed: () => context.go('/prop/payouts')),
            KButton(label: t('prop.mine.newChallenge'), icon: LucideIcons.plus, variant: KButtonVariant.surface, onPressed: () => context.go('/prop')),
          ],
        ),
        const SizedBox(height: 20),
        KAsync<List<Challenge>>(
          value: listAsync,
          onRetry: () => ref.invalidate(propChallengesProvider(10)),
          error: (e) => PropLoadError(error: e, onRetry: () => ref.invalidate(propChallengesProvider(10))),
          loading: const SizedBox(
            height: 120,
            child: Row(
              children: [
                Expanded(child: KSkeleton(height: 120, radius: 18)),
                SizedBox(width: 12),
                Expanded(child: KSkeleton(height: 120, radius: 18)),
              ],
            ),
          ),
          builder: (raw) {
            final list = sortChallenges(raw);
            final id = list.any((c) => c.id == _selected) ? _selected : list.firstOrNull?.id;
            if (id == null) {
              return KCard(
                child: KEmptyState(
                  art: KIllustrationName.propChallenge,
                  title: t('prop.mine.emptyTitle'),
                  text: t('prop.mine.emptyText'),
                  action: KButton(label: t('prop.browseChallenges'), trailingIcon: LucideIcons.target, onPressed: () => context.go('/prop')),
                ),
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _Selector(list: list, value: id, onChange: (x) => setState(() => _selected = x)),
                ChallengeDashboard(key: ValueKey(id), id: id, readOnly: readOnly),
              ],
            );
          },
        ),
      ],
    );
  }
}

/* ------------------------------------------------------------------ selector */

class _Selector extends StatelessWidget {
  const _Selector({required this.list, required this.value, required this.onChange});
  final List<Challenge> list;
  final int value;
  final ValueChanged<int> onChange;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return SizedBox(
      height: 124,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        itemCount: list.length + 1,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (context, i) {
          if (i == list.length) {
            return KPressable(
              onTap: () => context.go('/prop'),
              semanticLabel: t('prop.mine.newChallenge'),
              child: Container(
                width: 150,
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: k.fg3.withValues(alpha: 0.35)),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: k.line),
                      ),
                      child: Icon(LucideIcons.plus, size: 16, color: k.fg3),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      t('prop.mine.newChallenge'),
                      textAlign: TextAlign.center,
                      style: context.text.label.copyWith(color: k.fg3),
                    ),
                  ],
                ),
              ),
            );
          }
          final c = list[i];
          final on = c.id == value;
          final a = c.current;
          final v = a == null ? null : RuleView.of(c, a);
          return KPressable(
            onTap: () => onChange(c.id),
            semanticLabel: '${sizeLabel(c.size)} ${c.planName}',
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: 260,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: on ? k.emberSoft : k.cardBg,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: on ? k.ember.withValues(alpha: 0.4) : k.cardBorder),
                boxShadow: on ? null : k.shadowCard,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(sizeLabel(c.size), textDirection: TextDirection.ltr, style: context.text.figure.copyWith(fontSize: 17)),
                            Text(
                              '${c.planName}${a?.login != null ? ' · #${a!.login}' : ''}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: KChip(label: stageLabel(t, c), tone: challengeTone(c.status), small: true),
                      ),
                    ],
                  ),
                  const Spacer(),
                  if (v != null) ...[
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            a!.funded ? t('prop.profit') : t('prop.rule.profitTarget'),
                            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                          ),
                        ),
                        Text.rich(
                          TextSpan(
                            text: usd(v.profit, 0),
                            children: [
                              if (!a.funded && v.targetAmount != null && v.targetAmount! > 0)
                                TextSpan(
                                  text: ' / ${usd(v.targetAmount, 0)}',
                                  style: TextStyle(color: k.fg3),
                                ),
                            ],
                          ),
                          textDirection: TextDirection.ltr,
                          style: context.text.caption.copyWith(color: k.fg, fontFeatures: kTabular),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    KProgressBar(value: progressOf(c) / 100, color: c.status == 'failed' ? k.down : (c.status == 'funded' ? k.gold : k.ember)),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

/* ------------------------------------------------------------------ one challenge */

class ChallengeDashboard extends ConsumerStatefulWidget {
  const ChallengeDashboard({super.key, required this.id, required this.readOnly});
  final int id;
  final bool readOnly;

  @override
  ConsumerState<ChallengeDashboard> createState() => _ChallengeDashboardState();
}

class _ChallengeDashboardState extends ConsumerState<ChallengeDashboard> {
  int? _phase;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final async = ref.watch(propChallengeProvider(widget.id));
    return KAsync<Challenge>(
      value: async,
      onRetry: () => ref.invalidate(propChallengeProvider(widget.id)),
      error: (e) => Padding(
        padding: const EdgeInsets.only(top: 16),
        child: PropLoadError(error: e, title: t('prop.mine.loadError'), onRetry: () => ref.invalidate(propChallengeProvider(widget.id))),
      ),
      loading: const Padding(
        padding: EdgeInsets.only(top: 16),
        child: Column(children: [KSkeletonCard(height: 300, lines: 5), SizedBox(height: 16), KSkeletonCard(height: 220)]),
      ),
      builder: (c) {
        final a = (_phase != null ? c.phases.where((p) => p.phaseIndex == _phase).firstOrNull : null) ?? c.current ?? c.phases.lastOrNull;
        if (a == null) {
          return Padding(
            padding: const EdgeInsets.only(top: 16),
            child: KCard(
              child: KEmptyState(
                icon: LucideIcons.hourglass,
                title: t('prop.banner.openingTitle'),
                text: c.status == 'payment_failed' ? (c.failureReason ?? t('prop.mine.paymentFailedText')) : t('prop.mine.openingText'),
              ),
            ),
          );
        }
        final v = RuleView.of(c, a);
        final live = tradable(c, a);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (c.phases.length > 1) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  Text(t('prop.mine.phase'), style: context.text.footnote.copyWith(color: k.fg3)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: KChoiceChips<int>(
                      values: [for (final p in c.phases) p.phaseIndex],
                      labels: [
                        for (final p in c.phases)
                          '${p.phase} · ${p.status == 'active' ? t('prop.mine.live') : t.dyn('prop.phaseStatus.${p.status}', fallback: p.status)}',
                      ],
                      selected: a.phaseIndex,
                      onChanged: (x) => setState(() => _phase = x),
                    ),
                  ),
                ],
              ),
            ],
            ChallengeBanners(c: c, a: a, v: v),
            propGap,
            ChallengeOverview(c: c, a: a, v: v, readOnly: widget.readOnly),
            propGap,
            ResetCard(v: v, active: live),
            propGap,
            ChallengeKpis(c: c, a: a, v: v),
            propGap,
            ChallengeRules(c: c, a: a, v: v),
            propGap,
            EquityCard(key: ValueKey('eq-${c.id}-${a.phaseIndex}'), c: c, a: a, v: v),
            propGap,
            DrawdownCard(c: c, v: v),
            propGap,
            ChallengeObjectives(a: a),
            propGap,
            ChallengeEvents(events: c.events.where((e) => e.accountId == a.id).toList()),
            propGap,
            ChallengeTrades(key: ValueKey('tr-${c.id}-${a.phaseIndex}'), c: c, a: a),
          ],
        );
      },
    );
  }
}
