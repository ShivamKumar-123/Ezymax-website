// The options mode's header row and expiry chips (web: components/options/mobile.tsx header, header.tsx SpotPrice /
// FeedChange, expiry-bar.tsx): the underlying button (avatar, symbol, spot, change, ▾ → Markets), the Book badge
// while the order book is live, the stream dot, "How options work" and the strategy builder; under it every open
// expiry as a chip ("Today", "Tomorrow", "Fri, 09 Oct" with the time left to its cut and W / M for weekly and monthly
// expiries) in one row that scrolls sideways and keeps the chosen one in view.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../i18n/i18n.dart';
import '../../../../ui/ui.dart';
import '../../core/market.dart';
import '../../widgets/kit.dart';
import '../core/format.dart';
import '../core/pricer.dart';
import '../core/store.dart';
import 'bits.dart';

/// Spot of an underlying from the CFD feed (the chain's spot until the feed has it).
class SpotPrice extends ConsumerWidget {
  const SpotPrice(this.symbol, {super.key, this.size = 13, this.fallback});
  final String symbol;
  final double size;
  final double? fallback;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final digits = ref.watch(symbolBookProvider.select((b) => b[symbol]?.digits)) ?? optionSpecs[symbol]?.digits ?? 5;
    return QuoteBuilder(
      symbol: symbol,
      builder: (context, q) {
        final v = q != null && q.bid > 0 ? q.mid : (fallback ?? 0);
        return PriceText(v, digits: digits, size: size, dir: q?.dir ?? 0);
      },
    );
  }
}

/// Today's change of an underlying ("+0.21%").
class FeedChange extends StatelessWidget {
  const FeedChange(this.symbol, {super.key, this.size = 10.5});
  final String symbol;
  final double size;

  @override
  Widget build(BuildContext context) => QuoteBuilder(
    symbol: symbol,
    throttle: const Duration(milliseconds: 500),
    builder: (context, q) {
      if (q == null || q.bid <= 0) return const SizedBox.shrink();
      final k = context.k;
      return Text(
        '${q.change >= 0 ? '+' : ''}${q.change.toStringAsFixed(2)}%',
        textDirection: TextDirection.ltr,
        style: context.text.mono(size, color: q.change >= 0 ? k.up : k.down),
      );
    },
  );
}

/// The header row of Chart, Chain and Trade.
class OptionsHeader extends ConsumerWidget {
  const OptionsHeader({super.key, required this.onPickUnderlying, required this.onBuilder});
  final VoidCallback onPickUnderlying;
  final VoidCallback onBuilder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final u = ref.watch(optionsProvider.select((s) => s.u));
    final chainSpot = ref.watch(optionsProvider.select((s) => s.chain?.underlying == s.u ? s.chain?.spot?.mid : null));
    final book = ref.watch(optionsProvider.select((s) => s.isBookLive));
    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: k.surface,
        border: Border(bottom: BorderSide(color: k.line, width: 0.6)),
      ),
      child: Row(
        children: [
          Flexible(
            child: KPressable(
              minSize: 40,
              semanticLabel: t('trader.opt.pickUnderlying'),
              onTap: onPickUnderlying,
              child: Container(
                height: 36,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                decoration: BoxDecoration(
                  color: k.surface2,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: k.line),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    OptAvatar(u, size: 18),
                    const SizedBox(width: 7),
                    Text(u, style: context.text.label.copyWith(fontSize: 14, fontWeight: FontWeight.w600)),
                    const SizedBox(width: 7),
                    Flexible(child: SpotPrice(u, fallback: chainSpot)),
                    const SizedBox(width: 6),
                    FeedChange(u),
                    const SizedBox(width: 4),
                    Icon(LucideIcons.chevronDown, size: 14, color: k.fg3),
                  ],
                ),
              ),
            ),
          ),
          const Spacer(),
          if (book) ...[const BookBadge(), const SizedBox(width: 6)],
          const StreamDot(),
          const SizedBox(width: 4),
          const HowItWorksButton(),
          const SizedBox(width: 6),
          KPressable(
            minSize: 36,
            semanticLabel: t('trader.opt.builder.open'),
            onTap: onBuilder,
            child: Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: k.emberSoft,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: k.ember.withValues(alpha: 0.4)),
              ),
              child: Icon(LucideIcons.wand2, size: 16, color: k.ember),
            ),
          ),
        ],
      ),
    );
  }
}

