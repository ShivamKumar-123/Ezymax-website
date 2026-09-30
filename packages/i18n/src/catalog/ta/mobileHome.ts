import type { NsMessages } from "../../core";

// Kalks mobile app: Home tab. Headings are shown in tall uppercase display type: keep them short.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "காலை வணக்கம், {name}",
  "greet.afternoon": "மதிய வணக்கம், {name}",
  "greet.evening": "மாலை வணக்கம், {name}",
  equity: "ஈக்விட்டி",
  closedToday: "இன்று மூடியவை",
  openPnl: "திறந்த P&L",
  allLive: "அனைத்து லைவ் கணக்குகள் {amount}",
  "quick.deposit": "டெபாசிட்",
  "quick.withdraw": "பணம் எடு",
  "quick.transfer": "பரிமாற்றம்",
  "quick.trade": "டிரேட்",
  movers: "அதிக நகர்வுகள்",
  news: "தலைப்புச் செய்திகள்",
  allNews: "அனைத்துச் செய்திகளும்",
  notifications: "அறிவிப்புகள்",
  "kyc.title": "உங்கள் அடையாளத்தைச் சரிபார்க்கவும்",
  "kyc.body": "சரிபார்ப்பு லைவ் டிரேடிங் மற்றும் பணம் எடுத்தலைத் திறக்கும். சில நிமிடங்கள் ஆகும்.",
  "kyc.pending": "சரிபார்ப்பு பரிசீலனையில்",
  "kyc.pendingBody": "உங்கள் ஆவணங்களைச் சரிபார்க்கிறோம். முடிந்ததும் உங்களுக்கு அறிவிப்பு வரும்.",
  "kyc.action": "தொடர்க",
  "noAccount.title": "உங்கள் முதல் கணக்கைத் திறங்கள்",
  "noAccount.body": "மெய்நிகர் நிதியுடன் டெமோ கணக்கு சில வினாடிகளில் தயார். தயாரானதும் லைவ்வுக்குச் செல்லுங்கள்.",
  "noAccount.action": "கணக்கைத் திற",
  "news.empty": "தற்போது தலைப்புச் செய்திகள் இல்லை.",
  "a11y.bell": "அறிவிப்புகள், {count} படிக்காதவை",

  // Explore: one colour block per module (title on two short lines at most, hint on two lines)
  "explore.title": "ஆராயுங்கள்",
  "explore.copy": "காப்பி டிரேடிங்",
  "explore.copyHint": "நிரூபித்த டிரேடர்களைப் பின்தொடருங்கள்",
  "explore.prop": "Prop சவால்",
  "explore.propHint": "டிரேட் செய்ய நிதி பெறுங்கள்",
  "explore.academy": "அகாடமி",
  "explore.academyHint": "படிப்படியாக டிரேடிங் கற்றுக்கொள்ளுங்கள்",
  "explore.ai": "AI Trader",
  "explore.aiHint": "யோசனையை உத்தியாக மாற்றுங்கள்",
  "explore.invite": "நண்பர்களை அழையுங்கள்",
  "explore.inviteHint": "அவர்கள் டிரேட் செய்யும்போது சம்பாதியுங்கள்",
};
export default mobileHome;
