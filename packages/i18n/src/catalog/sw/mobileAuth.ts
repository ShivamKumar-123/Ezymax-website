import type { NsMessages } from "../../core";

// Kalks mobile app: sign in, sign up and password reset (most texts reuse the `auth` namespace).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "Fungua akaunti",
  "signIn.newHere": "Mgeni kwenye Kalks?",
  "signUp.eyebrow": "Fungua akaunti yako",
  "signUp.haveAccount": "Tayari una akaunti?",
  "signUp.signIn": "Ingia",
  "signUp.dobPlaceholder": "YYYY-MM-DD",
  "signUp.dobHint": "Lazima uwe na umri wa miaka 18 au zaidi.",
  "signUp.phonePlaceholder": "Namba ya simu",
  "signUp.marketing": "Nitumie barua pepe za vidokezo vya biashara, habari za bidhaa na ofa. Jiondoe wakati wowote.",
  "signUp.chooseCountry": "Chagua nchi yako",
  "signUp.continue": "Endelea kwenye Kalks",
  "forgot.eyebrow": "Kuweka upya nenosiri",
  "forgot.continue": "Endelea",
  "otp.eyebrow": "Ukaguzi wa usalama",
  "otp.wrongEmail": "Tumia barua pepe nyingine",
  googleSoon: "Kuingia kwa Google kunapatikana kwenye Eneo la Mteja kwenye wavuti.",
};
export default mobileAuth;
