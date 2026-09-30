import type { NsMessages } from "../../core";

// Kalks mobile app: Trade tab (chart, Sell / Buy bar, order ticket) and trade notifications.
// MT5 terms (Stop loss, Take profit, Margin call, Stop out) stay as in the `order` namespace.
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Header
  pickSymbol: "Chagua alama",
  searchSymbol: "Tafuta alama",
  depth: "Kina cha soko",
  alert: "Tahadhari ya bei",
  news: "Habari za {symbol}",
  calendar: "Kalenda ya kiuchumi ya {currency}",
  "account.chip": "{type} · #{login}",
  "account.manage": "Simamia akaunti",
  "account.open": "Fungua akaunti",

  // Chart
  "chart.indicators": "Viashiria",
  "chart.type.candles": "Mishumaa",
  "chart.type.line": "Mstari",
  "ind.ma": "Moving average 20",
  "ind.ema": "Exponential MA 50",
  "ind.bb": "Bollinger Bands 20, 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "Bado hakuna historia ya chati kwa alama hii",
  "chart.hint": "Bana ili kukuza · buruta ili kusogeza · bonyeza na ushikilie kwa msalaba · gusa mara mbili ili kuweka upya",

  // Sell / Buy bar and ticket
  "bar.volume": "Loti",
  "ticket.title": "Oda mpya",
  "ticket.confirmBuy": "Nunua {volume} {symbol}",
  "ticket.confirmSell": "Uza {volume} {symbol}",
  "ticket.atMarket": "kwa bei ya soko",
  "ticket.at": "kwa {price}",
  "ticket.addSl": "Ongeza stop loss",
  "ticket.addTp": "Ongeza take profit",
  "ticket.ifHit": "{money} ikifikiwa",
  "ticket.required": "Margin",
  "ticket.pip": "Thamani ya pip",
  "ticket.after": "Huru baadaye",
  "ticket.notEnough": "Margin huru haitoshi kwa kiasi hiki.",
  "ticket.noSpecs": "Inapakia maelezo ya mkataba…",
  "ticket.distance": "pips {n} mbali",
  "ticket.price": "Bei",

  // Rejections: a plain-language line under the reason (order.reject.<code>)
  "reject.no_money": "Margin huru yako haitoshi kwa oda hii. Punguza kiasi au ongeza fedha kwenye akaunti hii.",
  "reject.insufficient_funds": "Margin huru yako haitoshi kwa oda hii. Punguza kiasi au ongeza fedha kwenye akaunti hii.",
  "reject.market_closed": "Soko hili limefungwa kwa sasa. Jaribu tena litakapofunguliwa.",
  "reject.invalid_volume": "Tumia kiasi kilicho ndani ya mipaka ya alama hii na hatua ya loti.",
  "reject.max_lot": "Kiasi hiki kinazidi kiwango cha juu kwa kila oda kwenye akaunti yako.",
  "reject.close_only": "Akaunti yako inaweza kufunga nafasi lakini haiwezi kufungua mpya kwa sasa.",
  "reject.symbol_close_only": "Alama hii inaweza kufungwa lakini si kufunguliwa kwa sasa.",
  "reject.trading_disabled": "Biashara imezimwa kwenye akaunti hii. Wasiliana na msaada kwa maelezo.",
  "reject.symbol_halted": "Biashara kwenye alama hii imesitishwa. Jaribu tena baadaye.",
  "reject.requote.title": "Bei imebadilika",
  "reject.requote": "Soko lilisonga wakati oda yako ikiwa njiani. Angalia bei mpya kisha uthibitishe tena.",
  "reject.invalid_sl": "Stop loss iko upande usio sahihi wa bei, au karibu mno nayo.",
  "reject.invalid_tp": "Take profit iko upande usio sahihi wa bei, au karibu mno nayo.",
  "reject.invalid_price": "Bei hii iko upande usio sahihi wa soko kwa aina hii ya oda.",
  "reject.off_market": "Bei hii iko mbali mno na soko. Angalia thamani.",
  "reject.stale_price": "Bei za alama hii zimesitishwa kwa muda mfupi. Jaribu tena baada ya muda mfupi.",
  "reject.no_price": "Hakuna bei ya moja kwa moja kwa alama hii kwa sasa.",
  "reject.read_only": "Login hii inaweza kutazama akaunti lakini haiwezi kufanya biashara.",
  "reject.uncertain.title": "Hakuna jibu kutoka seva ya biashara",
  "reject.uncertain": "Huenda imetekelezwa. Angalia Portfolio kabla ya kujaribu tena.",
  "reject.uncertain.ticket": "Kuthibitisha tena ni salama: oda ileile haiwezi kuwekwa mara mbili.",

  // States
  "state.noAccount.title": "Bado hakuna akaunti ya biashara",
  "state.noAccount.body": "Fungua akaunti ya demo ili ujizoeze, au akaunti halisi ili ufanye biashara kwa kweli.",
  "state.noAccount.action": "Fungua akaunti",
  "state.connecting": "Inaunganisha na seva ya biashara…",
  "state.readOnly": "Akaunti hii ni ya kutazama tu hapa: bei na chati ziko moja kwa moja, biashara imezimwa.",
  "state.marketClosed.title": "Soko limefungwa",
  "state.marketClosed.body": "{symbol} itafunguliwa tena kipindi kijacho. Oda zinaweza kuwekwa ikishafunguliwa.",
  "state.streamError": "Haiwezi kufikia seva ya biashara",
  "state.streamErrorBody": "Nafasi na oda zako ziko salama kwenye seva. Tunaendelea kujaribu kuunganisha tena.",

  // Results
  "toast.filled": "{side} {volume} {symbol} imetekelezwa",
  "toast.at": "kwa {price}",
  "toast.placed": "Oda inayosubiri ya {symbol} imewekwa",
  "toast.duplicate": "Tayari imewekwa kama #{ticket}",
  "toast.duplicateBody": "Oda hii ilifika kwenye seva hapo awali; hakuna kipya kilichofunguliwa.",
  "toast.closed": "Nafasi #{ticket} imefungwa",
  "toast.partial": "Loti {volume} za #{ticket} zimefungwa",
  "toast.modified": "#{ticket} imesasishwa",
  "toast.cancelled": "Oda #{ticket} imeghairiwa",

  // Engine notifications while the app is open
  "notify.sl": "Stop loss imefikiwa",
  "notify.tp": "Take profit imefikiwa",
  "notify.order_filled": "Oda inayosubiri imetekelezwa",
  "notify.order_triggered": "Oda imeanzishwa",
  "notify.margin_call": "Margin call",
  "notify.stop_out": "Stop out",
  "notify.order_rejected": "Oda imekataliwa",
  "notify.order_expired": "Oda imeisha muda",
  "notify.order_cancelled": "Oda imeghairiwa",
};
export default mobileTrade;
