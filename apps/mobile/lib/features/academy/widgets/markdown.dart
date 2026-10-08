// The Academy's markdown subset (web components/academy/live/markdown.tsx, services/academy/src/content.rs) as native
// widgets, no HTML: ## / ### headings, paragraphs, **bold**, *italic*, `code`, internal [links](/path), - and 1.
// lists, | tables |, > **Kind:** callouts, ```text blocks, ```svg diagrams (drawn with flutter_svg, never run) and ---.
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';

sealed class MdBlock {
  const MdBlock();
}

class MdHeading extends MdBlock {
  const MdHeading(this.level, this.text, this.id);
  final int level;
  final String text, id;
}

class MdParagraph extends MdBlock {
  const MdParagraph(this.text);
  final String text;
}

class MdList extends MdBlock {
  const MdList(this.items, {this.ordered = false, this.start = 1});
  final List<String> items;
  final bool ordered;
  final int start;
}

class MdQuote extends MdBlock {
  const MdQuote(this.text);
  final String text;
}

class MdCode extends MdBlock {
  const MdCode(this.lang, this.text);
  final String lang, text;
}

class MdTable extends MdBlock {
  const MdTable(this.head, this.rows);
  final List<String> head;
  final List<List<String>> rows;
}

class MdRule extends MdBlock {
  const MdRule();
}

/// Heading anchor ids (web slugId).
String slugId(String s) {
  var x = s.toLowerCase().replaceAll(RegExp(r'[*`_]'), '').replaceAll(RegExp(r'[^a-z0-9]+'), '-').replaceAll(RegExp(r'^-|-$'), '');
  if (x.length > 60) x = x.substring(0, 60);
  return 'h-$x';
}

List<String> _cells(String line) {
  var s = line.trim();
  if (s.startsWith('|')) s = s.substring(1);
  if (s.endsWith('|')) s = s.substring(0, s.length - 1);
  return [for (final c in s.split('|')) c.trim()];
}

final _h = RegExp(r'^(#{2,3}) (.*)$');
final _ul = RegExp(r'^\s*[-*] (.*)$');
final _ol = RegExp(r'^\s*(\d+)[.)] (.*)$');
final _olItem = RegExp(r'^\s*\d+[.)] (.*)$');
final _rule = RegExp(r'^-{3,}\s*$');
final _tableSep = RegExp(r'^\|?\s*:?-{2,}');
final _continuation = RegExp(r'^\s{2,}\S');

bool _isSpecial(String l) =>
    RegExp(r'^(#{2,3}) ').hasMatch(l) ||
    l.trim().startsWith('```') ||
    l.startsWith('>') ||
    _ul.hasMatch(l) ||
    _olItem.hasMatch(l) ||
    l.trim().startsWith('|') ||
    _rule.hasMatch(l.trim());

