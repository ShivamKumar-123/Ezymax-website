import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile): app shell, onboarding and the states every screen shares.
const mobile: NsMessages<"mobile"> = {
  // Tab bar (short: one word each)
  "tab.home": "முகப்பு",
  "tab.markets": "சந்தைகள்",
  "tab.trade": "டிரேட்",
  "tab.portfolio": "போர்ட்ஃபோலியோ",
  "tab.more": "மேலும்",

  // Onboarding (3 slides). Titles are shown in tall uppercase display type: keep them short.
  "onboarding.skip": "தவிர்",
  "onboarding.next": "அடுத்து",
  "onboarding.getStarted": "தொடங்குங்கள்",
  "onboarding.haveAccount": "என்னிடம் கணக்கு உள்ளது",
  "onboarding.welcome.title": "சந்தைகளில் நுழையுங்கள்",
  "onboarding.welcome.body": "ஃபாரெக்ஸ், உலோகங்கள், குறியீடுகள், எரிசக்தி, கிரிப்டோ மற்றும் பங்குகள் ஒரே கணக்கில், உடனடி USDT நிதியளிப்புடன்.",
  "onboarding.markets.title": "ஒவ்வொரு டிக்கும் லைவ்",
  "onboarding.markets.body": "உண்மையான Bid மற்றும் Ask விலைகள், உங்கள் சொந்த சார்ட்கள், ஒரே தட்டலில் வாங்கு, விற்பனை. ஃபோனுக்காகவே உருவாக்கப்பட்டது.",
  "onboarding.security.title": "முழுப் பாதுகாப்பு",
  "onboarding.security.body": "புதிய சாதனங்களில் மின்னஞ்சல் குறியீடுகள், பணம் எடுத்தல்களுக்கு உறுதிப்படுத்தல் குறியீடுகள், உங்கள் அமர்வுக்குப் பாதுகாப்பான சேமிப்பகம்.",
  "onboarding.step": "{total} இல் {n}",

  // Shared states
  "state.offline.title": "இணைப்பு துண்டிக்கப்பட்டது",
  "state.offline.body": "உங்கள் இணைய இணைப்பைச் சரிபார்க்கவும். விலைகளும் உங்கள் கணக்கும் தானாக மீண்டும் இணையும்.",
  "state.reconnecting": "மீண்டும் இணைக்கிறது…",
  "state.error.title": "ஏதோ தவறு நடந்தது",
  "state.error.body": "இதை ஏற்ற முடியவில்லை. மீண்டும் முயல கீழே இழுக்கவும் அல்லது தட்டவும்.",
  "state.maintenance.title": "பராமரிப்பில் உள்ளது",
  "state.maintenance.body": "Kalks ஐ மேம்படுத்துகிறோம். உங்கள் பொசிஷன்களும் நிதியும் பாதுகாப்பாக உள்ளன. சிறிது நேரத்தில் மீண்டும் பாருங்கள்.",
  "state.sessionExpired": "உங்கள் அமர்வு முடிந்தது. மீண்டும் உள்நுழையுங்கள்.",
  "state.updated": "புதுப்பிப்பு: {time}",
  "state.pullToRefresh": "புதுப்பிக்கக் கீழே இழுக்கவும்",

  viewOnly: "பார்வை-மட்டும் அணுகல்",
  viewOnlyBody: "இந்த உள்நுழைவு பகிரப்பட்ட கணக்குகளைப் பார்க்கலாம், ஆனால் மாற்றங்கள் செய்ய முடியாது.",

  // Common short labels
  "action.retry": "மீண்டும் முயல்க",
  "action.openWeb": "கிளையன்ட் ஏரியாவில் திற",
  "action.signOut": "வெளியேறு",
  "action.seeAll": "அனைத்தையும் காண்க",
  "a11y.close": "மூடு",
  "a11y.back": "பின்செல்",
};
export default mobile;
