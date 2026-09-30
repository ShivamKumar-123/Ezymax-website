import type { NsMessages } from "../../core";

// Kalks mobile app: sign in, sign up and password reset (most texts reuse the `auth` namespace).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "கணக்கை உருவாக்கு",
  "signIn.newHere": "Kalks க்குப் புதியவரா?",
  "signUp.eyebrow": "உங்கள் கணக்கைத் திறங்கள்",
  "signUp.haveAccount": "ஏற்கனவே கணக்கு உள்ளதா?",
  "signUp.signIn": "உள்நுழை",
  "signUp.dobPlaceholder": "YYYY-MM-DD",
  "signUp.dobHint": "உங்களுக்குக் குறைந்தது 18 வயது இருக்க வேண்டும்.",
  "signUp.phonePlaceholder": "தொலைபேசி எண்",
  "signUp.marketing": "டிரேடிங் குறிப்புகள், தயாரிப்புச் செய்திகள் மற்றும் சலுகைகளை எனக்கு மின்னஞ்சலில் அனுப்புங்கள். எப்போது வேண்டுமானாலும் குழுவிலகலாம்.",
  "signUp.chooseCountry": "உங்கள் நாட்டைத் தேர்வுசெய்யுங்கள்",
  "signUp.continue": "Kalks க்குத் தொடர்க",
  "forgot.eyebrow": "கடவுச்சொல் மீட்டமைப்பு",
  "forgot.continue": "தொடர்க",
  "otp.eyebrow": "பாதுகாப்புச் சரிபார்ப்பு",
  "otp.wrongEmail": "வேறு மின்னஞ்சலைப் பயன்படுத்து",
  googleSoon: "Google உள்நுழைவு இணையத்தில் கிளையன்ட் ஏரியாவில் கிடைக்கிறது.",
};
export default mobileAuth;