/// Splits the source into blocks (web parseBlocks).
List<MdBlock> parseBlocks(String src) {
  final lines = src.replaceAll('\r\n', '\n').split('\n');
  final out = <MdBlock>[];
  final ids = <String, int>{};
  var i = 0;
  while (i < lines.length) {
    final line = lines[i];
    final tr = line.trim();
    if (tr.isEmpty) {
      i++;
      continue;
    }
    if (tr.startsWith('```')) {
      final lang = tr.substring(3).trim().toLowerCase();
      final buf = <String>[];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.add(lines[i++]);
      }
      i++;
      out.add(MdCode(lang, buf.join('\n')));
      continue;
    }
    final h = _h.firstMatch(line);
    if (h != null) {
      final text = h.group(2)!.trim();
      var id = slugId(text);
      final n = ids[id] ?? 0;
      ids[id] = n + 1;
      if (n > 0) id = '$id-${n + 1}';
      out.add(MdHeading(h.group(1)!.length, text, id));
      i++;
      continue;
    }
    if (_rule.hasMatch(tr)) {
      out.add(const MdRule());
      i++;
      continue;
    }
    if (tr.startsWith('>')) {
      final buf = <String>[];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.add(lines[i++].trim().replaceFirst(RegExp(r'^>\s?'), ''));
      }
      out.add(MdQuote(buf.join(' ').trim()));
      continue;
    }
    if (tr.startsWith('|') && i + 1 < lines.length && _tableSep.hasMatch(lines[i + 1].trim())) {
      final head = _cells(tr);
      i += 2;
      final rows = <List<String>>[];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.add(_cells(lines[i++]));
      }
      out.add(MdTable(head, rows));
      continue;
    }
    final ul = _ul.firstMatch(line);
    final ol = _ol.firstMatch(line);
    if (ul != null || ol != null) {
      final re = ul != null ? _ul : _olItem;
      final items = <String>[];
      while (i < lines.length) {
        final m = re.firstMatch(lines[i]);
        if (m != null) {
          items.add(m.group(1)!);
          i++;
        } else if (lines[i].trim().isNotEmpty && _continuation.hasMatch(lines[i]) && items.isNotEmpty) {
          items[items.length - 1] = '${items.last} ${lines[i].trim()}';
          i++;
        } else {
          break;
        }
      }
      out.add(MdList(items, ordered: ul == null, start: ol != null ? int.parse(ol.group(1)!) : 1));
      continue;
    }
    final buf = <String>[tr];
    i++;
    while (i < lines.length && lines[i].trim().isNotEmpty && !_isSpecial(lines[i])) {
      buf.add(lines[i++].trim());
    }
    out.add(MdParagraph(buf.join(' ')));
  }
  return out;
}

/// The level-2 and level-3 headings (web headingsOf).
List<({String id, String text, int level})> headingsOf(String src) => [
  for (final b in parseBlocks(src))
    if (b is MdHeading) (id: b.id, text: b.text.replaceAll(RegExp(r'[*`]'), ''), level: b.level),
];

final _inline = RegExp(r'(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))');
final _link = RegExp(r'^\[([^\]]+)\]\(([^)]+)\)$');

/// Inline markdown as spans: `code`, **bold**, *italic*, [text](/internal).
List<InlineSpan> inlineSpans(BuildContext context, String text, TextStyle base) {
  final k = context.k;
  final spans = <InlineSpan>[];
  var last = 0;
  for (final m in _inline.allMatches(text)) {
    if (m.start > last) spans.add(TextSpan(text: text.substring(last, m.start)));
    final s = m.group(0)!;
    if (m.group(1) != null) {
      spans.add(
        WidgetSpan(
          alignment: PlaceholderAlignment.middle,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            decoration: BoxDecoration(
              color: k.surface2,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: k.line),
            ),
            child: Text(
              s.substring(1, s.length - 1),
              style: context.text.mono((base.fontSize ?? 15) * 0.86, color: k.fg),
              textDirection: TextDirection.ltr,
            ),
          ),
        ),
      );
    } else if (m.group(2) != null) {
      spans.add(
        TextSpan(
          style: TextStyle(fontWeight: FontWeight.w600, color: k.fg),
          children: inlineSpans(context, s.substring(2, s.length - 2), base),
        ),
      );
    } else if (m.group(3) != null) {
      spans.add(
        TextSpan(
          text: s.substring(1, s.length - 1),
          style: const TextStyle(fontStyle: FontStyle.italic),
        ),
      );
    } else {
      final lm = _link.firstMatch(s)!;
      final label = lm.group(1)!;
      final href = lm.group(2)!;
      if (href.startsWith('/') && !href.startsWith('//')) {
        spans.add(
          WidgetSpan(
            alignment: PlaceholderAlignment.baseline,
            baseline: TextBaseline.alphabetic,
            child: GestureDetector(
              onTap: () => href.startsWith('/academy/chapter/') || href.startsWith('/academy/phase/') ? context.push(href) : context.go(href),
              child: Text(
                label,
                style: base.copyWith(color: k.ember, decoration: TextDecoration.underline, decorationColor: k.ember.withValues(alpha: 0.4)),
              ),
            ),
          ),
        );
      } else {
        spans.add(TextSpan(text: label));
      }
    }
    last = m.end;
  }
  if (last < text.length) spans.add(TextSpan(text: text.substring(last)));
  return spans;
}

