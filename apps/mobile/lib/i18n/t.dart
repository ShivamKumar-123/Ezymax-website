// The translator: a port of packages/i18n/src/core.ts `createT`, reading the flat catalogs exported by
// tool/export_i18n.mjs ("<ns>.<key>" -> text or plural forms). Same rules as the web:
// - a message is plain text with {name} placeholders, or plural forms picked by the CLDR rules on `count`, with
//   `zero` used only when count is exactly 0;
// - a placeholder whose value is missing stays as written ("{name}");
// - a key missing in the locale falls back to English, then to a readable form of the key (never the raw key).
import 'package:intl/intl.dart';

import 'locales.dart';

/// A catalog: `"<ns>.<key>"` -> String, or Map of plural forms (zero/one/two/few/many/other).
typedef Messages = Map<String, Object?>;

/// Template values: `{name}` placeholders and the plural `count`.
typedef Vars = Map<String, Object?>;

class T {
  T(this.locale, Messages? messages, Messages english) : _messages = messages ?? const {}, _en = english;

  /// `en`, `ar`, …
  final String locale;
  final Messages _messages;
  final Messages _en;

  bool get rtl => isRtl(locale);

  Object? _resolve(String key) => _messages[key] ?? _en[key];

  /// The text of `key` (e.g. `dashboard.home.totalBalance`) in this language.
  String call(String key, [Vars? vars]) {
    final msg = _resolve(key);
    return msg == null ? humanise(key) : render(msg, locale, vars);
  }

  /// Dynamic keys (status codes, server enums): `fallback` (or a readable key) when unknown.
  String dyn(String key, {String? fallback, Vars? vars}) {
    final msg = _resolve(key);
    if (msg != null) return render(msg, locale, vars);
    return fallback != null ? interpolate(fallback, vars) : humanise(key);
  }

  bool has(String key) => _resolve(key) != null;
}

final RegExp _placeholder = RegExp(r'\{(\w+)\}');

/// `{name}` -> vars['name']; unknown or null values keep the placeholder.
String interpolate(String s, Vars? vars) {
  if (vars == null || vars.isEmpty) return s;
  return s.replaceAllMapped(_placeholder, (m) {
    final v = vars[m.group(1)];
    return v == null ? m.group(0)! : '$v';
  });
}

num _count(Object? v) {
  if (v is num) return v;
  if (v is String) return num.tryParse(v) ?? double.nan;
  return 0;
}

/// Picks the plural form for `count` (CLDR rules of the locale; `zero` only for exactly 0) and fills placeholders.
String render(Object msg, String locale, Vars? vars) {
  if (msg is String) return interpolate(msg, vars);
  if (msg is Map) {
    final forms = msg.map((k, v) => MapEntry('$k', '$v'));
    final other = forms['other'] ?? (forms.isEmpty ? '' : forms.values.last);
    final n = _count(vars?['count']);
    String chosen;
    if (n == 0 && forms['zero'] != null) {
      chosen = forms['zero']!;
    } else if (n.isNaN) {
      chosen = other;
    } else {
      chosen = forms[pluralCategory(n, locale)] ?? other;
    }
    return interpolate(chosen, vars);
  }
  return '$msg';
}

/// The CLDR plural category of `n` in `locale` ("one", "few", …), like `Intl.PluralRules.select` on the web.
/// (Every form is passed by name so intl reports the category itself, with no "exact 1 means one" shortcut and no
/// two -> few fallback.)
String pluralCategory(num n, String locale) => Intl.pluralLogic<String>(
  n,
  locale: intlLocale(locale),
  zero: 'zero',
  one: 'one',
  two: 'two',
  few: 'few',
  many: 'many',
  other: 'other',
  useExplicitNumberCases: false,
);

/// Last-resort text for a key that exists nowhere: the humanised last segment ("totalBalance" -> "Total balance").
String humanise(String key) {
  final last = key.split('.').last;
  final s = last.replaceAll(RegExp(r'[_-]+'), ' ').replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]} ${m[2]}').trim();
  if (s.isEmpty) return s;
  return s[0].toUpperCase() + s.substring(1);
}

/// A piece of a message with inline markup: `<link>Create one</link>` -> (text "Create one", tag "link").
class RichSegment {
  const RichSegment(this.text, [this.tag]);
  final String text;
  final String? tag;

  @override
  bool operator ==(Object other) => other is RichSegment && other.text == text && other.tag == tag;

  @override
  int get hashCode => Object.hash(text, tag);

  @override
  String toString() => tag == null ? text : '<$tag>$text</$tag>';
}

final RegExp _tagRe = RegExp(r'<(\w+)>([\s\S]*?)</\1>');

/// Splits a message into plain and tagged pieces (port of richText in packages/i18n/src/react.tsx). Unknown tags
/// are the caller's choice: render their text plainly.
List<RichSegment> parseRich(String text) {
  final out = <RichSegment>[];
  var last = 0;
  for (final m in _tagRe.allMatches(text)) {
    if (m.start > last) out.add(RichSegment(text.substring(last, m.start)));
    out.add(RichSegment(m.group(2)!, m.group(1)));
    last = m.end;
  }
  if (last < text.length) out.add(RichSegment(text.substring(last)));
  return out;
}
