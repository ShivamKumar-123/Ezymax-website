import type { NsMessages } from "../../core";

// Paneles izquierdos de Ezymex Trader: Observación del mercado, chips de segmento y Navegador.
const market: NsMessages<"market"> = {
  // Cabecera y pestañas de Observación del mercado
  title: "Observación del mercado",
  collapse: "Contraer",
  "tab.symbols": "Símbolos",
  "tab.details": "Detalles",
  "tab.favourites": "Favoritos",
  segmentAria: "Segmento de Observación del mercado",
  searchPlaceholder: "Buscar símbolo",
  searchAria: "Buscar en Observación del mercado",
  clear: "Borrar",

  // Columnas (en mayúsculas)
  "col.symbol": "Símbolo",
  "col.bid": "Bid",
  "col.ask": "Ask",
  "col.spread": "Sp",
  "col.spreadTitle": "Spread, puntos",
  "col.change": "Var%",

  // Fila / tarjeta emergente
  "row.title": "{name} · spread {spread}",
  "tip.low": "Mín",
  "tip.high": "Máx",
  "tip.spread": "Sprd",
  "tip.range": "Rango",
  bid: "Bid",
  ask: "Ask",

  // Estados vacíos y pie
  "empty.favourites": "Aún no hay favoritos. Haga clic derecho en un símbolo para añadirlo.",
  "empty.favouritesTitle": "Aún no hay favoritos",
  "empty.noMatch": "Ningún símbolo coincide.",
  "footer.count": "{shown} / {total} símbolos",
  "footer.hint": "doble clic: gráfico",

  // Menú contextual
  "menu.newOrder": "Nueva orden",
  "menu.chartWindow": "Ventana de gráfico",
  "menu.openInActive": "Abrir en el gráfico activo",
  "menu.depth": "Profundidad de mercado",
  "menu.specification": "Especificación",
  "menu.removeFavourite": "Quitar de Favoritos",
  "menu.addFavourite": "Añadir a Favoritos",
  "menu.hide": "Ocultar",
  "menu.showAll": "Mostrar todos",

  // Avisos
  "toast.hidden": "{symbol} oculto en Observación del mercado",
  "toast.hiddenDesc": "Muestre todos los símbolos desde el menú contextual.",
  "toast.opened": "{symbol} abierto en el gráfico activo",

  // Chips de segmento (clases de activos)
  "segment.favourites": "Favoritos",
  "segment.forex": "Forex",
  "segment.metals": "Metales",
  "segment.indices": "Índices",
  "segment.energies": "Energías",
  "segment.crypto": "Cripto",
  "segment.stocks": "Acciones",
  "segment.aria": "Clase de activo",
  "segment.title": { one: "{label} · {count} símbolo", many: "{label} · {count} símbolos", other: "{label} · {count} símbolos" },

  // Árbol del Navegador
  "nav.title": "Navegador",
  "nav.indicators": "Indicadores",
  "nav.strategies": "Estrategias",
  "nav.scripts": "Scripts",
  "nav.guest": "invitado",
  "nav.noAccount": "Aún no tiene cuenta de trading",
  "nav.openAccount": "Abrir cuenta",
  "nav.openAccountTitle": "Cree su cuenta de Ezymex (abre el Área de clientes)",
  "nav.signIn": "Iniciar sesión",
  "nav.signInTitle": "Inicie sesión en el Área de clientes",
  "nav.accountType.live": "real",
  "nav.accountType.demo": "demo",
  "nav.category.trend": "Tendencia",
  "nav.category.oscillators": "Osciladores",
  "nav.category.volatility": "Volatilidad",
  "nav.category.volume": "Volumen",
  "nav.category.billWilliams": "Bill Williams",
  "nav.indicatorTitle": "{description} · Doble clic o Enter para aplicarlo a {symbol}, {tf}",
  "nav.strategyTitle": {
    one: "{server} · {login} · {count} operación",
    many: "{server} · {login} · {count} operaciones",
    other: "{server} · {login} · {count} operaciones",
  },
  "nav.strategyRunning": "{name} ya está en ejecución",
  "nav.strategyAttached": "{name} aplicada",
  "nav.strategyDesc": "{login} · {server} · P&L hoy {pnl}",
  "nav.script.closeAll": "Cerrar todas las posiciones",
  "nav.script.closeProfitable": "Cerrar las rentables",
  "nav.script.closeLosing": "Cerrar las perdedoras",
  "nav.script.deletePendings": "Eliminar todas las pendientes",
  "nav.script.breakevenAll": "Breakeven en todas (SL → entrada)",
  "nav.scriptTitle": "Doble clic para ejecutar en la cuenta actual",
  "nav.scriptsReadOnly": "Los scripts están deshabilitados en modo de solo lectura",
};
export default market;
