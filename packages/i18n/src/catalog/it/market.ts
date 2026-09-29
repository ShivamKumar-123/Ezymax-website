import type { NsMessages } from "../../core";

// Pannelli di sinistra di Kalks Trader: Osservazione del mercato, segmenti e Navigatore.
const market: NsMessages<"market"> = {
  // Intestazione e schede
  title: "Osservazione del mercato",
  collapse: "Comprimi",
  "tab.symbols": "Simboli",
  "tab.details": "Dettagli",
  "tab.favourites": "Preferiti",
  segmentAria: "Segmento di Osservazione del mercato",
  searchPlaceholder: "Cerca simbolo",
  searchAria: "Cerca in Osservazione del mercato",
  clear: "Cancella",

  // Colonne
  "col.symbol": "Simbolo",
  "col.bid": "Bid",
  "col.ask": "Ask",
  "col.spread": "Sp",
  "col.spreadTitle": "Spread, punti",
  "col.change": "Var%",

  // Riga / scheda al passaggio del mouse
  "row.title": "{name} · spread {spread}",
  "tip.low": "Min",
  "tip.high": "Max",
  "tip.spread": "Sprd",
  "tip.range": "Rng",
  bid: "Bid",
  ask: "Ask",

  // Stati vuoti e piè di pagina
  "empty.favourites": "Ancora nessun preferito. Fai clic destro su un simbolo per aggiungerlo.",
  "empty.noMatch": "Nessun simbolo corrispondente.",
  "footer.count": "{shown} / {total} simboli",
  "footer.hint": "doppio clic: grafico",

  // Menu contestuale
  "menu.newOrder": "Nuovo ordine",
  "menu.chartWindow": "Finestra grafico",
  "menu.openInActive": "Apri nel grafico attivo",
  "menu.depth": "Profondità di mercato",
  "menu.specification": "Specifiche",
  "menu.removeFavourite": "Rimuovi dai Preferiti",
  "menu.addFavourite": "Aggiungi ai Preferiti",
  "menu.hide": "Nascondi",
  "menu.showAll": "Mostra tutti",

  // Notifiche
  "toast.hidden": "{symbol} nascosto da Osservazione del mercato",
  "toast.hiddenDesc": "Mostra tutti i simboli dal menu contestuale.",
  "toast.opened": "{symbol} aperto nel grafico attivo",

  // Segmenti (classi di attività)
  "segment.favourites": "Preferiti",
  "segment.forex": "Forex",
  "segment.metals": "Metalli",
  "segment.indices": "Indici",
  "segment.energies": "Energie",
  "segment.crypto": "Cripto",
  "segment.stocks": "Azioni",
  "segment.aria": "Classe di attività",
  "segment.title": { one: "{label} · {count} simbolo", other: "{label} · {count} simboli" },

  // Albero del Navigatore
  "nav.title": "Navigatore",
  "nav.indicators": "Indicatori",
  "nav.strategies": "Strategie",
  "nav.scripts": "Script",
  "nav.guest": "ospite",
  "nav.noAccount": "Ancora nessun conto di trading",
  "nav.openAccount": "Apri conto",
  "nav.openAccountTitle": "Crea il tuo account Kalks (apre l'Area Clienti)",
  "nav.signIn": "Accedi",
  "nav.signInTitle": "Accedi all'Area Clienti",
  "nav.accountType.live": "reale",
  "nav.accountType.demo": "demo",
  "nav.category.trend": "Trend",
  "nav.category.oscillators": "Oscillatori",
  "nav.category.volatility": "Volatilità",
  "nav.category.volume": "Volumi",
  "nav.category.billWilliams": "Bill Williams",
  "nav.indicatorTitle": "{description} · Doppio clic o Enter per applicarlo a {symbol}, {tf}",
  "nav.strategyTitle": { one: "{server} · {login} · {count} operazione", other: "{server} · {login} · {count} operazioni" },
  "nav.strategyRunning": "{name} è già in esecuzione",
  "nav.strategyAttached": "{name} applicata",
  "nav.strategyDesc": "{login} · {server} · P&L oggi {pnl}",
  "nav.script.closeAll": "Chiudi tutte le posizioni",
  "nav.script.closeProfitable": "Chiudi in profitto",
  "nav.script.closeLosing": "Chiudi in perdita",
  "nav.script.deletePendings": "Elimina tutti i pendenti",
  "nav.script.breakevenAll": "Breakeven su tutte (SL → entrata)",
  "nav.scriptTitle": "Doppio clic per eseguirlo sul conto attivo",
  "nav.scriptsReadOnly": "Gli script sono disattivati in modalità sola lettura",
};
export default market;
