// Small building blocks of the API & Algo pages (web kit pieces the app's design system doesn't have): symbol
// avatar, code block with copy, multi-line monospace field, compact number field, stat tiles, pill choices, a date
// field, status chips and the toasts of the algo actions (web algoError: title + the server's message).
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/notifications/notifications.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';

/* ------------------------------------------------------------------ toasts */

void algoOk(WidgetRef ref, String title, {String? description, NotificationKind kind = NotificationKind.success}) {
  if (kind == NotificationKind.success) KHaptics.success();
  ref.read(notificationsProvider.notifier).toast(kind, title, description: description);
}

/// web algoError(title, e): the action's failure title and the reason.
void algoFail(WidgetRef ref, T t, String title, Object e) {
  KHaptics.error();
  ref.read(notificationsProvider.notifier).toast(NotificationKind.error, title, description: errorText(e, t));
}

/* ------------------------------------------------------------------ symbol avatar */

const Map<String, String> _ccyCountry = {'EUR': 'eu', 'USD': 'us', 'GBP': 'gb', 'JPY': 'jp', 'CHF': 'ch', 'AUD': 'au', 'CAD': 'ca', 'NZD': 'nz'};

/// The instrument's round avatar (web SymbolAvatar): the base currency's flag, a coin logo, or a tinted monogram
/// (metals, indices, energies).
class SymbolAvatar extends StatelessWidget {
  const SymbolAvatar(this.symbol, {super.key, this.size = 20});
  final String symbol;
  final double size;

  static const _coins = ['BTC', 'ETH', 'SOL', 'XRP', 'LTC', 'ADA', 'DOGE', 'BNB', 'DOT', 'AVAX', 'LINK', 'TRX', 'MATIC'];

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final s = symbol.toUpperCase();
    for (final c in _coins) {
      if (s.startsWith(c)) return KCoinIcon(c, size: size);
    }
    if (s.length == 6 && _ccyCountry.containsKey(s.substring(0, 3)) && _ccyCountry.containsKey(s.substring(3))) {
      return KFlag(_ccyCountry[s.substring(0, 3)]!, size: size);
    }
    final metal = s.startsWith('XAU') ? 'Au' : (s.startsWith('XAG') ? 'Ag' : null);
    final (bg, fg) = metal != null ? (k.goldSoft, k.gold) : (k.surface3, k.fg2);
    final text = metal ?? (s.isEmpty ? '?' : s.substring(0, s.length < 2 ? s.length : 2));
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
      child: Text(
        text,
        style: context.text.micro.copyWith(fontSize: size * 0.42, color: fg, height: 1),
      ),
    );
  }
}

/* ------------------------------------------------------------------ code */

