// Intl for the phone. Hermes (the JavaScript engine of the iOS and Android app) has Intl.NumberFormat,
// DateTimeFormat, Collator and getCanonicalLocales, but not Intl.PluralRules, Intl.RelativeTimeFormat or Intl.Locale.
// Without them every plural message and every "3 minutes ago" crashed the screen on a phone ("undefined cannot be used
// as a constructor"), while the web preview (Chrome) worked. Loaded first by ../../index.ts, before any app module.
// Each polyfill installs only when the engine lacks it, so browsers keep their own. Locale data: the app's 22 languages.
import "@formatjs/intl-getcanonicallocales/polyfill.js";
import "@formatjs/intl-locale/polyfill.js";
import "@formatjs/intl-pluralrules/polyfill.js";
import "@formatjs/intl-pluralrules/locale-data/en.js";
import "@formatjs/intl-pluralrules/locale-data/ar.js";
import "@formatjs/intl-pluralrules/locale-data/bn.js";
import "@formatjs/intl-pluralrules/locale-data/de.js";
import "@formatjs/intl-pluralrules/locale-data/es.js";
import "@formatjs/intl-pluralrules/locale-data/fa.js";
import "@formatjs/intl-pluralrules/locale-data/fr.js";
import "@formatjs/intl-pluralrules/locale-data/hi.js";
import "@formatjs/intl-pluralrules/locale-data/id.js";
import "@formatjs/intl-pluralrules/locale-data/it.js";
import "@formatjs/intl-pluralrules/locale-data/ja.js";
import "@formatjs/intl-pluralrules/locale-data/ko.js";
import "@formatjs/intl-pluralrules/locale-data/ms.js";
import "@formatjs/intl-pluralrules/locale-data/pt.js";
import "@formatjs/intl-pluralrules/locale-data/ru.js";
import "@formatjs/intl-pluralrules/locale-data/sw.js";
import "@formatjs/intl-pluralrules/locale-data/ta.js";
import "@formatjs/intl-pluralrules/locale-data/th.js";
import "@formatjs/intl-pluralrules/locale-data/tr.js";
import "@formatjs/intl-pluralrules/locale-data/ur.js";
import "@formatjs/intl-pluralrules/locale-data/vi.js";
import "@formatjs/intl-pluralrules/locale-data/zh.js";
import "@formatjs/intl-relativetimeformat/polyfill.js";
import "@formatjs/intl-relativetimeformat/locale-data/en.js";
import "@formatjs/intl-relativetimeformat/locale-data/ar.js";
import "@formatjs/intl-relativetimeformat/locale-data/bn.js";
import "@formatjs/intl-relativetimeformat/locale-data/de.js";
import "@formatjs/intl-relativetimeformat/locale-data/es.js";
import "@formatjs/intl-relativetimeformat/locale-data/fa.js";
import "@formatjs/intl-relativetimeformat/locale-data/fr.js";
import "@formatjs/intl-relativetimeformat/locale-data/hi.js";
import "@formatjs/intl-relativetimeformat/locale-data/id.js";
import "@formatjs/intl-relativetimeformat/locale-data/it.js";
import "@formatjs/intl-relativetimeformat/locale-data/ja.js";
import "@formatjs/intl-relativetimeformat/locale-data/ko.js";
import "@formatjs/intl-relativetimeformat/locale-data/ms.js";
import "@formatjs/intl-relativetimeformat/locale-data/pt.js";
import "@formatjs/intl-relativetimeformat/locale-data/ru.js";
import "@formatjs/intl-relativetimeformat/locale-data/sw.js";
import "@formatjs/intl-relativetimeformat/locale-data/ta.js";
import "@formatjs/intl-relativetimeformat/locale-data/th.js";
import "@formatjs/intl-relativetimeformat/locale-data/tr.js";
import "@formatjs/intl-relativetimeformat/locale-data/ur.js";
import "@formatjs/intl-relativetimeformat/locale-data/vi.js";
import "@formatjs/intl-relativetimeformat/locale-data/zh.js";
