import 'package:flutter/material.dart';

import '../../i18n/i18n.dart';
import '../tokens.dart';
import '../typography.dart';
import 'frosted.dart';
import 'haptics.dart';
import 'pressable.dart';

/// A bottom sheet in the iOS style: frosted (~92 % opaque), 28 pt top corners, a grabber, drag down to close,
/// keyboard-aware. `title` adds a centred title row; the body scrolls when tall.
Future<R?> showKSheet<R>(
  BuildContext context, {
  required WidgetBuilder builder,
  String? title,
  bool expand = false,
  bool dismissible = true,
  bool useRoot = true,
}) {
  KHaptics.tap();
  final k = context.k;
  return showModalBottomSheet<R>(
    context: context,
    useRootNavigator: useRoot,
    isScrollControlled: true,
    isDismissible: dismissible,
    enableDrag: dismissible,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: k.scrim,
    elevation: 0,
    builder: (ctx) => KSheetBody(
      title: title,
      expand: expand,
      child: Builder(builder: builder),
    ),
  );
}

/// The sheet material (also usable inside a custom route).
class KSheetBody extends StatelessWidget {
  const KSheetBody({super.key, required this.child, this.title, this.expand = false});
  final Widget child;
  final String? title;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final mq = MediaQuery.of(context);
    final maxH = mq.size.height * (expand ? 0.92 : 0.88);
    return Padding(
      padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxH, minHeight: expand ? maxH : 0),
        child: KFrosted(
          color: k.sheet,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          border: Border(top: BorderSide(color: k.lineTop)),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const KGrabber(),
                if (title != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 4, 20, 10),
                    child: Text(title!, textAlign: TextAlign.center, style: context.text.title2),
                  ),
                Flexible(fit: expand ? FlexFit.tight : FlexFit.loose, child: child),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The small handle at the top of sheets.
class KGrabber extends StatelessWidget {
  const KGrabber({super.key});

  @override
  Widget build(BuildContext context) => Center(
    child: Container(
      margin: const EdgeInsets.only(top: 8, bottom: 8),
      width: 36,
      height: 5,
      decoration: BoxDecoration(color: context.k.fg3.withValues(alpha: 0.4), borderRadius: BorderRadius.circular(3)),
    ),
  );
}

/// An action of an action sheet or alert.
class KAction<V> {
  const KAction({required this.label, this.value, this.onTap, this.icon, this.destructive = false, this.primary = false});
  final String label;
  final V? value;
  final VoidCallback? onTap;
  final IconData? icon;
  final bool destructive;

  /// Bold (the alert's preferred action).
  final bool primary;
}

/// iOS action sheet: a frosted group of actions and a separate Cancel, rising from the bottom. Returns the chosen
/// action's value (null on cancel).
Future<V?> showKActionSheet<V>(BuildContext context, {String? title, String? message, required List<KAction<V>> actions}) {
  KHaptics.tap();
  final k = context.k;
  return showModalBottomSheet<V>(
    context: context,
    useRootNavigator: true,
    // long menus (an account's ⋯ menu has a dozen actions) may use most of the screen and scroll, like iOS
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: k.scrim,
    elevation: 0,
    builder: (ctx) {
      final t = ctx.t;
      final k = ctx.k;
      Widget group(List<Widget> children) => KFrosted(
        color: k.sheet,
        borderRadius: BorderRadius.circular(16),
        child: Column(mainAxisSize: MainAxisSize.min, children: children),
      );
      Widget button(String label, {required VoidCallback onTap, bool destructive = false, bool bold = false, IconData? icon}) => KPressable(
        onTap: onTap,
        pressedScale: 1,
        child: SizedBox(
          height: 56,
          width: double.infinity,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[Icon(icon, size: 18, color: destructive ? k.down : k.ember), const SizedBox(width: 8)],
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: ctx.text.body.copyWith(fontSize: 17, fontWeight: bold ? FontWeight.w600 : FontWeight.w500, color: destructive ? k.down : k.ember),
                ),
              ),
            ],
          ),
        ),
      );
      final rows = <Widget>[];
      if (title != null || message != null) {
        rows.add(
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            child: Column(
              children: [
                if (title != null)
                  Text(
                    title,
                    textAlign: TextAlign.center,
                    style: ctx.text.label.copyWith(color: k.fg2, fontWeight: FontWeight.w600),
                  ),
                if (message != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    message,
                    textAlign: TextAlign.center,
                    style: ctx.text.footnote.copyWith(color: k.fg3),
                  ),
                ],
              ],
            ),
          ),
        );
      }
      for (final a in actions) {
        if (rows.isNotEmpty) rows.add(Container(height: 0.6, color: k.line));
        rows.add(
          button(
            a.label,
            icon: a.icon,
            destructive: a.destructive,
            onTap: () {
              Navigator.of(ctx).pop(a.value);
              a.onTap?.call();
            },
          ),
        );
      }
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(ctx).height * 0.88),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: KFrosted(
                    color: k.sheet,
                    borderRadius: BorderRadius.circular(16),
                    child: SingleChildScrollView(
                      child: Column(mainAxisSize: MainAxisSize.min, children: rows),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                group([button(t('common.cancel'), bold: true, onTap: () => Navigator.of(ctx).pop())]),
              ],
            ),
          ),
        ),
      );
    },
  );
}

