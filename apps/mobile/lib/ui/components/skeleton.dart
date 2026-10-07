import 'package:flutter/material.dart';

import '../tokens.dart';

/// Loading placeholder with a soft shimmer (web Skeleton). Shape it like the content it stands for.
class KSkeleton extends StatefulWidget {
  const KSkeleton({super.key, this.width, this.height = 14, this.radius = 8, this.circle = false});
  final double? width;
  final double height;
  final double radius;
  final bool circle;

  /// A block of text lines.
  static Widget lines(int n, {double height = 12, double gap = 8, double lastWidthFactor = 0.6}) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    mainAxisSize: MainAxisSize.min,
    children: [
      for (var i = 0; i < n; i++) ...[
        if (i > 0) SizedBox(height: gap),
        FractionallySizedBox(
          widthFactor: i == n - 1 && n > 1 ? lastWidthFactor : 1,
          child: KSkeleton(height: height),
        ),
      ],
    ],
  );

  @override
  State<KSkeleton> createState() => _KSkeletonState();
}

class _KSkeletonState extends State<KSkeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final base = k.surface3;
    final hi = Color.lerp(base, k.dark ? Colors.white : Colors.white, k.dark ? 0.06 : 0.55)!;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final x = -1.5 + 3 * _c.value;
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            shape: widget.circle ? BoxShape.circle : BoxShape.rectangle,
            borderRadius: widget.circle ? null : BorderRadius.circular(widget.radius),
            gradient: LinearGradient(begin: Alignment(x - 1, 0), end: Alignment(x + 1, 0), colors: [base, hi, base], stops: const [0.25, 0.5, 0.75]),
          ),
        );
      },
    );
  }
}
