import type { NsMessages } from "../../core";

// Kalks mobile app, Reports: Statements and Analytics (mobile-only text; the rest reuse portfolio.st.* / portfolio.an.*).
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "Ripoti",
  "eyebrow.analytics": "Ripoti · USD · saa ya seva",

  // Account picker
  "account.title": "Akaunti",
  "account.choose": "Chagua akaunti",
  "account.allHint": { one: "Akaunti {count} halisi", other: "Akaunti {count} halisi" },
  "account.change": "Badilisha akaunti",

  // Statements
  "st.day": "Siku",
  "st.pickDay": "Chagua siku",
  "st.pickFrom": "Tarehe ya kuanza",
  "st.pickTo": "Tarehe ya mwisho",
  "st.include": "Jumuisha",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "Inaandaa…",
  "st.ready": "Taarifa iko tayari",
  "st.saved": "Imehifadhiwa kama {file}",
  "st.shareTitle": "Shiriki taarifa",
  "st.failed": "Taarifa haikuweza kupakuliwa",
  "st.offline": "Huko mtandaoni. Unganisha ili upakue taarifa.",
  "st.monthly.empty": "Bado hakuna miezi ya taarifa.",
  "st.monthly.offline": "Huko mtandaoni. Unganisha ili uone taarifa za kila mwezi.",
  "st.monthly.a11y": "{month}: halisi {net}, {trades}. Hufungua upakuaji.",
  "st.month.title": "Taarifa ya {month}",
  "st.month.formats": "Pakua kama",
  "st.prevMonth": "Mwezi uliopita",
  "st.nextMonth": "Mwezi ujao",

  // Analytics: hero and stat tiles
  "an.hero.label": "P&L halisi · {period}",
  "an.hero.return": "Mapato",
  "an.hero.trades": "Biashara",
  "an.hero.lots": "Loti",
  "an.tile.sharpe": "Uwiano wa Sharpe",
  "an.tile.expectancy": "Matarajio",
  "an.tile.sortino": "Sortino {value}",
  "an.tile.avgWinLoss": "Wastani ushindi / hasara",
  "an.tile.rr": "Faida : hatari 1 : {value}",
  "an.tile.holdSplit": "Zilizoshinda {win} · zilizopoteza {loss}",
  "an.tile.streaks": "Mfululizo",
  "an.tile.streaksSub": "Ushindi / hasara mfululizo",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "Bado hakuna biashara",

  // Analytics: curves
  "an.curve.hint": "Gusa na ushikilie chati ili uone kila siku",
  "an.curve.drawdown": "Drawdown",
  "an.curve.a11y": "Equity {equity}, salio {balance} tarehe {date}. Drawdown ya juu {drawdown}.",

  // Analytics: P&L calendar (net of closed trades per server day)
  "an.cal.title": "Kalenda ya P&L",
  "an.cal.subtitle": "Matokeo halisi ya biashara zilizofungwa kwa kila siku ya seva",
  "an.cal.subtitleEstimated": "Mabadiliko ya salio ya kila siku, bila uwekaji na utoaji",
  "an.cal.days": { one: "Siku {count} ya biashara", other: "Siku {count} za biashara" },
  "an.cal.green": "{count} za kijani",
  "an.cal.red": "{count} nyekundu",
  "an.cal.noTrades": "Hakuna biashara zilizofungwa",
  "an.cal.select": "Gusa siku uone matokeo yake",
  "an.cal.a11yDay": "{date}: {net}, {trades}",

  // Analytics: breakdowns
  "an.hour.byHour": "P&L halisi kwa saa",
  "an.hour.byDayHour": "Siku ya wiki × saa",
  "an.hour.tap": "Gusa pau au kisanduku kwa maelezo",
  "an.tapBar": "Gusa pau kwa maelezo",
  "an.session.best": "Bora",
  "an.session.asia": "Asia",
  "an.session.london": "London",
  "an.session.overlap": "London / New York",
  "an.session.newYork": "New York",
  "an.session.lateNewYork": "New York jioni",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "Equity sasa",
  "an.charges.total": "Ada zilizolipwa",

  // Behaviour insights (the numbers come from the reports service)
  "insight.overtrading.title": { one: "Biashara kupita kiasi siku {count}", other: "Biashara kupita kiasi siku {count}" },
  "insight.overtrading.text": "Siku hizi uliweka zaidi ya biashara {limit} (siku yako ya kawaida ni {median}). Matokeo halisi ya siku hizo: {net}.",
  "insight.overtrading.tip": "Weka kikomo cha biashara {cap} kwa siku.",
  "insight.revenge.title": { one: "Biashara {count} inayowezekana ya kulipiza kisasi", other: "Biashara {count} zinazowezekana za kulipiza kisasi" },
  "insight.revenge.text": "Biashara zilizofunguliwa ndani ya dakika 15 baada ya kufunga kwa hasara, kwa ukubwa uleule au zaidi. Zilishinda {rate}% ya mara, kwa jumla ya {net}.",
  "insight.revenge.tip": "Pumzika dakika 15 baada ya hasara kabla ya biashara inayofuata.",
  "insight.risk.title": "Hatari kwa kila biashara ya hasara",
  "insight.risk.text": { one: "Biashara ya hasara iligharimu wastani wa {avg}% ya salio lako, {max}% kwa juu kabisa. Hasara {count} ilizidi 2%.", other: "Biashara ya hasara iligharimu wastani wa {avg}% ya salio lako, {max}% kwa juu kabisa. Hasara {count} zilizidi 2%." },
  "insight.risk.tip": "Panga ukubwa wa nafasi ili stop-loss igharimu si zaidi ya 1–2% ya salio.",
  "insight.holdLosers.title": "Biashara za hasara hushikiliwa muda mrefu kuliko za faida",
  "insight.holdLosers.text": "Biashara za hasara hukaa wazi {loss} kwa wastani, za faida {win}.",
  "insight.holdLosers.tip": "Weka stop-loss unapofungua biashara na uiache ilipo.",
  "insight.stopOut.title": { one: "Kufungwa {count} kwa stop-out", other: "Kufungwa {count} kwa stop-out" },
  "insight.stopOut.text": "Nafasi zilifungwa na stop-out ya margin, si na stop-loss yako mwenyewe.",
  "insight.stopOut.tip": "Weka kiwango cha margin juu ya kiwango cha margin call kwa nafasi ndogo zaidi.",
  "insight.slTp.title": "Biashara zilizofungwa kwa stop-loss au take-profit",
  "insight.slTp.text": "{tp} kwa take-profit, {sl} kwa stop-loss, zilizobaki zilifungwa kwa mkono au na dealing desk.",
  "insight.slTp.tip": "Njia za kutoka zilizopangwa huweka matokeo thabiti.",
  "insight.session.title": "Kipindi bora: {session}",
  "insight.session.text": "Biashara {trades} kwa kiwango cha ushindi cha {rate}%. Dhaifu zaidi: {worst} ({net}).",
  "insight.session.tip": "Lenga kipindi cha {session}.",
  "insight.tip": "Kidokezo",

  // States
  "state.updating": "Inasasisha…",
  "state.stale": "Inaonyesha data iliyohifadhiwa. Vuta chini ili kuonyesha upya.",
  "state.notShared.title": "Haijashirikiwa nawe",
  "state.footer": "Kiasi chote kiko kwa USD (akaunti za senti zimebadilishwa). Muda ni saa ya seva, GMT+2 / GMT+3.",
  "state.footerStatements": "Taarifa ziko kwa sarafu ya akaunti (USC kwa akaunti za senti). Muda ni saa ya seva, GMT+2 / GMT+3.",
};
export default mobileReports;
