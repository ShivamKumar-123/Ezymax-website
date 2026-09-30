import type { NsMessages } from "../../core";

// Kalks mobile app (src/features/platform): notifications inbox, push notifications, the app lock
// (Face ID / fingerprint / the phone's passcode), "Continue with Google" and links that open the app.
// Keep brand and product names as they are: Kalks, Face ID, Touch ID, Google.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // Notifications inbox (/notifications). Day headers above each group: Today, Yesterday, then the date.
  "inbox.eyebrow": "Posteingang",
  "inbox.unread": { one: "{count} ungelesen", other: "{count} ungelesen" },
  "inbox.caughtUp": "Alles gelesen",
  "inbox.filter.unread": "Ungelesen",
  "inbox.markedAll": "Alle als gelesen markiert",
  "inbox.emptyUnread.title": "Alles gelesen",
  "inbox.emptyUnread.body": "Sie haben alle Benachrichtigungen gelesen. Neue erscheinen hier, sobald sie eintreffen.",
  "inbox.loadMoreFailed": "Ältere Benachrichtigungen konnten nicht geladen werden. Tippen Sie, um es erneut zu versuchen.",
  // Under the title while the phone is offline and the inbox shows what it saved earlier
  "inbox.offlineCached": "Sie sind offline. Dies sind die auf diesem Smartphone gespeicherten Benachrichtigungen.",
  // Row accessibility: "Ungelesen. Einzahlung gutgeschrieben. …"
  "inbox.a11y.unread": "Ungelesen",
  "inbox.a11y.settings": "Benachrichtigungseinstellungen",
  // Detail sheet of a notification without a screen to open
  "inbox.detail.openWeb": "Link öffnen",
  "inbox.detail.received": "Erhalten am {time}",

  // Asking for push permission (never on the first launch): a sheet on Home and a card in the inbox
  "push.ask.eyebrow": "Benachrichtigungen",
  "push.ask.title": "Sofort informiert",
  "push.ask.body": "Einzahlungsgutschriften, erfolgte Auszahlungen, Margin Calls, Stop Outs und Antworten vom Support direkt auf Ihrem Sperrbildschirm.",
  "push.ask.point.money": "Ein- und Auszahlungen",
  "push.ask.point.risk": "Margin Calls und Stop Outs",
  "push.ask.point.support": "Antworten vom Support",
  "push.ask.allow": "Benachrichtigungen aktivieren",
  "push.ask.later": "Nicht jetzt",
  "push.ask.note": "Die Themen wählen Sie unter Profil › Benachrichtigungen. Angebote erhalten Sie nur, wenn Sie sie aktivieren.",
  // The sample notification drawn in the ask, as it would look on the lock screen ("now" = its time label)
  "push.ask.now": "jetzt",
  "push.ask.sampleTitle": "Einzahlung gutgeschrieben",
  "push.ask.sampleBody": "250.00 USDT wurden Ihrer Wallet gutgeschrieben.",
  "push.card.title": "Push-Benachrichtigungen aktivieren",
  "push.card.body": "Einzahlungen, Ausführungen und Margin Calls auf Ihrem Sperrbildschirm.",
  "push.card.action": "Aktivieren",
  "push.card.deniedTitle": "Push-Benachrichtigungen sind deaktiviert",
  "push.card.deniedBody": "Erlauben Sie Benachrichtigungen für Kalks in den Einstellungen Ihres Smartphones, um sie auf dem Sperrbildschirm zu erhalten.",
  "push.card.deniedAction": "Einstellungen öffnen",
  "push.card.dismiss": "Ausblenden",
  "push.enabled": "Push-Benachrichtigungen sind aktiviert",
  // Android notification channels (shown in the phone's settings for the app)
  "push.channel.alerts": "Margin Calls und Sicherheit",
  "push.channel.alertsHint": "Warnungen zu Margin Call und Stop Out, Ihre Kursalarme, neue Anmeldungen",
  "push.channel.activity": "Kontoaktivität",
  "push.channel.activityHint": "Einzahlungen, Auszahlungen, Ausführungen, Verifizierung und Antworten vom Support",
  "push.channel.news": "News und Angebote",
  "push.channel.newsHint": "Aktionen und Produktneuheiten, die Sie abonniert haben",
  // In-app banner for a push that arrives while the app is open
  "push.banner.a11y": "Neue Benachrichtigung: {title}. Zum Öffnen doppelt tippen.",

  // App lock screen (cold start, after the chosen time in the background, and /lock)
  "lock.eyebrow": "Gesperrt",
  "lock.title": "Willkommen zurück",
  "lock.subtitle": "Entsperren Sie, um Ihre Konten und Salden zu sehen.",
  // {method}: Face ID, Touch ID, Fingerabdruck, Gesichtserkennung or Gerätecode
  "lock.unlockWith": "Mit {method} entsperren",
  "lock.unlock": "Entsperren",
  "lock.prompt": "Kalks entsperren",
  "lock.promptSubtitle": "Bestätigen Sie, dass Sie es sind",
  "lock.failed": "Das hat nicht funktioniert. Versuchen Sie es erneut.",
  "lock.lockout": "Zu viele Versuche. Entsperren Sie Ihr Smartphone mit dem Gerätecode und versuchen Sie es dann erneut.",
  "lock.noScreenLock": "Ihr Smartphone hat keine Bildschirmsperre mehr, daher kann Kalks nicht bestätigen, dass Sie es sind. Melden Sie sich ab und mit Ihrem Passwort wieder an.",
  "lock.notYou": "Nicht Sie oder Entsperren nicht möglich?",
  "lock.signOut": "Abmelden",
  "lock.signOutTitle": "Von Kalks abmelden?",
  "lock.signOutBody": "Sie melden sich danach mit E-Mail und Passwort wieder an. Ihre Positionen und Gelder sind davon nicht betroffen.",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "Fingerabdruck",
  "lock.method.face": "Gesichtserkennung",
  "lock.method.iris": "Iris-Scan",
  "lock.method.passcode": "Gerätecode",

  // Settings › App lock (/settings/app-lock)
  "settings.eyebrow": "Sicherheit",
  "settings.title": "App-Sperre",
  "settings.subtitle": "Sperren Sie Kalks mit {method} beim Öffnen und nachdem die App im Hintergrund war.",
  "settings.toggle": "Kalks sperren",
  "settings.toggleHint": "Nutzt {method}, mit dem Gerätecode als Alternative",
  "settings.on": "App-Sperre ist aktiviert",
  "settings.off": "App-Sperre ist deaktiviert",
  "settings.after": "Erneut sperren nach",
  "settings.afterHint": "Wie lange Kalks im Hintergrund bleiben darf, bevor erneut gefragt wird. Beim Start wird immer gefragt.",
  "settings.timeout.0": "Sofort",
  "settings.timeout.60": "1 Minute",
  "settings.timeout.300": "5 Minuten",
  "settings.timeout.900": "15 Minuten",
  "settings.timeout.3600": "1 Stunde",
  "settings.privacy": "Bei aktiver App-Sperre zeigt die App-Übersicht ein Deckblatt statt Ihrer Salden.",
  "settings.lockNow": "Jetzt sperren",
  "settings.confirmOn": "Bestätigen, um die App-Sperre zu aktivieren",
  "settings.confirmOff": "Bestätigen, um die App-Sperre zu deaktivieren",
  // System prompt when the reader picks a longer "Lock again after" time
  "settings.confirmTimeout": "Bestätigen, um den Sperrzeitpunkt zu ändern",
  // Toast body after a password sign-in on a phone whose screen lock was removed (the app lock can't work without it)
  "settings.turnedOffNoScreenLock": "Dieses Smartphone hat keine Bildschirmsperre, daher kann Kalks nicht bestätigen, dass Sie es sind. Richten Sie in den Einstellungen Ihres Smartphones eine ein, um die App-Sperre wieder zu nutzen.",
  "settings.notConfirmed": "Nicht bestätigt, nichts geändert",
  "settings.unavailableTitle": "Richten Sie zuerst eine Bildschirmsperre ein",
  "settings.unavailableBody": "Die App-Sperre nutzt Face ID, Fingerabdruck oder Gerätecode Ihres Smartphones. Aktivieren Sie eine Methode in den Einstellungen Ihres Smartphones und kehren Sie dann zurück.",
  "settings.webTitle": "In der App verfügbar",
  "settings.webBody": "Die App-Sperre funktioniert in der Kalks-App für iPhone und Android.",
  "settings.thisPhone": "Gilt nur für dieses Smartphone",

  // Links that open the app (kalks://…, notification taps) but match no screen
  "link.notFound.title": "Hier gibt es nichts zu öffnen",
  "link.notFound.body": "Dieser Link passt zu keinem Bildschirm in der App. Er ist möglicherweise veraltet oder für den Kundenbereich im Web gedacht.",
  "link.notFound.home": "Zur Startseite",
  "link.openFailed": "Dieser Link konnte nicht geöffnet werden.",
};
export default mobilePlatform;
