// Partner › Network (web components/partner/live/network.tsx LivePartnerNetwork), in the phone order: header
// (Collapse all / Expand all) · one card per tier · the network tree (you, sub-IBs to expand, the direct-clients
// group) · lots by tier (donut + legend) · sub-IB leaderboard (opens the path in the tree) · permanent attribution.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'partner_api.dart';
import 'widgets/partner_widgets.dart';

/// The tree: children per parent (the root's id for direct clients) and nodes by id.
class _Tree {
  _Tree(List<PNode> nodes, int rootId) {
    for (final n in nodes) {
      byId[n.id] = n;
      (kids[n.parentId ?? rootId] ??= []).add(n);
    }
  }
  final Map<int, List<PNode>> kids = {};
  final Map<int, PNode> byId = {};

  bool hasKids(int id) => kids.containsKey(id);

  List<PNode> subtree(int id) => [
    for (final k in kids[id] ?? const <PNode>[]) ...[k, ...subtree(k.id)],
  ];

  List<PNode> sorted(List<PNode> list) => [...list]
    ..sort((a, b) {
      final x = (hasKids(b.id) ? 1 : 0) - (hasKids(a.id) ? 1 : 0);
      if (x != 0) return x;
      final y = b.lotsMonth.compareTo(a.lotsMonth);
      return y != 0 ? y : a.name.compareTo(b.name);
    });
}

List<Color> _tierColors(KTokens k) => [k.ember, const Color(0xFFE9B949), const Color(0xFF22C55E), const Color(0xFF38BDF8), const Color(0xFFA1A1AA)];

class PartnerNetworkScreen extends ConsumerStatefulWidget {
  const PartnerNetworkScreen({super.key});

  @override
  ConsumerState<PartnerNetworkScreen> createState() => _PartnerNetworkScreenState();
}

class _PartnerNetworkScreenState extends ConsumerState<PartnerNetworkScreen> {
  Map<String, bool> _open = {'direct': true};
  final _treeKey = GlobalKey();

  void _toggle(String id) => setState(() => _open = {..._open, id: !(_open[id] ?? false)});

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final pf = PartnerFmt(t);
    final async = ref.watch(partnerNetworkProvider);
    final prog = ref.watch(partnerProgrammeProvider).value;
    final data = async.value;
    if (data == null) {
      return PartnerPageFallback(
        title: t('partner.network.title'),
        subtitle: t('partner.network.subtitle'),
        error: async.hasError ? async.error : null,
        onRetry: () => ref.invalidate(partnerNetworkProvider),
        skeleton: const [170, 170, 170, 420],
      );
    }

    final tree = _Tree(data.nodes, data.rootId);
    final rootKids = tree.sorted(tree.kids[data.rootId] ?? const []);
    final directIbs = rootKids.where((c) => tree.hasKids(c.id)).toList();
    final directClients = rootKids.where((c) => !tree.hasKids(c.id)).toList();
    final allIbs = data.nodes.where((c) => tree.hasKids(c.id)).toList();
    final total = data.nodes.fold<double>(0, (s, c) => s + c.lotsMonth);
    final tierList = [for (var i = 1; i <= data.tiers; i++) i];
    double? tierPct(int tier) => prog?.tierPct(tier);
    final tierLots = [for (final tr in tierList) data.nodes.where((c) => c.tier == tr).fold<double>(0, (s, c) => s + c.lotsMonth)];
    final levelName = prog?.levels.where((l) => l.key == data.rootLevel).firstOrNull?.name ?? data.rootLevel;
    final ibRank =
        [
          for (final c in allIbs)
            () {
              final net = tree.subtree(c.id);
              return (c: c, n: net.length, lots: c.lotsMonth + net.fold<double>(0, (s, x) => s + x.lotsMonth));
            }(),
        ]..sort((a, b) {
          final x = b.lots.compareTo(a.lots);
          return x != 0 ? x : b.n.compareTo(a.n);
        });
    final top = ibRank.take(8).toList();

