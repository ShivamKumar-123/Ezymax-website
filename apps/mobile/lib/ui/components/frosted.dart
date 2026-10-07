import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../tokens.dart';

/// iOS material: a blurred, saturated backdrop under a ~90 % opaque fill. Blurred, never see-through (founder rule).
/// Used by the header, the tab bar, sheets, banners and the action sheet.
class KFrosted extends StatelessWidget {
  const KFrosted({super.key, required this.child, this.color, this.borderRadius = BorderRadius.zero, this.border, this.blur = 24, this.shadows});

  final Widget child;

  /// The fill (defaults to the theme's bar material).
  final Color? color;
  final BorderRadius borderRadius;
  final BoxBorder? border;
  final double blur;
  final List<BoxShadow>? shadows;

  /// saturate(1.5), like the web's backdrop-filter.
  static const List<double> _saturate = [
    1.3936, -0.3576, -0.036, 0, 0, //
    -0.1064, 1.1424, -0.036, 0, 0, //
    -0.1064, -0.3576, 1.464, 0, 0, //
    0, 0, 0, 1, 0,
  ];

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final filter = ui.ImageFilter.compose(
      outer: ui.ImageFilter.blur(sigmaX: blur / 2, sigmaY: blur / 2, tileMode: TileMode.mirror),
      inner: const ui.ColorFilter.matrix(_saturate),
    );
    Widget body = ClipRRect(
      borderRadius: borderRadius,
      child: BackdropFilter(
        filter: filter,
        child: DecoratedBox(
          decoration: BoxDecoration(color: color ?? k.bar, borderRadius: borderRadius, border: border),
          child: child,
        ),
      ),
    );
    if (shadows != null) {
      body = DecoratedBox(
        decoration: BoxDecoration(borderRadius: borderRadius, boxShadow: shadows),
        child: body,
      );
    }
    return body;
  }
}
