import type { NsMessages } from "../../core";

// Kalks mobile app (src/features/platform): the notifications inbox, push notifications, the app lock
// (Face ID / fingerprint / the phone's passcode), "Continue with Google" and links that open the app.
// Keep brand and product names as they are: Kalks, Face ID, Touch ID, Google.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // Notifications inbox (/notifications)
  "inbox.eyebrow": "इनबॉक्स",
  "inbox.unread": { one: "{count} अपठित", other: "{count} अपठित" },
  "inbox.caughtUp": "सब पढ़ लिया",
  "inbox.filter.unread": "अपठित",
  "inbox.markedAll": "सभी पढ़े हुए मार्क किए गए",
  "inbox.emptyUnread.title": "सब पढ़ लिया",
  "inbox.emptyUnread.body": "आपने हर सूचना पढ़ ली है। नई सूचनाएँ आते ही यहाँ दिखेंगी।",
  "inbox.loadMoreFailed": "पुरानी सूचनाएँ लोड नहीं हो सकीं। फिर से कोशिश करने के लिए टैप करें।",
  // Under the title while the phone is offline and the inbox shows what it saved earlier
  "inbox.offlineCached": "आप ऑफ़लाइन हैं। ये इस फ़ोन पर सेव की गई सूचनाएँ हैं।",
  // Row accessibility
  "inbox.a11y.unread": "अपठित",
  "inbox.a11y.settings": "सूचना सेटिंग्स",
  // Detail sheet of a notification without a screen to open
  "inbox.detail.openWeb": "लिंक खोलें",
  "inbox.detail.received": "{time} को मिली",

  // Asking for push permission (never on the first launch): a sheet on Home and a card in the inbox
  "push.ask.eyebrow": "सूचनाएँ",
  "push.ask.title": "जो भी हो, तुरंत जानें",
  "push.ask.body": "जमा क्रेडिट हुई, निकासी भेजी गई, मार्जिन कॉल, स्टॉप आउट और सहायता टीम के जवाब, सीधे आपकी लॉक स्क्रीन पर।",
  "push.ask.point.money": "जमा और निकासी",
  "push.ask.point.risk": "मार्जिन कॉल और स्टॉप आउट",
  "push.ask.point.support": "सहायता टीम के जवाब",
  "push.ask.allow": "सूचनाएँ चालू करें",
  "push.ask.later": "अभी नहीं",
  "push.ask.note": "विषय आप प्रोफ़ाइल › सूचनाएँ में चुनते हैं। ऑफ़र तभी भेजे जाते हैं जब आप उन्हें चालू करें।",
  // The sample notification drawn in the ask, as it would look on the lock screen ("now" = its time label)
  "push.ask.now": "अभी",
  "push.ask.sampleTitle": "जमा क्रेडिट हुई",
  "push.ask.sampleBody": "आपके वॉलेट में 250.00 USDT क्रेडिट हुए।",
  "push.card.title": "पुश सूचनाएँ चालू करें",
  "push.card.body": "जमा, फ़िल और मार्जिन कॉल अपनी लॉक स्क्रीन पर पाएँ।",
  "push.card.action": "चालू करें",
  "push.card.deniedTitle": "पुश सूचनाएँ बंद हैं",
  "push.card.deniedBody": "इन्हें लॉक स्क्रीन पर पाने के लिए अपने फ़ोन की सेटिंग्स में Kalks के लिए सूचनाओं की अनुमति दें।",
  "push.card.deniedAction": "सेटिंग्स खोलें",
  "push.card.dismiss": "छिपाएँ",
  "push.enabled": "पुश सूचनाएँ चालू हैं",
  // Android notification channels (shown in the phone's settings for the app)
  "push.channel.alerts": "मार्जिन कॉल और सुरक्षा",
  "push.channel.alertsHint": "मार्जिन कॉल और स्टॉप आउट की चेतावनियाँ, आपके प्राइस अलर्ट, नए साइन-इन",
  "push.channel.activity": "अकाउंट गतिविधि",
  "push.channel.activityHint": "जमा, निकासी, फ़िल, वेरिफ़िकेशन और सहायता टीम के जवाब",
  "push.channel.news": "न्यूज़ और ऑफ़र",
  "push.channel.newsHint": "प्रमोशन और प्रोडक्ट न्यूज़, जिन्हें आपने चुना है",
  // In-app banner for a push that arrives while the app is open
  "push.banner.a11y": "नई सूचना: {title}। खोलने के लिए डबल टैप करें।",

  // App lock screen (cold start, after the chosen time in the background, and /lock)
  "lock.eyebrow": "लॉक है",
  "lock.title": "फिर से स्वागत है",
  "lock.subtitle": "अपने अकाउंट और बैलेंस देखने के लिए अनलॉक करें।",
  // {method}: Face ID, Touch ID, fingerprint, face unlock or passcode
  "lock.unlockWith": "{method} से अनलॉक करें",
  "lock.unlock": "अनलॉक करें",
  "lock.prompt": "Kalks अनलॉक करें",
  "lock.promptSubtitle": "पुष्टि करें कि यह आप ही हैं",
  "lock.failed": "यह काम नहीं किया। फिर से कोशिश करें।",
  "lock.lockout": "बहुत ज़्यादा प्रयास। अपना फ़ोन उसके पासकोड से अनलॉक करें, फिर से कोशिश करें।",
  "lock.noScreenLock": "आपके फ़ोन में अब कोई स्क्रीन लॉक नहीं है, इसलिए Kalks पुष्टि नहीं कर सकता कि यह आप ही हैं। साइन आउट करें और अपने पासवर्ड से साइन इन करें।",
  "lock.notYou": "आप नहीं हैं, या अनलॉक नहीं हो रहा?",
  "lock.signOut": "साइन आउट करें",
  "lock.signOutTitle": "Kalks से साइन आउट करें?",
  "lock.signOutBody": "आप अपने ईमेल और पासवर्ड से फिर से साइन इन करेंगे। आपकी पोज़िशन और फ़ंड पर कोई असर नहीं पड़ता।",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "फ़िंगरप्रिंट",
  "lock.method.face": "फ़ेस अनलॉक",
  "lock.method.iris": "आइरिस",
  "lock.method.passcode": "पासकोड",

  // Settings › App lock (/settings/app-lock)
  "settings.eyebrow": "सुरक्षा",
  "settings.title": "ऐप लॉक",
  "settings.subtitle": "खुलने पर और बैकग्राउंड में रहने के बाद Kalks को {method} से लॉक रखें।",
  "settings.toggle": "Kalks लॉक करें",
  "settings.toggleHint": "{method} इस्तेमाल करता है, बैकअप के रूप में आपके फ़ोन का पासकोड",
  "settings.on": "ऐप लॉक चालू है",
  "settings.off": "ऐप लॉक बंद है",
  "settings.after": "इतने समय बाद फिर लॉक करें",
  "settings.afterHint": "Kalks फिर से पूछने से पहले कितनी देर बैकग्राउंड में रह सकता है। शुरू होने पर यह हमेशा पूछता है।",
  "settings.timeout.0": "तुरंत",
  "settings.timeout.60": "1 मिनट",
  "settings.timeout.300": "5 मिनट",
  "settings.timeout.900": "15 मिनट",
  "settings.timeout.3600": "1 घंटा",
  "settings.privacy": "ऐप लॉक चालू रहने पर, ऐप स्विचर में आपके बैलेंस की जगह एक कवर दिखता है।",
  "settings.lockNow": "अभी लॉक करें",
  "settings.confirmOn": "ऐप लॉक चालू करने के लिए पुष्टि करें",
  "settings.confirmOff": "ऐप लॉक बंद करने के लिए पुष्टि करें",
  // System prompt when the reader picks a longer "Lock again after" time
  "settings.confirmTimeout": "Kalks के लॉक होने का समय बदलने के लिए पुष्टि करें",
  // Toast body after a password sign-in on a phone whose screen lock was removed
  "settings.turnedOffNoScreenLock": "इस फ़ोन में कोई स्क्रीन लॉक नहीं है, इसलिए Kalks पुष्टि नहीं कर सकता कि यह आप ही हैं। ऐप लॉक फिर से इस्तेमाल करने के लिए अपने फ़ोन की सेटिंग्स में स्क्रीन लॉक सेट करें।",
  "settings.notConfirmed": "पुष्टि नहीं हुई, कुछ नहीं बदला",
  "settings.unavailableTitle": "पहले स्क्रीन लॉक सेट करें",
  "settings.unavailableBody": "ऐप लॉक आपके फ़ोन का Face ID, फ़िंगरप्रिंट या पासकोड इस्तेमाल करता है। अपने फ़ोन की सेटिंग्स में इनमें से कोई एक चालू करें, फिर वापस आएँ।",
  "settings.webTitle": "ऐप में उपलब्ध",
  "settings.webBody": "ऐप लॉक iPhone और Android के लिए Kalks ऐप में काम करता है।",
  "settings.thisPhone": "केवल इस फ़ोन पर लागू",

  // Links that open the app (kalks://…, notification taps) but match no screen
  "link.notFound.title": "यहाँ खोलने के लिए कुछ नहीं",
  "link.notFound.body": "यह लिंक ऐप की किसी स्क्रीन से मेल नहीं खाता। हो सकता है यह पुराना हो, या वेब पर क्लाइंट एरिया के लिए हो।",
  "link.notFound.home": "होम पर जाएँ",
  "link.openFailed": "यह लिंक नहीं खुल सका।",
};
export default mobilePlatform;