/// A `<pre>` block: monospace, left to right, scrolls sideways, with a copy button (web Code / pre + CopyButton).
class CodeBlock extends StatelessWidget {
  const CodeBlock(this.code, {super.key, this.lang, this.copy = true, this.color, this.fontSize = 11.5});
  final String code;
  final String? lang;
  final bool copy;
  final Color? color;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      decoration: BoxDecoration(
        color: k.dark ? Colors.black.withValues(alpha: 0.3) : k.surface2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: k.line),
      ),
      child: Stack(
        children: [
          Directionality(
            textDirection: TextDirection.ltr,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.fromLTRB(12, 12, copy ? 44 : 12, 12),
              child: SelectableText(code, style: context.text.mono(fontSize, color: color ?? k.fg2).copyWith(height: 1.5)),
            ),
          ),
          if (copy || lang != null)
            PositionedDirectional(
              top: 0,
              end: 0,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (lang != null) Text(lang!, style: context.text.caption.copyWith(color: k.fg3)),
                  if (copy) CopyIcon(code, label: context.t('developer.docs.code')),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// A small copy button (web CopyButton).
class CopyIcon extends StatelessWidget {
  const CopyIcon(this.value, {super.key, this.label});
  final String value;
  final String? label;

  @override
  Widget build(BuildContext context) => KPressable(
    semanticLabel: label ?? context.t('common.copy'),
    minSize: 40,
    onTap: () => kCopy(context, value),
    child: Icon(LucideIcons.copy, size: 15, color: context.k.fg3),
  );
}

/// A multi-line monospace input (JSON, IP lists, strategy code), left to right.
class CodeField extends StatefulWidget {
  const CodeField({
    super.key,
    this.controller,
    this.initial,
    this.onChanged,
    this.minLines = 2,
    this.maxLines = 8,
    this.placeholder,
    this.label,
    this.hint,
    this.mono = true,
    this.ltr = true,
    this.lineNumbers = false,
    this.errorLines = const {},
    this.semanticLabel,
    this.maxLength,
  });
  final TextEditingController? controller;
  final String? initial;
  final ValueChanged<String>? onChanged;
  final int minLines, maxLines;
  final String? placeholder, label, semanticLabel;
  final Widget? hint;
  final bool mono, ltr, lineNumbers;
  final Set<int> errorLines;
  final int? maxLength;

  @override
  State<CodeField> createState() => _CodeFieldState();
}

class _CodeFieldState extends State<CodeField> {
  late final TextEditingController _c = widget.controller ?? TextEditingController(text: widget.initial ?? '');
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    if (widget.controller == null) _c.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final style = widget.mono ? context.text.mono(12.5, color: k.fg).copyWith(height: 1.6) : context.text.body.copyWith(fontSize: 14, height: 1.45);
    final field = TextField(
      controller: _c,
      focusNode: _focus,
      onChanged: (v) {
        if (widget.lineNumbers) setState(() {});
        widget.onChanged?.call(v);
      },
      minLines: widget.minLines,
      maxLines: widget.maxLines,
      maxLength: widget.maxLength,
      keyboardType: TextInputType.multiline,
      autocorrect: !widget.mono,
      enableSuggestions: !widget.mono,
      textDirection: widget.ltr ? TextDirection.ltr : null,
      style: style,
      cursorColor: k.ember,
      decoration: InputDecoration(
        isCollapsed: true,
        border: InputBorder.none,
        counterText: '',
        hintText: widget.placeholder,
        hintStyle: style.copyWith(color: k.fg3),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      ),
    );
    final lines = '\n'.allMatches(_c.text).length + 1;
    final box = AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _focus.hasFocus ? k.ember.withValues(alpha: 0.55) : k.line),
      ),
      child: widget.lineNumbers
          ? Directionality(
              textDirection: TextDirection.ltr,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 34,
                    padding: const EdgeInsets.only(top: 11, bottom: 11, right: 6),
                    decoration: BoxDecoration(
                      border: Border(right: BorderSide(color: k.line)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        for (var i = 1; i <= lines; i++)
                          Text(
                            '$i',
                            style: style.copyWith(color: widget.errorLines.contains(i) ? k.down : k.fg3, fontSize: 11),
                            strutStyle: StrutStyle.fromTextStyle(style),
                          ),
                      ],
                    ),
                  ),
                  Expanded(child: field),
                ],
              ),
            )
          : field,
    );
    return Semantics(
      label: widget.semanticLabel,
      textField: true,
      child: Column(
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
          box,
        ],
      ),
    );
  }
}

/// A compact number input (web NumInput): keeps what is typed, reports parsed values (>= min).
class NumField extends StatefulWidget {
  const NumField({super.key, required this.value, required this.onChanged, this.min, this.suffix, this.width = 72, this.semanticLabel, this.integer = false});
  final double value;
  final ValueChanged<double> onChanged;
  final double? min;
  final String? suffix;
  final double width;
  final String? semanticLabel;
  final bool integer;

  @override
  State<NumField> createState() => _NumFieldState();
}

String numText(double v) => v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();

class _NumFieldState extends State<NumField> {
  late final TextEditingController _c = TextEditingController(text: numText(widget.value));
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() {
      if (!_focus.hasFocus) _c.text = numText(widget.value);
      setState(() {});
    });
  }

  @override
  void didUpdateWidget(NumField old) {
    super.didUpdateWidget(old);
    if (!_focus.hasFocus && old.value != widget.value) _c.text = numText(widget.value);
  }

  @override
  void dispose() {
    _c.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: widget.width,
          height: 34,
          decoration: BoxDecoration(
            color: k.surface2,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: _focus.hasFocus ? k.ember.withValues(alpha: 0.55) : k.line),
          ),
          child: Semantics(
            label: widget.semanticLabel,
            child: TextField(
              controller: _c,
              focusNode: _focus,
              textAlign: TextAlign.center,
              textDirection: TextDirection.ltr,
              keyboardType: TextInputType.numberWithOptions(decimal: !widget.integer, signed: widget.min == null || widget.min! < 0),
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(widget.integer ? r'[0-9-]' : r'[0-9.,-]'))],
              style: context.text.mono(13, color: k.fg),
              cursorColor: k.ember,
              decoration: const InputDecoration(isCollapsed: true, border: InputBorder.none, contentPadding: EdgeInsets.symmetric(horizontal: 6, vertical: 9)),
              onChanged: (s) {
                final n = double.tryParse(s.replaceAll(',', '.'));
                if (n == null || !n.isFinite) return;
                var v = widget.min != null && n < widget.min! ? widget.min! : n;
                if (widget.integer) v = v.roundToDouble();
                widget.onChanged(v);
              },
            ),
          ),
        ),
        if (widget.suffix != null) ...[const SizedBox(width: 6), Text(widget.suffix!, style: context.text.footnote.copyWith(color: k.fg3))],
      ],
    );
  }
}

