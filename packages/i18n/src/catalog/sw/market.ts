import type { NsMessages } from "../../core";

// Kalks Trader left panels: Market Watch (quotes list), segment chips and Navigator.
const market: NsMessages<"market"> = {
  // Market Watch header and tabs
  title: "Market Watch",
  collapse: "Kunja",
  "tab.symbols": "Alama",
  "tab.details": "Maelezo",
  "tab.favourites": "Vipendwa",
  segmentAria: "Sehemu ya Market Watch",
  searchPlaceholder: "Tafuta alama",
  searchAria: "Tafuta kwenye Market Watch",
  clear: "Futa",

  // Market Watch columns
  "col.symbol": "Alama",
  "col.bid": "Bid",
  "col.ask": "Ask",
  "col.spread": "Sp",
  "col.spreadTitle": "Spread, pointi",
  "col.change": "Bdl%",

  // Row / hover card
  "row.title": "{name} · spread {spread}",
  "tip.low": "C",
  "tip.high": "J",
  "tip.spread": "Sprd",
  "tip.range": "Wigo",
  bid: "Bid",
  ask: "Ask",

  // Empty states and footer
  "empty.favourites": "Bado hakuna vipendwa. Bofya kulia kwenye alama ili kuiongeza.",
  "empty.favouritesTitle": "Bado hakuna vipendwa",
  "empty.noMatch": "Hakuna alama zinazolingana.",
  "footer.count": "Alama {shown} / {total}",
  "footer.hint": "bofya mara 2: chati",

  // Context menu
  "menu.newOrder": "Oda Mpya",
  "menu.chartWindow": "Dirisha la Chati",
  "menu.openInActive": "Fungua kwenye chati inayotumika",
  "menu.depth": "Kina cha Soko",
  "menu.specification": "Vipimo",
  "menu.removeFavourite": "Ondoa kwenye Vipendwa",
  "menu.addFavourite": "Ongeza kwenye Vipendwa",
  "menu.hide": "Ficha",
  "menu.showAll": "Onyesha Zote",

  // Toasts
  "toast.hidden": "{symbol} imefichwa kwenye Market Watch",
  "toast.hiddenDesc": "Onyesha alama zote kutoka kwenye menyu ya muktadha.",
  "toast.opened": "{symbol} imefunguliwa kwenye chati inayotumika",

  // Segment chips (asset classes)
  "segment.favourites": "Vipendwa",
  "segment.forex": "Forex",
  "segment.metals": "Metali",
  "segment.indices": "Fahirisi",
  "segment.energies": "Nishati",
  "segment.crypto": "Crypto",
  "segment.stocks": "Hisa",
  "segment.aria": "Aina ya mali",
  "segment.title": { one: "{label} · alama {count}", other: "{label} · alama {count}" },

  // Navigator tree
  "nav.title": "Navigator",
  "nav.indicators": "Viashiria",
  "nav.strategies": "Mikakati",
  "nav.scripts": "Skripti",
  "nav.guest": "mgeni",
  "nav.noAccount": "Bado hakuna akaunti ya biashara",
  "nav.openAccount": "Fungua akaunti",
  "nav.openAccountTitle": "Fungua akaunti yako ya Kalks (inafungua Eneo la Mteja)",
  "nav.signIn": "Ingia",
  "nav.signInTitle": "Ingia kwenye Eneo la Mteja",
  "nav.accountType.live": "halisi",
  "nav.accountType.demo": "demo",
  "nav.category.trend": "Mwenendo",
  "nav.category.oscillators": "Oscillators",
  "nav.category.volatility": "Tete",
  "nav.category.volume": "Kiasi",
  "nav.category.billWilliams": "Bill Williams",
  "nav.indicatorTitle": "{description} · Bofya mara mbili au Enter ili kuambatisha kwa {symbol}, {tf}",
  "nav.strategyTitle": { one: "{server} · {login} · biashara {count}", other: "{server} · {login} · biashara {count}" },
  "nav.strategyRunning": "{name} tayari inaendeshwa",
  "nav.strategyAttached": "{name} imeambatishwa",
  "nav.strategyDesc": "{login} · {server} · P&L ya leo {pnl}",
  "nav.script.closeAll": "Funga nafasi zote",
  "nav.script.closeProfitable": "Funga zenye faida",
  "nav.script.closeLosing": "Funga zenye hasara",
  "nav.script.deletePendings": "Futa oda zote zinazosubiri",
  "nav.script.breakevenAll": "Breakeven zote (SL → kuingia)",
  "nav.scriptTitle": "Bofya mara mbili ili kuendesha kwenye akaunti ya sasa",
  "nav.scriptsReadOnly": "Skripti zimezimwa katika hali ya kusoma tu",
};
export default market;
