import type { NsMessages } from "../../core";

const auth: NsMessages<"auth"> = {
  // Shared form fields
  "field.email": "E-Mail",
  "field.emailOrViewer": "E-Mail oder Betrachter-ID",
  "field.password": "Passwort",
  "field.newPassword": "Neues Passwort",
  "field.firstName": "Vorname",
  "field.lastName": "Nachname",
  "field.country": "Wohnsitzland",
  "field.phone": "Telefon",
  "field.dateOfBirth": "Geburtsdatum",
  "field.referralCode": "Empfehlungscode",
  "field.optionalHint": "optional",
  "placeholder.email": "you@example.com",
  "placeholder.createPassword": "Sicheres Passwort erstellen",
  "togglePassword": "Passwort ein-/ausblenden",

  // Shared OTP / code step
  "otp.didntGetIt": "Nicht erhalten?",
  "otp.verifying": "Wird geprüft…",
  "otp.resendIn": "Erneut senden in 0:{seconds}",
  "otp.sending": "Wird gesendet…",
  "otp.resendCode": "Code erneut senden",
  "otp.devHint": "Dev-Modus: Der E-Mail-Versand ist noch nicht eingerichtet. Ihr Code lautet <code>{code}</code> (auch im Gateway-Log).",
  "toast.newCodeSent": "Neuer Code gesendet",
  "toast.checkEmail": "Prüfen Sie {email}",

  // Google sign-in
  "google.continue": "Weiter mit Google",
  "google.signUp": "Mit Google registrieren",
  "google.opening": "Google wird geöffnet…",
  "google.orWithEmail": "oder mit E-Mail",
  "google.error.cancelled": "Die Google-Anmeldung wurde abgebrochen. Wählen Sie ein Konto, um fortzufahren, oder nutzen Sie unten Ihre E-Mail.",
  "google.error.expired": "Ihre Google-Anmeldung ist abgelaufen oder wurde in einem anderen Tab geöffnet. Bitte versuchen Sie es erneut.",
  "google.error.unverified": "Die E-Mail-Adresse Ihres Google-Kontos ist nicht verifiziert. Verifizieren Sie sie bei Google oder nutzen Sie unten Ihre E-Mail.",
  "google.error.conflict": "Diese E-Mail ist bereits mit einem anderen Google-Konto verknüpft. Nutzen Sie dieses Google-Konto oder melden Sie sich mit Ihrem Passwort an.",
  "google.error.disabled": "Dieses Konto ist deaktiviert. Bitte wenden Sie sich an den Support.",
  "google.error.rate_limited": "Zu viele Anmeldeversuche. Bitte warten Sie einige Minuten und versuchen Sie es erneut.",
  "google.error.unavailable": "Die Google-Anmeldung ist derzeit nicht verfügbar. Bitte versuchen Sie es in Kürze erneut oder nutzen Sie Ihre E-Mail.",
  "google.error.failed": "Die Anmeldung mit Google ist fehlgeschlagen. Bitte versuchen Sie es erneut.",

  // Password strength meter
  "strength.rule": "8+ Zeichen, Großbuchstabe, Zahl & Sonderzeichen",
  "strength.tooWeak": "Zu schwach",
  "strength.weak": "Schwach",
  "strength.fair": "Mittel",
  "strength.good": "Gut",
  "strength.strong": "Stark",

  // Demo entry card (demo builds only)
  "demo.title": "Dies ist die Kalks-Demo",
  "demo.body": "Kein Konto erforderlich. Alle Ansichten laufen mit Beispieldaten.",
  "demo.enter": "Demo starten",

  // Auth layout brand panel
  "brand.headline": "Handeln Sie globale Märkte mit institutioneller Präzision.",
  "brand.body": "Forex, Metalle, Indizes, Energie, Krypto und Aktien – sofortige USDT-Einzahlungen, ein Konto für Trading, Copy-Trading und Partnerschaft.",
  "brand.previewAlt": "Kalks-Kundenbereich-Dashboard",

  // Sign in
  "login.title": "Willkommen zurück",
  "login.subtitle": "Melden Sie sich in Ihrem Kalks-Kundenbereich an.",
  "login.forgot": "Passwort vergessen?",
  "login.signingIn": "Anmeldung läuft…",
  "login.signIn": "Anmelden",
  "login.newToKalks": "Neu bei Kalks? <link>Konto erstellen</link>",
  "login.verifyEmailTitle": "E-Mail verifizieren",
  "login.verifyDeviceTitle": "Bestätigen Sie Ihre Identität",
  "login.emailNotVerified": "Ihre E-Mail ist noch nicht verifiziert.",
  "login.newDevice": "Neues Gerät erkannt.",
  "login.codeSent": "Wir haben einen 6-stelligen Code an <b>{email}</b> gesendet.",
  "login.verifyContinue": "Bestätigen & weiter",
  "login.back": "← Zurück",

  // Sign up
  "register.stepDetails": "Angaben",
  "register.stepVerify": "E-Mail bestätigen",
  "register.stepDone": "Fertig",
  "register.title": "Kalks-Konto erstellen",
  "register.subtitleDemo": "Eröffnen Sie sofort ein kostenloses Demokonto. Wechseln Sie zu Live, wann immer Sie bereit sind.",
  "register.subtitle": "In einer Minute registriert – verfolgen Sie sofort die Live-Märkte.",
  "register.emailTaken": "<signin>Melden Sie sich an</signin> oder <reset>setzen Sie Ihr Passwort zurück</reset>.",
  "register.terms": "Ich bin über 18 Jahre alt und stimme der <agreement>Kundenvereinbarung</agreement>, der <risk>Risikoaufklärung</risk> und der <privacy>Datenschutzerklärung</privacy> zu.",
  "register.creating": "Konto wird erstellt…",
  "register.create": "Konto erstellen",
  "register.haveAccount": "Bereits ein Konto? <link>Anmelden</link>",
  "register.checkInbox": "Prüfen Sie Ihren Posteingang",
  "register.enterCode": "Geben Sie den 6-stelligen Code ein, den wir an <b>{email}</b> gesendet haben.",
  "register.verifyEmail": "E-Mail bestätigen",
  "register.welcome": "Willkommen bei Kalks, {name}",
  "register.readyDemo": "Ihre E-Mail ist verifiziert und Ihr Konto ist bereit. Eröffnen Sie jetzt ein Demokonto oder verifizieren Sie Ihre Identität, um live zu handeln.",
  "register.ready": "Ihre E-Mail ist verifiziert und Ihr Konto ist bereit. Verfolgen Sie jetzt die Live-Märkte; Einzahlungen und Handelskonten folgen in Kürze.",
  "register.openClientArea": "Zum Kundenbereich",

  // Complete profile after Google sign-up
  "complete.stepGoogle": "Google-Konto",
  "complete.stepDetails": "Ihre Angaben",
  "complete.loading": "Ihr Google-Profil wird geladen…",
  "complete.expiredTitle": "Beginnen wir von vorn",
  "complete.accountExists": "Ihr Konto ist bereits eingerichtet. Fahren Sie mit Google fort, um sich anzumelden.",
  "complete.expired": "Ihre Google-Registrierung ist abgelaufen oder wurde in einem anderen Tab abgeschlossen. Fahren Sie mit Google fort, um dort weiterzumachen, wo Sie aufgehört haben.",
  "complete.preferEmail": "Lieber per E-Mail? <link>Mit E-Mail registrieren</link>",
  "complete.title": "Profil vervollständigen",
  "complete.subtitle": "Einige Angaben, die wir für jedes Kalks-Konto benötigen. Das dauert weniger als eine Minute.",
  "complete.googleAccount": "Google-Konto",
  "complete.emailTaken": "<signin>Melden Sie sich</signin> stattdessen mit Ihrem Passwort an oder <reset>setzen Sie es zurück</reset>.",
  "complete.ready": "Ihr Konto ist bereit und Sie sind mit Google angemeldet. Verfolgen Sie jetzt die Live-Märkte; Einzahlungen und Handelskonten folgen in Kürze.",
  "complete.notYou": "Nicht Sie? <link>Anderes Google-Konto verwenden</link>",

  // Forgot / reset password
  "forgot.backToSignIn": "Zurück zur Anmeldung",
  "forgot.titleReset": "Passwort zurücksetzen",
  "forgot.titleCode": "Code eingeben",
  "forgot.titleNew": "Neues Passwort festlegen",
  "forgot.intro": "Wir senden Ihnen per E-Mail einen 6-stelligen Code zum Zurücksetzen Ihres Passworts.",
  "forgot.codeSent": "Falls ein Konto für <b>{email}</b> existiert, haben wir einen Code dorthin gesendet.",
  "forgot.passwordRule": "Verwenden Sie mindestens 8 Zeichen mit Buchstaben, Zahlen und Sonderzeichen.",
  "forgot.sendCode": "Code senden",
  "forgot.updating": "Wird aktualisiert…",
  "forgot.update": "Passwort ändern",
  "forgot.toastUpdated": "Passwort geändert",
  "forgot.toastUpdatedBody": "Melden Sie sich mit Ihrem neuen Passwort an.",

  // Step-up confirmation dialog (emailed code before sensitive changes)
  // {what} is a translated action phrase such as "change the leverage of #10000123"
  "stepup.intro": "Um {what}, geben Sie den 6-stelligen Code ein, den wir an <b>{email}</b> gesendet haben. Er ist {minutes} Minuten gültig.",
  "stepup.spam": "Nicht erhalten? Prüfen Sie Ihren Spam-Ordner.",
  "stepup.checking": "Wird geprüft…",
  "stepup.saving": "Wird gespeichert…",
  "stepup.sendAgain": "Code erneut senden",
  "stepup.sendingCode": "Bestätigungscode wird an Ihre E-Mail gesendet…",
};
export default auth;
