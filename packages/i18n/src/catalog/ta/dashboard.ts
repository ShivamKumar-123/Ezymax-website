import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // Page header (Client Area home)
  "greeting.morning": "காலை வணக்கம், {name}",
  "greeting.afternoon": "மதிய வணக்கம், {name}",
  "greeting.evening": "மாலை வணக்கம், {name}",
  "greeting.welcome": "வரவேற்கிறோம், {name}",
  "subtitle.live": "Kalks க்கு வரவேற்கிறோம். உங்கள் கணக்கும் இன்றைய சந்தைகளும் இதோ.",
  "subtitle.demo": "இன்று உங்கள் கணக்குகள் எப்படிச் செயல்படுகின்றன என்பது இதோ.",
  launchTrader: "Kalks Trader ஐத் தொடங்கு",
  openTerminal: "டிரேடிங் டெர்மினலைத் திற",

  // Getting started checklist
  "steps.title": "தொடங்குதல்",
  "steps.subtitle": "லைவ் டிரேடிங்கை நோக்கிய உங்கள் முன்னேற்றம்",
  "steps.progress": "{total} இல் {done}",
  "steps.account.title": "உங்கள் கணக்கை உருவாக்குங்கள்",
  "steps.account.text": "{date} அன்று பதிவுசெய்யப்பட்டது.",
  "steps.email.title": "உங்கள் மின்னஞ்சலைச் சரிபார்க்கவும்",
  "steps.email.verified": "{email} சரிபார்க்கப்பட்டது.",
  "steps.email.confirm": "நாங்கள் அனுப்பிய குறியீட்டுடன் {email} ஐ உறுதிப்படுத்தவும்.",
  "steps.kyc.title": "உங்கள் அடையாளத்தைச் சரிபார்க்கவும்",
  "steps.kyc.verified": "உங்கள் அடையாளம் சரிபார்க்கப்பட்டது. பணம் எடுத்தல் திறக்கப்பட்டது.",
  "steps.kyc.moreInfo": "எங்கள் குழுவுக்கு உங்களிடமிருந்து இன்னும் ஒரு ஆவணம் தேவை.",
  "steps.kyc.review": "உங்கள் ஆவணங்கள் எங்கள் சரிபார்ப்புக் குழுவிடம் உள்ளன.",
  "steps.kyc.draft": "விட்ட இடத்திலிருந்து தொடருங்கள். சுமார் 3 நிமிடங்கள் ஆகும்.",
  "steps.kyc.rejected": "உங்கள் ஆவணங்களைச் சரிபார்க்க முடியவில்லை. நீங்கள் மீண்டும் தொடங்கலாம்.",
  "steps.kyc.todo": "சுமார் 3 நிமிடங்கள் ஆகும். பணம் எடுத்தலைத் திறக்கும்.",
  "steps.accountOpen.title": "டிரேடிங் கணக்கைத் திறங்கள்",
  "steps.accountOpen.opened": { one: "{live} லைவ் மற்றும் {demo} டெமோ கணக்கு திறந்துள்ளது.", other: "{live} லைவ் மற்றும் {demo} டெமோ கணக்குகள் திறந்துள்ளன." },
  "steps.accountOpen.todo": "லைவ் அல்லது டெமோ கணக்கைத் திறங்கள்; உங்கள் லாகின் உடனே வழங்கப்படும்.",
  "steps.wallet.title": "உங்கள் வாலட்டுக்கு நிதியளியுங்கள்",
  "steps.wallet.text": "TRC20 இல் USDT டெபாசிட்கள் இணைக்கப்பட்டு வருகின்றன.",
  // Step status chips
  "steps.state.done": "முடிந்தது",
  "steps.state.todo": "செய்ய வேண்டியது",
  "steps.state.review": "பரிசீலனையில்",
  "steps.state.rejected": "நிராகரிக்கப்பட்டது",
  "steps.state.soon": "தொடங்கவில்லை",

  // Trading accounts card
  "accounts.title": "டிரேடிங் கணக்குகள்",
  "accounts.summary": "லைவ் ஈக்விட்டி <b>{equity}</b> · {live} லைவ் · {demo} டெமோ · {positions} திறந்த பொசிஷன்கள்",
  "accounts.subtitle": "உங்கள் லைவ் மற்றும் டெமோ கணக்குகள்",
  "accounts.all": "அனைத்துக் கணக்குகளும்",
  "accounts.open": "கணக்கைத் திற",
  "accounts.unavailable": "டிரேடிங் கணக்குகள் தற்போது கிடைக்கவில்லை. உங்கள் பேலன்ஸ்கள் பாதுகாப்பாக உள்ளன.",
  "accounts.openLive.title": "லைவ் கணக்கைத் திறங்கள்",
  "accounts.openLive.text": "உண்மையான சந்தைகள். பூஜ்ஜிய பேலன்ஸில் தொடங்கும்; உங்கள் வாலட்டிலிருந்து நிதியளியுங்கள்.",
  "accounts.openDemo.title": "டெமோ கணக்கைத் திறங்கள்",
  "accounts.openDemo.text": "நிகழ்நேர விலைகளில் மெய்நிகர் நிதி, தினமும் நிரப்பலாம்.",
  "accounts.more": { one: "மேலும் {count} கணக்கு", other: "மேலும் {count} கணக்குகள்" },
  "accounts.myTitle": "எனது டிரேடிங் கணக்குகள்",

  // Your account card
  "account.title": "உங்கள் கணக்கு",
  "account.clientId": "கிளையன்ட் ID",
  "account.emailStatus": "மின்னஞ்சல் நிலை",
  "account.notVerified": "சரிபார்க்கப்படவில்லை",
  "account.identity": "அடையாளம்",
  "account.memberSince": "உறுப்பினரான தேதி",
  "account.profile": "சுயவிவரம்",

  // Kalks Trader banner
  "trader.chip": "லைவ் விலைகள்",
  "trader.text": "ஃபாரெக்ஸ், உலோகங்கள், குறியீடுகள், எரிசக்தி, கிரிப்டோ மற்றும் பங்குகளில் {count} கருவிகளுக்கான நிகழ்நேர விலைகள் மற்றும் சார்ட்கள். உங்கள் பிரவுசரில் இயங்கும், நிறுவ எதுவும் தேவையில்லை.",

  // Market clock / heatmap
  "sessions.title": "சந்தைக் கடிகாரம்",
  "sessions.open": "{total} இல் {open} சந்தைகள் திறந்துள்ளன",
  "heatmap.title": "சந்தை ஹீட்மேப்",
  "heatmap.subtitle": "லைவ் விலைகளிலிருந்து இன்றைய நகர்வு · வெற்றுப் புள்ளி: சந்தை மூடியுள்ளது",
  "heatmap.up": "{count} ஏற்றம்",
  "heatmap.down": "{count} இறக்கம்",
  "heatmap.allMarkets": "அனைத்துச் சந்தைகளும்",
  "heatmap.tipOpen": "{symbol} · சந்தை திறந்துள்ளது",
  "heatmap.tipClosed": "{symbol} · சந்தை மூடியுள்ளது, கடந்த அமர்வின் நகர்வு",

  // Support card
  "support.title": "உதவி தேவையா?",
  "support.text": "உங்கள் பதிவுசெய்த முகவரியிலிருந்து <mail>{email}</mail> க்கு எழுதுங்கள், உங்கள் கிளையன்ட் ID ஐச் சேர்க்கவும்.",
  "support.emailSupport": "மின்னஞ்சல் உதவி",
  "support.copied": "மின்னஞ்சல் முகவரி நகலெடுக்கப்பட்டது",
  "support.copyFailed": "நகலெடுக்க முடியவில்லை, முகவரியைத் தேர்ந்தெடுக்கவும்",

  // Demo dashboard: onboarding strip
  "onboarding.title": "உங்கள் கணக்கு அமைப்பை முடியுங்கள்",
  "onboarding.text": "பணம் எடுத்தல் மற்றும் அதிக வரம்புகளைத் திறக்க KYC ஐ முடியுங்கள்.",
  "onboarding.progress": "முன்னேற்றம்",
  "onboarding.dismiss": "நிராகரி",

  // Margin health
  "margin.title": "மார்ஜின் நிலை",
  "margin.subtitle": "அனைத்து லைவ் கணக்குகளிலும்",
  "margin.healthy": "ஆரோக்கியமானது",
  "margin.level": "மார்ஜின் லெவல்",
  "margin.used": "பயன்படுத்திய மார்ஜின்",
  "margin.free": "ஃப்ரீ மார்ஜின்",

  // Equity / P&L
  "equity.title": "மொத்த ஈக்விட்டி",
  "equity.changeOver": "{range} இல் மாற்றம்",
  "pnl.title": "லாபம் / நஷ்டம் · மாதம்",
  "pnl.lowRisk": "குறைந்த அபாயம்",
  "pnl.winRate": "வெற்றி விகிதம் (30நா)",
  "pnl.trades": "டிரேடுகள் (30நா)",
  "pnl.avgWin": "சராசரி லாப டிரேடு",
  "pnl.avgLoss": "சராசரி நஷ்ட டிரேடு",
  "pnl.charges": "செலுத்திய கட்டணங்கள்",

  // KPI cards
  "kpi.wallet": "வாலட்",
  "kpi.today": "இன்று +{pct}%",
  "kpi.monthPnl": "மாத P&L",
  "kpi.vsLastMonth": "கடந்த மாதத்தை விட +{pct}%",
  "kpi.partnerEarnings": "பார்ட்னர் வருமானம்",
  "kpi.copy": "காப்பி {amount}",

  // Top movers
  "movers.title": "அதிக நகர்வுகள்",
  "movers.gainers": "ஏற்றம் கண்டவை",
  "movers.losers": "இறக்கம் கண்டவை",

  // Economic calendar. A = Actual, F = Forecast, P = Previous
  "calendar.title": "பொருளாதார நாட்காட்டி",
  "calendar.subtitle": "இன்று · சர்வர் நேரம் GMT+3",
  "calendar.actual": "A {value} · ",
  "calendar.forecastPrevious": "F {forecast} · P {previous}",

  // News / world
  "news.title": "சந்தைச் செய்திகள்",
  "news.all": "அனைத்துச் செய்திகளும்",
  "news.pinned": "பின் செய்யப்பட்டது",
  "world.title": "உலகெங்கும் சந்தைகள் & செய்திகள்",
  "world.subtitle": "நாடு வாரியான லைவ் தலைப்புச் செய்திகள் மற்றும் நாணய உணர்வு",
  "world.stories": { one: "இன்று {count} செய்தி", other: "இன்று {count} செய்திகள்" },

  // Open positions
  "positions.title": "திறந்த பொசிஷன்கள்",
  "positions.summary": { one: "{count} பொசிஷன் · ஃப்ளோட்டிங்", other: "{count} பொசிஷன்கள் · ஃப்ளோட்டிங்" },
  "positions.terminal": "டெர்மினல்",

  // Partner banner
  "partner.chip": "பார்ட்னர் திட்டம்",
  "partner.title": "டிரேடர்களை அழையுங்கள். ஒரு லாட்டுக்கு $15 வரை சம்பாதியுங்கள் — வாழ்நாள் முழுவதும்.",
  "partner.text": "பல அடுக்குக் கமிஷன்கள், CPA போனஸ்கள் மற்றும் நிகழ்நேரக் கண்காணிப்பு. உங்கள் இணைப்பு: <link>{url}</link>",
  "partner.open": "பார்ட்னர் டாஷ்போர்டைத் திற",

  // Short relative times
  "time.justNow": "இப்போது",
  "time.minutesAgo": "{count}நி முன்பு",
  "time.hoursAgo": "{count}ம முன்பு",
  "time.daysAgo": "{count}நா முன்பு",
  "time.ago": "{time} முன்பு",

  // Notifications bell / panel
  "notifications.title": "அறிவிப்புகள்",
  "notifications.ariaUnread": "அறிவிப்புகள், {count} படிக்காதவை",
  "notifications.markAll": "அனைத்தையும் படித்ததாகக் குறி",
  "notifications.clear": "அழி",
  "notifications.emptyTitle": "இன்னும் அறிவிப்புகள் இல்லை",
  "notifications.emptyText": "டெபாசிட்கள், பணம் எடுத்தல், சரிபார்ப்பு, டிரேடிங் எச்சரிக்கைகள் மற்றும் உதவிக் குழுவின் பதில்கள் இங்கே தோன்றும்.",
  "notifications.settings": "அறிவிப்பு அமைப்புகள்",
};
export default dashboard;
