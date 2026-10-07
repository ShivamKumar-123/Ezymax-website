import 'package:flutter/widgets.dart';

import 'haptics.dart';

/// The iOS press feedback used by every tappable control: a quick dim and a slight scale on touch-down, a light
/// haptic on tap. No Material ripple. `minSize` grows the hit area (not the look) to the 44 pt touch target.
class KPressable extends StatefulWidget {
  const KPressable({
    super.key,
    required this.child,
    required this.onTap,
    this.onLongPress,
    this.haptic = true,
    this.pressedOpacity = 0.6,
    this.pressedScale = 0.98,
    this.minSize = 44,
    this.semanticLabel,
    this.behavior = HitTestBehavior.opaque,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final bool haptic;
  final double pressedOpacity;
  final double pressedScale;
  final double minSize;
  final String? semanticLabel;
  final HitTestBehavior behavior;

  @override
  State<KPressable> createState() => _KPressableState();
}

class _KPressableState extends State<KPressable> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v && mounted) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null || widget.onLongPress != null;
    Widget body = AnimatedOpacity(
      duration: Duration(milliseconds: _down ? 60 : 160),
      opacity: _down ? widget.pressedOpacity : 1,
      child: AnimatedScale(
        duration: Duration(milliseconds: _down ? 60 : 200),
        curve: Curves.easeOutCubic,
        scale: _down ? widget.pressedScale : 1,
        child: widget.child,
      ),
    );
    body = GestureDetector(
      behavior: widget.behavior,
      onTapDown: enabled ? (_) => _set(true) : null,
      onTapUp: enabled ? (_) => _set(false) : null,
      onTapCancel: enabled ? () => _set(false) : null,
      onTap: widget.onTap == null
          ? null
          : () {
              if (widget.haptic) KHaptics.tap();
              widget.onTap!();
            },
      onLongPress: widget.onLongPress,
      child: ConstrainedBox(
        constraints: BoxConstraints(minWidth: widget.minSize, minHeight: widget.minSize),
        child: Center(widthFactor: 1, heightFactor: 1, child: body),
      ),
    );
    return Semantics(button: true, enabled: enabled, label: widget.semanticLabel, child: body);
  }
}
