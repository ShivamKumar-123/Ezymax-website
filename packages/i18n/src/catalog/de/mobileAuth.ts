import type { NsMessages } from "../../core";

// Kalks mobile app: sign in, sign up and password reset (most texts reuse the `auth` namespace).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "Konto erstellen",
  "signIn.newHere": "Neu bei Kalks?",
  "signUp.eyebrow": "Konto eröffnen",
  "signUp.haveAccount": "Bereits ein Konto?",
  "signUp.signIn": "Anmelden",
  "signUp.dobPlaceholder": "JJJJ-MM-TT",
  "signUp.dobHint": "Sie müssen mindestens 18 Jahre alt sein.",
  "signUp.phonePlaceholder": "Telefonnummer",
  "signUp.marketing": "Senden Sie mir Trading-Tipps, Produktneuheiten und Angebote per E-Mail. Jederzeit abbestellbar.",
  "signUp.chooseCountry": "Land wählen",
  "signUp.continue": "Weiter zu Kalks",
  "forgot.eyebrow": "Passwort zurücksetzen",
  "forgot.continue": "Weiter",
  "otp.eyebrow": "Sicherheitsprüfung",
  "otp.wrongEmail": "Andere E-Mail verwenden",
  "googleSoon": "Die Google-Anmeldung ist im Kundenbereich im Web verfügbar.",
};
export default mobileAuth;