class MdInline extends StatelessWidget {
  const MdInline(this.text, {super.key, required this.style});
  final String text;
  final TextStyle style;

  @override
  Widget build(BuildContext context) => Text.rich(TextSpan(style: style, children: inlineSpans(context, text, style)));
}

/// The callout kinds (`> **Risk warning:** …`) and the translation keys of their labels.
const Map<String, String> _calloutLabels = {
  'risk warning': 'academy.callout.riskWarning',
  'warning': 'academy.callout.warning',
  'example': 'academy.callout.example',
  'tip': 'academy.callout.tip',
  'note': 'academy.callout.note',
  'in kalks trader': 'academy.callout.inKalksTrader',
};

final _calloutRe = RegExp(r'^\*\*([^*:]+):?\*\*:?\s*(.*)$');

class _Callout extends StatelessWidget {
  const _Callout(this.text, this.style);
  final String text;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final m = _calloutRe.firstMatch(text);
    if (m == null) {
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 14),
        padding: const EdgeInsetsDirectional.only(start: 14),
        decoration: BoxDecoration(
          border: BorderDirectional(start: BorderSide(color: k.line, width: 2)),
        ),
        child: MdInline(text, style: style),
      );
    }
    final key = m.group(1)!.trim().toLowerCase();
    final labelKey = _calloutLabels[key];
    final label = labelKey != null ? context.t(labelKey) : m.group(1)!.trim();
    final (Color bg, Color border, Color fg) = switch (key) {
      'risk warning' || 'warning' => (k.downSoft, k.down.withValues(alpha: 0.3), k.down),
      'example' => (k.infoSoft, k.info.withValues(alpha: 0.25), k.info),
      'tip' => (k.upSoft, k.up.withValues(alpha: 0.25), k.up),
      'in kalks trader' => (k.emberSoft, k.ember.withValues(alpha: 0.3), k.ember),
      _ => (k.surface2, k.line, k.fg2),
    };
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(vertical: 14),
      padding: const EdgeInsets.fromLTRB(16, 13, 16, 14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border),
      ),
      child: Semantics(
        container: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label.toUpperCase(), style: context.text.micro.copyWith(color: fg, letterSpacing: 0.9, fontSize: 11)),
            const SizedBox(height: 4),
            MdInline(m.group(2)!, style: style.copyWith(fontSize: (style.fontSize ?? 15) - 0.5)),
          ],
        ),
      ),
    );
  }
}

class _Diagram extends StatelessWidget {
  const _Diagram(this.svg);
  final String svg;

  @override
  Widget build(BuildContext context) {
    final title = RegExp(r'<text[^>]*>([^<]{4,80})</text>').firstMatch(svg)?.group(1) ?? context.t('academy.diagram');
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 18),
      decoration: BoxDecoration(
        color: const Color(0xFF121216),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.k.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: LayoutBuilder(
        builder: (context, c) => SvgPicture.string(
          svg.trim(),
          width: c.maxWidth,
          semanticsLabel: title,
          errorBuilder: (_, _, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: Text(title, style: context.text.footnote.copyWith(color: const Color(0xFFC9C9D1))),
          ),
        ),
      ),
    );
  }
}

