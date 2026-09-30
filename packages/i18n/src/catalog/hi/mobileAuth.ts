import type { NsMessages } from "../../core";

// Kalks mobile app: sign in, sign up and password reset (most texts reuse the `auth` namespace).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "अकाउंट बनाएँ",
  "signIn.newHere": "Kalks पर नए हैं?",
  "signUp.eyebrow": "अपना अकाउंट खोलें",
  "signUp.haveAccount": "पहले से अकाउंट है?",
  "signUp.signIn": "साइन इन करें",
  "signUp.dobPlaceholder": "YYYY-MM-DD",
  "signUp.dobHint": "आपकी उम्र 18 वर्ष या उससे अधिक होनी चाहिए।",
  "signUp.phonePlaceholder": "फ़ोन नंबर",
  "signUp.marketing": "मुझे ट्रेडिंग टिप्स, प्रोडक्ट न्यूज़ और ऑफ़र ईमेल करें। कभी भी अनसब्सक्राइब करें।",
  "signUp.chooseCountry": "अपना देश चुनें",
  "signUp.continue": "Kalks पर जारी रखें",
  "forgot.eyebrow": "पासवर्ड रीसेट",
  "forgot.continue": "जारी रखें",
  "otp.eyebrow": "सुरक्षा जाँच",
  "otp.wrongEmail": "दूसरा ईमेल इस्तेमाल करें",
  googleSoon: "Google साइन-इन वेब पर क्लाइंट एरिया में उपलब्ध है।",
};
export default mobileAuth;
