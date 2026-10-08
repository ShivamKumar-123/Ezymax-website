import type { NsMessages } from "../../core";

// Client Area support: live chat, launcher, support page.
const support: NsMessages<"support"> = {
  // Support page
  "page.title": "உதவி",
  "page.subtitle": "உடனடி பதில்களுக்கு Ezymex AI உடன் அரட்டையடிக்கவும். எப்போது வேண்டுமானாலும் ஒரு நபரைக் கேட்கலாம்; எங்கள் குழு முழு உரையாடலுடன் பொறுப்பேற்கும்.",
  "email.prefer": "மின்னஞ்சல் விரும்புகிறீர்களா?",
  // <email> and <id> wrap the client's email address and client ID
  "email.writeFrom": "<email>{email}</email> இலிருந்து எழுதி, உங்கள் கிளையன்ட் ID <id>{id}</id> ஐச் சேர்க்கவும்.",
  "email.write": "உதவிக் குழுவுக்கு எழுதவும்",
  "email.copyId": "கிளையன்ட் ID ஐ நகலெடு",
  clientId: "கிளையன்ட் ID",
  notice: "எங்கள் குழுவின் பதில்கள் அறிவிப்பு மணியிலும் தோன்றும்; நீங்கள் இல்லாதபோது மின்னஞ்சல் அனுப்புவோம். இதை சுயவிவரம் → அறிவிப்புகள் பகுதியில் மாற்றலாம்.",
  "toast.copied": "{what} நகலெடுக்கப்பட்டது",
  "toast.copyFailed": "நகலெடுக்க முடியவில்லை, தயவுசெய்து அதைத் தேர்ந்தெடுக்கவும்",

  // Conversation status
  "status.bot": "AI உதவியாளர்",
  "status.waiting": "வரிசையில்",
  "status.assigned": "முகவருடன்",
  "status.resolved": "முடிந்தது",

  // Conversation history
  "history.title": "உங்கள் உரையாடல்கள்",
  "history.subtitle": "உரையாடல் பதிவுகள் உங்கள் Client Area-வில் வைக்கப்படும்",
  "history.emptyTitle": "இன்னும் உரையாடல்கள் இல்லை",
  "history.emptyText": "அரட்டையில் ஒரு கேள்வி கேளுங்கள், அது இங்கே தோன்றும்.",
  conversation: "உரையாடல்",
  "toast.openFailed": "உரையாடலைத் திறக்க முடியவில்லை",

  // Floating button
  "launcher.open": "உதவி அரட்டையைத் திற",
  "launcher.close": "உதவி அரட்டையை மூடு",

  // Chat
  you: "நீங்கள்",
  agent: "முகவர்",
  // Fallback name for a team member without a name
  supportName: "உதவி",
  // File size, e.g. "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // Suggested first questions (sent as the client's message)
  "quick.verify": "எனது அடையாளத்தை எப்படிச் சரிபார்ப்பது?",
  "quick.deposit": "USDT ஐ எப்படி டெபாசிட் செய்வது?",
  "quick.withdrawal": "எனது பணம் எடுத்தல் எப்போது வந்து சேரும்?",
  "quick.stopOut": "ஸ்டாப்-அவுட் என்றால் என்ன?",
  "header.supportTeam": "உதவிக் குழு",
  "header.agentSub": "கிளையன்ட் உதவி · Ezymex",
  "header.connecting": "உங்களை ஒரு முகவருடன் இணைக்கிறோம்…",
  "header.replySoon": "எங்கள் குழு விரைவில் இங்கே பதிலளிக்கும்",
  "header.helpCentre": "உதவி மையப் பதில்கள் · எப்போது வேண்டுமானாலும் ஒரு நபர் இணையலாம்",
  "header.instant": "உடனடிப் பதில்கள் · எப்போது வேண்டுமானாலும் ஒரு நபர் இணையலாம்",
  "chip.liveAgent": "நேரடி முகவர்",
  "menu.aria": "அரட்டை விருப்பங்கள்",
  "menu.talkToPerson": "ஒரு நபருடன் பேசு",
  "menu.endChat": "அரட்டையை முடி",
  "menu.newChat": "புதிய அரட்டையைத் தொடங்கு",
  closeChat: "அரட்டையை மூடு",
  unavailable: "அரட்டை தற்போது கிடைக்கவில்லை.",
  greeting: "வணக்கம் {name}.",
  "csat.question": "இந்த அரட்டை எப்படி இருந்தது?",
  "csat.stars": { one: "{count} நட்சத்திரம்", other: "{count} நட்சத்திரங்கள்" },
  "csat.placeholder": "ஏதேனும் சேர்க்க வேண்டுமா? (விருப்பத்தேர்வு)",
  "csat.send": "மதிப்பீட்டை அனுப்பு",
  "csat.rated": "இந்த அரட்டைக்கு நீங்கள் {rating}/5 மதிப்பீடு அளித்தீர்கள்",
  "composer.attach": "கோப்பை இணை",
  "composer.messageTo": "{name} க்குச் செய்தி…",
  "composer.newChat": "புதிய அரட்டையைத் தொடங்குங்கள்…",
  "composer.ask": "{name} இடம் எதையும் கேளுங்கள்…",
  "composer.aria": "செய்தி",
  disclaimer: "{name} தவறு செய்யக்கூடும், ஒருபோதும் முதலீட்டு ஆலோசனை வழங்காது. தரத்திற்காக அரட்டைகள் பதிவு செய்யப்படுகின்றன.",
  "toast.chattingWith": "நீங்கள் {name} உடன் அரட்டையடிக்கிறீர்கள்",
  "toast.inQueue": "முகவருக்கான வரிசையில் உள்ளீர்கள்",
  "toast.notSent": "செய்தி அனுப்பப்படவில்லை",
  "toast.teamUnreachable": "குழுவைத் தொடர்பு கொள்ள முடியவில்லை",
  "toast.endFailed": "அரட்டையை முடிக்க முடியவில்லை",
  "toast.rateFailed": "மதிப்பீடு சேமிக்கப்படவில்லை",
  "toast.thanks": "உங்கள் கருத்துக்கு நன்றி",
  "toast.fileTooLarge": "கோப்பு மிகப் பெரியது",
  "toast.fileTooLargeText": "கோப்புகள் அதிகபட்சம் {mb} MB வரை இருக்கலாம்.",
  "toast.unsupported": "ஆதரிக்கப்படாத கோப்பு",
  "toast.unsupportedText": "ஒரு படத்தை (PNG, JPG, GIF, WEBP) அல்லது PDF ஐ இணைக்கவும்.",
  "toast.uploadFailed": "பதிவேற்றம் தோல்வியடைந்தது",
  "error.uploadFailed": "பதிவேற்றம் தோல்வியடைந்தது.",
};
export default support;
