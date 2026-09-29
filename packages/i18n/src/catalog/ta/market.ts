import type { NsMessages } from "../../core";

// Kalks Trader left panels: Market Watch, segment chips and Navigator.
const market: NsMessages<"market"> = {
  // Market Watch header and tabs
  title: "மார்க்கெட் வாட்ச்",
  collapse: "சுருக்கு",
  "tab.symbols": "சிம்பல்கள்",
  "tab.details": "விவரங்கள்",
  "tab.favourites": "பிடித்தவை",
  segmentAria: "மார்க்கெட் வாட்ச் பிரிவு",
  searchPlaceholder: "சிம்பலைத் தேடு",
  searchAria: "மார்க்கெட் வாட்சில் தேடு",
  clear: "அழி",

  // Market Watch columns
  "col.symbol": "சிம்பல்",
  "col.bid": "Bid",
  "col.ask": "Ask",
  "col.spread": "Sp",
  "col.spreadTitle": "ஸ்ப்ரெட், புள்ளிகள்",
  "col.change": "மா%",

  // Row / hover card
  "row.title": "{name} · ஸ்ப்ரெட் {spread}",
  "tip.low": "L",
  "tip.high": "H",
  "tip.spread": "ஸ்ப்.",
  "tip.range": "வரம்பு",
  bid: "Bid",
  ask: "Ask",

  // Empty states and footer
  "empty.favourites": "இன்னும் பிடித்தவை இல்லை. சேர்க்க ஒரு சிம்பலில் ரைட்-கிளிக் செய்யுங்கள்.",
  "empty.noMatch": "பொருந்தும் சிம்பல்கள் இல்லை.",
  "footer.count": "{shown} / {total} சிம்பல்கள்",
  "footer.hint": "இரு-கிளிக்: சார்ட்",

  // Context menu
  "menu.newOrder": "புதிய ஆர்டர்",
  "menu.chartWindow": "சார்ட் விண்டோ",
  "menu.openInActive": "செயலில் உள்ள சார்ட்டில் திற",
  "menu.depth": "டெப்த் ஆஃப் மார்க்கெட்",
  "menu.specification": "விவரக்குறிப்பு",
  "menu.removeFavourite": "பிடித்தவையிலிருந்து அகற்று",
  "menu.addFavourite": "பிடித்தவையில் சேர்",
  "menu.hide": "மறை",
  "menu.showAll": "அனைத்தையும் காட்டு",

  // Toasts
  "toast.hidden": "{symbol} மார்க்கெட் வாட்சிலிருந்து மறைக்கப்பட்டது",
  "toast.hiddenDesc": "சூழல் மெனுவிலிருந்து அனைத்துச் சிம்பல்களையும் காட்டுங்கள்.",
  "toast.opened": "{symbol} செயலில் உள்ள சார்ட்டில் திறக்கப்பட்டது",

  // Segment chips (asset classes)
  "segment.favourites": "பிடித்தவை",
  "segment.forex": "ஃபாரெக்ஸ்",
  "segment.metals": "உலோகங்கள்",
  "segment.indices": "குறியீடுகள்",
  "segment.energies": "எரிசக்தி",
  "segment.crypto": "கிரிப்டோ",
  "segment.stocks": "பங்குகள்",
  "segment.aria": "சொத்து வகை",
  "segment.title": { one: "{label} · {count} சிம்பல்", other: "{label} · {count} சிம்பல்கள்" },

  // Navigator tree
  "nav.title": "நேவிகேட்டர்",
  "nav.indicators": "இண்டிகேட்டர்கள்",
  "nav.strategies": "உத்திகள்",
  "nav.scripts": "ஸ்கிரிப்டுகள்",
  "nav.guest": "விருந்தினர்",
  "nav.noAccount": "இன்னும் டிரேடிங் கணக்கு இல்லை",
  "nav.openAccount": "கணக்கைத் திற",
  "nav.openAccountTitle": "உங்கள் Kalks கணக்கை உருவாக்குங்கள் (கிளையன்ட் ஏரியாவைத் திறக்கும்)",
  "nav.signIn": "உள்நுழை",
  "nav.signInTitle": "கிளையன்ட் ஏரியாவில் உள்நுழையுங்கள்",
  "nav.accountType.live": "லைவ்",
  "nav.accountType.demo": "டெமோ",
  "nav.category.trend": "டிரெண்ட்",
  "nav.category.oscillators": "ஆஸிலேட்டர்கள்",
  "nav.category.volatility": "ஏற்ற இறக்கம்",
  "nav.category.volume": "வால்யூம்",
  "nav.category.billWilliams": "Bill Williams",
  "nav.indicatorTitle": "{description} · {symbol}, {tf} இல் இணைக்க இரு-கிளிக் அல்லது Enter",
  "nav.strategyTitle": { one: "{server} · {login} · {count} டிரேடு", other: "{server} · {login} · {count} டிரேடுகள்" },
  "nav.strategyRunning": "{name} ஏற்கனவே இயங்குகிறது",
  "nav.strategyAttached": "{name} இணைக்கப்பட்டது",
  "nav.strategyDesc": "{login} · {server} · இன்றைய P&L {pnl}",
  "nav.script.closeAll": "அனைத்துப் பொசிஷன்களையும் மூடு",
  "nav.script.closeProfitable": "லாபமானவற்றை மூடு",
  "nav.script.closeLosing": "நஷ்டமானவற்றை மூடு",
  "nav.script.deletePendings": "அனைத்துப் பெண்டிங்குகளையும் நீக்கு",
  "nav.script.breakevenAll": "அனைத்தையும் பிரேக்ஈவன் (SL → நுழைவு)",
  "nav.scriptTitle": "தற்போதைய கணக்கில் இயக்க இரு-கிளிக் செய்யுங்கள்",
  "nav.scriptsReadOnly": "படிக்க-மட்டும் பயன்முறையில் ஸ்கிரிப்டுகள் முடக்கப்பட்டுள்ளன",
};
export default market;
