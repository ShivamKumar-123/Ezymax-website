import type { NsMessages } from "../../core";

// Kalks mobile app: Home tab. Headings are shown in tall uppercase display type: keep them short.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "Guten Morgen, {name}",
  "greet.afternoon": "Guten Tag, {name}",
  "greet.evening": "Guten Abend, {name}",
  equity: "Eigenkapital",
  closedToday: "Heute realisiert",
  openPnl: "Offener P&L",
  allLive: "Alle Live-Konten {amount}",
  "quick.deposit": "Einzahlen",
  "quick.withdraw": "Auszahlen",
  "quick.transfer": "Übertragen",
  "quick.trade": "Handeln",
  movers: "Top-Mover",
  news: "Schlagzeilen",
  allNews: "Alle News",
  notifications: "Benachrichtigungen",
  "kyc.title": "Identität verifizieren",
  "kyc.body": "Die Verifizierung schaltet Live-Handel und Auszahlungen frei. Sie dauert nur wenige Minuten.",
  "kyc.pending": "Verifizierung in Prüfung",
  "kyc.pendingBody": "Wir prüfen Ihre Dokumente. Sie erhalten eine Benachrichtigung, sobald die Prüfung abgeschlossen ist.",
  "kyc.action": "Weiter",
  "noAccount.title": "Erstes Konto eröffnen",
  "noAccount.body": "Ein Demokonto mit virtuellem Guthaben ist in Sekunden bereit. Wechseln Sie zu Live, wann immer Sie so weit sind.",
  "noAccount.action": "Konto eröffnen",
  "news.empty": "Derzeit keine Schlagzeilen.",
  "a11y.bell": "Benachrichtigungen, {count} ungelesen",

  // Explore: one colour block per module (title in display type on two short lines at most, hint on two lines)
  "explore.title": "Entdecken",
  "explore.copy": "Copy-Trading",
  "explore.copyHint": "Bewährten Tradern folgen",
  "explore.prop": "Prop Challenge",
  "explore.propHint": "Mit unserem Kapital handeln",
  "explore.academy": "Academy",
  "explore.academyHint": "Trading lernen, Schritt für Schritt",
  "explore.ai": "AI Trader",
  "explore.aiHint": "Aus einer Idee eine Strategie machen",
  "explore.invite": "Freunde einladen",
  "explore.inviteHint": "Verdienen, wenn sie handeln",
};
export default mobileHome;