/// iOS alert: a centred frosted card with title, message and side-by-side (or stacked) buttons. Returns the chosen
/// action's value.
Future<V?> showKAlert<V>(BuildContext context, {required String title, String? message, Widget? content, required List<KAction<V>> actions}) {
  KHaptics.medium();
  final k = context.k;
  // the alert takes the look of the screen it opens from (Kalks Trader's theme), like sheets do
  final themes = InheritedTheme.capture(from: context, to: Navigator.of(context, rootNavigator: true).context);
  return showGeneralDialog<V>(
    context: context,
    barrierColor: k.scrim,
    transitionDuration: const Duration(milliseconds: 220),
    pageBuilder: (outer, _, _) => themes.wrap(
      Builder(
        builder: (ctx) => _alertBody<V>(ctx, title: title, message: message, content: content, actions: actions),
      ),
    ),
    transitionBuilder: (ctx, anim, _, child) {
      final curved = CurvedAnimation(parent: anim, curve: Curves.easeOutCubic);
      return FadeTransition(
        opacity: curved,
        child: ScaleTransition(scale: Tween(begin: 1.08, end: 1.0).animate(curved), child: child),
      );
    },
  );
}

Widget _alertBody<V>(BuildContext ctx, {required String title, String? message, Widget? content, required List<KAction<V>> actions}) {
  final k = ctx.k;
  final stacked = actions.length > 2;
  Widget btn(KAction<V> a) => KPressable(
    pressedScale: 1,
    onTap: () {
      Navigator.of(ctx).pop(a.value);
      a.onTap?.call();
    },
    child: SizedBox(
      height: 46,
      child: Center(
        child: Text(
          a.label,
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: ctx.text.body.copyWith(fontSize: 16, fontWeight: a.primary ? FontWeight.w600 : FontWeight.w500, color: a.destructive ? k.down : k.ember),
        ),
      ),
    ),
  );
  final buttons = <Widget>[];
  for (var i = 0; i < actions.length; i++) {
    if (i > 0) buttons.add(stacked ? Container(height: 0.6, color: k.line) : Container(width: 0.6, height: 46, color: k.line));
    buttons.add(stacked ? btn(actions[i]) : Expanded(child: btn(actions[i])));
  }
  return Center(
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 290),
      child: Material(
        type: MaterialType.transparency,
        child: KFrosted(
          color: k.sheet,
          borderRadius: BorderRadius.circular(18),
          shadows: k.shadowPop,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 20, 18, 16),
                child: Column(
                  children: [
                    Text(title, textAlign: TextAlign.center, style: ctx.text.headline.copyWith(fontSize: 16.5)),
                    if (message != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        message,
                        textAlign: TextAlign.center,
                        style: ctx.text.footnote.copyWith(color: k.fg2, fontSize: 13),
                      ),
                    ],
                    if (content != null) ...[const SizedBox(height: 12), content],
                  ],
                ),
              ),
              Container(height: 0.6, color: k.line),
              if (stacked) ...buttons else Row(children: buttons),
            ],
          ),
        ),
      ),
    ),
  );
}
