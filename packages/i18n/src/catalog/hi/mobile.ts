import type { NsMessages } from "../../core";

// Kalks mobile app: app shell, onboarding and the states every screen shares.
const mobile: NsMessages<"mobile"> = {
  // Tab bar (short: one word each)
  "tab.home": "होम",
  "tab.markets": "मार्केट",
  "tab.trade": "ट्रेड",
  "tab.portfolio": "पोर्टफ़ोलियो",
  "tab.more": "और",

  // Onboarding (3 slides). Titles are shown in tall uppercase display type: keep them short.
  "onboarding.skip": "छोड़ें",
  "onboarding.next": "आगे",
  "onboarding.getStarted": "शुरू करें",
  "onboarding.haveAccount": "मेरे पास अकाउंट है",
  "onboarding.welcome.title": "मार्केट में कदम रखें",
  "onboarding.welcome.body": "फ़ॉरेक्स, मेटल्स, इंडाइसेस, एनर्जी, क्रिप्टो और स्टॉक्स एक ही अकाउंट में, तुरंत USDT फ़ंडिंग के साथ।",
  "onboarding.markets.title": "हर टिक, लाइव",
  "onboarding.markets.body": "असली बिड और आस्क कीमतें, आपके अपने चार्ट और वन-टैप बाय और सेल, सब कुछ फ़ोन के लिए बना।",
  "onboarding.security.title": "पूरी तरह सुरक्षित",
  "onboarding.security.body": "नए डिवाइस पर ईमेल कोड, निकासी के लिए पुष्टि कोड और आपके सेशन के लिए सुरक्षित वॉल्ट।",
  // Slide counter, e.g. "1 of 3"
  "onboarding.step": "{total} में से {n}",

  // Shared states
  "state.offline.title": "कनेक्शन टूट गया",
  "state.offline.body": "अपना इंटरनेट कनेक्शन जाँचें। कीमतें और आपका अकाउंट अपने-आप फिर से कनेक्ट हो जाएँगे।",
  "state.reconnecting": "फिर से कनेक्ट हो रहा है…",
  "state.error.title": "कुछ गलत हो गया",
  "state.error.body": "यह लोड नहीं हो सका। फिर से कोशिश करने के लिए नीचे खींचें या टैप करें।",
  "state.maintenance.title": "रखरखाव के लिए बंद",
  "state.maintenance.body": "हम Kalks को अपग्रेड कर रहे हैं। आपकी पोज़िशन और फ़ंड सुरक्षित हैं। कृपया थोड़ी देर में फिर देखें।",
  "state.sessionExpired": "आपका सेशन समाप्त हो गया है। कृपया फिर से साइन इन करें।",
  "state.updated": "अपडेट: {time}",
  "state.pullToRefresh": "रिफ़्रेश करने के लिए नीचे खींचें",

  viewOnly: "केवल-देखने की एक्सेस",
  viewOnlyBody: "यह लॉगिन शेयर किए गए अकाउंट देख सकता है, लेकिन बदलाव नहीं कर सकता।",

  // Common short labels
  "action.retry": "फिर से कोशिश करें",
  "action.openWeb": "क्लाइंट एरिया में खोलें",
  "action.signOut": "साइन आउट करें",
  "action.seeAll": "सभी देखें",
  "a11y.close": "बंद करें",
  "a11y.back": "वापस",
};
export default mobile;
