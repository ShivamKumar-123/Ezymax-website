import 'package:flutter/cupertino.dart';

import '../tokens.dart';
import 'haptics.dart';

/// A page body that scrolls under the frosted header and tab bar (their heights come in as MediaQuery padding from
/// the shell), with iOS pull-to-refresh. Use it for every Client Area page so spacing stays the same everywhere.
class KPageScroll extends StatelessWidget {
  const KPageScroll({
    super.key,
    required this.children,
    this.onRefresh,
    this.padding = const EdgeInsets.fromLTRB(KSpace.page, 12, KSpace.page, 24),
    this.controller,
  });

  /// The page's blocks, top to bottom (the web's section order).
  final List<Widget> children;

  /// Pull to refresh (reload the page's data); null disables it.
  final Future<void> Function()? onRefresh;
  final EdgeInsets padding;
  final ScrollController? controller;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.paddingOf(context);
    return CustomScrollView(
      controller: controller,
      slivers: [
        SliverPadding(padding: EdgeInsets.only(top: mq.top)),
        if (onRefresh != null)
          CupertinoSliverRefreshControl(
            onRefresh: () async {
              KHaptics.medium();
              await onRefresh!();
            },
            builder: (context, mode, pulled, trigger, indicator) => Center(
              child: Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Opacity(
                  opacity: (pulled / trigger).clamp(0.0, 1.0),
                  child: CupertinoActivityIndicator(
                    color: context.k.fg3,
                    animating: mode == RefreshIndicatorMode.refresh || mode == RefreshIndicatorMode.armed,
                  ),
                ),
              ),
            ),
          ),
        SliverPadding(
          padding: padding.copyWith(bottom: padding.bottom + mq.bottom),
          sliver: SliverList.list(children: children),
        ),
      ],
    );
  }
}
