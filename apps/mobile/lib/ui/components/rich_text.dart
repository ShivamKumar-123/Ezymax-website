import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../i18n/t.dart';
import '../tokens.dart';

/// How a `<tag>` of a message renders: a tappable link, or just a style (e.g. `<b>` -> the plain text colour).
class KTag {
  const KTag({this.onTap, this.style});

  /// A link in the brand colour, semibold.
  factory KTag.link(VoidCallback onTap, {TextStyle? style}) => KTag(onTap: onTap, style: style);

  final VoidCallback? onTap;
  final TextStyle? style;
}

/// A translated message with inline markup (web `<Trans>`): `"New to Kalks? <link>Create an account</link>"` with
/// {'link': KTag.link(() => …)}. Unknown tags render their text plainly.
class KRichText extends StatefulWidget {
  const KRichText(this.text, {super.key, this.tags = const {}, this.style, this.textAlign});
  final String text;
  final Map<String, KTag> tags;
  final TextStyle? style;
  final TextAlign? textAlign;

  @override
  State<KRichText> createState() => _KRichTextState();
}

class _KRichTextState extends State<KRichText> {
  final List<TapGestureRecognizer> _recognizers = [];

  void _clear() {
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();
  }

  @override
  void dispose() {
    _clear();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    _clear();
    final k = context.k;
    final base = DefaultTextStyle.of(context).style.merge(widget.style);
    final spans = <InlineSpan>[];
    for (final seg in parseRich(widget.text)) {
      final tag = seg.tag == null ? null : widget.tags[seg.tag];
      if (tag == null) {
        spans.add(TextSpan(text: seg.text));
        continue;
      }
      TapGestureRecognizer? rec;
      if (tag.onTap != null) {
        rec = TapGestureRecognizer()..onTap = tag.onTap;
        _recognizers.add(rec);
      }
      final linkStyle = tag.onTap != null ? TextStyle(color: k.ember, fontWeight: FontWeight.w600) : TextStyle(color: k.fg, fontWeight: FontWeight.w600);
      spans.add(TextSpan(text: seg.text, style: linkStyle.merge(tag.style), recognizer: rec));
    }
    return Text.rich(
      TextSpan(style: base, children: spans),
      textAlign: widget.textAlign,
    );
  }
}
