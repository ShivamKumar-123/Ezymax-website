// Small shared pieces of the options mode (web: components/options/bits.tsx, book-bits.tsx, explain.tsx, the
// StreamDot of desktop.tsx): call / put and side tags, state badges, the flashing number, a compact segmented
// control with up / down tones, the "launching soon" and error panels, rejection notes, countdowns, the "(?)"
// explanations, "Options in 30 seconds" and the order-book badges. Terminal tokens, compact sizes.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/prefs.dart';
import '../../../../i18n/i18n.dart';
import '../../../../ui/ui.dart';
import '../../widgets/kit.dart';
import '../core/errors.dart';
import '../core/format.dart';
import '../core/store.dart';

/// The avatar of an underlying (flags for currency pairs, the metal / energy discs).
class OptAvatar extends StatelessWidget {
  const OptAvatar(this.symbol, {super.key, this.size = 16});
  final String symbol;
  final double size;

  @override
  Widget build(BuildContext context) => SymbolAvatar(symbol, size: size);
}

/// "C" / "P" in green / red.
class RightTag extends StatelessWidget {
  const RightTag(this.right, {super.key, this.size = 17});
  final String right;
  final double size;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final call = right == 'call';
    return Container(
      constraints: BoxConstraints(minWidth: size),
      height: size,
      padding: const EdgeInsets.symmetric(horizontal: 3),
      alignment: Alignment.center,
      decoration: BoxDecoration(color: call ? k.upSoft : k.downSoft, borderRadius: BorderRadius.circular(4)),
      child: Text(
        call ? 'C' : 'P',
        style: context.text.mono(size * 0.6, weight: FontWeight.w700, color: call ? k.up : k.down),
      ),
    );
  }
}

/// "Call" / "Put" as a chip.
class RightChip extends StatelessWidget {
  const RightChip(this.right, {super.key, this.fontSize = 10.5});
  final String right;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final call = right == 'call';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
      decoration: BoxDecoration(color: call ? k.upSoft : k.downSoft, borderRadius: BorderRadius.circular(5)),
      child: Text(
        call ? context.t('trader.opt.call') : context.t('trader.opt.put'),
        style: context.text.caption.copyWith(fontSize: fontSize, fontWeight: FontWeight.w600, color: call ? k.up : k.down),
      ),
    );
  }
}

/// "Bought ×2" / "Sold ×1".
class SideChip extends StatelessWidget {
  const SideChip({super.key, required this.side, required this.n});
  final String side;
  final double n;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final buy = side == 'buy';
    return Container(
      height: 18,
      padding: const EdgeInsets.symmetric(horizontal: 5),
      alignment: Alignment.center,
      decoration: BoxDecoration(color: buy ? k.upSoft : k.downSoft, borderRadius: BorderRadius.circular(5)),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(text: buy ? context.t('trader.opt.pos.bought') : context.t('trader.opt.pos.sold')),
            TextSpan(
              text: ' ×${qty(n)}',
              style: context.text.mono(10.5, weight: FontWeight.w600, color: buy ? k.up : k.down),
            ),
          ],
        ),
        style: context.text.caption.copyWith(fontSize: 10.5, fontWeight: FontWeight.w600, color: buy ? k.up : k.down),
      ),
    );
  }
}

/// close_only / halted / closed (nothing while open).
class StateBadge extends StatelessWidget {
  const StateBadge(this.state, {super.key});
  final String state;

  @override
  Widget build(BuildContext context) {
    if (state == 'open') return const SizedBox.shrink();
    final k = context.k;
    final (Color bg, Color fg) = switch (state) {
      'halted' => (k.downSoft, k.down),
      'closed' => (k.surface3, k.fg3),
      _ => (k.warnSoft, k.warn),
    };
    return Container(
      height: 17,
      padding: const EdgeInsets.symmetric(horizontal: 5),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: fg.withValues(alpha: 0.3)),
      ),
      child: Text(
        context.t.dyn('trader.opt.state.$state', fallback: state).toUpperCase(),
        style: context.text.micro.copyWith(fontSize: 9.5, color: fg, letterSpacing: 0.4),
      ),
    );
  }
}

