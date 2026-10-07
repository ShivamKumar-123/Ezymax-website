import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // Encabezado (inicio del Área de clientes). {name} = nombre del cliente
  "greeting.morning": "Buenos días, {name}",
  "greeting.afternoon": "Buenas tardes, {name}",
  "greeting.evening": "Buenas noches, {name}",
  "greeting.welcome": "Hola, {name}",
  "subtitle.live": "Le damos la bienvenida a Kalks. Aquí tiene su cuenta y los mercados de hoy.",
  "subtitle.demo": "Así evolucionan hoy sus cuentas.",
  launchTrader: "Abrir Kalks Trader",
  openTerminal: "Abrir terminal de trading",

  // Lista de primeros pasos
  "steps.title": "Primeros pasos",
  "steps.subtitle": "Su progreso hacia el trading real",
  "steps.progress": "{done} de {total}",
  "steps.account.title": "Cree su cuenta",
  "steps.account.text": "Registrado el {date}.",
  "steps.email.title": "Verifique su correo electrónico",
  "steps.email.verified": "{email} está verificado.",
  "steps.email.confirm": "Confirme {email} con el código que le enviamos.",
  "steps.kyc.title": "Verifique su identidad",
  "steps.kyc.verified": "Su identidad está verificada. Los retiros están desbloqueados.",
  "steps.kyc.moreInfo": "Nuestro equipo necesita un documento más.",
  "steps.kyc.review": "Sus documentos están en manos de nuestro equipo de verificación.",
  "steps.kyc.draft": "Continúe donde lo dejó. Tarda unos 3 minutos.",
  "steps.kyc.rejected": "No pudimos verificar sus documentos. Puede empezar de nuevo.",
  "steps.kyc.todo": "Tarda unos 3 minutos. Desbloquea los retiros.",
  "steps.accountOpen.title": "Abra una cuenta de trading",
  // {count} = total de cuentas reales + demo
  "steps.accountOpen.opened": { one: "Cuentas abiertas: real {live}, demo {demo}.", other: "Cuentas abiertas: real {live}, demo {demo}." },
  "steps.accountOpen.todo": "Abra una cuenta real o demo; su login se emite al instante.",
  "steps.wallet.title": "Financie su billetera",
  "steps.wallet.text": "Estamos habilitando los depósitos en USDT por TRC20.",
  // Chips de estado de los pasos
  "steps.state.done": "Hecho",
  "steps.state.todo": "Pendiente",
  "steps.state.review": "En revisión",
  "steps.state.rejected": "Rechazado",
  "steps.state.soon": "Sin iniciar",

  // Tarjeta de cuentas de trading. <b> envuelve el importe de patrimonio
  "accounts.title": "Cuentas de trading",
  "accounts.summary": "Patrimonio real <b>{equity}</b> · {live} reales · {demo} demo · {positions} posiciones abiertas",
  "accounts.subtitle": "Sus cuentas reales y demo",
  "accounts.all": "Todas las cuentas",
  "accounts.open": "Abrir cuenta",
  "accounts.unavailable": "Las cuentas de trading no están disponibles en este momento. Sus saldos están seguros.",
  "accounts.openLive.title": "Abra una cuenta real",
  "accounts.openLive.text": "Mercados reales. Empieza con saldo cero; fondéela desde su billetera.",
  "accounts.openDemo.title": "Abra una cuenta demo",
  "accounts.openDemo.text": "Fondos virtuales con precios en tiempo real, recargables cada día.",
  "accounts.more": { one: "{count} cuenta más", many: "{count} cuentas más", other: "{count} cuentas más" },
  "accounts.myTitle": "Mis cuentas de trading",

  // Tarjeta de su cuenta
  "account.title": "Su cuenta",
  "account.clientId": "ID de cliente",
  "account.emailStatus": "Estado del correo",
  "account.notVerified": "No verificado",
  "account.identity": "Identidad",
  "account.memberSince": "Cliente desde",
  "account.profile": "Perfil",

  // Banner de Kalks Trader
  "trader.chip": "Precios en tiempo real",
  "trader.text": "Cotizaciones y gráficos en tiempo real de {count} instrumentos de forex, metales, índices, energías, criptomonedas y acciones. Funciona en su navegador, sin instalar nada.",

  // Reloj de mercados / mapa de calor
  "sessions.title": "Reloj de mercados",
  "sessions.open": "{open} de {total} mercados abiertos",
  "heatmap.title": "Mapa de calor del mercado",
  "heatmap.subtitle": "Variación de hoy con precios en tiempo real · punto hueco: mercado cerrado",
  "heatmap.up": "{count} al alza",
  "heatmap.down": "{count} a la baja",
  "heatmap.allMarkets": "Todos los mercados",
  "heatmap.tipOpen": "{symbol} · mercado abierto",
  "heatmap.tipClosed": "{symbol} · mercado cerrado, variación de la última sesión",

  // Tarjeta de soporte. <mail> envuelve la dirección de soporte
  "support.title": "¿Necesita ayuda?",
  "support.text": "Escriba a <mail>{email}</mail> desde su dirección registrada e incluya su ID de cliente.",
  "support.emailSupport": "Escribir a soporte",
  "support.copied": "Dirección de correo copiada",
  "support.copyFailed": "No se pudo copiar; seleccione la dirección manualmente",

  // Panel demo: franja de incorporación
  "onboarding.title": "Termine de configurar su cuenta",
  "onboarding.text": "Complete el KYC para desbloquear los retiros y límites más altos.",
  "onboarding.progress": "Progreso",
  "onboarding.dismiss": "Descartar",

  // Salud del margen
  "margin.title": "Salud del margen",
  "margin.subtitle": "En todas las cuentas reales",
  "margin.healthy": "Saludable",
  "margin.level": "Nivel de margen",
  "margin.used": "Margen utilizado",
  "margin.free": "Margen libre",

  // Patrimonio / P&L. {range} = 1W, 1M, 3M, YTD, 1Y, ALL (se mantienen)
  "equity.title": "Patrimonio total",
  "equity.changeOver": "Variación en {range}",
  "pnl.title": "Ganancias / pérdidas · mes",
  "pnl.lowRisk": "Riesgo bajo",
  "pnl.winRate": "Tasa de acierto (30 d)",
  "pnl.trades": "Operaciones (30 d)",
  "pnl.avgWin": "Operación ganadora media",
  "pnl.avgLoss": "Operación perdedora media",
  "pnl.charges": "Cargos pagados",

  // Tarjetas KPI
  "kpi.wallet": "Billetera",
  "kpi.today": "+{pct}% hoy",
  "kpi.monthPnl": "P&L del mes",
  "kpi.vsLastMonth": "+{pct}% vs. mes anterior",
  "kpi.partnerEarnings": "Ganancias de socio",
  // Copy = ganancias de copy trading
  "kpi.copy": "Copy {amount}",

  // Mayores variaciones
  "movers.title": "Mayores variaciones",
  "movers.gainers": "Alzas",
  "movers.losers": "Bajas",

  // Calendario económico. A = Actual, P = Previsión, Ant = Anterior
  "calendar.title": "Calendario económico",
  "calendar.subtitle": "Hoy · hora del servidor GMT+3",
  "calendar.actual": "A {value} · ",
  "calendar.forecastPrevious": "P {forecast} · Ant {previous}",

  // Noticias / mundo
  "news.title": "Noticias del mercado",
  "news.all": "Todas las noticias",
  "news.pinned": "Fijada",
  "world.title": "Mercados y noticias en todo el mundo",
  "world.subtitle": "Titulares en directo por país y sentimiento por divisa",
  "world.stories": { one: "{count} noticia hoy", many: "{count} noticias hoy", other: "{count} noticias hoy" },

  // Posiciones abiertas
  "positions.title": "Posiciones abiertas",
  "positions.summary": { one: "{count} posición · flotante", many: "{count} posiciones · flotante", other: "{count} posiciones · flotante" },
  "positions.terminal": "Terminal",

  // Banner de socios. <link> envuelve el enlace de referido
  "partner.chip": "Programa de socios",
  "partner.title": "Invite a traders. Gane hasta $15 por lote, de por vida.",
  "partner.text": "Comisiones multinivel, bonos CPA y seguimiento en tiempo real. Su enlace: <link>{url}</link>",
  "partner.open": "Abrir panel de socio",

  // Tiempos relativos cortos (min = minutos, h = horas, d = días)
  "time.justNow": "Ahora mismo",
  "time.minutesAgo": "hace {count} min",
  "time.hoursAgo": "hace {count} h",
  "time.daysAgo": "hace {count} d",
  // {time} = valor de ejemplo como "5m"
  "time.ago": "hace {time}",

  // Campana / panel de notificaciones
  "notifications.title": "Notificaciones",
  "notifications.ariaUnread": "Notificaciones, {count} sin leer",
  "notifications.markAll": "Marcar todo como leído",
  "notifications.clear": "Borrar",
  "notifications.emptyTitle": "Aún no hay notificaciones",
  "notifications.emptyText": "Aquí aparecerán depósitos, retiros, verificación, alertas de trading y respuestas de soporte.",
  "notifications.settings": "Ajustes de notificaciones",

  // Client Area redesign: side menu, dashboard overview
  "chrome.expand": "Expandir menú",
  "chrome.collapse": "Contraer menú",
  "chrome.menu": "Menú",
  "home.todayPnl": "P&L de hoy",
  "home.walletBalance": "Saldo de la billetera",
  "home.rewardsEarnings": "Recompensas y ganancias IB",
  "home.todayPct": "{pct}% hoy",
  "home.floating": "P&L flotante",
  "home.rewards": "Recompensas",
  "home.accountsChip": "{live} reales · {positions} posiciones abiertas",
  "home.statistics": "Estadísticas",
  "home.pnl": "P&L",
  "home.weekly": "Semanal",
  "home.monthly": "Mensual",
  "home.lastYear": "Último año",
  "home.noHistory": "Tu historial de capital aparecerá aquí cuando tus cuentas reales tengan actividad.",
  "home.thisPeriod": "Este periodo",
  "home.previousPeriod": "Periodo anterior",
  "home.yourAccounts": "Tus cuentas",
  "home.tradingAccount": "Cuenta de trading",
  "home.accountInfo": "Información de la cuenta",
  "home.accountName": "Nombre de la cuenta",
  "home.leverage": "Apalancamiento",
  "home.previous": "Cuenta anterior",
  "home.next": "Cuenta siguiente",
  "home.showBalances": "Mostrar saldos",
  "home.hideBalances": "Ocultar saldos",
  "home.trade": "Operar",
  "home.history": "Historial",
  "home.funding": "Fondos",
  "home.linked": "Vinculado",
  "home.connected": "Conectado",
  "home.subscriptions": { one: "{count} suscripción activa", many: "{count} suscripciones activas", other: "{count} suscripciones activas" },
  "home.points": "{points} puntos",
  "home.redeem": "Canjear",
  "home.networkUnavailable": "En pausa",
  "home.totalBalance": "Saldo total",
  "home.totalBalanceSub": "Cuentas reales y billetera",
  "home.transferFunds": "Transferir fondos",
  "home.quickActions": "Acciones rápidas",
  "home.later": "Más tarde",
  "home.viewDetails": "Ver detalles",
  "home.verifyNow": "Verificar ahora",
  "home.fundTitle": "Fondea tu billetera",
  "home.fundText": "Deposita USDT para empezar a operar en una cuenta real.",
  "home.depositNow": "Depositar ahora",
  "home.tradingTitle": "Trading",
  "home.marketsTitle": "Mercados",
  "home.moreTitle": "Más para ti",
};
export default dashboard;
