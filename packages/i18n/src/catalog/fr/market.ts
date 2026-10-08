import type { NsMessages } from "../../core";

// Ezymex Trader left panels: Observation du marché, segment chips and Navigateur.
const market: NsMessages<"market"> = {
  // Market Watch header and tabs
  title: "Observation du marché",
  collapse: "Réduire",
  "tab.symbols": "Symboles",
  "tab.details": "Détails",
  "tab.favourites": "Favoris",
  segmentAria: "Segment de l'Observation du marché",
  searchPlaceholder: "Rechercher un symbole",
  searchAria: "Rechercher dans l'Observation du marché",
  clear: "Effacer",

  // Market Watch columns (shown uppercase)
  "col.symbol": "Symbole",
  "col.bid": "Bid",
  "col.ask": "Ask",
  "col.spread": "Sp",
  "col.spreadTitle": "Spread, points",
  "col.change": "Var%",

  // Row / hover card
  "row.title": "{name} · spread {spread}",
  "tip.low": "B",
  "tip.high": "H",
  "tip.spread": "Sprd",
  "tip.range": "Fourch.",
  bid: "Bid",
  ask: "Ask",

  // Empty states and footer
  "empty.favourites": "Aucun favori pour le moment. Faites un clic droit sur un symbole pour l'ajouter.",
  "empty.favouritesTitle": "Aucun favori",
  "empty.noMatch": "Aucun symbole correspondant.",
  "footer.count": "{shown} / {total} symboles",
  "footer.hint": "double-clic : graphique",

  // Context menu
  "menu.newOrder": "Nouvel ordre",
  "menu.chartWindow": "Fenêtre graphique",
  "menu.openInActive": "Ouvrir dans le graphique actif",
  "menu.depth": "Profondeur de marché",
  "menu.specification": "Spécification",
  "menu.removeFavourite": "Retirer des favoris",
  "menu.addFavourite": "Ajouter aux favoris",
  "menu.hide": "Masquer",
  "menu.showAll": "Tout afficher",

  // Toasts
  "toast.hidden": "{symbol} masqué de l'Observation du marché",
  "toast.hiddenDesc": "Affichez tous les symboles depuis le menu contextuel.",
  "toast.opened": "{symbol} ouvert dans le graphique actif",

  // Segment chips (asset classes)
  "segment.favourites": "Favoris",
  "segment.forex": "Forex",
  "segment.metals": "Métaux",
  "segment.indices": "Indices",
  "segment.energies": "Énergies",
  "segment.crypto": "Crypto",
  "segment.stocks": "Actions",
  "segment.aria": "Classe d'actifs",
  "segment.title": { one: "{label} · {count} symbole", other: "{label} · {count} symboles" },

  // Navigator tree
  "nav.title": "Navigateur",
  "nav.indicators": "Indicateurs",
  "nav.strategies": "Stratégies",
  "nav.scripts": "Scripts",
  "nav.guest": "invité",
  "nav.noAccount": "Aucun compte de trading pour le moment",
  "nav.openAccount": "Ouvrir un compte",
  "nav.openAccountTitle": "Créez votre compte Ezymex (ouvre l'espace client)",
  "nav.signIn": "Se connecter",
  "nav.signInTitle": "Se connecter à l'espace client",
  "nav.accountType.live": "réel",
  "nav.accountType.demo": "démo",
  "nav.category.trend": "Tendance",
  "nav.category.oscillators": "Oscillateurs",
  "nav.category.volatility": "Volatilité",
  "nav.category.volume": "Volume",
  "nav.category.billWilliams": "Bill Williams",
  "nav.indicatorTitle": "{description} · Double-cliquez ou appuyez sur Enter pour l'attacher à {symbol}, {tf}",
  "nav.strategyTitle": { one: "{server} · {login} · {count} trade", other: "{server} · {login} · {count} trades" },
  "nav.strategyRunning": "{name} est déjà en cours d'exécution",
  "nav.strategyAttached": "{name} attachée",
  "nav.strategyDesc": "{login} · {server} · P&L du jour {pnl}",
  "nav.script.closeAll": "Clôturer toutes les positions",
  "nav.script.closeProfitable": "Clôturer les gagnantes",
  "nav.script.closeLosing": "Clôturer les perdantes",
  "nav.script.deletePendings": "Supprimer tous les ordres en attente",
  "nav.script.breakevenAll": "Tout au point mort (SL → entrée)",
  "nav.scriptTitle": "Double-cliquez pour exécuter sur le compte actuel",
  "nav.scriptsReadOnly": "Les scripts sont désactivés en mode lecture seule",
};
export default market;