/// A number that glows green / red when it changes (chain prices, the selection bar).
class Flash extends StatefulWidget {
  const Flash({super.key, required this.value, required this.child, this.radius = 3});
  final double value;
  final Widget child;
  final double radius;

  @override
  State<Flash> createState() => _FlashState();
}

class _FlashState extends State<Flash> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));
  int _dir = 0;

  @override
  void didUpdateWidget(Flash old) {
    super.didUpdateWidget(old);
    if (old.value != widget.value && old.value != 0 && widget.value.isFinite) {
      _dir = widget.value > old.value ? 1 : -1;
      _c.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        final a = _c.isAnimating ? (1 - _c.value) * 0.22 : 0.0;
        return DecoratedBox(
          decoration: BoxDecoration(
            color: a > 0 ? (_dir > 0 ? k.up : k.down).withValues(alpha: a) : Colors.transparent,
            borderRadius: BorderRadius.circular(widget.radius),
          ),
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

/// A compact segmented control (web Seg) with an iOS sliding thumb: grey track, the chosen segment lifted, or filled
/// green / red when it carries a tone (Calls / Puts, Buy / Sell).
class OptSeg<V> extends StatelessWidget {
  const OptSeg({super.key, required this.values, required this.labels, required this.selected, required this.onChanged, this.tones, this.height = 30});
  final List<V> values;
  final List<String> labels;
  final V selected;
  final ValueChanged<V> onChanged;

  /// Per value: 1 up (green), -1 down (red), 0 / null neutral.
  final List<int?>? tones;
  final double height;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final index = values.indexOf(selected);
    final tone = index < 0 ? null : tones?[index];
    final thumb = tone == 1 ? k.up : (tone == -1 ? k.down : (k.dark ? k.surface3 : Colors.white));
    final fs = height <= 24 ? 10.5 : 12.0;
    return Container(
      height: height,
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(height <= 24 ? 6 : 8),
        border: Border.all(color: k.line),
      ),
      child: LayoutBuilder(
        builder: (context, c) {
          final w = c.maxWidth / values.length;
          final rtl = Directionality.of(context) == TextDirection.rtl;
          return Stack(
            children: [
              if (index >= 0)
                AnimatedPositioned(
                  duration: const Duration(milliseconds: 220),
                  curve: Curves.easeOutCubic,
                  left: (rtl ? values.length - 1 - index : index) * w,
                  top: 0,
                  bottom: 0,
                  width: w,
                  child: Container(
                    decoration: BoxDecoration(
                      color: thumb,
                      borderRadius: BorderRadius.circular(height <= 24 ? 4.5 : 6),
                      boxShadow: tone == null || tone == 0 ? const [BoxShadow(color: Color(0x22000000), offset: Offset(0, 1.5), blurRadius: 4)] : null,
                    ),
                  ),
                ),
              Row(
                children: [
                  for (var i = 0; i < values.length; i++)
                    Expanded(
                      child: Semantics(
                        button: true,
                        selected: i == index,
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () {
                            if (i == index) return;
                            KHaptics.selection();
                            onChanged(values[i]);
                          },
                          child: Center(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 4),
                              child: Text(
                                labels[i],
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: context.text.label.copyWith(
                                  fontSize: fs,
                                  fontWeight: FontWeight.w600,
                                  color: i == index ? ((tones?[i] ?? 0) != 0 ? Colors.white : k.fg) : k.fg3,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

/// A full-width row under a header (the web's `border-b px-2 py-1.5` rows): a segmented control, an extra button.
class SegRow extends StatelessWidget {
  const SegRow({super.key, required this.child, this.trailing});
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
      decoration: BoxDecoration(
        color: k.surface,
        border: Border(bottom: BorderSide(color: k.line, width: 0.6)),
      ),
      child: Row(
        children: [
          Expanded(child: child),
          if (trailing != null) ...[const SizedBox(width: 8), trailing!],
        ],
      ),
    );
  }
}

/// Full-panel state: the module is off here ("launching soon"), or the price server is down.
class OptionsUnavailable extends StatelessWidget {
  const OptionsUnavailable({super.key, required this.soon, this.onRetry, this.compact = false});
  final bool soon;
  final VoidCallback? onRetry;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final tone = soon ? k.ember : k.warn;
    return Center(
      child: SingleChildScrollView(
        padding: EdgeInsets.all(compact ? 16 : 28),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: soon ? k.emberSoft : k.warnSoft,
                  border: Border.all(color: tone.withValues(alpha: 0.3)),
                ),
                child: Icon(soon ? LucideIcons.hourglass : LucideIcons.triangleAlert, size: 20, color: tone),
              ),
              const SizedBox(height: 12),
              Text(
                soon ? t('trader.opt.soon.title') : t('trader.opt.error.title'),
                textAlign: TextAlign.center,
                style: context.text.headline.copyWith(fontSize: 14),
              ),
              const SizedBox(height: 6),
              Text(
                soon ? t('trader.opt.soon.text') : t('trader.opt.error.text'),
                textAlign: TextAlign.center,
                style: context.text.footnote.copyWith(color: k.fg3, height: 1.5),
              ),
              if (soon) ...[
                const SizedBox(height: 12),
                for (final key in const ['trader.opt.soon.point1', 'trader.opt.soon.point2', 'trader.opt.soon.point3'])
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          margin: const EdgeInsets.only(top: 6),
                          decoration: BoxDecoration(color: k.ember, shape: BoxShape.circle),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            t(key),
                            style: context.text.caption.copyWith(color: k.fg2, fontWeight: FontWeight.w400),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
              if (onRetry != null) ...[
                const SizedBox(height: 14),
                KButton(
                  label: t('trader.opt.soon.retry'),
                  icon: LucideIcons.refreshCw,
                  size: KButtonSize.sm,
                  variant: KButtonVariant.surface,
                  onPressed: onRetry,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A rejection with what to do about it; `not_eligible` reads as a friendly note with the options intro link.
class ErrorNote extends StatelessWidget {
  const ErrorNote({super.key, required this.code, this.message});
  final String code;
  final String? message;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    if (needsOnboarding(code)) {
      return Container(
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
        decoration: BoxDecoration(
          color: k.infoSoft.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: k.info.withValues(alpha: 0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(LucideIcons.bookOpen, size: 14, color: k.info),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    t('trader.opt.err.not_eligible'),
                    style: context.text.caption.copyWith(fontWeight: FontWeight.w600, color: k.fg),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              t('trader.opt.onboarding.text'),
              style: context.text.caption.copyWith(fontWeight: FontWeight.w400, color: k.fg2, height: 1.45),
            ),
            const SizedBox(height: 6),
            KPressable(
              minSize: 30,
              onTap: () => context.push('/options'),
              child: Container(
                height: 26,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                decoration: BoxDecoration(
                  color: k.surface2,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: k.info.withValues(alpha: 0.35)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      t('trader.opt.onboarding.cta'),
                      style: context.text.caption.copyWith(color: k.info, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(width: 4),
                    Icon(LucideIcons.arrowUpRight, size: 12, color: k.info),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 7, 10, 7),
      decoration: BoxDecoration(
        color: k.downSoft.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: k.down.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: Icon(LucideIcons.triangleAlert, size: 14, color: k.down),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              optionErrorText(t, code, message),
              style: context.text.caption.copyWith(color: k.down, fontWeight: FontWeight.w500, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }
}

/// Rebuilds once a second while mounted (countdowns, expiry chips).
class NowBuilder extends StatefulWidget {
  const NowBuilder({super.key, required this.builder, this.every = const Duration(seconds: 1)});
  final Widget Function(BuildContext context, int nowMs) builder;
  final Duration every;

  @override
  State<NowBuilder> createState() => _NowBuilderState();
}

class _NowBuilderState extends State<NowBuilder> {
  Timer? _t;

  @override
  void initState() {
    super.initState();
    _t = Timer.periodic(widget.every, (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, DateTime.now().millisecondsSinceEpoch);
}

/// Live countdown to an instant with a clock icon (warn under an hour).
class Countdown extends StatelessWidget {
  const Countdown({super.key, required this.toMs, this.size = 10.5});
  final int toMs;
  final double size;

  @override
  Widget build(BuildContext context) => NowBuilder(
    builder: (context, now) {
      final k = context.k;
      final left = toMs - now;
      final color = left < 3600000 && left > 0 ? k.warn : k.fg3;
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(LucideIcons.clock3, size: size + 1, color: color.withValues(alpha: 0.75)),
          const SizedBox(width: 3),
          Text(
            left <= 0 ? '0s' : countdown(toMs, now),
            textDirection: TextDirection.ltr,
            style: context.text.mono(size, color: color),
          ),
        ],
      );
    },
  );
}

/// The options stream's state as a dot (web StreamDot).
class StreamDot extends ConsumerWidget {
  const StreamDot({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final k = context.k;
    final t = context.t;
    final s = ref.watch(optionsProvider.select((x) => x.stream));
    final color = s == 'open' ? k.up : (s == 'polling' ? k.gold : (s == 'unavailable' ? k.fg3 : k.warn));
    final label = s == 'open'
        ? t('trader.opt.stream.live')
        : (s == 'polling' ? t('trader.opt.stream.polling') : (s == 'unavailable' ? t('trader.opt.stream.off') : t('trader.opt.stream.connecting')));
    return Semantics(
      label: label,
      child: Tooltip(
        message: label,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
        ),
      ),
    );
  }
}

/// "Book": prices on screen are the order book.
class BookBadge extends StatelessWidget {
  const BookBadge({super.key});

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Tooltip(
      message: context.t('trader.opt.book.badgeHint'),
      child: Container(
        height: 18,
        padding: const EdgeInsets.symmetric(horizontal: 5),
        decoration: BoxDecoration(
          color: k.infoSoft,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: k.info.withValues(alpha: 0.35)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.bookOpenText, size: 11, color: k.info),
            const SizedBox(width: 3),
            Text(context.t('trader.opt.book.badge').toUpperCase(), style: context.text.micro.copyWith(fontSize: 9.5, color: k.info, letterSpacing: 0.4)),
          ],
        ),
      ),
    );
  }
}

/// A book order's status (working, filled, …).
class OrderStatusChip extends StatelessWidget {
  const OrderStatusChip(this.status, {super.key});
  final String status;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final (Color bg, Color fg) = switch (status) {
      'working' || 'pending' => (k.infoSoft, k.info),
      'partially_filled' => (k.goldSoft, k.gold),
      'filled' => (k.upSoft, k.up),
      'rejected' => (k.downSoft, k.down),
      _ => (k.surface3, k.fg3),
    };
    return Container(
      height: 17,
      padding: const EdgeInsets.symmetric(horizontal: 5),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: fg.withValues(alpha: 0.3)),
      ),
      child: Text(
        context.t.dyn('trader.opt.ord.status.$status', fallback: status.replaceAll('_', ' ')).toUpperCase(),
        style: context.text.micro.copyWith(fontSize: 9.5, color: fg, letterSpacing: 0.4),
      ),
    );
  }
}

/// Barrier legs and house positions are priced by Kalks, not traded on the order book.
class KalksQuotedTag extends StatelessWidget {
  const KalksQuotedTag({super.key});

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      height: 16,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: k.goldSoft,
        borderRadius: BorderRadius.circular(3),
        border: Border.all(color: k.gold.withValues(alpha: 0.35)),
      ),
      child: Text(context.t('trader.opt.rfq.kalksQuoted'), style: context.text.micro.copyWith(fontSize: 9, color: k.gold)),
    );
  }
}

/// The ticket's "Kalks-quoted" note while the book is on.
class HouseRouteNote extends StatelessWidget {
  const HouseRouteNote({super.key});

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
      decoration: BoxDecoration(
        color: k.goldSoft,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: k.gold.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const KalksQuotedTag(),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              context.t('trader.opt.rfq.houseNote'),
              style: context.text.caption.copyWith(color: k.fg2, fontWeight: FontWeight.w400),
            ),
          ),
        ],
      ),
    );
  }
}

/* ---------------- explanations ---------------- */

/// A "(?)" that explains `topic` in plain words (web Explain: a bottom sheet on phones).
class Explain extends StatelessWidget {
  const Explain(this.topic, {super.key, this.size = 13});
  final String topic;
  final double size;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final title = t('trader.opt.help.$topic.title');
    return KPressable(
      minSize: 26,
      semanticLabel: '${t('trader.opt.help.what')} $title',
      onTap: () => showKSheet<void>(
        context,
        builder: (ctx) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(color: ctx.k.emberSoft, shape: BoxShape.circle),
                child: Icon(LucideIcons.circleHelp, size: 15, color: ctx.k.ember),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: ctx.text.headline),
                    const SizedBox(height: 4),
                    Text(t('trader.opt.help.$topic.text'), style: ctx.text.callout.copyWith(color: ctx.k.fg2)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      child: Icon(LucideIcons.circleHelp, size: size, color: k.fg3),
    );
  }
}

const List<String> _facts = ['trader.opt.intro.f1', 'trader.opt.intro.f2', 'trader.opt.intro.f3', 'trader.opt.intro.f4'];

/// "Options in 30 seconds": four facts, numbered.
class IntroFacts extends StatelessWidget {
  const IntroFacts({super.key});

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Column(
      children: [
        for (var i = 0; i < _facts.length; i++)
          Padding(
            padding: EdgeInsets.only(top: i == 0 ? 0 : 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 20,
                  height: 20,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: k.surface3, shape: BoxShape.circle),
                  child: Text('${i + 1}', style: context.text.mono(10.5, weight: FontWeight.w600)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(context.t(_facts[i]), style: context.text.footnote.copyWith(color: k.fg2, height: 1.4)),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// The intro is hidden once the trader tapped "Got it" (stored on the phone); "How options work" brings it back.
final introHiddenProvider = NotifierProvider<IntroHidden, bool>(IntroHidden.new);

class IntroHidden extends Notifier<bool> {
  @override
  bool build() {
    try {
      return ref.read(prefsProvider).featureJson('options.intro')?['hidden'] == true;
    } catch (_) {
      return false;
    }
  }

  void set(bool v) {
    state = v;
    try {
      unawaited(ref.read(prefsProvider).setFeatureJson('options.intro', {'hidden': v}));
    } catch (_) {
      // prefs unavailable
    }
  }
}

/// The intro as a one-line banner that opens the four facts (Quick trade, the empty ticket).
class IntroCard extends ConsumerStatefulWidget {
  const IntroCard({super.key});

  @override
  ConsumerState<IntroCard> createState() => _IntroCardState();
}

class _IntroCardState extends ConsumerState<IntroCard> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final deco = BoxDecoration(
      gradient: LinearGradient(colors: [k.ember.withValues(alpha: 0.1), k.ember.withValues(alpha: 0)], begin: Alignment.topLeft, end: Alignment.bottomRight),
      borderRadius: BorderRadius.circular(_open ? 12 : 10),
      border: Border.all(color: k.ember.withValues(alpha: 0.25)),
    );
    if (!_open) {
      return KPressable(
        minSize: 36,
        onTap: () => setState(() => _open = true),
        child: Container(
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: deco,
          child: Row(
            children: [
              Icon(LucideIcons.graduationCap, size: 16, color: k.ember),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  t('desk.opt.learn30'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.label.copyWith(color: k.fg2, fontSize: 12.5),
                ),
              ),
              Text('→', style: TextStyle(color: k.ember)),
            ],
          ),
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: deco,
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(color: k.emberSoft, shape: BoxShape.circle),
                child: Icon(LucideIcons.graduationCap, size: 16, color: k.ember),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(t('trader.opt.intro.title'), style: context.text.label.copyWith(fontWeight: FontWeight.w600)),
              ),
              KTextButton(label: t('trader.opt.intro.gotIt'), onPressed: () => ref.read(introHiddenProvider.notifier).set(true)),
            ],
          ),
          const SizedBox(height: 8),
          const IntroFacts(),
        ],
      ),
    );
  }
}

/// "How options work": the intro in a sheet (header of the workspace).
class HowItWorksButton extends ConsumerWidget {
  const HowItWorksButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    return KPressable(
      minSize: 36,
      semanticLabel: t('trader.opt.intro.how'),
      onTap: () {
        ref.read(introHiddenProvider.notifier).set(false);
        showKSheet<void>(
          context,
          title: t('trader.opt.intro.title'),
          builder: (ctx) => const Padding(padding: EdgeInsets.fromLTRB(20, 0, 20, 20), child: IntroFacts()),
        );
      },
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: k.surface2,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: k.line),
        ),
        child: Icon(LucideIcons.graduationCap, size: 16, color: k.ember),
      ),
    );
  }
}

/// The small label of a block (with an optional "(?)" and something at the end).
class OptLabel extends StatelessWidget {
  const OptLabel(this.text, {super.key, this.help, this.trailing});
  final String text;
  final Widget? help;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Row(
      children: [
        Flexible(
          child: Text(text, style: context.text.caption.copyWith(color: context.k.fg3, fontSize: 11)),
        ),
        if (help != null) ...[const SizedBox(width: 3), help!],
        if (trailing != null) ...[const Spacer(), trailing!],
      ],
    ),
  );
}

/// A rounded card on the panel colour (terminal radius).
class OptCard extends StatelessWidget {
  const OptCard({super.key, required this.child, this.padding = EdgeInsets.zero, this.color, this.border});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final Color? border;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? k.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border ?? k.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: child,
    );
  }
}

/// A small action (h 32): Close, Cancel, the chips under the ticket.
class OptSmallButton extends StatelessWidget {
  const OptSmallButton({super.key, required this.label, required this.onTap, this.icon, this.tone, this.filled = false, this.busy = false, this.trailing});
  final String label;
  final VoidCallback? onTap;
  final IconData? icon;

  /// Accent of the text and border (down for Close, ember…).
  final Color? tone;
  final bool filled;
  final bool busy;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final disabled = onTap == null || busy;
    final fg = filled ? Colors.white : (tone ?? k.fg);
    return Opacity(
      opacity: disabled ? 0.5 : 1,
      child: KPressable(
        minSize: 36,
        onTap: disabled ? null : onTap,
        child: Container(
          height: 32,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: filled ? (tone ?? k.ember) : k.surface2,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: filled ? Colors.transparent : (tone?.withValues(alpha: 0.4) ?? k.line)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[Icon(icon, size: 14, color: fg), const SizedBox(width: 5)],
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.label.copyWith(fontSize: 12, fontWeight: FontWeight.w600, color: fg),
                ),
              ),
              ?trailing,
            ],
          ),
        ),
      ),
    );
  }
}

