import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../tokens.dart';
import '../typography.dart';

/// A labelled text field (web Field + Input): label above, 44 pt field with a leading icon, ember focus ring, the
/// error under it. `hint` sits next to the label (e.g. "Forgot password?").
class KTextField extends StatefulWidget {
  const KTextField({
    super.key,
    this.label,
    this.hint,
    this.placeholder,
    this.controller,
    this.leading,
    this.leadingText,
    this.trailing,
    this.error,
    this.obscure = false,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.onChanged,
    this.onSubmitted,
    this.autofocus = false,
    this.enabled = true,
    this.ltr = false,
    this.focusNode,
    this.inputFormatters,
    this.textCapitalization = TextCapitalization.none,
    this.readOnly = false,
    this.onTap,
  });

  final String? label;
  final Widget? hint;
  final String? placeholder;
  final TextEditingController? controller;
  final IconData? leading;

  /// Text in front of the input (a phone dial code).
  final String? leadingText;
  final Widget? trailing;
  final String? error;
  final bool obscure;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final bool autofocus;
  final bool enabled;

  /// Always left-to-right (emails, phone numbers, addresses), also in Arabic.
  final bool ltr;
  final FocusNode? focusNode;
  final List<TextInputFormatter>? inputFormatters;
  final TextCapitalization textCapitalization;
  final bool readOnly;
  final VoidCallback? onTap;

  @override
  State<KTextField> createState() => _KTextFieldState();
}

class _KTextFieldState extends State<KTextField> {
  late final FocusNode _focus = widget.focusNode ?? FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(_onFocus);
  }

  void _onFocus() => setState(() {});

  @override
  void dispose() {
    _focus.removeListener(_onFocus);
    if (widget.focusNode == null) _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final focused = _focus.hasFocus;
    final hasError = widget.error != null && widget.error!.isNotEmpty;
    final borderColor = hasError ? k.down.withValues(alpha: 0.6) : (focused ? k.ember.withValues(alpha: 0.55) : k.line);
    final field = AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      height: KSize.field,
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor),
        boxShadow: focused ? [BoxShadow(color: (hasError ? k.down : k.ember).withValues(alpha: 0.1), spreadRadius: 4)] : null,
      ),
      child: Row(
        children: [
          if (widget.leading != null)
            Padding(
              padding: const EdgeInsetsDirectional.only(start: 13),
              child: Icon(widget.leading, size: 17, color: k.fg3),
            ),
          if (widget.leadingText != null)
            Padding(
              padding: const EdgeInsetsDirectional.only(start: 13),
              child: Text(
                widget.leadingText!,
                textDirection: TextDirection.ltr,
                style: context.text.callout.copyWith(color: k.fg2, fontFeatures: kTabular),
              ),
            ),
          Expanded(
            child: TextField(
              controller: widget.controller,
              focusNode: _focus,
              obscureText: widget.obscure,
              keyboardType: widget.keyboardType,
              textInputAction: widget.textInputAction,
              autofillHints: widget.autofillHints,
              onChanged: widget.onChanged,
              onSubmitted: widget.onSubmitted,
              autofocus: widget.autofocus,
              enabled: widget.enabled,
              readOnly: widget.readOnly,
              onTap: widget.onTap,
              inputFormatters: widget.inputFormatters,
              textCapitalization: widget.textCapitalization,
              autocorrect: false,
              enableSuggestions: !widget.obscure && widget.keyboardType != TextInputType.emailAddress,
              textDirection: widget.ltr ? TextDirection.ltr : null,
              style: context.text.body.copyWith(fontSize: 14.5),
              cursorColor: k.ember,
              decoration: InputDecoration(
                isCollapsed: true,
                border: InputBorder.none,
                hintText: widget.placeholder,
                hintStyle: context.text.body.copyWith(fontSize: 14.5, color: k.fg3),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              ),
            ),
          ),
          if (widget.trailing != null) Padding(padding: const EdgeInsetsDirectional.only(end: 4), child: widget.trailing!),
        ],
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.label != null || widget.hint != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              children: [
                if (widget.label != null)
                  Expanded(
                    child: Text(widget.label!, style: context.text.label.copyWith(color: k.fg2)),
                  ),
                ?widget.hint,
              ],
            ),
          ),
        field,
        if (hasError)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(widget.error!, style: context.text.footnote.copyWith(color: k.down)),
          ),
      ],
    );
  }
}

