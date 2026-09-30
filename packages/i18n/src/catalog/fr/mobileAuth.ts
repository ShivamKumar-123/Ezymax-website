import type { NsMessages } from "../../core";

// Kalks mobile app: sign in, sign up and password reset (most texts reuse the `auth` namespace).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "Créer un compte",
  "signIn.newHere": "Nouveau sur Kalks ?",
  "signUp.eyebrow": "Ouvrez votre compte",
  "signUp.haveAccount": "Vous avez déjà un compte ?",
  "signUp.signIn": "Se connecter",
  "signUp.dobPlaceholder": "AAAA-MM-JJ",
  "signUp.dobHint": "Vous devez avoir au moins 18 ans.",
  "signUp.phonePlaceholder": "Numéro de téléphone",
  "signUp.marketing": "Recevoir par e-mail des conseils de trading, des nouveautés et des offres. Désinscription possible à tout moment.",
  "signUp.chooseCountry": "Choisissez votre pays",
  "signUp.continue": "Continuer vers Kalks",
  "forgot.eyebrow": "Réinitialisation du mot de passe",
  "forgot.continue": "Continuer",
  "otp.eyebrow": "Contrôle de sécurité",
  "otp.wrongEmail": "Utiliser une autre adresse e-mail",
  googleSoon: "La connexion avec Google est disponible dans l'espace client sur le web.",
};
export default mobileAuth;