class _Table extends StatelessWidget {
  const _Table(this.table);
  final MdTable table;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final cols = table.head.length;
    final cellStyle = context.text.callout.copyWith(color: k.fg2, fontFeatures: kTabular, height: 1.45);
    final headStyle = context.text.micro.copyWith(color: k.fg3, letterSpacing: 0.7, fontSize: 11);
    Widget cell(String text, TextStyle style) => Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      child: MdInline(text, style: style),
    );
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: k.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: LayoutBuilder(
        builder: (context, c) {
          final width = c.maxWidth < cols * 120.0 ? cols * 120.0 : c.maxWidth;
          return SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: width,
              child: Table(
                defaultColumnWidth: const IntrinsicColumnWidth(flex: 1),
                border: TableBorder(horizontalInside: BorderSide(color: k.line, width: 0.6)),
                children: [
                  TableRow(
                    decoration: BoxDecoration(color: k.surface2),
                    children: [for (final h in table.head) cell(h.toUpperCase(), headStyle)],
                  ),
                  for (final r in table.rows)
                    TableRow(children: [for (var x = 0; x < cols; x++) cell(x < r.length ? r[x] : '', x == 0 ? cellStyle.copyWith(color: k.fg) : cellStyle)]),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

/// A chapter body. `headingKeys` (id -> key) lets the reader scroll to a heading.
class Markdown extends StatelessWidget {
  const Markdown(this.src, {super.key, this.headingKeys = const {}});
  final String src;
  final Map<String, GlobalKey> headingKeys;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final body = context.text.body.copyWith(fontSize: 15.5, height: 1.7, color: k.fg2);
    final blocks = parseBlocks(src);
    final children = <Widget>[];
    for (var i = 0; i < blocks.length; i++) {
      final b = blocks[i];
      switch (b) {
        case MdHeading():
          final h2 = b.level == 2;
          children.add(
            Padding(
              key: headingKeys[b.id],
              padding: EdgeInsets.only(top: i == 0 ? 0 : (h2 ? 30 : 22), bottom: h2 ? 10 : 6),
              child: MdInline(
                b.text,
                style: (h2 ? context.text.title1.copyWith(fontSize: 21) : context.text.title2).copyWith(fontWeight: FontWeight.w600, height: 1.3, color: k.fg),
              ),
            ),
          );
        case MdParagraph():
          children.add(
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: MdInline(b.text, style: body),
            ),
          );
        case MdList():
          children.add(
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var j = 0; j < b.items.length; j++)
                    Padding(
                      padding: EdgeInsets.only(top: j == 0 ? 0 : 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (b.ordered)
                            Container(
                              width: 24,
                              height: 24,
                              margin: const EdgeInsets.only(top: 2),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: k.surface2,
                                shape: BoxShape.circle,
                                border: Border.all(color: k.line),
                              ),
                              child: Text(
                                '${b.start + j}',
                                style: context.text.caption.copyWith(color: k.fg2, fontFeatures: kTabular),
                                textDirection: TextDirection.ltr,
                              ),
                            )
                          else
                            Container(
                              width: 6,
                              height: 6,
                              margin: const EdgeInsets.only(top: 11, left: 4, right: 4),
                              decoration: BoxDecoration(color: k.ember.withValues(alpha: 0.8), shape: BoxShape.circle),
                            ),
                          const SizedBox(width: 12),
                          Expanded(child: MdInline(b.items[j], style: body)),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          );
        case MdQuote():
          children.add(_Callout(b.text, body));
        case MdCode():
          if (b.lang == 'svg') {
            children.add(_Diagram(b.text));
          } else {
            children.add(
              Container(
                width: double.infinity,
                margin: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: k.surface2,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: k.line),
                ),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                  child: Text(
                    b.text,
                    style: context.text.mono(12.5, weight: FontWeight.w400, color: k.fg).copyWith(height: 1.6),
                    textDirection: TextDirection.ltr,
                  ),
                ),
              ),
            );
          }
        case MdTable():
          children.add(_Table(b));
        case MdRule():
          children.add(
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 22),
              child: Container(height: 0.6, color: k.line),
            ),
          );
      }
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children);
  }
}
