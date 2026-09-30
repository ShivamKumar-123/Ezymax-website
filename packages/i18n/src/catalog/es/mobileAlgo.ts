import type { NsMessages } from "../../core";

// App móvil de Kalks: Algo (/algo): estrategias que se ejecutan 24/7 en el servidor (despliegues), el interruptor de
// emergencia, informes de backtest, el marketplace de estrategias, claves API y webhooks.
// Se mantienen: Kalks, Algo, API, USDT, USD, nombres de indicadores (EMA, RSI, MACD, ATR, CCI, ADX, DI…), símbolos
// (EURUSD, XAUUSD), marcos temporales (M15, H1, H4), "R" (múltiplo de la distancia del stop), pips, P&L, DD, SL / TP.
// Los títulos marcados (display) van en mayúsculas grandes: cortos.
// "Despliegue" = una versión de una estrategia ejecutándose en una cuenta. "Interruptor de emergencia" = parada total.
const mobileAlgo: NsMessages<"mobileAlgo"> = {
  never: "nunca",
  // {n} días, compacto
  days: "{n} d",
  lot: "lotes",
  // Tiempo que se mantuvo una operación: min = minutos, h = horas, d = días (compacto)
  "dur.m": "{m} min",
  "dur.h": "{h} h",
  "dur.hm": "{h} h {m} min",
  "dur.d": "{d} d",
  "dur.dh": "{d} d {h} h",
  nTrades: { one: "{count} operación", many: "{count} operaciones", other: "{count} operaciones" },
  readOnly: "Con este acceso puede ver las estrategias, pero no cambiar nada.",

  /* ---------------------------------------------------------------- */
  /* Estados de pantalla                                               */
  /* ---------------------------------------------------------------- */
  // (display)
  "state.unavailable.title": "Algo no disponible",
  "state.unavailable.text": "No pudimos conectar con el servicio de estrategias. Sus estrategias siguen ejecutándose en el servidor; inténtelo de nuevo en un momento.",
  // (display)
  "state.disabled.title": "No disponible",
  "state.disabled.text": "Esta función no está disponible en su cuenta.",
  // (display)
  "state.notFound.title": "No encontrado",
  "state.notFound.text": "Puede que se haya eliminado o que el enlace sea incorrecto.",
  "state.back": "Volver a Algo",

  /* ---------------------------------------------------------------- */
  /* Errores del servidor (códigos del servicio de estrategias)        */
  /* ---------------------------------------------------------------- */
  "error.haltedMine": "Su interruptor de emergencia está activado. Desactívelo en la pantalla de Algo antes de volver a iniciar estrategias.",
  "error.haltedPlatform": "El bróker ha pausado el trading automatizado en este momento. Inténtelo más tarde.",
  // {n} = máximo de estrategias que pueden ejecutarse a la vez
  "error.limitRunning": "Puede ejecutar hasta {n} estrategias a la vez. Detenga una primero.",
  "error.accountStatus": "Esta cuenta no puede operar en este momento.",
  "error.alreadyRunning": "Esta versión ya se está ejecutando en esa cuenta.",
  "error.invalidStrategy": "Corrija primero los errores de la estrategia (en el Área de clientes o con AI Trader).",
  "error.state": "Ya ha cambiado. Deslice hacia abajo para ver su estado actual.",
  "error.queueFull": "Ya tiene 3 backtests en cola o en ejecución. Espere a que termine uno.",
  "error.dailyLimit": "Ha alcanzado el límite de hoy de {n} backtests.",
  "error.ownListing": "No puede suscribirse a su propia estrategia.",
  "error.subscribed": "Ya tiene una suscripción a esta estrategia.",
  "error.cloneNotAllowed": "El autor no permite clonarla; cópiela en su cuenta en su lugar.",
  // {amount} en USDT
  "error.insufficientFunds": "El saldo de su billetera es inferior a {amount} USDT. Deposite USDT para suscribirse.",
  "error.insufficientFundsPlain": "El saldo de su billetera es insuficiente. Deposite USDT para suscribirse.",
  "error.inactive": "Esta suscripción ya no está activa.",
  "error.archiveRunning": "Detenga los despliegues de esta estrategia antes de archivarla.",
  "error.archived": "Esta estrategia está archivada.",
  "error.finished": "Este backtest ya ha terminado.",
  "error.revoked": "Esta clave ya está revocada.",
  "error.notFound": "Ya no existe.",
  // {tf} = marco temporal (H1), {days} = número de días
  "error.rangeTooLong": "Los backtests en {tf} pueden abarcar como máximo {days} días. Elija un periodo más corto.",
  "error.balanceRange": "El balance inicial debe estar entre 100 y 10,000,000.",
  "error.dates": "La fecha de inicio debe ser anterior a la fecha de fin.",

  /* ---------------------------------------------------------------- */
  /* Inicio                                                            */
  /* ---------------------------------------------------------------- */
  "home.eyebrow": "Trading automatizado",
  // (display)
  "home.title": "Algo",
  "home.heroEyebrow": "En ejecución",
  "home.heroRunning": {
    zero: "estrategias operando 24/7 en el servidor",
    one: "estrategia operando 24/7 en el servidor",
    many: "estrategias operando 24/7 en el servidor",
    other: "estrategias operando 24/7 en el servidor",
  },
  "home.heroRealized": "P&L realizado",
  "home.heroOpen": "Abiertas ahora",
  // operaciones cerradas hasta ahora
  "home.heroTrades": "Operaciones",
  "home.qaAi": "Crear con IA",
  "home.qaAiHint": "Describa una idea y obtenga reglas exactas",
  "home.qaMarket": "Marketplace",
  "home.qaMarketHint": "Copie estrategias verificadas",
  "home.qaKeys": "Claves API y webhooks",
  "home.qaKeysHint": "Uso, revocación, alertas recientes",
  // (display)
  "home.running": "Despliegues",
  "home.runningSub": { zero: "Nada en ejecución ahora", one: "{count} en ejecución", many: "{count} en ejecución", other: "{count} en ejecución" },
  // {n} = número que se muestra en el filtro
  "home.filterActive": "Activos · {n}",
  "home.filterAll": "Todos · {n}",
  // (display)
  "home.strategies": "Mis estrategias",
  "home.strategiesSub": { zero: "Aún no hay ninguna guardada", one: "{count} guardada", many: "{count} guardadas", other: "{count} guardadas" },
  "home.newWithAi": "Nueva con IA",
  // (display)
  "home.backtests": "Backtests",
  "home.backtestsSub": "Las últimas ejecuciones, las más recientes primero",
  "home.emptyDeps": "Aún no se ha ejecutado nada. Abra una de sus estrategias abajo y despliéguela primero en una cuenta demo.",
  "home.emptyActive": "No hay nada en ejecución ahora. Las estrategias detenidas están en Todos.",
  "home.showAll": "Mostrar todo",
  "home.emptyStrats": "Aún no tiene estrategias propias. Describa su idea a AI Trader y se convertirá en reglas exactas que puede probar.",
  "home.browseMarket": "Explorar el marketplace",
  "home.emptyBts": "Aún no hay backtests. Abra una estrategia y ejecute uno sobre el historial de precios real.",
  "home.startEyebrow": "Primeros pasos",
  // (display)
  "home.startTitle": "Ponga a trabajar una estrategia",
  "home.step1": "Describa su idea a AI Trader: se convierte en reglas exactas que puede leer y cambiar.",
  "home.step2": "Pruebe las reglas en backtest sobre el historial de precios real, con los costes de su cuenta.",
  "home.step3": "Ejecútela 24/7 primero en una cuenta demo. Pause, detenga o termine la estrategia cuando quiera.",
  "home.footnote": "Las estrategias se ejecutan en los servidores de Kalks las 24 horas, en barras cerradas, con las mismas comprobaciones de órdenes que el trading manual: margen, horario del mercado y sus límites. Cree y edite estrategias con AI Trader o en el Área de clientes.",
  "home.openWeb": "Abrir el constructor de estrategias en la web",

  /* ---------------------------------------------------------------- */
  /* Interruptor de emergencia (toda la cuenta)                        */
  /* ---------------------------------------------------------------- */
  "kill.cardTitle": "Interruptor de emergencia",
  "kill.cardBody": "Detenga todas las estrategias a la vez y bloquee las órdenes de webhook y API.",
  "kill.stopAll": "Detener todo",
  "kill.onTitle": "Interruptor de emergencia activado",
  // {at} = fecha y hora
  "kill.onSince": "Desde {at}. Las estrategias están detenidas; las órdenes de webhook y API están bloqueadas.",
  "kill.onBody": "Las estrategias están detenidas; las órdenes de webhook y API están bloqueadas.",
  "kill.release": "Desactivar",
  // (display)
  "kill.title": "¿Detenerlo todo?",
  "kill.body": {
    zero: "Todas las estrategias se detienen de inmediato, y las órdenes de webhook y API quedan bloqueadas hasta que desactive el interruptor.",
    one: "La estrategia en ejecución se detiene de inmediato, y las órdenes de webhook y API quedan bloqueadas hasta que desactive el interruptor.",
    many: "Las {count} estrategias en ejecución se detienen de inmediato, y las órdenes de webhook y API quedan bloqueadas hasta que desactive el interruptor.",
    other: "Las {count} estrategias en ejecución se detienen de inmediato, y las órdenes de webhook y API quedan bloqueadas hasta que desactive el interruptor.",
  },
  "kill.alsoClose": "Cerrar también sus posiciones",
  "kill.alsoCloseHint": "Cierra a mercado todas las posiciones abiertas por una estrategia, un webhook o la API en todas sus cuentas. Sus operaciones manuales siguen abiertas.",
  "kill.confirm": "Detener todo ahora",
  // (display)
  "kill.doneTitle": "Todo detenido",
  "kill.stopped": "Estrategias detenidas",
  "kill.doneBody": "El interruptor de emergencia sigue activado hasta que lo desactive. Las estrategias detenidas no se reinician solas.",
  // (display)
  "kill.releaseTitle": "¿Desactivar el interruptor?",
  "kill.releaseBody": "Las órdenes de webhook y API vuelven a estar permitidas. Las estrategias detenidas siguen detenidas: despliéguelas de nuevo cuando quiera.",
  // (display)
  "kill.releasedTitle": "Interruptor desactivado",
  "kill.releasedBody": "Las órdenes de webhook y API vuelven a estar permitidas. Despliegue una estrategia para iniciarla.",
  "kill.globalTitle": "El trading automatizado está en pausa",
  "kill.globalBody": "El bróker ha pausado por ahora todas las estrategias y las órdenes de webhook y API. Las posiciones abiertas mantienen sus stops.",

  /* ---------------------------------------------------------------- */
  /* Estados y controles del despliegue                                */
  /* ---------------------------------------------------------------- */
  "dep.status.running": "En ejecución",
  "dep.status.paused": "En pausa",
  "dep.status.stopped": "Detenida",
  "dep.status.killed": "Terminada",
  "dep.status.error": "Error",
  "dep.realized": "P&L realizado",
  "dep.trades": "Operaciones",
  "dep.winRate": "Tasa de acierto",
  "dep.open": "Abiertas",
  "dep.orders": "Órdenes",
  "dep.openNow": "Abiertas",
  // {ago} = "hace 5 minutos"
  "dep.lastCheck": "Última barra evaluada {ago}",
  // {since} = fecha de inicio
  "dep.lastCheckSince": "Última barra evaluada {ago} · en ejecución desde {since}",
  // {reason} = motivo del servicio, p. ej. "detenida por el propietario"
  "dep.stoppedWhy": "Detenida: {reason}",
  "dep.stoppedTitle": "Detenida: {at}",
  "dep.errorTitle": "La estrategia ha tenido un error",
  // {account} = "Demo 50000083"
  "dep.eyebrow": "Despliegue · {account}",
  "dep.marketplaceCopy": "Copia del marketplace",
  "dep.openStrategy": "Abrir la estrategia",
  "dep.openSubscription": "Abrir mis suscripciones",
  // {pct} = rentabilidad %, {amount} = balance inicial
  "dep.onStart": "{pct} sobre {amount}",
  "dep.curveA11y": "Balance diario durante {days} días, realizado {pnl}",
  "dep.tabLog": "Registro · {n}",
  "dep.tabTrades": "Operaciones · {n}",
  "dep.tabSetup": "Configuración",
  "dep.noLogs": "Aún no hay registros: la primera barra cerrada es de calentamiento.",
  "dep.noTrades": "Aún no hay operaciones.",
  "dep.older": "Cargar entradas anteriores",
  "dep.logStart": "Esta es la primera entrada.",
  "dep.rules": "Reglas",
  "dep.rulesHidden": "El autor mantiene privadas las reglas: la estrategia se ejecuta en su cuenta tal como se publicó.",
  "dep.lotMultiplier": "Multiplicador de lote",
  "dep.maxLots": "Máx. lotes por orden",
  "dep.maxOpen": "Máx. posiciones abiertas",
  "dep.dailyLoss": "Límite de pérdida diaria",
  "dep.started": "Inicio",
  "dep.startBalance": "Balance inicial",
  "dep.setupNote": "Un despliegue ejecuta una versión exacta: guardar una versión nueva no lo cambia. Despliegue la nueva versión para cambiar.",

  "ctl.pause": "Pausar",
  "ctl.resume": "Reanudar",
  "ctl.stop": "Detener",
  "ctl.kill": "Terminar",
  "ctl.killNow": "Terminar ahora",
  "ctl.closePositions": "Cerrar posiciones",
  // (display)
  "ctl.pauseTitle": "¿Pausarla?",
  "ctl.pauseBody": "No habrá operaciones nuevas. Las posiciones abiertas mantienen su stop, objetivo y breakeven. Reanúdela cuando quiera.",
  // (display)
  "ctl.resumeTitle": "¿Reanudarla?",
  "ctl.resumeBody": "Vuelve a operar desde la próxima barra cerrada.",
  // (display)
  "ctl.stopTitle": "¿Detenerla?",
  "ctl.stopBody": "Se detiene definitivamente: no habrá operaciones nuevas. Para volver a ejecutarla, despliéguela de nuevo.",
  "ctl.keepTitle": "Mantener las posiciones abiertas",
  "ctl.keepText": {
    one: "La posición abierta mantiene su stop y su objetivo; gestiónela usted.",
    many: "Las {count} posiciones abiertas mantienen sus stops y objetivos; gestiónelas usted.",
    other: "Las {count} posiciones abiertas mantienen sus stops y objetivos; gestiónelas usted.",
  },
  "ctl.closeAllTitle": "Cerrarlas ahora",
  "ctl.closeAllText": {
    one: "La posición abierta se cierra a mercado.",
    many: "Las {count} posiciones abiertas se cierran a mercado.",
    other: "Las {count} posiciones abiertas se cierran a mercado.",
  },
  // (display)
  "ctl.killTitle": "¿Terminarla ahora?",
  "ctl.killBody": "El interruptor de emergencia detiene esta estrategia de inmediato y, por defecto, cierra a mercado las posiciones que abrió.",
  "ctl.killClose": "Cerrar sus posiciones",
  "ctl.killCloseHint": "A mercado, ahora. Desactívelo para mantenerlas abiertas con sus stops.",
  // (display)
  "ctl.closeTitle": "¿Cerrar sus posiciones?",
  "ctl.closeBody": {
    one: "La posición que abrió esta estrategia se cierra a mercado. La estrategia sigue ejecutándose.",
    many: "Las {count} posiciones que abrió esta estrategia se cierran a mercado. La estrategia sigue ejecutándose.",
    other: "Las {count} posiciones que abrió esta estrategia se cierran a mercado. La estrategia sigue ejecutándose.",
  },
  // (display)
  "ctl.done.pause": "En pausa",
  // (display)
  "ctl.done.resume": "De nuevo en marcha",
  // (display)
  "ctl.done.stop": "Detenida",
  // (display)
  "ctl.done.kill": "Terminada",
  // (display)
  "ctl.done.close": "Posiciones cerradas",
  "ctl.donePause": "No habrá operaciones nuevas hasta que la reanude.",
  "ctl.doneResume": "Vuelve a operar desde la próxima barra cerrada.",
  "ctl.doneClosed": { one: "Se cerró {count} posición.", many: "Se cerraron {count} posiciones.", other: "Se cerraron {count} posiciones." },
  "ctl.doneKept": "Sus posiciones abiertas, si las hay, siguen abiertas con sus stops y objetivos.",
  "ctl.doneNothing": "No había nada abierto que cerrar.",
  "ctl.closedLabel": "Cerradas",
  "ctl.failedLabel": "No se pudieron cerrar",
  "ctl.failedTitle": { one: "No se pudo cerrar {count} posición", many: "No se pudieron cerrar {count} posiciones", other: "No se pudieron cerrar {count} posiciones" },
  "ctl.failedBody": "Puede que el mercado esté cerrado. Ciérrela desde Cartera cuando vuelva a abrir.",
  // detener o terminar una copia del marketplace no termina su suscripción (ni las renovaciones de una de pago)
  "ctl.copyNote": "Esta es una copia del marketplace: detenerla no termina la suscripción. Para dejar de pagar, cancélela en Marketplace › Suscripciones.",

  /* ---------------------------------------------------------------- */
  /* Estrategia                                                        */
  /* ---------------------------------------------------------------- */
  // {version} = número de versión
  "strat.eyebrow": "Estrategia · v{version}",
  "strat.runningN": { one: "En ejecución", many: "{count} en ejecución", other: "{count} en ejecución" },
  "strat.draft": "Borrador",
  "strat.ready": "Lista",
  "strat.errors": { one: "{count} error", many: "{count} errores", other: "{count} errores" },
  "strat.archivedTag": "Archivada",
  "strat.lastBacktest": "Último backtest",
  "strat.backtested": "backtest",
  // (display)
  "strat.notTested": "Aún sin backtest",
  "strat.notTestedBody": "Pruebe las reglas sobre el historial de precios real, con los costes de su cuenta, antes de ejecutarlas.",
  "strat.runFirst": "Ejecutar un backtest",
  "strat.openReport": "Abrir el informe completo",
  "strat.deployV": "Desplegar v{version}",
  "strat.backtest": "Backtest",
  "strat.fixFirst": "Corrija esto antes de probar o desplegar",
  "strat.line": "Línea {n}:",
  // (display)
  "strat.rules": "Reglas",
  "strat.rulesSub": "Se comprueban en cada barra cerrada",
  "strat.rulesCodeSub": "Las señales del código, comprobadas en cada barra cerrada",
  "strat.showCode": "Mostrar como código",
  // (display)
  "strat.risk": "Riesgo",
  "strat.riskSub": "Tamaño, stops, horario y límites",
  "strat.editVisual": "Para cambiar las reglas, pídaselo a AI Trader o edítelas en el Área de clientes; cada cambio se guarda como una versión nueva.",
  "strat.editCode": "Las estrategias en código se editan en el Área de clientes web; cada cambio se guarda como una versión nueva.",
  "strat.openWeb": "Editar el código en la web",
  // (display)
  "strat.deployments": "Despliegues",
  "strat.deploymentsSub": { zero: "No se ejecuta en ninguna parte", one: "{count} despliegue", many: "{count} despliegues", other: "{count} despliegues" },
  "strat.notRunning": "No se está ejecutando. Despliéguela primero en una cuenta demo para ver cómo opera en real.",
  // (display)
  "strat.backtests": "Backtests",
  "strat.backtestsSub": { zero: "Aún ninguno", one: "{count} ejecución", many: "{count} ejecuciones", other: "{count} ejecuciones" },
  "strat.runNew": "Ejecutar nuevo",
  "strat.noBacktests": "Aún no hay backtests.",
  // (display)
  "strat.versions": "Versiones",
  "strat.versionsSub": { one: "{count} versión", many: "{count} versiones", other: "{count} versiones" },
  "strat.current": "Actual",
  "strat.archive": "Archivar",
  // (display)
  "strat.archiveTitle": "¿Archivarla?",
  "strat.archiveBody": "“{name}” sale de su lista. Sus backtests y despliegues anteriores se quedan en su historial.",
  "strat.archived": "“{name}” archivada",

  "kind.visual": "Reglas visuales",
  "kind.code": "Código",
  // De dónde viene una estrategia
  "origin.ai": "AI Trader",
  "origin.template": "Plantilla",
  "origin.manual": "Hecha a mano",
  "origin.marketplace": "Marketplace",

  /* ---------------------------------------------------------------- */
  /* Reglas en palabras                                                */
  /* ---------------------------------------------------------------- */
  "rules.buy": "Comprar cuando",
  "rules.sell": "Vender cuando",
  "rules.exitBuy": "Cerrar compras cuando",
  "rules.exitSell": "Cerrar ventas cuando",
  "rules.and": "y",
  "rules.or": "o",
  // {tf} = marco temporal, p. ej. "en H4"
  "rules.onTf": "en {tf}",
  "rules.noRules": "Aún no hay reglas de entrada.",
  "rules.size": "Tamaño",
  "rules.stop": "Stop loss",
  "rules.target": "Take profit",
  "rules.trailing": "Trailing",
  "rules.window": "Horario de trading",
  "rules.limits": "Límites",
  "rules.none": "Ninguno",
  "rules.lots": "{lots} lotes",
  "rules.riskPct": "{pct}% de riesgo por operación",
  "rules.maxLots": "máx. {lots} lotes",
  // puntos: mover el stop a la entrada + {o} tras {v} puntos de beneficio
  "rules.breakeven": "breakeven a {v} puntos (+{o})",
  "rules.allDay": "Las 24 horas",
  "rules.perDay": { one: "{count} operación al día", many: "{count} operaciones al día", other: "{count} operaciones al día" },
  "rules.dailyLoss": "Se detiene por el día con una pérdida de {amount}",
  "rules.oneAtATime": "Una posición a la vez",
  "rules.closeOutside": "Cierra fuera del horario",
  "rules.noLimits": "Sin límites diarios",
  "op.crossesAbove": "cruza por encima de",
  "op.crossesBelow": "cruza por debajo de",
  "dist.pips": "{v} pips",
  "dist.points": "{v} puntos",
  "dist.price": "a {v}",
  "dist.percent": "{v}% del precio",
  // {v} × ATR({p})
  "dist.atr": "{v} × ATR({p})",
  "dist.level": "nivel {v}",
  // múltiplo de la distancia del stop
  "dist.rr": "{v}R",
  "field.close": "Cierre",
  "field.open": "Apertura",
  "field.high": "Máximo",
  "field.low": "Mínimo",
  "field.hl2": "Precio mediano",
  "field.hlc3": "Precio típico",
  "field.ohlc4": "Precio medio",
  "field.volume": "Volumen",
  "pattern.bullish": "Vela alcista",
  "pattern.bearish": "Vela bajista",
  "pattern.bullish_engulfing": "Envolvente alcista",
  "pattern.bearish_engulfing": "Envolvente bajista",
  "pattern.hammer": "Martillo",
  "pattern.shooting_star": "Estrella fugaz",
  "pattern.doji": "Doji",
  "pattern.inside_bar": "Inside bar",
  "ind.sma": "SMA",
  "ind.ema": "EMA",
  "ind.wma": "WMA",
  "ind.rsi": "RSI",
  "ind.macd": "MACD",
  "ind.macd_signal": "Señal MACD",
  "ind.macd_hist": "Histograma MACD",
  "ind.bb_upper": "Bollinger superior",
  "ind.bb_middle": "Bollinger media",
  "ind.bb_lower": "Bollinger inferior",
  "ind.atr": "ATR",
  "ind.stoch_k": "Estocástico %K",
  "ind.stoch_d": "Estocástico %D",
  "ind.highest": "Máximo más alto",
  "ind.lowest": "Mínimo más bajo",
  "ind.cci": "CCI",
  "ind.willr": "Williams %R",
  "ind.adx": "ADX",
  "ind.plus_di": "+DI",
  "ind.minus_di": "−DI",
  "ind.momentum": "Momentum",
  "ind.roc": "ROC",
  "ind.stddev": "Desviación estándar",
  "note.noDailyLimit": "Sin límite diario de operaciones",
  "note.noStop": "Sin stop loss: las posiciones quedan sin protección",
  "note.riskNeedsStop": "El tamaño basado en riesgo requiere un stop loss",
  "note.rrNeedsStop": "Un take profit en R requiere un stop loss",
  "note.noEntry": "Sin regla de entrada: añada una condición de compra o de venta",

  /* ---------------------------------------------------------------- */
  /* Desplegar (formulario)                                            */
  /* ---------------------------------------------------------------- */
  "deploy.eyebrow": "Desplegar · v{version}",
  // (display)
  "deploy.title": "Ejecútela 24/7",
  "deploy.body": "“{name}” v{version} opera {symbol} en cada barra cerrada de {tf}, en los servidores de Kalks, incluso con su teléfono apagado. Pause, detenga o termine la estrategia cuando quiera.",
  "deploy.account": "Cuenta",
  "deploy.equity": "Patrimonio {amount}",
  "deploy.noAccounts": "Necesita una cuenta de trading activa. Abra una cuenta demo para probar estrategias sin riesgo.",
  "deploy.openAccount": "Abrir una cuenta",
  "deploy.multiplier": "Multiplicador de lote",
  "deploy.multiplierHint": "Escala el tamaño de cada orden. 1× opera el tamaño propio de la estrategia.",
  "deploy.maxOpen": "Máx. posiciones abiertas",
  "deploy.maxOpenHint": "Un límite adicional a las reglas propias de la estrategia.",
  "deploy.strategyDefault": "Regla de la estrategia",
  "deploy.dailyLoss": "Límite de pérdida diaria",
  "deploy.dailyLossHint": "Cuando la pérdida cerrada y abierta del día lo alcanza, no hay operaciones nuevas hasta mañana (hora del servidor).",
  "deploy.off": "Desactivado",
  "deploy.custom": "Personalizado",
  "deploy.dailyLossAmount": "Pérdida por día",
  "deploy.lossInvalid": "Introduzca un importe superior a 0.",
  "deploy.liveTitle": "Dinero real",
  "deploy.liveBody": "Esta es una cuenta real. La estrategia coloca órdenes reales con dinero real, y puede perderlo.",
  "deploy.ack": "Entiendo que la estrategia opera con dinero real en mi cuenta real y que soy responsable de ello.",
  "deploy.note": "El trading automatizado puede perder dinero. Los backtests son simulaciones y no predicen resultados futuros. Esto no es asesoramiento financiero.",
  // {account} = "Demo 50000083"
  "deploy.confirm": "Desplegar en {account}",
  // (display)
  "deploy.doneTitle": "En marcha",
  "deploy.doneBody": "“{name}” v{version} se está ejecutando en {account}.",
  "deploy.warmup": "La primera barra cerrada de {tf} es de calentamiento; las órdenes pueden empezar desde la siguiente.",
  "deploy.open": "Abrir despliegue",

  /* ---------------------------------------------------------------- */
  /* Backtests                                                         */
  /* ---------------------------------------------------------------- */
  "bt.status.queued": "En cola",
  "bt.status.running": "En ejecución",
  "bt.status.done": "Completado",
  "bt.status.failed": "Fallido",
  "bt.status.cancelled": "Cancelado",
  "bt.stage.queued": "Esperando un proceso libre",
  "bt.stage.loading": "Cargando el historial de precios",
  "bt.stage.m1": "Cargando barras de minutos",
  "bt.stage.simulating": "Simulando operaciones",
  "bt.stage.running": "En ejecución",
  // {id} = número del backtest, {version} = versión de la estrategia
  "bt.eyebrow": "Backtest #{id} · v{version}",
  // (display)
  "bt.title": "Backtest",
  "bt.start": "Inicio {amount}",
  "bt.runningNote": "Se ejecuta en el servidor: puede salir de esta pantalla y volver.",
  "bt.failed": "El backtest ha fallado",
  // (display)
  "bt.cancelled": "Cancelado",
  "bt.runAgain": "Ejecutar de nuevo",
  "bt.net": "Beneficio neto",
  // {pct} = rentabilidad, {amount} = balance inicial
  "bt.returnOf": "{pct} sobre {amount}",
  "bt.pf": "Factor de beneficio",
  "bt.winRate": "Tasa de acierto",
  "bt.winsOf": "{wins} de {trades}",
  "bt.maxDd": "Drawdown máximo",
  "bt.maxDdShort": "DD máx.",
  "bt.sharpe": "Sharpe",
  "bt.sortino": "Sortino {v}",
  "bt.trades": "Operaciones",
  "bt.longShort": "Largas: {long} · cortas: {short}",
  "bt.expectancy": "Esperanza",
  "bt.perTrade": "por operación",
  // (display)
  "bt.equity": "Patrimonio",
  "bt.drawdown": "Drawdown",
  "bt.legendEquity": "Patrimonio",
  "bt.legendBalance": "Balance",
  "bt.legendStart": "Inicio",
  "bt.noCurve": "No hay suficientes barras para una curva.",
  "bt.scrubHint": "Arrastre sobre el gráfico, o manténgalo pulsado, para leer cualquier punto.",
  "bt.curveA11y": "Patrimonio de {from} a {to}; drawdown máximo {dd}",
  // (display)
  "bt.monthly": "Mensual",
  "bt.monthlySub": "Rentabilidad de cada mes, % del balance",
  "bt.noTradesMonth": "sin operaciones",
  // (display)
  "bt.statistics": "Estadísticas",
  // (display)
  "bt.tradeList": "Operaciones",
  "bt.tradeListSub": "Las más recientes primero, netas de costes",
  "bt.truncated": "Las primeras {n} operaciones, las más recientes primero",
  "bt.fAll": "Todas · {n}",
  "bt.fWins": "Ganadoras · {n}",
  "bt.fLosses": "Perdedoras · {n}",
  "bt.noTrades": "Las reglas no operaron en este periodo.",
  // (display)
  "bt.data": "Datos y costes",
  "bt.m1Bars": "Barras de minutos (intrabarra)",
  "bt.since": "desde {date}",
  "bt.signals": "Señales",
  "bt.signalsValue": "Compra: {buy} · venta: {sell} · salida: {exits}",
  "bt.skipped": "Omitidas: {reason}",
  "bt.model": "Modelo",
  "bt.group": "Tipo de cuenta",
  "bt.spread": "Spread",
  "bt.spreadValue": "{points} puntos ({source})",
  "bt.commission": "Comisión",
  "bt.perLot": "{amount} por lote",
  "bt.swaps": "Swaps",
  "bt.swapsOn": "Se cobran en cada rollover",
  "bt.swapsOff": "No se cobran (sin swap)",
  "bt.conversion": "Conversión del P&L",
  "bt.usdBase": "USD como base: al precio de salida",
  "bt.usdQuoted": "Cotizado en USD",
  "bt.currentRate": "Al tipo actual ({rate})",
  "bt.simNote": "El backtest #{id} es una simulación sobre precios pasados: ejecuciones en la apertura de la barra siguiente, stops y objetivos sobre una trayectoria OHLC (barras de minutos cuando existen) y el spread, la comisión y los swaps de su tipo de cuenta. Los resultados pasados no predicen resultados futuros.",
  // Fuentes del historial y motivos de omisión del servicio
  "source.native": "nativo",
  "source.built_from_M1": "construido a partir de M1",
  "source.built_from_M5": "construido a partir de M5",
  "source.built_from_M15": "construido a partir de M15",
  "source.built_from_M30": "construido a partir de M30",
  "source.built_from_H1": "construido a partir de H1",
  "skip.outside_trading_window": "fuera del horario de trading",
  "skip.position_already_open": "ya había una posición abierta",
  "skip.daily_trade_limit": "límite diario de operaciones",
  "skip.max_daily_loss": "límite de pérdida diaria",
  "skip.market_closed": "mercado cerrado",
  "skip.20_open_positions": "ya había 20 posiciones abiertas",
  "skip.buy_and_sell_on_the_same_bar": "compra y venta en la misma barra",
  "skip.stop_distance_not_ready": "distancia del stop aún no disponible",
  "skip.SL_level_on_the_wrong_side": "nivel de stop en el lado equivocado",
  "skip.volume_below_the_minimum_lot": "tamaño inferior al lote mínimo",
  "spreadSource.group_quote": "cotización en tiempo real de su tipo de cuenta",
  "spreadSource.catalogue": "spread del catálogo",
  "spreadSource.fixed": "fijo",

  // (display)
  "btNew.title": "Ejecutar un backtest",
  "btNew.period": "Periodo",
  "btNew.balance": "Balance inicial",
  "btNew.other": "Otro",
  "btNew.amount": "Importe",
  "btNew.costs": "Costes según",
  "btNew.accountType": "Tipo de cuenta",
  "btNew.myAccount": "Mi cuenta",
  "btNew.costsGroupHint": "El spread, la comisión y los swaps de ese tipo de cuenta.",
  "btNew.costsAccountHint": "El spread, la comisión y los swaps del grupo de esa cuenta.",
  "btNew.noAccounts": "Aún no tiene una cuenta de trading activa.",
  "btNew.run": "Ejecutar backtest",
  "btNew.note": "El periodo máximo depende del marco temporal. Pueden ejecutarse hasta 3 backtests a la vez.",

  "period.p1m": "1M",
  "period.p3m": "3M",
  "period.p6m": "6M",
  "period.p1y": "1A",
  "period.p2y": "2A",
  "period.p5y": "5A",

  // Motivos de salida de la operación (códigos del servidor)
  "exit.sl": "Stop loss",
  "exit.tp": "Take profit",
  "exit.trailing": "Trailing stop",
  "exit.breakeven": "Breakeven",
  "exit.signal": "Señal",
  "exit.exit_rule": "Regla de salida",
  "exit.session": "Fuera de horario",
  "exit.end_of_test": "Fin de la prueba",
  "exit.stop_out": "Stop out",
  "exit.kill": "Interruptor de emergencia",
  "exit.stopped": "Detenida",
  "exit.client": "Cerrada",
  "exit.close": "Cerrada",

  "stat.balance": "Balance",
  "stat.gross": "Beneficio / pérdida bruta",
  "stat.cagr": "Crecimiento anual (CAGR)",
  "stat.avgWinLoss": "Ganancia / pérdida media",
  "stat.largest": "Mayor ganancia / pérdida",
  "stat.payoff": "Ratio de payoff",
  "stat.long": "Operaciones largas · acierto",
  "stat.short": "Operaciones cortas · acierto",
  "stat.streaks": "Máx. ganadoras / perdedoras seguidas",
  "stat.maxDd": "Drawdown máximo",
  "stat.recovery": "Factor de recuperación",
  "stat.sharpeSortino": "Sharpe / Sortino",
  "stat.avgBars": "Barras medias en posición",
  "stat.exposure": "Tiempo en el mercado",
  "stat.costs": "Comisión / swap / spread",
  "stat.bars": "Barras probadas",
  "stat.cpu": "Calculado en",
  "stat.seconds": "{s} s",

  /* ---------------------------------------------------------------- */
  /* Tipos de registro (ejecución)                                     */
  /* ---------------------------------------------------------------- */
  "log.eval": "Barra",
  "log.signal": "Señal",
  "log.order": "Orden",
  "log.close": "Cierre",
  "log.manage": "Gestión",
  "log.error": "Error",
  "log.info": "Info",

  /* ---------------------------------------------------------------- */
  /* Marketplace                                                       */
  /* ---------------------------------------------------------------- */
  "house.badge": "Estrategia de la casa · Gestionada por Kalks",
  "house.disclosure":
    "Estrategia de la casa gestionada por Kalks: una cuenta real propiedad del bróker que ejecuta esta estrategia. El historial incluye solo sus propias operaciones reales desde su inicio; nada es simulado ni se ha añadido retroactivamente.",
  "market.eyebrow": "Marketplace de estrategias",
  // (display)
  "market.title": "Marketplace",
  "market.subtitle": "Estrategias con historial verificado en cuentas reales de Kalks. Copie una en su cuenta o clone sus reglas cuando el autor lo permita.",
  "market.browse": "Explorar",
  "market.subs": "Suscripciones",
  "market.subsN": "Suscripciones · {n}",
  "market.mine": "Sus publicaciones",
  "market.search": "Buscar estrategias, autores…",
  "market.clear": "Borrar la búsqueda",
  "market.all": "Todas",
  "market.free": "Gratis",
  "market.paid": "De pago",
  "market.newest": "Más recientes",
  "market.topRated": "Mejor valoradas",
  "market.popular": "Populares",
  // {price} en USDT
  "market.perMonth": "{price} USDT/mes",
  "market.by": "por {author}",
  "market.return": "Rentabilidad",
  "market.winRate": "Tasa de acierto",
  "market.maxDd": "DD máx.",
  "market.trades": "Operaciones",
  // {type} = real / demo
  "market.verified": "{type} verificada",
  "market.verifiedDays": "{type} verificada · {days} días",
  // historial de menos de un día
  "market.verifiedNew": "{type} verificada · menos de un día",
  "market.subscribed": "Suscrito",
  "market.ratings": { zero: "Sin valoraciones", one: "{count} valoración", many: "{count} valoraciones", other: "{count} valoraciones" },
  "market.subscribers": { one: "{count} suscriptor", many: "{count} suscriptores", other: "{count} suscriptores" },
  // (display)
  "market.emptyTitle": "Aún no hay publicaciones",
  "market.emptyText": "Las estrategias aparecen aquí cuando sus autores las publican con un historial verificado.",
  // (display)
  "market.noMatchTitle": "Sin coincidencias",
  "market.noMatchText": "Pruebe con otra búsqueda o filtro.",
  // (display)
  "market.noSubsTitle": "Sin suscripciones",
  "market.noSubsText": "Las estrategias que copie o clone del marketplace aparecen aquí.",
  "market.disclaimer": "La rentabilidad pasada no garantiza resultados futuros. Los historiales proceden de cuentas reales o demo en Kalks y se etiquetan como tales. Comisión de la plataforma en suscripciones de pago: {pct}%.",
  "market.houseFootnote": "Las estrategias de la casa se ejecutan en cuentas reales propiedad del bróker; sus historiales son solo sus propias operaciones reales.",
  "market.earned": "Ganado",
  "market.fees": "Comisiones de la plataforma",
  "market.payments": "Pagos",
  "market.publishWeb": "La publicación de estrategias (con su historial verificado) y la edición de publicaciones se hacen en el Área de clientes web.",
  "market.openWeb": "Abrir el marketplace en la web",

  // Estados de la publicación (valores del servidor)
  "listing.pending": "En revisión",
  "listing.approved": "Publicada",
  "listing.rejected": "Rechazada",
  "listing.suspended": "Suspendida",
  "listing.unlisted": "Retirada",
  "listing.eyebrow": "Marketplace · {symbol} {tf}",
  "listing.verified": "Historial {type} verificado",
  "listing.cloneAllowed": "Se permite clonar",
  "listing.trackReturn": "Rentabilidad verificada",
  "listing.net": "Neto",
  "listing.noCurve": "La curva diaria aparece tras dos días de trading.",
  "listing.curveA11y": "Patrimonio diario durante {days} días, rentabilidad {ret}",
  "listing.trackNote": "Del propio despliegue del autor en Kalks desde {since}, calculado a partir de las transacciones cerradas en el motor de trading: nunca lo introduce el autor.",
  "listing.btSimulated": "Backtest · simulado",
  "listing.btNote": "Cómo habrían operado las reglas con precios pasados y los costes de este tipo de cuenta. No forma parte del historial real de arriba.",
  "listing.btA11y": "Curva de patrimonio del backtest (simulada)",
  // (display)
  "listing.about": "Descripción",
  // (display)
  "listing.risk": "Riesgo",
  // (display)
  "listing.rules": "Reglas",
  "listing.rulesPrivate": "Las reglas son privadas: copie la estrategia para ejecutarla en su cuenta.",
  // (display)
  "listing.reviews": "Reseñas · {n}",
  "listing.noReviews": "Aún no hay reseñas.",
  "listing.subscribeFree": "Suscribirse gratis",
  "listing.subscribePaid": "Suscribirse · {price} USDT / mes",
  "listing.copying": "Copiando en {login}",
  "listing.clonedTo": "Clonada en sus estrategias",
  "listing.openDeployment": "Abrir despliegue",
  "listing.openStrategy": "Abrir estrategia",
  "listing.cancel": "Cancelar",
  "listing.cancelConfirm": "Cancelar la suscripción",
  "listing.keep": "Mantenerla",
  // (display)
  "listing.cancelTitle": "¿Cancelarla?",
  "listing.cancelCopy": "La estrategia se detiene ahora en su cuenta. Sus posiciones abiertas siguen abiertas con sus stops y objetivos.",
  "listing.cancelClone": "La suscripción termina. La estrategia clonada se queda en su lista.",
  // {date} = fin del periodo pagado
  "listing.cancelPaid": "Sigue funcionando hasta el {date} y no se renovará. No se reembolsa nada del periodo actual.",
  "listing.cancelled": "Suscripción cancelada",
  "listing.cancelledPaid": "No se renovará",
  "listing.yours": "Su publicación",
  "listing.manageWeb": "Gestionar en la web",

  /* ---------------------------------------------------------------- */
  /* Suscribirse (formulario), suscripciones                           */
  /* ---------------------------------------------------------------- */
  "sub.eyebrow": "Suscribirse",
  "sub.title": "Suscribirse",
  "sub.body": "por {author} · {symbol} {tf}",
  "sub.how": "Modo",
  "sub.copyTitle": "Copiar en mi cuenta",
  "sub.copyText": "La versión exacta del autor se ejecuta en su cuenta, 24/7. Las reglas siguen siendo privadas.",
  "sub.copyTextOpen": "La versión exacta del autor se ejecuta en su cuenta, 24/7.",
  "sub.cloneTitle": "Clonar las reglas",
  "sub.cloneText": "Las reglas pasan a ser una de sus estrategias: pruébelas, cámbielas y despliéguelas usted mismo.",
  "sub.multiplierHint": "Escala el tamaño de las órdenes de la estrategia en su cuenta.",
  "sub.price": "Precio",
  "sub.dueNow": "A pagar ahora",
  "sub.wallet": "Billetera (disponible)",
  "sub.renewal": "Renovación",
  "sub.noCharge": "Gratis, no se cobra nada",
  "sub.shortTitle": "USDT insuficientes",
  "sub.shortBody": "Su billetera necesita al menos {amount} USDT disponibles.",
  "sub.deposit": "Depositar",
  "sub.liveBody": "La estrategia coloca órdenes reales con dinero real en esta cuenta, y puede perderlo.",
  "sub.ackPay": "Cobrar {price} USDT de mi billetera Kalks ahora y cada 30 días hasta que cancele.",
  // (display)
  "sub.doneTitle": "Suscrito",
  // {title} = estrategia, {account} = "Demo 50000083"
  "sub.doneCopy": "“{title}” se está ejecutando en {account}.",
  "sub.doneClone": "“{title}” ya es una de sus estrategias.",
  "sub.charged": "Se cobraron {amount} USDT de su billetera.",
  // la respuesta a la suscripción se perdió (conexión, tiempo de espera): la app vuelve a leer la publicación antes de reintentar
  "sub.noAnswer": "No recibimos respuesta. Puede que la suscripción se haya completado.",
  "sub.checkingTitle": "Comprobando su suscripción",
  "sub.checkingBody": "La respuesta se perdió por el camino. Lo estamos comprobando con el servidor antes de que pueda reintentarlo, para que nunca se le cobre dos veces.",
  "sub.noAnswerRetry": "Sigue sin haber respuesta y no hay ninguna suscripción nueva en su cuenta. Puede volver a intentarlo.",
  "sub.notThrough": "No se completó y no queda ningún cargo (cualquier cargo se reembolsa a su billetera). Puede volver a intentarlo.",
  "sub.unfinished": "Todavía se está configurando en el servidor. Revise Marketplace › Suscripciones y el historial de su billetera, o contacte con soporte, antes de volver a intentarlo.",
  "sub.free": "Suscripción gratuita: no se cobró nada.",
  "sub.copyOn": "copia en {login}",
  "sub.cloned": "clonada",
  "sub.renews": "se renueva el {date}",
  "sub.ends": "termina el {date}",
  "sub.status.active": "Activa",
  "sub.status.cancelled": "Cancelada",
  "sub.status.expired": "Caducada",
  "sub.status.past_due": "Pago vencido",

  // (display)
  "review.title": "Valórela",
  "review.rating": "Su valoración",
  "review.stars": { one: "{count} estrella", many: "{count} estrellas", other: "{count} estrellas" },
  "review.comment": "Comentario (opcional)",
  "review.placeholder": "¿Qué resultados le ha dado?",
  "review.post": "Publicar reseña",
  "review.saved": "Reseña guardada",
  "review.rate": "Valorar",
  "review.edit": "Editar reseña",
  "review.you": "Usted",

  /* ---------------------------------------------------------------- */
  /* Claves API y webhooks                                             */
  /* ---------------------------------------------------------------- */
  "keys.eyebrow": "Desarrolladores",
  // (display)
  "keys.title": "API",
  "keys.subtitle": "Claves para sus propios programas de trading y URL de webhook para alertas (TradingView y otros).",
  "keys.requests24h": "Solicitudes · últimas 24 h",
  "keys.errors": "Errores",
  // solicitudes rechazadas por el límite de frecuencia
  "keys.limited": "Limitadas",
  "keys.p50": "Mediana",
  "keys.writes": "Órdenes",
  // (display)
  "keys.keys": "Claves API",
  "keys.keysSub": "Activas: {n} de un máximo de 20",
  "keys.none": "No hay claves API. Cree una en el Área de clientes web.",
  "keys.status.active": "Activa",
  "keys.status.revoked": "Revocada",
  "keys.status.expired": "Caducada",
  "keys.scope.read": "Lectura",
  "keys.scope.trade": "Trading",
  // {ips} = lista de direcciones IP
  "keys.ips": "Solo desde {ips}",
  "keys.anyIp": "Desde cualquier dirección IP",
  "keys.expires": "Caduca el {date}",
  "keys.noExpiry": "No caduca",
  "keys.lastUsed": "último uso {ago}",
  "keys.revoke": "Revocar",
  // (display)
  "keys.revokeTitle": "¿Revocar esta clave?",
  "keys.revokeBody": "“{name}” ({id}) deja de funcionar de inmediato para todos los programas que la usan. Esta acción no se puede deshacer.",
  "keys.revoked": "“{name}” revocada",
  "keys.webTitle": "Crear en la web",
  "keys.webBody": "Las claves y los webhooks nuevos se crean en el Área de clientes: el secreto de una clave y la URL de un webhook se muestran una sola vez, donde puede copiarlos en sus herramientas de trading.",
  "keys.openWeb": "Abrir el Área de clientes",
  "keys.killHint": "¿Necesita detenerlo todo? El interruptor de emergencia de la pantalla de Algo detiene todas las estrategias y bloquea las órdenes de webhook y API.",

  // (display)
  "hooks.title": "Webhooks",
  "hooks.sub": "{n} de un máximo de 20",
  "hooks.none": "No hay webhooks. Cree uno en el Área de clientes web.",
  // {hint} = últimos caracteres de la URL
  "hooks.hint": "URL …{hint}",
  "hooks.accounts": { one: "{count} cuenta", many: "{count} cuentas", other: "{count} cuentas" },
  "hooks.today": { zero: "sin alertas hoy", one: "{count} alerta hoy", many: "{count} alertas hoy", other: "{count} alertas hoy" },
  "hooks.used": "usado {ago}",
  "hooks.on": "Activado",
  "hooks.off": "Desactivado",
  "hooks.switch": "Webhook “{name}” activado",
  "hooks.passphrase": "Requiere frase de acceso",
  "hooks.noPassphrase": "Sin frase de acceso",
  "hooks.delete": "Eliminar",
  // (display)
  "hooks.deleteTitle": "¿Eliminar este webhook?",
  "hooks.deleteBody": "“{name}” y su URL secreta dejan de funcionar de inmediato; las alertas que se le envíen se rechazan. Esta acción no se puede deshacer.",
  "hooks.deleted": "“{name}” eliminado",
  // (display)
  "hooks.alerts": "Alertas recientes",
  "hooks.alertsSub": "Cada alerta con el resultado de cada cuenta",
  // Estados de la alerta (valores del servidor)
  "hooks.status.accepted": "Aceptada",
  "hooks.status.partial": "Parcial",
  "hooks.status.failed": "Fallida",
  "hooks.status.received": "Recibida",
  "hooks.status.rejected": "Rechazada",
  "hooks.status.blocked": "Bloqueada (interruptor)",
  // Resultado de una alerta en cada cuenta (valores del servidor)
  "hooks.result.filled": "ejecutada",
  "hooks.result.pending": "orden colocada",
  "hooks.result.closed": "cerrada",
  "hooks.result.nothing_to_close": "nada que cerrar",
  "hooks.result.rejected": "rechazada",
};
export default mobileAlgo;
