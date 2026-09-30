import type { NsMessages } from "../../core";

// App mobile Kalks: accesso, registrazione e reimpostazione della password (gran parte dei testi riusa `auth`).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "Crea un account",
  "signIn.newHere": "Nuovo su Kalks?",
  "signUp.eyebrow": "Apri il tuo account",
  "signUp.haveAccount": "Hai già un account?",
  "signUp.signIn": "Accedi",
  "signUp.dobPlaceholder": "AAAA-MM-GG",
  "signUp.dobHint": "Devi avere almeno 18 anni.",
  "signUp.phonePlaceholder": "Numero di telefono",
  "signUp.marketing": "Inviami via email consigli di trading, novità sui prodotti e offerte. Puoi disiscriverti in qualsiasi momento.",
  "signUp.chooseCountry": "Scegli il tuo paese",
  "signUp.continue": "Continua su Kalks",
  "forgot.eyebrow": "Reimposta password",
  "forgot.continue": "Continua",
  "otp.eyebrow": "Controllo di sicurezza",
  "otp.wrongEmail": "Usa un'altra email",
  googleSoon: "L'accesso con Google è disponibile nell'Area Clienti sul web.",
};
export default mobileAuth;
