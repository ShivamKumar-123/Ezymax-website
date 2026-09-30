import type { NsMessages } from "../../core";

// App móvil de Kalks, Informes: Extractos (/reports/statements) y Analítica (/reports/analytics).
// La mayoría de etiquetas vienen de portfolio.st.* / portfolio.an.* del Área de clientes; aquí solo va lo del móvil.
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "Informes",
  "eyebrow.analytics": "Informes · USD · hora del servidor",

  // Selector de cuenta (una tarjeta que abre una hoja)
  "account.title": "Cuenta",
  "account.choose": "Elija una cuenta",
  "account.allHint": { one: "{count} cuenta real", many: "{count} cuentas reales", other: "{count} cuentas reales" },
  "account.change": "Cambiar de cuenta",

  // Extractos
  "st.day": "Día",
  "st.pickDay": "Elija un día",
  "st.pickFrom": "Fecha de inicio",
  "st.pickTo": "Fecha de fin",
  "st.include": "Incluir",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "Preparando…",
  "st.ready": "Extracto listo",
  "st.saved": "Guardado como {file}",
  "st.shareTitle": "Compartir extracto",
  "st.failed": "No se pudo descargar el extracto",
  "st.offline": "No tiene conexión. Conéctese para descargar extractos.",
  "st.monthly.empty": "Aún no hay meses con extracto.",
  "st.monthly.offline": "No tiene conexión. Conéctese para ver los extractos mensuales.",
  "st.monthly.a11y": "{month}: neto {net}, {trades}. Abre las descargas.",
  "st.month.title": "Extracto de {month}",
  "st.month.formats": "Descargar como",
  "st.prevMonth": "Mes anterior",
  "st.nextMonth": "Mes siguiente",

  // Analítica: cabecera y cifras
  "an.hero.label": "P&L neto · {period}",
  "an.hero.return": "Rentabilidad",
  "an.hero.trades": "Operaciones",
  "an.hero.lots": "Lotes",
  "an.tile.sharpe": "Ratio de Sharpe",
  "an.tile.expectancy": "Esperanza",
  "an.tile.sortino": "Sortino {value}",
  "an.tile.avgWinLoss": "Ganancia / pérdida media",
  "an.tile.rr": "Beneficio : riesgo 1 : {value}",
  "an.tile.holdSplit": "Ganadoras {win} · perdedoras {loss}",
  "an.tile.streaks": "Rachas",
  "an.tile.streaksSub": "Ganadoras / perdedoras seguidas",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "Aún no hay operaciones",

  // Analítica: curvas
  "an.curve.hint": "Mantenga pulsado el gráfico para ver cada día",
  "an.curve.drawdown": "Drawdown",
  "an.curve.a11y": "Patrimonio {equity}, balance {balance} el {date}. Drawdown máximo {drawdown}.",

  // Analítica: calendario de P&L (neto de las operaciones cerradas por día del servidor)
  "an.cal.title": "Calendario de P&L",
  "an.cal.subtitle": "Resultado neto de las operaciones cerradas por día del servidor",
  "an.cal.subtitleEstimated": "Variación diaria del balance, sin depósitos ni retiros",
  "an.cal.days": { one: "{count} día de trading", many: "{count} días de trading", other: "{count} días de trading" },
  "an.cal.green": "{count} en verde",
  "an.cal.red": "{count} en rojo",
  "an.cal.noTrades": "Sin operaciones cerradas",
  "an.cal.select": "Toque un día para ver su resultado",
  "an.cal.a11yDay": "{date}: {net}, {trades}",

  // Analítica: desgloses
  "an.hour.byHour": "P&L neto por hora",
  "an.hour.byDayHour": "Día de la semana × hora",
  "an.hour.tap": "Toque una barra o una celda para ver detalles",
  "an.tapBar": "Toque una barra para ver detalles",
  "an.session.best": "Mejor",
  "an.session.asia": "Asia",
  "an.session.london": "Londres",
  "an.session.overlap": "Londres / Nueva York",
  "an.session.newYork": "Nueva York",
  "an.session.lateNewYork": "Nueva York (tarde)",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "Patrimonio actual",
  "an.charges.total": "Cargos pagados",

  // Análisis del comportamiento (las cifras vienen del servicio de informes)
  "insight.overtrading.title": { one: "Sobretrading en {count} día", many: "Sobretrading en {count} días", other: "Sobretrading en {count} días" },
  "insight.overtrading.text": "Esos días abrió más de {limit} operaciones (en un día típico abre {median}). Resultado neto de esos días: {net}.",
  "insight.overtrading.tip": "Fije un límite diario de {cap} operaciones.",
  "insight.revenge.title": {
    one: "{count} posible operación de venganza",
    many: "{count} posibles operaciones de venganza",
    other: "{count} posibles operaciones de venganza",
  },
  "insight.revenge.text": "Operaciones abiertas en los 15 minutos siguientes a un cierre con pérdida, con el mismo tamaño o mayor. Ganaron el {rate}% de las veces, con {net} en total.",
  "insight.revenge.tip": "Haga una pausa de 15 minutos tras una pérdida antes de la siguiente operación.",
  "insight.risk.title": "Riesgo por operación perdedora",
  "insight.risk.text": {
    one: "Una operación perdedora le costó de media el {avg}% de su balance, como máximo el {max}%. {count} pérdida superó el 2%.",
    many: "Una operación perdedora le costó de media el {avg}% de su balance, como máximo el {max}%. {count} pérdidas superaron el 2%.",
    other: "Una operación perdedora le costó de media el {avg}% de su balance, como máximo el {max}%. {count} pérdidas superaron el 2%.",
  },
  "insight.risk.tip": "Dimensione las posiciones para que un stop loss cueste como máximo el 1–2% del balance.",
  "insight.holdLosers.title": "Mantiene las perdedoras más tiempo que las ganadoras",
  "insight.holdLosers.text": "Las operaciones perdedoras siguen abiertas {loss} de media; las ganadoras, {win}.",
  "insight.holdLosers.tip": "Coloque un stop loss al abrir la operación y no lo mueva.",
  "insight.stopOut.title": { one: "{count} cierre por stop out", many: "{count} cierres por stop out", other: "{count} cierres por stop out" },
  "insight.stopOut.text": "Las posiciones se cerraron por el stop out de margen, no por su propio stop loss.",
  "insight.stopOut.tip": "Mantenga el nivel de margen por encima del nivel de margin call con posiciones más pequeñas.",
  "insight.slTp.title": "Operaciones cerradas por stop loss o take profit",
  "insight.slTp.text": "{tp} por take profit, {sl} por stop loss; el resto se cerró a mano o por la mesa de operaciones.",
  "insight.slTp.tip": "Las salidas planificadas mantienen la coherencia de los resultados.",
  "insight.session.title": "Mejor sesión: {session}",
  "insight.session.text": "{trades} operaciones con una tasa de acierto del {rate}%. La más floja: {worst} ({net}).",
  "insight.session.tip": "Céntrese en la sesión de {session}.",
  "insight.tip": "Consejo",

  // Estados
  "state.updating": "Actualizando…",
  "state.stale": "Se muestran datos guardados. Deslice hacia abajo para actualizar.",
  "state.notShared.title": "No compartido con usted",
  "state.footer": "Todos los importes en USD (cuentas cent convertidas). Horas del servidor, GMT+2 / GMT+3.",
  "state.footerStatements": "Los extractos están en la divisa de la cuenta (USC en las cuentas cent). Horas del servidor, GMT+2 / GMT+3.",
};
export default mobileReports;