/// Skeleton blocks while the first numbers load.
class OptSkeletonList extends StatelessWidget {
  const OptSkeletonList({super.key, this.count = 6, this.height = 46});
  final int count;
  final double height;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(10),
    child: Column(
      children: [
        for (var i = 0; i < count; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: SizedBox(height: height, child: const KSkeleton(radius: 10)),
          ),
      ],
    ),
  );
}

/// The big primary action of the ticket / Quick trade (h 40, web bg-accent-strong): the label at the start, an amount
/// chip at the end; grey while blocked.
class OptPrimaryButton extends StatelessWidget {
  const OptPrimaryButton({super.key, required this.label, required this.onTap, this.amount, this.trailingIcon, this.idle = false});
  final String label;
  final VoidCallback? onTap;
  final String? amount;
  final IconData? trailingIcon;

  /// Not ready (no side chosen): the outlined look.
  final bool idle;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final disabled = onTap == null;
    final bg = disabled ? k.surface3 : (idle ? k.surface2 : k.ember);
    final fg = disabled || idle ? k.fg3 : Colors.white;
    return KPressable(
      onTap: onTap,
      child: Container(
        height: 42,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(11),
          border: idle ? Border.all(color: k.line) : null,
          boxShadow: disabled || idle
              ? null
              : [BoxShadow(color: k.ember.withValues(alpha: 0.45), offset: const Offset(0, 8), blurRadius: 18, spreadRadius: -10)],
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.text.label.copyWith(fontSize: 13.5, fontWeight: FontWeight.w600, color: fg),
              ),
            ),
            if (amount != null) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(7)),
                child: Text(
                  amount!,
                  textDirection: TextDirection.ltr,
                  style: context.text.mono(12, weight: FontWeight.w600, color: fg),
                ),
              ),
            ],
            if (trailingIcon != null) ...[const SizedBox(width: 8), Icon(trailingIcon, size: 16, color: fg)],
          ],
        ),
      ),
    );
  }
}