    return KPageScroll(
      onRefresh: () async {
        ref
          ..invalidate(partnerNetworkProvider)
          ..invalidate(partnerProgrammeProvider);
        await ref.read(partnerNetworkProvider.future).then((_) {}, onError: (Object _) {});
      },
      children: [
        KPageHeader(title: t('partner.network.title'), subtitle: Text(t('partner.network.subtitle'))),
        if (data.nodes.isNotEmpty) ...[
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              KButton(
                label: t('partner.network.collapseAll'),
                icon: LucideIcons.chevronsDownUp,
                variant: KButtonVariant.surface,
                size: KButtonSize.sm,
                onPressed: () => setState(() => _open = {}),
              ),
              KButton(
                label: t('partner.network.expandAll'),
                icon: LucideIcons.chevronsUpDown,
                variant: KButtonVariant.surface,
                size: KButtonSize.sm,
                onPressed: () => setState(() => _open = {'direct': true, for (final c in allIbs) '${c.id}': true}),
              ),
            ],
          ),
        ],
        const SizedBox(height: 20),
        for (final tier in tierList) ...[_TierCard(tier: tier, pct: tierPct(tier), nodes: data.nodes, total: total), const SizedBox(height: 12)],
        const SizedBox(height: 4),
        KCard(
          key: _treeKey,
          padding: const EdgeInsets.fromLTRB(14, 16, 14, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: KCardHeader(
                  title: t('partner.network.tree'),
                  subtitle: allIbs.isNotEmpty ? t('partner.network.treeHintIbs') : t('partner.network.treeHint'),
                  icon: LucideIcons.network,
                ),
              ),
              const SizedBox(height: 10),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: KChip(
                  label: '${t('partner.network.peopleCount', {'count': data.nodes.length})} · ${t('partner.network.tiersCount', {'n': data.tiers})}',
                  tone: KChipTone.ember,
                  dot: true,
                ),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Color.lerp(k.cardBorder, k.ember, 0.22)!),
                  gradient: RadialGradient(
                    center: const AlignmentDirectional(1, -1).resolve(Directionality.of(context)),
                    radius: 1.6,
                    colors: [k.ember.withValues(alpha: 0.16), k.ember.withValues(alpha: 0.02)],
                  ),
                ),
                child: Row(
                  children: [
                    KAvatar(name: partnerInitials(data.rootName), size: 44),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Wrap(
                            spacing: 8,
                            runSpacing: 4,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text(t('partner.network.you', {'name': data.rootName}), style: context.text.headline.copyWith(fontWeight: FontWeight.w500)),
                              KChip(label: levelName, tone: KChipTone.gold, small: true),
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${t('partner.subIbCount', {'count': directIbs.length})} · ${t('partner.network.directClients', {'count': directClients.length})} · '
                            '${t('partner.network.networkLotsMonth', {'lots': pf.lots(total, 1)})}',
                            style: context.text.caption.copyWith(color: k.fg2, fontWeight: FontWeight.w400),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              if (data.nodes.isEmpty) ...[
                const SizedBox(height: 14),
                CardEmpty(
                  title: t('partner.network.emptyTitle'),
                  text: t('partner.network.emptyText'),
                  child: KButton(
                    label: t('partner.network.getLinks'),
                    variant: KButtonVariant.surface,
                    size: KButtonSize.sm,
                    onPressed: () => context.go('/partner/links'),
                  ),
                ),
              ] else
                Padding(
                  padding: const EdgeInsetsDirectional.only(start: 12, top: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final (i, c) in directIbs.indexed)
                        _Branch(
                          last: directClients.isEmpty && i == directIbs.length - 1,
                          child: _PartnerNode(c: c, tree: tree, open: _open, toggle: _toggle),
                        ),
                      if (directClients.isNotEmpty)
                        _Branch(
                          last: true,
                          child: _DirectGroup(list: directClients, open: _open['direct'] ?? false, onToggle: () => _toggle('direct')),
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        kGap,
        KCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KCardHeader(title: t('partner.network.lotsByTier'), subtitle: t('partner.network.lotsByTierSubtitle', {'lots': pf.lots(total, 1)})),
              const SizedBox(height: 16),
              if (total > 0) ...[
                Center(
                  child: KDonut(
                    size: 160,
                    thickness: 18,
                    segments: [for (var i = 0; i < tierList.length; i++) (tierLots[i], _tierColors(k)[i % 5])],
                    center: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(total.toStringAsFixed(total >= 100 ? 0 : 1), textDirection: TextDirection.ltr, style: context.text.figure.copyWith(fontSize: 20)),
                        Text(
                          t('partner.network.lotsUnit'),
                          style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                _TierLegend(tiers: tierList, lots: tierLots, total: total, pct: tierPct),
              ] else ...[
                _TierLegend(tiers: tierList, lots: tierLots, total: total, pct: tierPct),
                const SizedBox(height: 10),
                Text(
                  t('partner.network.noLots'),
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
                ),
              ],
            ],
          ),
        ),
        if (top.isNotEmpty) ...[
          kGap,
          KCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                KCardHeader(title: t('partner.network.leaderboard'), subtitle: t('partner.network.leaderboardSubtitle'), icon: LucideIcons.users),
                const SizedBox(height: 14),
                for (final (i, r) in top.indexed) ...[
                  if (i > 0) const SizedBox(height: 8),
                  PartnerRow(
                    onTap: () {
                      // open the path from the root down to this partner, then show the tree
                      final m = <String, bool>{'${r.c.id}': true};
                      var p = r.c.parentId;
                      while (p != null && tree.byId.containsKey(p)) {
                        m['$p'] = true;
                        p = tree.byId[p]!.parentId;
                      }
                      setState(() => _open = {..._open, ...m});
                      final ctx = _treeKey.currentContext;
                      if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 350), curve: Curves.easeOutCubic);
                    },
                    child: Row(
                      children: [
                        SizedBox(
                          width: 16,
                          child: Text('${i + 1}', style: context.text.mono(11, color: k.fg3)),
                        ),
                        KAvatar(name: partnerInitials(r.c.name), size: 30),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Flexible(
                                    child: Text(
                                      r.c.name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: context.text.label.copyWith(color: k.fg),
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  TierChip(r.c.tier),
                                ],
                              ),
                              Text(
                                t('partner.network.peopleCount', {'count': r.n}),
                                style: context.text.caption.copyWith(fontSize: 11, color: k.fg3, fontWeight: FontWeight.w400),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          pf.lots(r.lots, 1),
                          style: context.text.label.copyWith(fontFeatures: kTabular, color: k.fg),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
        kGap,
        KCard(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              RoundIcon(LucideIcons.infinity, size: 40, bg: k.surface2, border: true),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t('partner.network.permanentTitle'), style: context.text.headline.copyWith(fontSize: 14, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 4),
                    Text(t('partner.network.permanentText'), style: context.text.footnote.copyWith(color: k.fg3, height: 1.5)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/* ------------------------------------------------------------------ tiers */

class _TierCard extends StatelessWidget {
  const _TierCard({required this.tier, required this.pct, required this.nodes, required this.total});
  final int tier;
  final double? pct;
  final List<PNode> nodes;
  final double total;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final pf = PartnerFmt(t);
    final list = nodes.where((c) => c.tier == tier).toList();
    final lots = list.fold<double>(0, (s, c) => s + c.lotsMonth);
    final share = total > 0 ? lots / total * 100 : 0.0;
    final earned = list.fold<double>(0, (s, c) => s + c.earnedMonth);
    final (title, note) = tier >= 1 && tier <= 3
        ? (t.dyn('partner.network.tier${tier}Title'), t.dyn('partner.network.tier${tier}Note'))
        : (t('partner.tierN', {'n': tier}), t('partner.levelsBelow', {'n': tier - 1}));
    final label = context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12);
    final big = context.text.figure.copyWith(fontSize: 20);
    final small = context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 11, fontFeatures: kTabular);
    return KCard(
      padding: const EdgeInsets.all(18),
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
                    Row(
                      children: [
                        TierChip(tier),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(title, style: context.text.label.copyWith(fontSize: 13.5, color: k.fg)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(note, style: label),
                  ],
                ),
              ),
              if (pct != null)
                KChip(
                  label: t('partner.ofRate', {'pct': fmtPct(pct!)}),
                  tone: tier == 1
                      ? KChipTone.ember
                      : tier == 2
                      ? KChipTone.gold
                      : KChipTone.neutral,
                ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t('partner.network.people'), style: label),
                    const SizedBox(height: 2),
                    Text('${list.length}', style: big),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t('partner.lots'), style: label),
                    const SizedBox(height: 2),
                    Text(pf.lots(lots, 1), style: big),
                    Text(total > 0 ? t('partner.network.pctOfNetwork', {'pct': share.toStringAsFixed(1)}) : t('partner.network.thisMonth'), style: small),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t('partner.network.toYou'), style: label),
                    const SizedBox(height: 2),
                    KMoney(earned, decimals: 2, style: big.copyWith(color: earned != 0 ? k.up : k.fg)),
                    Text(t('partner.network.thisMonth'), style: small),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          KProgressBar(
            value: share / 100,
            color: tier == 1
                ? k.ember
                : tier == 2
                ? k.gold
                : k.up,
          ),
        ],
      ),
    );
  }
}

class _TierLegend extends StatelessWidget {
  const _TierLegend({required this.tiers, required this.lots, required this.total, required this.pct});
  final List<int> tiers;
  final List<double> lots;
  final double total;
  final double? Function(int tier) pct;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final pf = PartnerFmt(t);
    return Column(
      children: [
        for (var i = 0; i < tiers.length; i++) ...[
          if (i > 0) const SizedBox(height: 8),
          PartnerRow(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            child: Row(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(color: _tierColors(k)[i % 5], shape: BoxShape.circle),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: t('partner.tierN', {'n': tiers[i]})),
                        if (pct(tiers[i]) != null)
                          TextSpan(
                            text: ' · ${t('partner.ofRate', {'pct': fmtPct(pct(tiers[i])!)})}',
                            style: TextStyle(color: k.fg3),
                          ),
                      ],
                    ),
                    style: context.text.footnote.copyWith(color: k.fg),
                  ),
                ),
                Text(
                  pf.lots(lots[i], 1),
                  style: context.text.footnote.copyWith(fontWeight: FontWeight.w600, color: k.fg, fontFeatures: kTabular),
                ),
                SizedBox(
                  width: 52,
                  child: Text(
                    total > 0 ? '${(lots[i] / total * 100).toStringAsFixed(1)}%' : '—',
                    textAlign: TextAlign.end,
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontFeatures: kTabular),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/* ------------------------------------------------------------------ tree */

/// A tree branch: the vertical line down the side and the short connector to the node (web Branch).
class _Branch extends StatelessWidget {
  const _Branch({required this.child, required this.last});
  final Widget child;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Stack(
      children: [
        PositionedDirectional(
          start: 0,
          top: 0,
          bottom: last ? null : 0,
          height: last ? 30 : null,
          child: Container(width: 1, color: k.fg3.withValues(alpha: 0.3)),
        ),
        PositionedDirectional(start: 0, top: 30, child: Container(width: 14, height: 1, color: k.fg3.withValues(alpha: 0.4))),
        Padding(padding: const EdgeInsetsDirectional.only(start: 16, bottom: 10), child: child),
      ],
    );
  }
}

class _Chevron extends StatelessWidget {
  const _Chevron({required this.open});
  final bool open;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        color: k.surface3,
        shape: BoxShape.circle,
        border: Border.all(color: k.line),
      ),
      child: AnimatedRotation(
        turns: open ? 0.5 : 0,
        duration: const Duration(milliseconds: 200),
        child: Icon(LucideIcons.chevronDown, size: 14, color: k.fg2),
      ),
    );
  }
}

class _Collapsible extends StatelessWidget {
  const _Collapsible({required this.open, required this.child});
  final bool open;
  final Widget child;

  @override
  Widget build(BuildContext context) => AnimatedSize(
    duration: const Duration(milliseconds: 240),
    curve: Curves.easeOutCubic,
    alignment: AlignmentDirectional.topStart,
    child: open ? child : const SizedBox(width: double.infinity),
  );
}

class _PartnerNode extends StatelessWidget {
  const _PartnerNode({required this.c, required this.tree, required this.open, required this.toggle});
  final PNode c;
  final _Tree tree;
  final Map<String, bool> open;
  final void Function(String id) toggle;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final pf = PartnerFmt(t);
    final kids = tree.sorted(tree.kids[c.id] ?? const []);
    final isOpen = open['${c.id}'] ?? false;
    final net = tree.subtree(c.id);
    final lots = c.lotsMonth + net.fold<double>(0, (s, x) => s + x.lotsMonth);
    final hasKids = kids.isNotEmpty;
    final box = Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: hasKids ? k.gold.withValues(alpha: 0.05) : k.surface2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: hasKids ? k.gold.withValues(alpha: 0.25) : k.line),
      ),
      child: Row(
        children: [
          PartnerAvatar(name: c.name, country: c.country, size: hasKids ? 38 : 32),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(c.name, style: context.text.label.copyWith(fontSize: 13.5, color: k.fg)),
                    TierChip(c.tier),
                    if (hasKids) KChip(label: t('partner.network.subIb'), tone: KChipTone.gold, small: true),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  hasKids
                      ? t('partner.network.inTheirNetwork', {'n': net.length, 'lots': pf.lots(lots, 1)})
                      : c.lotsMonth != 0
                      ? t('partner.network.lotsThisMonth', {'lots': pf.lots(c.lotsMonth)})
                      : t('partner.network.noTradesThisMonth'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                ),
              ],
            ),
          ),
          if (hasKids) ...[const SizedBox(width: 8), _Chevron(open: isOpen)],
        ],
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (hasKids) KPressable(onTap: () => toggle('${c.id}'), pressedScale: 0.99, child: box) else box,
        if (hasKids)
          _Collapsible(
            open: isOpen,
            child: Padding(
              padding: const EdgeInsetsDirectional.only(start: 12, top: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final (i, kid) in kids.indexed)
                    _Branch(
                      last: i == kids.length - 1,
                      child: _PartnerNode(c: kid, tree: tree, open: open, toggle: toggle),
                    ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _DirectGroup extends StatefulWidget {
  const _DirectGroup({required this.list, required this.open, required this.onToggle});
  final List<PNode> list;
  final bool open;
  final VoidCallback onToggle;

  @override
  State<_DirectGroup> createState() => _DirectGroupState();
}

class _DirectGroupState extends State<_DirectGroup> {
  bool _all = false;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final pf = PartnerFmt(t);
    final list = widget.list;
    final active = list.where((c) => c.lotsMonth > 0).length;
    final shown = _all ? list : list.take(12).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KPressable(
          onTap: widget.onToggle,
          pressedScale: 0.99,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: k.ember.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: k.ember.withValues(alpha: 0.25)),
            ),
            child: Row(
              children: [
                const RoundIcon(LucideIcons.users, size: 34, border: true),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              t('partner.network.directClients', {'count': list.length}),
                              style: context.text.label.copyWith(fontSize: 13.5, color: k.fg),
                            ),
                          ),
                          const SizedBox(width: 6),
                          const TierChip(1),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        t('partner.network.directGroupHint', {'n': active}),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                _Chevron(open: widget.open),
              ],
            ),
          ),
        ),
        _Collapsible(
          open: widget.open,
          child: Padding(
            padding: const EdgeInsetsDirectional.only(start: 12, top: 10),
            child: Container(
              padding: const EdgeInsetsDirectional.only(start: 14, bottom: 4),
              decoration: BoxDecoration(
                border: BorderDirectional(start: BorderSide(color: k.fg3.withValues(alpha: 0.3))),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final (i, c) in shown.indexed) ...[
                    if (i > 0) const SizedBox(height: 8),
                    PartnerRow(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      onTap: () => context.go('/partner/clients'),
                      child: Row(
                        children: [
                          KAvatar(name: partnerInitials(c.name), size: 26),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Flexible(
                                      child: Text(
                                        c.name,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: context.text.label.copyWith(fontSize: 12.5, color: k.fg),
                                      ),
                                    ),
                                    if (c.country.isNotEmpty) ...[const SizedBox(width: 5), KFlag(c.country, size: 12)],
                                  ],
                                ),
                                Text(
                                  c.lotsMonth > 0 ? t('partner.tradedThisMonth') : t('partner.network.noTradesThisMonth'),
                                  style: context.text.caption.copyWith(fontSize: 11, color: k.fg3, fontWeight: FontWeight.w400),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            c.lotsMonth != 0 ? t('partner.lotsN', {'lots': pf.lots(c.lotsMonth, 1)}) : '—',
                            style: context.text.caption.copyWith(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: c.lotsMonth != 0 ? k.fg : k.fg3,
                              fontFeatures: kTabular,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  if (list.length > 12) ...[
                    const SizedBox(height: 6),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: KButton(
                        label: _all ? t('partner.network.showFewer') : t('partner.network.showAll', {'n': list.length}),
                        variant: KButtonVariant.ghost,
                        size: KButtonSize.sm,
                        onPressed: () => setState(() => _all = !_all),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
