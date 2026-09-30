import type { NsMessages } from "../../core";

// Kalks mobile app: Home tab. Headings are shown in tall uppercase display type: keep them short.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "सुप्रभात, {name}",
  "greet.afternoon": "नमस्ते, {name}",
  "greet.evening": "शुभ संध्या, {name}",
  equity: "इक्विटी",
  closedToday: "आज बंद ट्रेड",
  openPnl: "ओपन P&L",
  allLive: "सभी लाइव अकाउंट {amount}",
  "quick.deposit": "जमा",
  "quick.withdraw": "निकासी",
  "quick.transfer": "ट्रांसफ़र",
  "quick.trade": "ट्रेड",
  movers: "टॉप मूवर्स",
  news: "हेडलाइन",
  allNews: "सभी न्यूज़",
  notifications: "सूचनाएँ",
  "kyc.title": "अपनी पहचान वेरिफ़ाई करें",
  "kyc.body": "वेरिफ़िकेशन से लाइव ट्रेडिंग और निकासी अनलॉक होती है। इसमें कुछ ही मिनट लगते हैं।",
  "kyc.pending": "वेरिफ़िकेशन समीक्षा में",
  "kyc.pendingBody": "हम आपके दस्तावेज़ जाँच रहे हैं। पूरा होने पर आपको सूचना मिलेगी।",
  "kyc.action": "जारी रखें",
  "noAccount.title": "अपना पहला अकाउंट खोलें",
  "noAccount.body": "वर्चुअल फ़ंड वाला डेमो अकाउंट कुछ ही सेकंड में तैयार हो जाता है। जब आप तैयार हों, लाइव पर जाएँ।",
  "noAccount.action": "अकाउंट खोलें",
  "news.empty": "अभी कोई हेडलाइन नहीं।",
  "a11y.bell": "सूचनाएँ, {count} अपठित",
};
export default mobileHome;