/// Read-only (investor) note instead of an order button.
class ReadOnlyBox extends StatelessWidget {
  const ReadOnlyBox({super.key});

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
      decoration: BoxDecoration(
        color: k.warnSoft,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: k.warn.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(LucideIcons.lock, size: 14, color: k.warn),
          const SizedBox(width: 6),
          Expanded(
            child: Text(context.t('trader.opt.ticket.readOnly'), style: context.text.caption.copyWith(color: k.warn)),
          ),
        ],
      ),
    );
  }
}

/// A folded section ("More order options", "Details").
class Fold extends StatelessWidget {
  const Fold({super.key, required this.title, required this.open, required this.onToggle, required this.child, this.hint, this.active = false, this.badge});
  final String title;
  final String? hint;
  final bool open;
  final VoidCallback onToggle;
  final Widget child;
  final bool active;
  final Widget? badge;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      decoration: BoxDecoration(
        color: k.surface2.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: k.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KPressable(
            minSize: 36,
            pressedScale: 1,
            onTap: onToggle,
            child: SizedBox(
              height: 36,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: Row(
                  children: [
                    AnimatedRotation(
                      turns: open ? 0.25 : 0,
                      duration: const Duration(milliseconds: 160),
                      child: Icon(LucideIcons.chevronRight, size: 14, color: k.fg3),
                    ),
                    const SizedBox(width: 6),
                    Text(title, style: context.text.label.copyWith(fontSize: 12.5, color: k.fg2)),
                    if (active) ...[
                      const SizedBox(width: 6),
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(color: k.ember, shape: BoxShape.circle),
                      ),
                    ],
                    if (badge != null) ...[const SizedBox(width: 6), badge!],
                    const SizedBox(width: 8),
                    if (!open && hint != null)
                      Expanded(
                        child: Text(
                          hint!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.end,
                          style: context.text.caption.copyWith(fontSize: 10.5, color: k.fg3, fontWeight: FontWeight.w400),
                        ),
                      )
                    else
                      const Spacer(),
                  ],
                ),
              ),
            ),
          ),
          if (open)
            Container(
              padding: const EdgeInsets.fromLTRB(10, 10, 10, 10),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: k.line.withValues(alpha: 0.7))),
              ),
              child: child,
            ),
        ],
      ),
    );
  }
}

/// A checkbox row (web Check): a small square box and a label.
class OptCheck extends StatelessWidget {
  const OptCheck({super.key, required this.value, required this.onChanged, required this.label});
  final bool value;
  final ValueChanged<bool>? onChanged;
  final Widget label;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Opacity(
      opacity: onChanged == null ? 0.45 : 1,
      child: KPressable(
        minSize: 32,
        pressedScale: 1,
        onTap: onChanged == null ? null : () => onChanged!(!value),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 16,
              height: 16,
              decoration: BoxDecoration(
                color: value ? k.ember : k.surface2,
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: value ? k.ember : k.line),
              ),
              child: value ? const Icon(LucideIcons.check, size: 12, color: Colors.white) : null,
            ),
            const SizedBox(width: 6),
            DefaultTextStyle.merge(
              style: context.text.caption.copyWith(color: k.fg2),
              child: label,
            ),
          ],
        ),
      ),
    );
  }
}
