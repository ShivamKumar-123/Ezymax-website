import type { NsMessages } from "../../core";

// Kalks mobile app: Trade tab (chart, Sell / Buy bar, order ticket) and trade notifications.
// Trading terms follow the MetaTrader 5 French localisation (see the `order` namespace).
// {placeholders} hold numbers, prices, tickets and symbols: keep them, never translate them.
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Header
  pickSymbol: "Choisir un symbole",
  searchSymbol: "Rechercher des symboles",
  depth: "Profondeur de marché",
  alert: "Alerte de prix",
  // Header buttons' accessibility labels, e.g. "Calendrier économique EUR"
  news: "Actualités sur {symbol}",
  calendar: "Calendrier économique {currency}",
  "account.chip": "{type} · #{login}",
  "account.manage": "Gérer les comptes",
  "account.open": "Ouvrir un compte",

  // Chart
  "chart.indicators": "Indicateurs",
  "chart.type.candles": "Chandeliers",
  "chart.type.line": "Ligne",
  "ind.ma": "Moyenne mobile 20",
  "ind.ema": "MM exponentielle 50",
  "ind.bb": "Bandes de Bollinger 20, 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "Pas encore d'historique de graphique pour ce symbole",
  "chart.hint": "Pincez pour zoomer · glissez pour faire défiler · appui long pour le réticule · touchez deux fois pour réinitialiser",

  // Sell / Buy bar and ticket
  "bar.volume": "Lots",
  "ticket.title": "Nouvel ordre",
  "ticket.confirmBuy": "Acheter {volume} {symbol}",
  "ticket.confirmSell": "Vendre {volume} {symbol}",
  "ticket.atMarket": "au marché",
  "ticket.at": "à {price}",
  "ticket.addSl": "Ajouter un Stop Loss",
  "ticket.addTp": "Ajouter un Take Profit",
  "ticket.ifHit": "{money} si atteint",
  "ticket.required": "Marge",
  "ticket.pip": "Valeur du pip",
  "ticket.after": "Marge libre après",
  "ticket.notEnough": "Marge libre insuffisante pour ce volume.",
  "ticket.noSpecs": "Chargement des détails du contrat…",
  "ticket.distance": "À {n} pips",
  "ticket.price": "Prix",

  // Rejections: a plain-language line under the reason (order.reject.<code>); the engine's own detail follows it
  "reject.no_money": "Votre marge libre ne couvre pas cet ordre. Réduisez le volume ou alimentez ce compte.",
  "reject.insufficient_funds": "Votre marge libre ne couvre pas cet ordre. Réduisez le volume ou alimentez ce compte.",
  "reject.market_closed": "Ce marché est fermé pour le moment. Réessayez à son ouverture.",
  "reject.invalid_volume": "Utilisez un volume compris dans les limites et le pas de lot de ce symbole.",
  "reject.max_lot": "Ce volume dépasse le maximum par ordre autorisé sur votre compte.",
  "reject.close_only": "Votre compte peut clôturer des positions, mais pas en ouvrir de nouvelles pour le moment.",
  "reject.symbol_close_only": "Sur ce symbole, les positions peuvent être clôturées mais pas ouvertes pour le moment.",
  "reject.trading_disabled": "Le trading est désactivé sur ce compte. Contactez l'assistance pour en savoir plus.",
  "reject.symbol_halted": "Le trading sur ce symbole est suspendu. Réessayez plus tard.",
  "reject.requote.title": "Le prix a bougé",
  "reject.requote": "Le marché a bougé pendant l'envoi de votre ordre. Vérifiez le nouveau prix et confirmez à nouveau.",
  "reject.invalid_sl": "Le Stop Loss est du mauvais côté du prix, ou trop proche de celui-ci.",
  "reject.invalid_tp": "Le Take Profit est du mauvais côté du prix, ou trop proche de celui-ci.",
  "reject.invalid_price": "Ce prix est du mauvais côté du marché pour ce type d'ordre.",
  "reject.off_market": "Ce prix est trop éloigné du marché. Vérifiez la valeur.",
  "reject.stale_price": "Les prix de ce symbole sont momentanément en pause. Réessayez dans un instant.",
  "reject.no_price": "Aucun prix en direct pour ce symbole pour le moment.",
  "reject.read_only": "Cet identifiant peut consulter le compte, mais pas trader.",
  "reject.uncertain.title": "Pas de réponse du serveur de trading",
  "reject.uncertain": "L'ordre est peut-être passé. Vérifiez le Portfolio avant de réessayer.",
  "reject.uncertain.ticket": "Vous pouvez confirmer à nouveau sans risque : le même ordre ne peut pas être passé deux fois.",

  // States
  "state.noAccount.title": "Aucun compte de trading",
  "state.noAccount.body": "Ouvrez un compte démo pour vous entraîner, ou un compte réel pour trader pour de vrai.",
  "state.noAccount.action": "Ouvrir un compte",
  "state.connecting": "Connexion au serveur de trading…",
  "state.readOnly": "Ce compte est en lecture seule ici : les prix et graphiques sont en direct, le trading est désactivé.",
  "state.marketClosed.title": "Marché fermé",
  "state.marketClosed.body": "{symbol} rouvre à la prochaine séance. Vous pourrez passer des ordres dès l'ouverture.",
  "state.streamError": "Impossible de joindre le serveur de trading",
  "state.streamErrorBody": "Vos positions et ordres sont en sécurité sur le serveur. Nous continuons d'essayer de nous reconnecter.",

  // Results ({side} is the Buy / Sell verb from common.buy / common.sell)
  "toast.filled": "{side} {volume} {symbol} : ordre exécuté",
  "toast.at": "à {price}",
  "toast.placed": "Ordre en attente {symbol} placé",
  "toast.duplicate": "Déjà passé sous le ticket #{ticket}",
  "toast.duplicateBody": "Cet ordre était déjà parvenu au serveur ; rien de nouveau n'a été ouvert.",
  "toast.closed": "Position #{ticket} clôturée",
  "toast.partial": "{volume} lots de #{ticket} clôturés",
  "toast.modified": "#{ticket} mis à jour",
  "toast.cancelled": "Ordre #{ticket} annulé",

  // Engine notifications while the app is open
  "notify.sl": "Stop Loss atteint",
  "notify.tp": "Take Profit atteint",
  "notify.order_filled": "Ordre en attente exécuté",
  "notify.order_triggered": "Ordre déclenché",
  "notify.margin_call": "Appel de marge",
  "notify.stop_out": "Stop out",
  "notify.order_rejected": "Ordre rejeté",
  "notify.order_expired": "Ordre expiré",
  "notify.order_cancelled": "Ordre annulé",
};
export default mobileTrade;