/* ------------------------------------------------------------------ tiles, pills, labels */

/// A small label / value tile (web rounded-[12px] bg-surface-2/60 px-3 py-2.5).
class MiniTile extends StatelessWidget {
  const MiniTile({super.key, required this.label, required this.value, this.color, this.sub, this.big = false});
  final String label, value;
  final String? sub;
  final Color? color;
  final bool big;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: k.surface2.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textDirection: TextDirection.ltr,
            style: context.text.figure.copyWith(fontSize: big ? 17 : 14.5, color: color ?? k.fg),
          ),
          if (sub != null) ...[
            const SizedBox(height: 2),
            Text(
              sub!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
            ),
          ],
        ],
      ),
    );
  }
}

/// Tiles in a grid of `columns` (2 on phones).
class TileGrid extends StatelessWidget {
  const TileGrid({super.key, required this.children, this.columns = 2, this.gap = 8});
  final List<Widget> children;
  final int columns;
  final double gap;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += columns) {
      if (i > 0) rows.add(SizedBox(height: gap));
      rows.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var j = 0; j < columns; j++) ...[
                if (j > 0) SizedBox(width: gap),
                Expanded(child: i + j < children.length ? children[i + j] : const SizedBox.shrink()),
              ],
            ],
          ),
        ),
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: rows);
  }
}

/// Pills that wrap, one (or several) selected (web rounded-full pickers: accounts, expiry, groups, days).
class PillChoice<V> extends StatelessWidget {
  const PillChoice({super.key, required this.values, required this.labels, required this.isSelected, required this.onTap, this.dashed});
  final List<V> values;
  final List<String> labels;
  final bool Function(V v) isSelected;
  final ValueChanged<V> onTap;

  /// A trailing dashed "+ add" pill.
  final ({String label, VoidCallback onTap})? dashed;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (var i = 0; i < values.length; i++)
          KPressable(
            pressedScale: 0.96,
            onTap: () {
              KHaptics.selection();
              onTap(values[i]);
            },
            child: Container(
              height: 32,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: isSelected(values[i]) ? k.emberSoft : Colors.transparent,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: isSelected(values[i]) ? k.ember.withValues(alpha: 0.4) : k.line),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [Text(labels[i], style: context.text.label.copyWith(fontSize: 12.5, color: isSelected(values[i]) ? k.ember : k.fg2))],
              ),
            ),
          ),
        if (dashed != null) DashedPill(label: dashed!.label, onTap: dashed!.onTap),
      ],
    );
  }
}

/// The dashed "+ Add …" pill.
class DashedPill extends StatelessWidget {
  const DashedPill({super.key, required this.label, required this.onTap, this.icon = LucideIcons.plus});
  final String label;
  final VoidCallback onTap;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return KPressable(
      pressedScale: 0.96,
      onTap: onTap,
      child: Container(
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: k.fg3.withValues(alpha: 0.45)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: k.fg2),
            const SizedBox(width: 5),
            Text(label, style: context.text.label.copyWith(fontSize: 12.5, color: k.fg2)),
          ],
        ),
      ),
    );
  }
}

/// A grey field label (web text-fg-3 above an input).
class FieldLabel extends StatelessWidget {
  const FieldLabel(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Row(
      children: [
        Expanded(
          child: Text(text, style: context.text.label.copyWith(color: context.k.fg2)),
        ),
        ?trailing,
      ],
    ),
  );
}

/// The small uppercase section label (web .k-label).
class SmallLabel extends StatelessWidget {
  const SmallLabel(this.text, {super.key, this.color});
  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) => Text(text.toUpperCase(), style: context.text.micro.copyWith(color: color ?? context.k.fg3, letterSpacing: 0.6));
}