/// Every open expiry as chips in a sideways row (the chosen one kept in view).
class ExpiryBar extends ConsumerStatefulWidget {
  const ExpiryBar({super.key});

  @override
  ConsumerState<ExpiryBar> createState() => _ExpiryBarState();
}

class _ExpiryBarState extends ConsumerState<ExpiryBar> {
  final ScrollController _scroll = ScrollController();
  final Map<String, GlobalKey> _keys = {};
  String? _shown;

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _reveal(String? date) {
    if (date == null || date == _shown) return;
    _shown = date;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final c = _keys[date]?.currentContext;
      if (c != null && mounted) Scrollable.ensureVisible(c, duration: const Duration(milliseconds: 250), alignment: 0.5);
    });
  }

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final t = context.t;
    final list = ref.watch(optionsProvider.select((s) => s.expiries));
    final expiry = ref.watch(optionsProvider.select((s) => s.expiry));
    _reveal(expiry);
    return Container(
      height: 52,
      decoration: BoxDecoration(
        color: k.surface,
        border: Border(bottom: BorderSide(color: k.line, width: 0.6)),
      ),
      child: NowBuilder(
        builder: (context, now) {
          final open = list.where((e) => expiryOpen(e, now) || e.date == expiry).toList()..sort((a, b) => a.cutMs.compareTo(b.cutMs));
          if (open.isEmpty) {
            return ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
              children: [
                for (var i = 0; i < 5; i++)
                  const Padding(
                    padding: EdgeInsets.only(right: 6),
                    child: SizedBox(width: 84, child: KSkeleton(radius: 9)),
                  ),
              ],
            );
          }
          return Semantics(
            label: t('trader.opt.col.expiry'),
            child: ListView(
              controller: _scroll,
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
              children: [
                for (final e in open)
                  Padding(
                    key: _keys.putIfAbsent(e.date, GlobalKey.new),
                    padding: const EdgeInsets.only(right: 6),
                    child: _Chip(date: e.date, kinds: e.kinds, state: e.state, cutMs: e.cutMs, now: now, active: e.date == expiry),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Chip extends ConsumerWidget {
  const _Chip({required this.date, required this.kinds, required this.state, required this.cutMs, required this.now, required this.active});
  final String date, state;
  final List<String> kinds;
  final int cutMs, now;
  final bool active;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final k = context.k;
    final t = context.t;
    final label = dayLabel(t, date, t.locale, now);
    final soon = cutMs - now < 3600000;
    final tag = kinds.contains('monthly') ? 'M' : (kinds.contains('weekly') ? 'W' : null);
    return KPressable(
      minSize: 40,
      pressedScale: 0.97,
      semanticLabel: '$label ${cutWhen(cutMs, t.locale)}',
      onTap: () => ref.read(optionsProvider.notifier).selectExpiry(date),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        constraints: const BoxConstraints(minWidth: 84),
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: active ? k.emberSoft : k.surface2.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(9),
          border: Border.all(color: active ? k.ember : k.line, width: active ? 1.5 : 1),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: context.text.label.copyWith(fontSize: 11.5, fontWeight: FontWeight.w600, color: active ? k.fg : k.fg2, height: 1),
                ),
                if (tag != null) ...[
                  const SizedBox(width: 5),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(color: tag == 'M' ? k.goldSoft : k.infoSoft, borderRadius: BorderRadius.circular(3)),
                    child: Text(
                      tag,
                      style: context.text.mono(8.5, weight: FontWeight.w700, color: tag == 'M' ? k.gold : k.info),
                    ),
                  ),
                ],
                if (state != 'open') ...[
                  const SizedBox(width: 5),
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(color: state == 'halted' ? k.down : k.warn, shape: BoxShape.circle),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 4),
            Text(
              untilText(cutMs, now),
              textDirection: TextDirection.ltr,
              style: context.text.mono(10, color: soon ? k.warn : (active ? k.ember : k.fg3)),
            ),
          ],
        ),
      ),
    );
  }
}
