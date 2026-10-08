// A small Markdown renderer for the options terms (the web renders them with components/academy/live/markdown.tsx):
// headings (#, ##, ###), paragraphs, bullet and numbered lists, block quotes, rules, **bold**, *italic*, `code` and
// [links](url).
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../ui/ui.dart';

class MarkdownText extends StatefulWidget {
  const MarkdownText(this.src, {super.key, this.style});
  final String src;
  final TextStyle? style;

  @override
  State<MarkdownText> createState() => _MarkdownTextState();
}

class _MarkdownTextState extends State<MarkdownText> {
  final List<TapGestureRecognizer> _taps = [];

  @override
  void dispose() {
    for (final r in _taps) {
      r.dispose();
    }
    super.dispose();
  }

  static final RegExp _inline = RegExp(r'(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))');

  List<InlineSpan> _spans(String text, TextStyle base) {
    final k = context.k;
    final out = <InlineSpan>[];
    var last = 0;
    for (final m in _inline.allMatches(text)) {
      if (m.start > last) out.add(TextSpan(text: text.substring(last, m.start)));
      if (m.group(2) != null) {
        out.add(
          TextSpan(
            text: m.group(2),
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        );
      } else if (m.group(4) != null) {
        out.add(
          TextSpan(
            text: m.group(4),
            style: const TextStyle(fontStyle: FontStyle.italic),
          ),
        );
      } else if (m.group(6) != null) {
        out.add(
          TextSpan(
            text: m.group(6),
            style: context.text.mono(base.fontSize ?? 14, color: k.fg),
          ),
        );
      } else {
        final url = m.group(9)!;
        final r = TapGestureRecognizer()..onTap = () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
        _taps.add(r);
        out.add(
          TextSpan(
            text: m.group(8),
            style: TextStyle(color: k.ember, fontWeight: FontWeight.w600),
            recognizer: r,
          ),
        );
      }
      last = m.end;
    }
    if (last < text.length) out.add(TextSpan(text: text.substring(last)));
    return out;
  }

  @override
  Widget build(BuildContext context) {
    for (final r in _taps) {
      r.dispose();
    }
    _taps.clear();
    final k = context.k;
    final base = (widget.style ?? context.text.body).copyWith(color: k.fg2, height: 1.7);
    final blocks = <Widget>[];
    final para = <String>[];
    void flush() {
      if (para.isEmpty) return;
      blocks.add(
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Text.rich(TextSpan(style: base, children: _spans(para.join(' '), base))),
        ),
      );
      para.clear();
    }

    for (final raw in widget.src.split('\n')) {
      final line = raw.trimRight();
      final h = RegExp(r'^(#{1,4})\s+(.*)$').firstMatch(line);
      final bullet = RegExp(r'^\s*[-*]\s+(.*)$').firstMatch(line);
      final number = RegExp(r'^\s*(\d+)\.\s+(.*)$').firstMatch(line);
      if (line.trim().isEmpty) {
        flush();
      } else if (h != null) {
        flush();
        final level = h.group(1)!.length;
        final style = (level <= 2 ? context.text.title2.copyWith(fontSize: level == 1 ? 19 : 17) : context.text.headline).copyWith(color: k.fg);
        blocks.add(
          Padding(
            padding: EdgeInsets.only(top: level <= 2 ? 18 : 12, bottom: 8),
            child: Text.rich(TextSpan(style: style, children: _spans(h.group(2)!, style))),
          ),
        );
      } else if (RegExp(r'^\s*(-{3,}|\*{3,})\s*$').hasMatch(line)) {
        flush();
        blocks.add(const Padding(padding: EdgeInsets.symmetric(vertical: 10), child: KDivider()));
      } else if (bullet != null || number != null) {
        flush();
        blocks.add(
          Padding(
            padding: const EdgeInsetsDirectional.only(start: 4, bottom: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 20,
                  child: Text(bullet != null ? '•' : '${number!.group(1)}.', style: base.copyWith(color: k.fg3)),
                ),
                Expanded(
                  child: Text.rich(TextSpan(style: base, children: _spans(bullet?.group(1) ?? number!.group(2)!, base))),
                ),
              ],
            ),
          ),
        );
      } else if (line.startsWith('>')) {
        flush();
        blocks.add(
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsetsDirectional.only(start: 12),
            decoration: BoxDecoration(
              border: BorderDirectional(start: BorderSide(color: k.line, width: 3)),
            ),
            child: Text.rich(TextSpan(style: base, children: _spans(line.replaceFirst(RegExp(r'^>\s?'), ''), base))),
          ),
        );
      } else {
        para.add(line.trim());
      }
    }
    flush();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: blocks);
  }
}
