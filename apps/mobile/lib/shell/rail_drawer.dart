// The side navigation, the web's rail as a drawer (apps/crm/components/chrome/rail.tsx, expanded): the broker's mark
// and name, a divider, then the modules in the web's order and sections. The active module is marked by an ember
// notch on the outer edge. A module with two or more pages opens in place as an accordion, one at a time, so a long
// list never pushes the rest out of reach; a module with one page simply navigates. Sections are separated by a
// hairline; Offers carries its unseen count. Opened from the brand mark in the header, or by a swipe from the edge.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/config/app_config.dart';
import '../features/offers/offers_api.dart';
import '../i18n/i18n.dart';
import '../ui/ui.dart';
import 'nav.dart';

/// The web rail's width when expanded, plus the phone's side padding.
const double kRailWidth = 264;

class RailDrawer extends ConsumerStatefulWidget {
  const RailDrawer({super.key, required this.path, required this.nav});
  final String path;
  final List<NavModule> nav;

  @override
  ConsumerState<RailDrawer> createState() => _RailDrawerState();
}

class _RailDrawerState extends ConsumerState<RailDrawer> {
  /// A manual open / close, pinned to the module it was made in (web `from`): it survives navigation inside that
  /// module and is dropped once the route moves to another one, where the current module's group opens again.
  ({String? key, String? from})? _open;

  /// Only a real menu of sub-pages is worth an accordion (web groupOf).
  List<NavSub>? _groupOf(NavModule m) => m.sub.length >= 2 ? m.sub : null;

