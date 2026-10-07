// The 22 interface languages: a port of packages/i18n/src/locales.ts (same order, names, flags and Intl tags).

class LocaleInfo {
  const LocaleInfo(this.code, this.name, this.english, this.flag, this.intl, {this.rtl = false});

  /// `en`, `hi`, `ar`, …: the catalog file and the `X-Kalks-Locale` header.
  final String code;

  /// The language's own name ("हिन्दी").
  final String name;
  final String english;

  /// flag-icons country code (`assets/flags/<flag>.png`).
  final String flag;

  /// BCP-47 tag for number and date formats ("hi-IN"); digits stay Latin (see lib/core/format).
  final String intl;
  final bool rtl;
}

const List<LocaleInfo> kLocales = [
  LocaleInfo('en', 'English', 'English', 'gb', 'en-GB'),
  LocaleInfo('hi', 'हिन्दी', 'Hindi', 'in', 'hi-IN'),
  LocaleInfo('ar', 'العربية', 'Arabic', 'ae', 'ar-AE', rtl: true),
  LocaleInfo('ur', 'اردو', 'Urdu', 'pk', 'ur-PK', rtl: true),
  LocaleInfo('fa', 'فارسی', 'Persian', 'ir', 'fa-IR', rtl: true),
  LocaleInfo('es', 'Español', 'Spanish', 'es', 'es-ES'),
  LocaleInfo('pt', 'Português', 'Portuguese', 'br', 'pt-BR'),
  LocaleInfo('fr', 'Français', 'French', 'fr', 'fr-FR'),
  LocaleInfo('de', 'Deutsch', 'German', 'de', 'de-DE'),
  LocaleInfo('it', 'Italiano', 'Italian', 'it', 'it-IT'),
  LocaleInfo('ru', 'Русский', 'Russian', 'ru', 'ru-RU'),
  LocaleInfo('tr', 'Türkçe', 'Turkish', 'tr', 'tr-TR'),
  LocaleInfo('id', 'Bahasa Indonesia', 'Indonesian', 'id', 'id-ID'),
  LocaleInfo('ms', 'Bahasa Melayu', 'Malay', 'my', 'ms-MY'),
  LocaleInfo('vi', 'Tiếng Việt', 'Vietnamese', 'vn', 'vi-VN'),
  LocaleInfo('th', 'ไทย', 'Thai', 'th', 'th-TH'),
  LocaleInfo('zh', '中文', 'Chinese (Simplified)', 'cn', 'zh-CN'),
  LocaleInfo('ja', '日本語', 'Japanese', 'jp', 'ja-JP'),
  LocaleInfo('ko', '한국어', 'Korean', 'kr', 'ko-KR'),
  LocaleInfo('bn', 'বাংলা', 'Bengali', 'bd', 'bn-BD'),
  LocaleInfo('ta', 'தமிழ்', 'Tamil', 'in', 'ta-IN'),
  LocaleInfo('sw', 'Kiswahili', 'Swahili', 'ke', 'sw-KE'),
];

const String kDefaultLocale = 'en';

/// Right-to-left scripts. `he` is listed so a future Hebrew catalog flips direction without code changes.
const Set<String> _rtl = {'ar', 'ur', 'fa', 'he'};

bool isLocale(String? code) => code != null && kLocales.any((l) => l.code == code);

LocaleInfo localeInfo(String code) => kLocales.firstWhere((l) => l.code == code, orElse: () => kLocales.first);

bool isRtl(String code) => _rtl.contains(code);

/// The locale for `package:intl` (plural rules, number symbols, date names): "pt-BR" -> "pt_BR".
String intlLocale(String code) => localeInfo(code).intl.replaceAll('-', '_');

/// Normalises a raw tag ("pt-BR", "zh_Hans_CN", "AR") to a supported locale, or null (port of matchLocale).
String? matchLocale(String? tag) {
  if (tag == null) return null;
  final base = tag.trim().toLowerCase().replaceAll('_', '-').split('-').first;
  if (base == 'in') return 'id'; // legacy Java/Android tag for Indonesian
  if (base == 'iw') return null; // Hebrew: no catalog yet
  return isLocale(base) ? base : null;
}
