import 'package:flutter/material.dart';

import '../tokens.dart';

/// The pastel washes behind every Client Area page (web .k-backdrop): five soft radial gradients mixed from the
/// brand colour over the page background. The terminal gets its subtle ember glow (.t-backdrop) instead.
class KBackdrop extends StatelessWidget {
  const KBackdrop({super.key});

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return RepaintBoundary(
      child: CustomPaint(painter: _WashPainter(k), size: Size.infinite),
    );
  }
}

class _WashPainter extends CustomPainter {
  _WashPainter(this.k);
  final KTokens k;

  /// `radial-gradient(<rx>vw <ry>vh at <x>% <y>%, colour, transparent <stop>%)`
  void _wash(Canvas canvas, Size s, double rx, double ry, double x, double y, Color c, double stop) {
    final center = Offset(s.width * x, s.height * y);
    final r = Size(s.width * rx, s.height * ry);
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.scale(1, r.height / r.width);
    final paint = Paint()
      ..shader = RadialGradient(colors: [c, c.withValues(alpha: 0)], stops: [0, stop]).createShader(Rect.fromCircle(center: Offset.zero, radius: r.width));
    canvas.drawCircle(Offset.zero, r.width, paint);
    canvas.restore();
  }

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = k.bg);
    if (k.trader) {
      _wash(canvas, size, 1.4, 0.6, 0.12, -0.12, k.wash1, 0.62);
      _wash(canvas, size, 1.0, 0.7, 1.0, 0.0, k.wash2, 0.6);
      return;
    }
    _wash(canvas, size, 0.55, 0.48, 0.06, -0.06, k.wash1, 0.70);
    _wash(canvas, size, 0.48, 0.52, 1.00, 0.04, k.wash3, 0.72);
    _wash(canvas, size, 0.60, 0.56, 0.72, 1.04, k.wash2, 0.70);
    _wash(canvas, size, 0.42, 0.48, -0.04, 0.92, k.wash3, 0.72);
    _wash(canvas, size, 0.36, 0.36, 0.44, 0.46, k.wash1.withValues(alpha: k.wash1.a * 0.45), 0.75);
  }

  @override
  bool shouldRepaint(_WashPainter old) => old.k != k;
}