  void _go(String href) {
    Navigator.of(context).pop();
    context.go(href);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final cfg = ref.watch(configProvider);
    final unreadOffers = ref.watch(unreadOffersProvider);
    final current = moduleOf(widget.nav, widget.path);
    final open = _open;
    final openKey = open != null && open.from == current?.key ? open.key : (current != null && _groupOf(current) != null ? current.key : null);

    String? last;
    final rows = <Widget>[];
    for (final m in widget.nav) {
      final sep = last != null && m.section != last;
      last = m.section;
      if (rows.isNotEmpty) rows.add(const SizedBox(height: 3));
      if (sep) rows.add(Container(height: 1, color: k.line, margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 12)));
      final active = isActive(widget.path, m);
      final group = _groupOf(m);
      final isOpen = group != null && openKey == m.key;
      final here = isOpen ? activeSub(widget.path, group) : null;
      final badge = m.key == 'offers' && unreadOffers > 0 ? unreadOffers : null;
      rows.add(
        _Row(
          icon: m.icon,
          label: t(m.labelKey),
          active: active,
          badge: badge,
          chevron: group == null ? null : isOpen,
          onTap: group == null ? () => _go(m.href) : () => setState(() => _open = (key: isOpen ? null : m.key, from: current?.key)),
        ),
      );
      if (group != null) {
        rows.add(
          AnimatedSize(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOut,
            alignment: Alignment.topCenter,
            child: !isOpen
                ? const SizedBox(width: double.infinity)
                : Column(
                    children: [
                      for (final s in group)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: _SubRow(label: t(s.labelKey), active: here?.href == s.href, onTap: () => _go(s.href)),
                        ),
                    ],
                  ),
          ),
        );
      }
    }

    return Drawer(
      width: kRailWidth,
      backgroundColor: Colors.transparent,
      elevation: 0,
      shape: const RoundedRectangleBorder(),
      child: KFrosted(
        color: k.bar,
        border: BorderDirectional(end: BorderSide(color: k.line, width: 0.8)),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // the brand: the mark, and the broker's name beside it (Ezymex: its wordmark)
                KPressable(
                  onTap: () => _go('/'),
                  semanticLabel: t('shell.nav.dashboard'),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Row(
                      children: [
                        KBrandAvatar(size: 36, letter: cfg.tenantDefault ? null : cfg.tenantName.characters.first.toUpperCase()),
                        const SizedBox(width: 10),
                        Expanded(
                          child: cfg.tenantDefault
                              ? Align(alignment: AlignmentDirectional.centerStart, child: KLogo(height: 17, color: k.fg))
                              : Text(
                                  cfg.tenantName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: context.text.headline.copyWith(fontSize: 15.5, fontWeight: FontWeight.w700),
                                ),
                        ),
                      ],
                    ),
                  ),
                ),
                Container(height: 1, color: k.line, margin: const EdgeInsets.fromLTRB(4, 16, 4, 12)),
                Expanded(child: ListView(padding: EdgeInsets.zero, clipBehavior: Clip.none, children: rows)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A module row (web rowCls + face): the icon, the label, the badge, the accordion chevron; the active one on the
/// soft ember with the notch on the outer edge.
class _Row extends StatelessWidget {
  const _Row({required this.icon, required this.label, required this.active, required this.onTap, this.badge, this.chevron});
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;
  final int? badge;

  /// null: no accordion; else whether it is open.
  final bool? chevron;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return KPressable(
      onTap: onTap,
      pressedScale: 1,
      semanticLabel: label,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            height: 36,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(color: active ? k.emberSoft.withValues(alpha: 0.6) : Colors.transparent, borderRadius: BorderRadius.circular(11)),
            child: Row(
              children: [
                Icon(icon, size: 17, color: active ? k.ember : k.fg3),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.label.copyWith(fontSize: 13, fontWeight: active ? FontWeight.w600 : FontWeight.w500, color: active ? k.ember : k.fg3),
                  ),
                ),
                if (badge != null) _Badge(badge!),
                if (chevron != null) ...[
                  const SizedBox(width: 6),
                  AnimatedRotation(
                    duration: const Duration(milliseconds: 200),
                    turns: chevron! ? 0.5 : 0,
                    child: Icon(LucideIcons.chevronDown, size: 14, color: k.fg3.withValues(alpha: 0.7)),
                  ),
                ],
              ],
            ),
          ),
          // the notch on the outer edge (web .k-rail-notch: 5 × 28, rounded on the inner side, an ember glow)
          if (active)
            PositionedDirectional(
              start: -16,
              top: 4,
              child: Container(
                width: 5,
                height: 28,
                decoration: BoxDecoration(
                  color: k.ember,
                  borderRadius: const BorderRadiusDirectional.horizontal(end: Radius.circular(8)),
                  boxShadow: [BoxShadow(color: k.ember.withValues(alpha: 0.55), blurRadius: 18, spreadRadius: 1)],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// A page of an open module (web: the accordion's rows, indented under the icon; the current one on surface-3).
class _SubRow extends StatelessWidget {
  const _SubRow({required this.label, required this.active, required this.onTap});
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return KPressable(
      onTap: onTap,
      pressedScale: 1,
      semanticLabel: label,
      child: Container(
        height: 32,
        padding: const EdgeInsetsDirectional.only(start: 40, end: 12),
        alignment: AlignmentDirectional.centerStart,
        decoration: BoxDecoration(color: active ? k.surface3 : Colors.transparent, borderRadius: BorderRadius.circular(10)),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: context.text.label.copyWith(fontSize: 12.5, fontWeight: active ? FontWeight.w600 : FontWeight.w500, color: active ? k.fg : k.fg3),
        ),
      ),
    );
  }
}

/// The unseen count (web NavBadge on the rail): an ember pill, ringed by the rail's own background.
class _Badge extends StatelessWidget {
  const _Badge(this.value);
  final int value;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      height: 16,
      constraints: const BoxConstraints(minWidth: 16),
      padding: const EdgeInsets.symmetric(horizontal: 4),
      alignment: Alignment.center,
      decoration: BoxDecoration(color: k.ember, borderRadius: BorderRadius.circular(999), border: Border.all(color: k.bar, width: 2)),
      child: Text(value > 99 ? '99+' : '$value', style: context.text.micro.copyWith(fontSize: 9, fontWeight: FontWeight.w700, color: k.onEmber, height: 1)),
    );
  }
}