/// A label / control row with a hairline under it (web builder Row; settings rows).
class SettingRow extends StatelessWidget {
  const SettingRow({super.key, required this.label, this.hint, required this.child, this.last = false});
  final String label;
  final String? hint;
  final Widget child;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        border: last ? null : Border(bottom: BorderSide(color: k.line, width: 0.6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(label, style: context.text.callout.copyWith(color: k.fg)),
          if (hint != null)
            Text(
              hint!,
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
            ),
          const SizedBox(height: 8),
          Align(alignment: AlignmentDirectional.centerStart, child: child),
        ],
      ),
    );
  }
}

/// A picker button that looks like the web's chip menus (value + chevron).
class MenuChip extends StatelessWidget {
  const MenuChip({super.key, required this.label, required this.onTap, this.tone = KChipTone.neutral, this.leading, this.mono = false});
  final String label;
  final VoidCallback? onTap;
  final KChipTone tone;
  final Widget? leading;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, border) = context.k.chip(tone);
    final style = mono ? context.text.mono(12, color: fg) : context.text.label.copyWith(color: fg, fontSize: 13);
    return KPressable(
      onTap: onTap,
      pressedScale: 0.97,
      child: Container(
        height: 32,
        padding: const EdgeInsetsDirectional.only(start: 10, end: 8),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (leading != null) ...[leading!, const SizedBox(width: 6)],
            Flexible(
              child: Text(label, style: style, maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
            const SizedBox(width: 4),
            Icon(LucideIcons.chevronDown, size: 13, color: fg.withValues(alpha: 0.6)),
          ],
        ),
      ),
    );
  }
}

/* ------------------------------------------------------------------ dates */

String isoDay(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// A date input (web <input type="date">) opening an iOS date wheel in a sheet.
class DateField extends StatelessWidget {
  const DateField({super.key, required this.label, required this.value, required this.onChanged, this.min, this.max});
  final String label;
  final String value;
  final ValueChanged<String> onChanged;
  final String? min, max;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 4),
        KPressable(
          pressedScale: 1,
          semanticLabel: label,
          onTap: () async {
            var picked = DateTime.tryParse(value) ?? DateTime.now();
            final ok = await showKSheet<bool>(
              context,
              title: label,
              builder: (ctx) => KSheetContent(
                footer: KButton(label: ctx.t('common.done'), expand: true, size: KButtonSize.lg, onPressed: () => Navigator.of(ctx).pop(true)),
                children: [
                  SizedBox(
                    height: 200,
                    child: CupertinoDatePicker(
                      mode: CupertinoDatePickerMode.date,
                      initialDateTime: picked,
                      minimumDate: min == null ? null : DateTime.tryParse(min!),
                      maximumDate: max == null ? null : DateTime.tryParse(max!),
                      onDateTimeChanged: (d) => picked = d,
                    ),
                  ),
                ],
              ),
            );
            if (ok == true) onChanged(isoDay(picked));
          },
          child: Container(
            height: 40,
            padding: const EdgeInsets.symmetric(horizontal: 11),
            decoration: BoxDecoration(
              color: k.surface2,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: k.line),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    value,
                    textDirection: TextDirection.ltr,
                    style: context.text.mono(13, color: k.fg),
                  ),
                ),
                Icon(LucideIcons.calendar, size: 15, color: k.fg3),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/* ------------------------------------------------------------------ status chips */

/// web DEP_TONE.
KChipTone depTone(String status) => switch (status) {
  'running' => KChipTone.ember,
  'killed' || 'error' => KChipTone.down,
  _ => KChipTone.neutral,
};

class DepStatusChip extends StatelessWidget {
  const DepStatusChip(this.status, {super.key});
  final String status;

  @override
  Widget build(BuildContext context) => KChip(
    label: context.t.dyn('developer.depStatus.$status', fallback: status),
    tone: depTone(status),
    dot: status == 'running',
    small: true,
  );
}

/// Keeps a section in view after a selection (the web's master / detail on one column).
void revealLater(GlobalKey key) => WidgetsBinding.instance.addPostFrameCallback((_) {
  final c = key.currentContext;
  if (c != null && c.mounted) Scrollable.ensureVisible(c, duration: const Duration(milliseconds: 320), curve: Curves.easeOutCubic, alignment: 0.02);
});