/// The 6-digit code input (web OtpInput): six boxes over one hidden field, so typing, pasting and the keyboard's
/// one-time-code suggestion all work. Calls `onCompleted` on the sixth digit.
class KOtpField extends StatefulWidget {
  const KOtpField({super.key, this.length = 6, required this.onCompleted, this.onChanged, this.autofocus = true, this.semanticLabel});
  final int length;
  final ValueChanged<String> onCompleted;
  final ValueChanged<String>? onChanged;
  final bool autofocus;
  final String? semanticLabel;

  @override
  State<KOtpField> createState() => _KOtpFieldState();
}

class _KOtpFieldState extends State<KOtpField> {
  final _c = TextEditingController();
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _c.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _changed(String v) {
    final digits = v.replaceAll(RegExp(r'\D'), '');
    final clipped = digits.length > widget.length ? digits.substring(0, widget.length) : digits;
    if (clipped != v) {
      _c.value = TextEditingValue(
        text: clipped,
        selection: TextSelection.collapsed(offset: clipped.length),
      );
    }
    setState(() {});
    widget.onChanged?.call(clipped);
    if (clipped.length == widget.length) widget.onCompleted(clipped);
  }

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final v = _c.text;
    return Directionality(
      textDirection: TextDirection.ltr,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _focus.requestFocus,
        child: Stack(
          children: [
            Opacity(
              opacity: 0,
              child: SizedBox(
                height: 56,
                child: TextField(
                  controller: _c,
                  focusNode: _focus,
                  autofocus: widget.autofocus,
                  keyboardType: TextInputType.number,
                  autofillHints: const [AutofillHints.oneTimeCode],
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  showCursor: false,
                  enableInteractiveSelection: true,
                  onChanged: _changed,
                  decoration: const InputDecoration(border: InputBorder.none, counterText: ''),
                ),
              ),
            ),
            IgnorePointer(
              child: Semantics(
                label: widget.semanticLabel,
                value: v,
                child: Row(
                  children: [
                    for (var i = 0; i < widget.length; i++) ...[
                      if (i > 0) const SizedBox(width: 8),
                      Expanded(
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 140),
                          height: 56,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: k.surface2,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: _focus.hasFocus && i == v.length.clamp(0, widget.length - 1)
                                  ? k.ember.withValues(alpha: 0.6)
                                  : (i < v.length ? k.fg3.withValues(alpha: 0.35) : k.line),
                            ),
                          ),
                          child: Text(i < v.length ? v[i] : '', style: context.text.mono(20, weight: FontWeight.w600)),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The inline error banner of forms (web FormError).
class KFormError extends StatelessWidget {
  const KFormError(this.message, {super.key});
  final String? message;

  @override
  Widget build(BuildContext context) {
    if (message == null || message!.isEmpty) return const SizedBox.shrink();
    final k = context.k;
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: k.downSoft,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: k.down.withValues(alpha: 0.25)),
        ),
        child: Text(message!, style: context.text.footnote.copyWith(color: k.down, fontSize: 13)),
      ),
    );
  }
}

/// A checkbox row with wrapping text (terms, marketing consent).
class KCheckRow extends StatelessWidget {
  const KCheckRow({super.key, required this.value, required this.onChanged, required this.child});
  final bool value;
  final ValueChanged<bool> onChanged;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => onChanged(!value),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: 20,
              height: 20,
              margin: const EdgeInsets.only(top: 1),
              decoration: BoxDecoration(
                color: value ? k.ember : k.surface2,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: value ? k.ember : k.fg3.withValues(alpha: 0.5)),
              ),
              child: value ? Icon(Icons.check_rounded, size: 14, color: k.onEmber) : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: DefaultTextStyle.merge(
                style: context.text.footnote.copyWith(color: k.fg2, height: 1.5),
                child: child,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
