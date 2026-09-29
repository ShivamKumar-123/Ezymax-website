import type { NsMessages } from "../../core";

// Client Area support: live chat, launcher, support page.
const support: NsMessages<"support"> = {
  // Support page
  "page.title": "Support",
  "page.subtitle": "Chatten Sie mit Kalks AI für sofortige Antworten. Sie können jederzeit nach einer Person fragen, dann übernimmt unser Team mit dem gesamten Gesprächsverlauf.",
  "email.prefer": "Lieber per E-Mail?",
  // <email> and <id> wrap the client's email address and client ID
  "email.writeFrom": "Schreiben Sie von <email>{email}</email> und geben Sie Ihre Kunden-ID <id>{id}</id> an.",
  "email.write": "An den Support schreiben",
  "email.copyId": "Kunden-ID kopieren",
  clientId: "Kunden-ID",
  notice: "Antworten unseres Teams erscheinen auch in den Benachrichtigungen, und wenn Sie nicht da sind, erhalten Sie eine E-Mail. Dies können Sie unter Profil → Benachrichtigungen ändern.",
  "toast.copied": "{what} kopiert",
  "toast.copyFailed": "Kopieren fehlgeschlagen, bitte markieren Sie den Text",

  // Conversation status
  "status.bot": "KI-Assistent",
  "status.waiting": "In der Warteschlange",
  "status.assigned": "Bei einem Mitarbeiter",
  "status.resolved": "Beendet",

  // Conversation history
  "history.title": "Ihre Gespräche",
  "history.subtitle": "Verläufe werden in Ihrem Kundenbereich gespeichert",
  "history.emptyTitle": "Noch keine Gespräche",
  "history.emptyText": "Stellen Sie im Chat eine Frage, dann erscheint sie hier.",
  conversation: "Gespräch",
  "toast.openFailed": "Gespräch konnte nicht geöffnet werden",

  // Floating button
  "launcher.open": "Support-Chat öffnen",
  "launcher.close": "Support-Chat schließen",

  // Chat
  you: "Sie",
  agent: "Mitarbeiter",
  // Fallback name for a team member without a name
  supportName: "Support",
  // File size, e.g. "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // Suggested first questions (sent as the client's message)
  "quick.verify": "Wie verifiziere ich meine Identität?",
  "quick.deposit": "Wie zahle ich USDT ein?",
  "quick.withdrawal": "Wann kommt meine Auszahlung an?",
  "quick.stopOut": "Was ist ein Stop-Out?",
  "header.supportTeam": "Support-Team",
  "header.agentSub": "Kundensupport · Kalks",
  "header.connecting": "Sie werden mit einem Mitarbeiter verbunden…",
  "header.replySoon": "Unser Team antwortet Ihnen hier in Kürze",
  "header.helpCentre": "Antworten aus dem Hilfecenter · jederzeit mit einer Person möglich",
  "header.instant": "Sofortige Antworten · jederzeit mit einer Person möglich",
  "chip.liveAgent": "Live-Mitarbeiter",
  "menu.aria": "Chat-Optionen",
  "menu.talkToPerson": "Mit einer Person sprechen",
  "menu.endChat": "Chat beenden",
  "menu.newChat": "Neuen Chat starten",
  closeChat: "Chat schließen",
  unavailable: "Der Chat ist derzeit nicht verfügbar.",
  greeting: "Hallo {name}.",
  "csat.question": "Wie war dieser Chat?",
  "csat.stars": { one: "{count} Stern", other: "{count} Sterne" },
  "csat.placeholder": "Möchten Sie etwas ergänzen? (optional)",
  "csat.send": "Bewertung senden",
  "csat.rated": "Sie haben diesen Chat mit {rating}/5 bewertet",
  "composer.attach": "Datei anhängen",
  "composer.messageTo": "Nachricht an {name}…",
  "composer.newChat": "Neuen Chat starten…",
  "composer.ask": "Fragen Sie {name} etwas…",
  "composer.aria": "Nachricht",
  disclaimer: "{name} kann Fehler machen und gibt niemals Anlageberatung. Chats werden zu Qualitätszwecken aufgezeichnet.",
  "toast.chattingWith": "Sie chatten mit {name}",
  "toast.inQueue": "Sie sind in der Warteschlange für einen Mitarbeiter",
  "toast.notSent": "Nachricht nicht gesendet",
  "toast.teamUnreachable": "Team nicht erreichbar",
  "toast.endFailed": "Chat konnte nicht beendet werden",
  "toast.rateFailed": "Bewertung nicht gespeichert",
  "toast.thanks": "Vielen Dank für Ihr Feedback",
  "toast.fileTooLarge": "Datei zu groß",
  "toast.fileTooLargeText": "Dateien dürfen bis zu {mb} MB groß sein.",
  "toast.unsupported": "Nicht unterstützte Datei",
  "toast.unsupportedText": "Hängen Sie ein Bild (PNG, JPG, GIF, WEBP) oder ein PDF an.",
  "toast.uploadFailed": "Upload fehlgeschlagen",
  "error.uploadFailed": "Upload fehlgeschlagen.",
};
export default support;
