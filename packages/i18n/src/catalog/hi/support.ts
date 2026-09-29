import type { NsMessages } from "../../core";

// Client Area support: live chat, launcher, support page.
const support: NsMessages<"support"> = {
  // Support page
  "page.title": "सहायता",
  "page.subtitle": "तुरंत जवाब के लिए Kalks AI से चैट करें। किसी भी समय किसी व्यक्ति से बात करने के लिए कहें और हमारी टीम पूरी बातचीत के साथ आगे संभाल लेगी।",
  "email.prefer": "ईमेल पसंद है?",
  // <email> and <id> wrap the client's email address and client ID
  "email.writeFrom": "<email>{email}</email> से लिखें और अपना क्लाइंट ID <id>{id}</id> शामिल करें।",
  "email.write": "सहायता टीम को लिखें",
  "email.copyId": "क्लाइंट ID कॉपी करें",
  clientId: "क्लाइंट ID",
  notice: "हमारी टीम के जवाब नोटिफ़िकेशन बेल में भी दिखते हैं, और आपके दूर होने पर हम आपको ईमेल करते हैं। इसे प्रोफ़ाइल → नोटिफ़िकेशन में बदलें।",
  "toast.copied": "{what} कॉपी हुआ",
  "toast.copyFailed": "कॉपी नहीं हो सका, कृपया इसे चुनकर कॉपी करें",

  // Conversation status
  "status.bot": "AI असिस्टेंट",
  "status.waiting": "कतार में",
  "status.assigned": "एजेंट के साथ",
  "status.resolved": "समाप्त",

  // Conversation history
  "history.title": "आपकी बातचीत",
  "history.subtitle": "ट्रांसक्रिप्ट आपके क्लाइंट एरिया में रखे जाते हैं",
  "history.emptyTitle": "अभी कोई बातचीत नहीं",
  "history.emptyText": "चैट में कोई सवाल पूछें और वह यहाँ दिखेगा।",
  conversation: "बातचीत",
  "toast.openFailed": "बातचीत नहीं खुल सकी",

  // Floating button
  "launcher.open": "सहायता चैट खोलें",
  "launcher.close": "सहायता चैट बंद करें",

  // Chat
  you: "आप",
  agent: "एजेंट",
  // Fallback name for a team member without a name
  supportName: "सहायता",
  // File size, e.g. "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // Suggested first questions (sent as the client's message)
  "quick.verify": "मैं अपनी पहचान कैसे वेरिफ़ाई करूँ?",
  "quick.deposit": "मैं USDT कैसे जमा करूँ?",
  "quick.withdrawal": "मेरी निकासी कब पहुँचेगी?",
  "quick.stopOut": "स्टॉप आउट क्या है?",
  "header.supportTeam": "सहायता टीम",
  "header.agentSub": "क्लाइंट सहायता · Kalks",
  "header.connecting": "आपको एजेंट से जोड़ा जा रहा है…",
  "header.replySoon": "हमारी टीम जल्द ही यहाँ जवाब देगी",
  "header.helpCentre": "हेल्प सेंटर से जवाब · कोई व्यक्ति कभी भी जुड़ सकता है",
  "header.instant": "तुरंत जवाब · कोई व्यक्ति कभी भी जुड़ सकता है",
  "chip.liveAgent": "लाइव एजेंट",
  "menu.aria": "चैट विकल्प",
  "menu.talkToPerson": "किसी व्यक्ति से बात करें",
  "menu.endChat": "चैट समाप्त करें",
  "menu.newChat": "नई चैट शुरू करें",
  closeChat: "चैट बंद करें",
  unavailable: "चैट अभी उपलब्ध नहीं है।",
  greeting: "नमस्ते {name}।",
  "csat.question": "यह चैट कैसी रही?",
  "csat.stars": { one: "{count} स्टार", other: "{count} स्टार" },
  "csat.placeholder": "कुछ और जोड़ना चाहेंगे? (वैकल्पिक)",
  "csat.send": "रेटिंग भेजें",
  "csat.rated": "आपने इस चैट को {rating}/5 रेटिंग दी",
  "composer.attach": "फ़ाइल अटैच करें",
  "composer.messageTo": "{name} को मैसेज…",
  "composer.newChat": "नई चैट शुरू करें…",
  "composer.ask": "{name} से कुछ भी पूछें…",
  "composer.aria": "मैसेज",
  disclaimer: "{name} से गलती हो सकती है और यह कभी निवेश सलाह नहीं देता। गुणवत्ता के लिए चैट रिकॉर्ड की जाती हैं।",
  "toast.chattingWith": "आप {name} से चैट कर रहे हैं",
  "toast.inQueue": "आप एजेंट के लिए कतार में हैं",
  "toast.notSent": "मैसेज नहीं भेजा गया",
  "toast.teamUnreachable": "टीम से संपर्क नहीं हो सका",
  "toast.endFailed": "चैट समाप्त नहीं हो सकी",
  "toast.rateFailed": "रेटिंग सेव नहीं हुई",
  "toast.thanks": "आपके फ़ीडबैक के लिए धन्यवाद",
  "toast.fileTooLarge": "फ़ाइल बहुत बड़ी है",
  "toast.fileTooLargeText": "फ़ाइलें {mb} MB तक हो सकती हैं।",
  "toast.unsupported": "असमर्थित फ़ाइल",
  "toast.unsupportedText": "कोई इमेज (PNG, JPG, GIF, WEBP) या PDF अटैच करें।",
  "toast.uploadFailed": "अपलोड विफल",
  "error.uploadFailed": "अपलोड विफल।",
};
export default support;
