// What the shell's chrome (app_shell.dart) and the module pager (module_pager.dart) share: the header's height for
// pages that size themselves, the pager's live slide for the Dashboard's hero chrome, and the scroll of the page in
// front of a pager, which the shell follows like a plain page's own scroll.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The shell's header over the page: status bar, the demo strip, the header row and the module's page tabs. A page
/// gets it as MediaQuery.padding.top from the shell; the module pager asks here because the shell hands its branch one
/// padding (none while the Dashboard's picture shows) and the pages beside the picture need the header's.
double shellHeaderHeight(BuildContext context) => ShellInsets.maybeOf(context)?.headerHeight ?? MediaQuery.paddingOf(context).top;

/// Set by the shell around its branches: the header's height, one formula (the shell's), for [shellHeaderHeight].
class ShellInsets extends InheritedWidget {
  const ShellInsets({super.key, required this.headerHeight, required super.child});
  final double headerHeight;

  static ShellInsets? maybeOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<ShellInsets>();

  @override
  bool updateShouldNotify(ShellInsets old) => old.headerHeight != headerHeight;
}

/// How far the module pager on screen has slid from its first page, in pages (0 the first page, 1 the second, …),
/// live under a finger. The shell's hero chrome collapses as soon as the Dashboard's picture starts to leave (> 0.02)
/// and keeps the hero treatment while the picture is still partly on screen (< 1).
final modulePagerOffsetProvider = Provider<ValueNotifier<double>>((ref) {
  final n = ValueNotifier<double>(0);
  ref.onDispose(n.dispose);
  return n;
});

/// The vertical scroll of the page in front of the module pager. The shell's own listeners only take a page's scroll
/// at depth 0, and inside the pager a page's scroll bubbles up through the pager's viewport; so the pager sends the
/// page in front's scroll again from its own place in the tree (and once more when another page comes in front).
/// It names the page: the shell's own path is a build behind when a finger has just moved the page.
class ModulePageScrollNotification extends Notification {
  const ModulePageScrollNotification(this.path, this.metrics);

  /// The web path of the page the scroll belongs to.
  final String path;
  final ScrollMetrics metrics;
}
