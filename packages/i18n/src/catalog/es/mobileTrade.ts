import type { NsMessages } from "../../core";

// App móvil de Kalks: pestaña Operar (gráfico, barra Vender / Comprar, ticket de orden) y avisos de trading.
// Términos de trading según la localización de MetaTrader 5 (véase `order`). Los {placeholders} llevan números,
// precios, tickets y símbolos: se mantienen tal cual.
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Cabecera
  pickSymbol: "Elegir un símbolo",
  searchSymbol: "Buscar símbolos",
  depth: "Profundidad de mercado",
  alert: "Alerta de precio",
  "account.chip": "{type} · #{login}",
  "account.manage": "Gestionar cuentas",
  "account.open": "Abrir cuenta",

  // Gráfico
  "chart.indicators": "Indicadores",
  "chart.type.candles": "Velas",
  "chart.type.line": "Línea",
  "ind.ma": "Media móvil 20",
  "ind.ema": "Media exponencial 50",
  "ind.bb": "Bandas de Bollinger 20, 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "Aún no hay historial del gráfico para este símbolo",
  "chart.hint": "Pellizque para ampliar · arrastre para desplazarse · mantenga pulsado para la cruz · toque dos veces para restablecer",

  // Barra Vender / Comprar y ticket
  "bar.volume": "Lotes",
  "ticket.title": "Nueva orden",
  "ticket.confirmBuy": "Comprar {volume} {symbol}",
  "ticket.confirmSell": "Vender {volume} {symbol}",
  "ticket.atMarket": "a mercado",
  "ticket.at": "a {price}",
  "ticket.addSl": "Añadir stop loss",
  "ticket.addTp": "Añadir take profit",
  "ticket.ifHit": "{money} si se alcanza",
  "ticket.required": "Margen",
  "ticket.pip": "Valor del pip",
  "ticket.after": "Margen libre después",
  "ticket.notEnough": "No hay suficiente margen libre para este volumen.",
  "ticket.noSpecs": "Cargando los datos del contrato…",
  "ticket.distance": "a {n} pips",
  "ticket.price": "Precio",

  // Rechazos: una línea sencilla bajo el motivo (order.reject.<code>); le sigue el detalle del motor
  "reject.no_money": "Su margen libre no cubre esta orden. Reduzca el volumen o añada fondos a esta cuenta.",
  "reject.insufficient_funds": "Su margen libre no cubre esta orden. Reduzca el volumen o añada fondos a esta cuenta.",
  "reject.market_closed": "Este mercado está cerrado ahora. Inténtelo de nuevo cuando abra.",
  "reject.invalid_volume": "Use un volumen dentro de los límites y del paso de lote de este símbolo.",
  "reject.max_lot": "Este volumen supera el máximo por orden de su cuenta.",
  "reject.close_only": "Ahora su cuenta puede cerrar posiciones, pero no abrir otras nuevas.",
  "reject.symbol_close_only": "Ahora este símbolo se puede cerrar, pero no abrir.",
  "reject.trading_disabled": "El trading está desactivado en esta cuenta. Contacte con soporte para más detalles.",
  "reject.symbol_halted": "El trading en este símbolo está en pausa. Inténtelo más tarde.",
  "reject.requote.title": "El precio ha cambiado",
  "reject.requote": "El mercado se movió mientras su orden estaba en camino. Revise el nuevo precio y vuelva a confirmar.",
  "reject.invalid_sl": "El stop loss está en el lado equivocado del precio o demasiado cerca de él.",
  "reject.invalid_tp": "El take profit está en el lado equivocado del precio o demasiado cerca de él.",
  "reject.invalid_price": "Este precio está en el lado equivocado del mercado para este tipo de orden.",
  "reject.off_market": "Este precio está demasiado lejos del mercado. Revise el valor.",
  "reject.stale_price": "Los precios de este símbolo están en pausa un momento. Inténtelo de nuevo en breve.",
  "reject.no_price": "Ahora no hay precio en tiempo real para este símbolo.",
  "reject.read_only": "Con este acceso puede ver la cuenta, pero no operar.",
  "reject.uncertain.title": "Sin respuesta del servidor de trading",
  "reject.uncertain": "Puede que se haya ejecutado. Revise la Cartera antes de volver a intentarlo.",
  "reject.uncertain.ticket": "Volver a confirmar es seguro: la misma orden no se puede colocar dos veces.",

  // Estados
  "state.noAccount.title": "Aún no tiene cuenta de trading",
  "state.noAccount.body": "Abra una cuenta demo para practicar o una cuenta real para operar de verdad.",
  "state.noAccount.action": "Abrir una cuenta",
  "state.connecting": "Conectando con el servidor de trading…",
  "state.readOnly": "Aquí esta cuenta es de solo lectura: los precios y gráficos funcionan en tiempo real y el trading está desactivado.",
  "state.marketClosed.title": "Mercado cerrado",
  "state.marketClosed.body": "{symbol} vuelve a abrir con la próxima sesión. Podrá colocar órdenes cuando abra.",
  "state.streamError": "No se puede conectar con el servidor de trading",
  "state.streamErrorBody": "Sus posiciones y órdenes están seguras en el servidor. Seguimos intentando reconectar.",

  // Resultados
  "toast.filled": "Orden ejecutada: {side} {volume} {symbol}",
  "toast.at": "a {price}",
  "toast.placed": "Orden pendiente de {symbol} colocada",
  "toast.duplicate": "Ya colocada como #{ticket}",
  "toast.duplicateBody": "Esta orden ya había llegado al servidor; no se abrió nada nuevo.",
  "toast.closed": "Posición #{ticket} cerrada",
  "toast.partial": "Cerrados {volume} lotes de #{ticket}",
  "toast.modified": "#{ticket} actualizada",
  "toast.cancelled": "Orden #{ticket} cancelada",

  // Avisos del motor mientras la app está abierta
  "notify.sl": "Stop loss alcanzado",
  "notify.tp": "Take profit alcanzado",
  "notify.order_filled": "Orden pendiente ejecutada",
  "notify.order_triggered": "Orden activada",
  "notify.margin_call": "Margin call",
  "notify.stop_out": "Stop out",
  "notify.order_rejected": "Orden rechazada",
  "notify.order_expired": "Orden expirada",
  "notify.order_cancelled": "Orden cancelada",
};
export default mobileTrade;
