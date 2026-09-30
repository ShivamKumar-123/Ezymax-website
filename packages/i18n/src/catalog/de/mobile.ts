import type { NsMessages } from "../../core";

// Kalks mobile app: app shell, onboarding and the states every screen shares.
const mobile: NsMessages<"mobile"> = {
  // Tab bar (short: one word each)
  "tab.home": "Start",
  "tab.markets": "Märkte",
  "tab.trade": "Handel",
  "tab.portfolio": "Portfolio",
  "tab.more": "Mehr",

  // Onboarding (3 slides). Titles are shown in tall uppercase display type: keep them short.
  "onboarding.skip": "Überspringen",
  "onboarding.next": "Weiter",
  "onboarding.getStarted": "Loslegen",
  "onboarding.haveAccount": "Ich habe ein Konto",
  "onboarding.welcome.title": "Ab in die Märkte",
  "onboarding.welcome.body": "Forex, Metalle, Indizes, Energie, Krypto und Aktien in einem Konto, sofort per USDT aufladbar.",
  "onboarding.markets.title": "Jeder Tick, live",
  "onboarding.markets.body": "Echte Bid- und Ask-Kurse, eigene Charts und Kaufen oder Verkaufen mit einem Tippen, gemacht fürs Smartphone.",
  "onboarding.security.title": "Rundum geschützt",
  "onboarding.security.body": "E-Mail-Codes auf neuen Geräten, Bestätigungscodes für Auszahlungen und ein sicherer Tresor für Ihre Sitzung.",
  "onboarding.step": "{n} von {total}", // slide counter, e.g. "1 von 3"

  // Shared states
  "state.offline.title": "Verbindung unterbrochen",
  "state.offline.body": "Prüfen Sie Ihre Internetverbindung. Kurse und Ihr Konto verbinden sich automatisch neu.",
  "state.reconnecting": "Wird neu verbunden…",
  "state.error.title": "Etwas ist schiefgelaufen",
  "state.error.body": "Laden fehlgeschlagen. Ziehen Sie nach unten oder tippen Sie, um es erneut zu versuchen.",
  "state.maintenance.title": "Wartungsarbeiten",
  "state.maintenance.body": "Wir aktualisieren Kalks. Ihre Positionen und Gelder sind sicher. Bitte schauen Sie in Kürze wieder vorbei.",
  "state.sessionExpired": "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.",
  "state.updated": "Aktualisiert {time}",
  "state.pullToRefresh": "Zum Aktualisieren ziehen",

  "viewOnly": "Nur-Lese-Zugriff",
  "viewOnlyBody": "Dieser Login kann freigegebene Konten ansehen, aber keine Änderungen vornehmen.",

  // Common short labels
  "action.retry": "Erneut versuchen",
  "action.openWeb": "Im Kundenbereich öffnen",
  "action.signOut": "Abmelden",
  "action.seeAll": "Alle anzeigen",
  "a11y.close": "Schließen",
  "a11y.back": "Zurück",
};
export default mobile;
