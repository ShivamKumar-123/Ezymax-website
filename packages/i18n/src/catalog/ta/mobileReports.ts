import type { NsMessages } from "../../core";

// Kalks mobile app, Reports: Statements and Analytics (mobile-only text; the rest reuse portfolio.st.* / portfolio.an.*).
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "அறிக்கைகள்",
  "eyebrow.analytics": "அறிக்கைகள் · USD · சர்வர் நேரம்",

  // Account picker (a card that opens a sheet)
  "account.title": "கணக்கு",
  "account.choose": "ஒரு கணக்கைத் தேர்வுசெய்யுங்கள்",
  "account.allHint": { one: "{count} லைவ் கணக்கு", other: "{count} லைவ் கணக்குகள்" },
  "account.change": "கணக்கை மாற்று",

  // Statements
  "st.day": "நாள்",
  "st.pickDay": "ஒரு நாளைத் தேர்வுசெய்யுங்கள்",
  "st.pickFrom": "தொடக்கத் தேதி",
  "st.pickTo": "இறுதித் தேதி",
  "st.include": "சேர்க்க வேண்டியவை",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "தயாராகிறது…",
  "st.ready": "அறிக்கை தயார்",
  "st.saved": "{file} ஆகச் சேமிக்கப்பட்டது",
  "st.shareTitle": "அறிக்கையைப் பகிர்",
  "st.failed": "அறிக்கையைப் பதிவிறக்க முடியவில்லை",
  "st.offline": "நீங்கள் ஆஃப்லைனில் உள்ளீர்கள். அறிக்கைகளைப் பதிவிறக்க இணையுங்கள்.",
  "st.monthly.empty": "இன்னும் அறிக்கை மாதங்கள் இல்லை.",
  "st.monthly.offline": "நீங்கள் ஆஃப்லைனில் உள்ளீர்கள். மாதாந்திர அறிக்கைகளைப் பார்க்க இணையுங்கள்.",
  "st.monthly.a11y": "{month}: நிகரம் {net}, {trades}. பதிவிறக்கங்களைத் திறக்கும்.",
  "st.month.title": "{month} அறிக்கை",
  "st.month.formats": "இவ்வாறு பதிவிறக்கு",
  "st.prevMonth": "முந்தைய மாதம்",
  "st.nextMonth": "அடுத்த மாதம்",

  // Analytics: hero and stat tiles
  "an.hero.label": "நிகர P&L · {period}",
  "an.hero.return": "வருமானம்",
  "an.hero.trades": "டிரேடுகள்",
  "an.hero.lots": "லாட்கள்",
  "an.tile.sharpe": "Sharpe விகிதம்",
  "an.tile.expectancy": "எதிர்பார்ப்பு",
  "an.tile.sortino": "Sortino {value}",
  "an.tile.avgWinLoss": "சராசரி லாபம் / நஷ்டம்",
  "an.tile.rr": "லாபம் : அபாயம் 1 : {value}",
  "an.tile.holdSplit": "லாபம் {win} · நஷ்டம் {loss}",
  "an.tile.streaks": "தொடர்கள்",
  "an.tile.streaksSub": "தொடர் லாபங்கள் / நஷ்டங்கள்",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "இன்னும் டிரேடு இல்லை",

  // Analytics: curves
  "an.curve.hint": "ஒவ்வொரு நாளையும் பார்க்க சார்ட்டைத் தொட்டுப் பிடியுங்கள்",
  "an.curve.drawdown": "டிராடவுன்",
  "an.curve.a11y": "{date} அன்று ஈக்விட்டி {equity}, பேலன்ஸ் {balance}. அதிகபட்ச டிராடவுன் {drawdown}.",

  // Analytics: P&L calendar (net of closed trades per server day)
  "an.cal.title": "P&L காலண்டர்",
  "an.cal.subtitle": "ஒவ்வொரு சர்வர் நாளிலும் மூடிய டிரேடுகளின் நிகர முடிவு",
  "an.cal.subtitleEstimated": "தினசரி பேலன்ஸ் மாற்றம், டெபாசிட்களும் பணம் எடுத்தல்களும் நீக்கப்பட்டவை",
  "an.cal.days": { one: "{count} டிரேடிங் நாள்", other: "{count} டிரேடிங் நாட்கள்" },
  "an.cal.green": "{count} பச்சை",
  "an.cal.red": "{count} சிவப்பு",
  "an.cal.noTrades": "மூடிய டிரேடுகள் இல்லை",
  "an.cal.select": "முடிவைப் பார்க்க ஒரு நாளைத் தட்டவும்",
  "an.cal.a11yDay": "{date}: {net}, {trades}",

  // Analytics: breakdowns
  "an.hour.byHour": "மணிநேர வாரியாக நிகர P&L",
  "an.hour.byDayHour": "வார நாள் × மணிநேரம்",
  "an.hour.tap": "விவரங்களுக்கு ஒரு பட்டை அல்லது கலத்தைத் தட்டவும்",
  "an.tapBar": "விவரங்களுக்கு ஒரு பட்டையைத் தட்டவும்",
  "an.session.best": "சிறந்தது",
  "an.session.asia": "ஆசியா",
  "an.session.london": "லண்டன்",
  "an.session.overlap": "லண்டன் / நியூயார்க்",
  "an.session.newYork": "நியூயார்க்",
  "an.session.lateNewYork": "பிற்பகுதி நியூயார்க்",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "தற்போதைய ஈக்விட்டி",
  "an.charges.total": "செலுத்திய கட்டணங்கள்",

  // Behaviour insights (the numbers come from the reports service)
  "insight.overtrading.title": { one: "{count} நாள் அதிக டிரேடிங்", other: "{count} நாட்கள் அதிக டிரேடிங்" },
  "insight.overtrading.text": "இந்த நாட்களில் நீங்கள் {limit} க்கும் அதிகமான டிரேடுகளைச் செய்தீர்கள் (உங்கள் வழக்கமான நாள் {median}). அந்த நாட்களின் நிகர முடிவு: {net}.",
  "insight.overtrading.tip": "நாளொன்றுக்கு {cap} டிரேடுகள் என்ற வரம்பை அமையுங்கள்.",
  "insight.revenge.title": { one: "{count} சாத்தியமான பழிவாங்கும் டிரேடு", other: "{count} சாத்தியமான பழிவாங்கும் டிரேடுகள்" },
  "insight.revenge.text": "நஷ்டத்தில் மூடிய 15 நிமிடங்களுக்குள், அதே அளவில் அல்லது பெரிதாகத் திறந்த டிரேடுகள். அவை {rate}% முறை லாபம் தந்தன, மொத்தம் {net}.",
  "insight.revenge.tip": "நஷ்டத்திற்குப் பிறகு அடுத்த டிரேடுக்கு முன் 15 நிமிடங்கள் இடைவெளி விடுங்கள்.",
  "insight.risk.title": "ஒரு நஷ்ட டிரேடுக்கான அபாயம்",
  "insight.risk.text": { one: "ஒரு நஷ்ட டிரேடு சராசரியாக உங்கள் பேலன்ஸில் {avg}%, அதிகபட்சம் {max}% இழப்பை ஏற்படுத்தியது. {count} நஷ்டம் 2% ஐ மீறியது.", other: "ஒரு நஷ்ட டிரேடு சராசரியாக உங்கள் பேலன்ஸில் {avg}%, அதிகபட்சம் {max}% இழப்பை ஏற்படுத்தியது. {count} நஷ்டங்கள் 2% ஐ மீறின." },
  "insight.risk.tip": "ஸ்டாப் லாஸ் பேலன்ஸில் அதிகபட்சம் 1–2% மட்டுமே இழக்கும்படி பொசிஷன் அளவை அமையுங்கள்.",
  "insight.holdLosers.title": "லாப டிரேடுகளை விட நஷ்ட டிரேடுகள் நீண்ட நேரம் வைக்கப்படுகின்றன",
  "insight.holdLosers.text": "நஷ்ட டிரேடுகள் சராசரியாக {loss}, லாப டிரேடுகள் {win} திறந்திருக்கின்றன.",
  "insight.holdLosers.tip": "டிரேடைத் திறக்கும்போதே ஸ்டாப் லாஸ் வைத்து, அதை மாற்றாமல் விடுங்கள்.",
  "insight.stopOut.title": { one: "{count} ஸ்டாப் அவுட் மூடல்", other: "{count} ஸ்டாப் அவுட் மூடல்கள்" },
  "insight.stopOut.text": "பொசிஷன்கள் உங்கள் சொந்த ஸ்டாப் லாஸால் அல்ல, மார்ஜின் ஸ்டாப் அவுட்டால் மூடப்பட்டன.",
  "insight.stopOut.tip": "சிறிய பொசிஷன்களுடன் மார்ஜின் லெவலை மார்ஜின் கால் அளவுக்கு மேல் வைத்திருங்கள்.",
  "insight.slTp.title": "ஸ்டாப் லாஸ் அல்லது டேக் ப்ராஃபிட்டால் மூடிய டிரேடுகள்",
  "insight.slTp.text": "{tp} டேக் ப்ராஃபிட்டால், {sl} ஸ்டாப் லாஸால், மீதமுள்ளவை கைமுறையாக அல்லது டெஸ்க்கால் மூடப்பட்டன.",
  "insight.slTp.tip": "திட்டமிட்ட வெளியேற்றங்கள் முடிவுகளை நிலையாக வைக்கும்.",
  "insight.session.title": "சிறந்த செஷன்: {session}",
  "insight.session.text": "{rate}% வெற்றி விகிதத்துடன் {trades} டிரேடுகள். பலவீனமானது: {worst} ({net}).",
  "insight.session.tip": "{session} செஷனில் கவனம் செலுத்துங்கள்.",
  "insight.tip": "குறிப்பு",

  // States
  "state.updating": "புதுப்பிக்கிறது…",
  "state.stale": "சேமித்த தரவு காட்டப்படுகிறது. புதுப்பிக்கக் கீழே இழுக்கவும்.",
  "state.notShared.title": "உங்களுடன் பகிரப்படவில்லை",
  "state.footer": "அனைத்துத் தொகைகளும் USD இல் (சென்ட் கணக்குகள் மாற்றப்பட்டவை). நேரங்கள் சர்வர் நேரம், GMT+2 / GMT+3.",
  "state.footerStatements": "அறிக்கைகள் கணக்கின் நாணயத்தில் உள்ளன (சென்ட் கணக்குகளுக்கு USC). நேரங்கள் சர்வர் நேரம், GMT+2 / GMT+3.",
};
export default mobileReports;
