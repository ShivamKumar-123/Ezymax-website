import type { NsMessages } from "../../core";

// App mobile Kalks: scheda Trade (grafico, barra Sell / Buy, ticket d'ordine) e notifiche di trading.
// Terminologia MT5 come in `order`. I {placeholder} contengono numeri, prezzi, ticket e simboli.
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Intestazione
  pickSymbol: "Scegli un simbolo",
  searchSymbol: "Cerca simboli",
  depth: "Profondità di mercato",
  alert: "Avviso di prezzo",
  news: "Notizie su {symbol}",
  calendar: "Calendario economico {currency}",
  "account.chip": "{type} · #{login}",
  "account.manage": "Gestisci conti",
  "account.open": "Apri conto",

  // Grafico
  "chart.indicators": "Indicatori",
  "chart.type.candles": "Candele",
  "chart.type.line": "Linea",
  "ind.ma": "Media mobile 20",
  "ind.ema": "Media mobile esp. 50",
  "ind.bb": "Bande di Bollinger 20, 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "Ancora nessuno storico del grafico per questo simbolo",
  "chart.hint": "Pizzica per lo zoom · trascina per scorrere · tieni premuto per il mirino · tocca due volte per reimpostare",

  // Barra Sell / Buy e ticket
  "bar.volume": "Lotti",
  "ticket.title": "Nuovo ordine",
  "ticket.confirmBuy": "Buy {volume} {symbol}",
  "ticket.confirmSell": "Sell {volume} {symbol}",
  "ticket.atMarket": "a mercato",
  "ticket.at": "a {price}",
  "ticket.addSl": "Aggiungi stop loss",
  "ticket.addTp": "Aggiungi take profit",
  "ticket.ifHit": "{money} se raggiunto",
  "ticket.required": "Margine",
  "ticket.pip": "Valore del pip",
  "ticket.after": "Libero dopo",
  "ticket.notEnough": "Margine libero insufficiente per questo volume.",
  "ticket.noSpecs": "Caricamento delle specifiche del contratto…",
  "ticket.distance": "a {n} pip",
  "ticket.price": "Prezzo",

  // Rifiuti: una riga in linguaggio semplice sotto il motivo (order.reject.<code>)
  "reject.no_money": "Il margine libero non copre questo ordine. Riduci il volume o aggiungi fondi a questo conto.",
  "reject.insufficient_funds": "Il margine libero non copre questo ordine. Riduci il volume o aggiungi fondi a questo conto.",
  "reject.market_closed": "Questo mercato è chiuso in questo momento. Riprova all'apertura.",
  "reject.invalid_volume": "Usa un volume entro i limiti e il passo lotto di questo simbolo.",
  "reject.max_lot": "Questo volume supera il massimo per ordine del tuo conto.",
  "reject.close_only": "Il tuo conto può chiudere posizioni ma al momento non può aprirne di nuove.",
  "reject.symbol_close_only": "Questo simbolo al momento può essere chiuso ma non aperto.",
  "reject.trading_disabled": "Il trading è disattivato su questo conto. Contatta l'assistenza per i dettagli.",
  "reject.symbol_halted": "Il trading su questo simbolo è sospeso. Riprova più tardi.",
  "reject.requote.title": "Il prezzo si è mosso",
  "reject.requote": "Il mercato si è mosso mentre il tuo ordine era in invio. Controlla il nuovo prezzo e conferma di nuovo.",
  "reject.invalid_sl": "Lo stop loss è dal lato sbagliato del prezzo o troppo vicino.",
  "reject.invalid_tp": "Il take profit è dal lato sbagliato del prezzo o troppo vicino.",
  "reject.invalid_price": "Questo prezzo è dal lato sbagliato del mercato per questo tipo di ordine.",
  "reject.off_market": "Questo prezzo è troppo lontano dal mercato. Controlla il valore.",
  "reject.stale_price": "I prezzi di questo simbolo sono in pausa per un momento. Riprova tra poco.",
  "reject.no_price": "Al momento non c'è un prezzo in tempo reale per questo simbolo.",
  "reject.read_only": "Questo login può vedere il conto ma non fare trading.",
  "reject.uncertain.title": "Nessuna risposta dal server di trading",
  "reject.uncertain": "Potrebbe essere andato a buon fine. Controlla il Portafoglio prima di riprovare.",
  "reject.uncertain.ticket": "Confermare di nuovo è sicuro: lo stesso ordine non può essere inviato due volte.",

  // Stati
  "state.noAccount.title": "Ancora nessun conto di trading",
  "state.noAccount.body": "Apri un conto demo per esercitarti o un conto reale per fare trading sul serio.",
  "state.noAccount.action": "Apri un conto",
  "state.connecting": "Connessione al server di trading…",
  "state.readOnly": "Qui questo conto è in sola lettura: prezzi e grafici sono in tempo reale, il trading è disattivato.",
  "state.marketClosed.title": "Mercato chiuso",
  "state.marketClosed.body": "{symbol} riapre con la prossima sessione. Potrai inviare ordini all'apertura.",
  "state.streamError": "Server di trading non raggiungibile",
  "state.streamErrorBody": "Le tue posizioni e i tuoi ordini sono al sicuro sul server. Continuiamo a tentare la riconnessione.",

  // Esiti
  "toast.filled": "{side} {volume} {symbol} eseguito",
  "toast.at": "a {price}",
  "toast.placed": "Ordine pendente {symbol} inserito",
  "toast.duplicate": "Già inserito come #{ticket}",
  "toast.duplicateBody": "Questo ordine aveva già raggiunto il server; non è stato aperto nulla di nuovo.",
  "toast.closed": "Posizione #{ticket} chiusa",
  "toast.partial": "Chiusi {volume} lotti di #{ticket}",
  "toast.modified": "#{ticket} aggiornato",
  "toast.cancelled": "Ordine #{ticket} annullato",

  // Notifiche del motore mentre l'app è aperta
  "notify.sl": "Stop loss raggiunto",
  "notify.tp": "Take profit raggiunto",
  "notify.order_filled": "Ordine pendente eseguito",
  "notify.order_triggered": "Ordine attivato",
  "notify.margin_call": "Margin call",
  "notify.stop_out": "Stop out",
  "notify.order_rejected": "Ordine rifiutato",
  "notify.order_expired": "Ordine scaduto",
  "notify.order_cancelled": "Ordine annullato",
};
export default mobileTrade;
