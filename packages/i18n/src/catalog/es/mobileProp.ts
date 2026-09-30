import type { NsMessages } from "../../core";

// App móvil de Kalks: Prop (catálogo de desafíos y compra, panel de reglas en tiempo real, pagos, certificados).
// Se mantienen "Kalks", "Kalks Prop", "Kalks Trader", "Kalks-Live", "USDT", "New York" y "17:00".
// Los títulos en mayúsculas grandes van marcados "display": cortos.
const mobileProp: NsMessages<"mobileProp"> = {
  // Inicio de Prop
  "home.eyebrow": "Kalks Prop",
  // display
  "home.title": "Consiga financiación",
  "home.subtitle": "Supere un desafío, consiga una cuenta financiada y quédese hasta el {split}% del beneficio. Todas las cuentas prop son simuladas.",
  "home.subtitleNoSplit": "Supere un desafío, consiga una cuenta financiada y quédese una parte del beneficio. Todas las cuentas prop son simuladas.",
  "home.payouts": "Pagos",
  "home.payoutsReady": "{amount} disponibles",
  "home.payoutsNone": "Ninguno disponible aún",
  "home.certificates": "Certificados",
  "home.certCount": { one: "{count} obtenido", many: "{count} obtenidos", other: "{count} obtenidos" },
  "home.mine": "Sus desafíos",
  "home.past": "Desafíos anteriores",
  "home.showAll": "Mostrar todos ({count})",
  "home.yourCertificates": "Sus certificados",
  "home.plans": "Elija su desafío",
  "home.newChallenge": "Iniciar un nuevo desafío",
  // display
  "home.emptyTitle": "No hay desafíos disponibles",
  "home.emptyBody": "Estamos preparando nuevos planes de desafío. Vuelva a consultarlo pronto.",
  "home.mineError": "No se pudieron cargar sus desafíos.",
  "home.plansError": "No se pudieron cargar los planes de desafío.",

  // Cómo funciona (numerado 01–04 en el inicio de Prop)
  "how.title": "Cómo funciona",
  "how.1.title": "Elija un plan",
  "how.1.body": "Elija el modelo y el tamaño de la cuenta. La tarifa se paga una sola vez desde su billetera USDT.",
  "how.2.title": "Alcance el objetivo",
  "how.2.body": "Alcance el objetivo de beneficio dentro de los límites de pérdida diaria y drawdown, durante los días mínimos de trading.",
  "how.3.title": "Consiga financiación",
  "how.3.body": "Si lo supera, su cuenta financiada se abre automáticamente con un certificado para compartir.",
  "how.4.title": "Cobre",
  "how.4.body": "Solicite su parte del beneficio a su billetera USDT en cada ciclo de pago.",
  "how.enforce": "Los límites se comprueban en el servidor cada segundo, sobre el patrimonio. Recibirá avisos al 50, 75 y 90% de la pérdida diaria; una infracción cierra todas las posiciones y pone fin al desafío.",

  // Modelos de plan
  "type.oneStep": "1 fase",
  "type.twoStep": "2 fases",
  "type.instant": "Instantáneo",
  "typeText.oneStep": "Una fase de evaluación. Alcance el objetivo, respete los límites y obtenga financiación.",
  "typeText.twoStep": "Dos fases de evaluación con objetivos más bajos y límites más amplios.",
  "typeText.instant": "Sin evaluación. Empiece directamente en una cuenta financiada, con límites más estrictos.",

  // Tarjeta del plan
  "plan.refundable": "Tarifa reembolsable",
  "plan.fee": "Tarifa",
  "plan.account": "Cuenta",
  "plan.leverage": "Apalancamiento 1:{n}",
  "plan.target": "Objetivo",
  "plan.dailyLoss": "Pérdida diaria",
  "plan.maxDD": "Drawdown máx.",
  "plan.static": "estático",
  "plan.trailing": "dinámico",
  "plan.start": "Empezar · {fee}",

  // Compra
  "checkout.eyebrow": "Compra",
  "checkout.fee": "Tarifa única",
  "checkout.chargedRefund": "Se paga desde su billetera USDT. Se reembolsa con su primer pago.",
  "checkout.chargedNoRefund": "Se paga desde su billetera USDT. No reembolsable.",
  "checkout.walletBalance": "Saldo de la billetera: {balance} USDT",
  "checkout.shortTitle": "Su billetera no cubre la tarifa",
  "checkout.short": "Tiene {balance} USDT. Deposite {missing} USDT más para pagar este desafío.",
  "checkout.rules": "Las reglas",
  "checkout.limitsNote": "Los límites son un porcentaje del balance inicial. Infringir la pérdida diaria o el drawdown máximo suspende la cuenta y cierra todas las posiciones a mercado. El día de trading se reinicia a las 17:00 New York.",
  "checkout.agree": "He leído las reglas y entiendo que la cuenta es simulada y se suspende automáticamente al infringir un límite de pérdida.",
  "checkout.pay": "Pagar {fee}",
  "checkout.retry": "Reintentar · {fee}",
  "checkout.paying": "Pagando…",
  "checkout.goToMine": "Ver mis desafíos",
  // display
  "checkout.readyTitle": "Ya está dentro",
  "checkout.readyBody": "Se pagaron {fee} desde su billetera USDT y su cuenta de {size} ({phase}) está abierta. Las reglas se aplican desde ahora.",
  "checkout.savePasswords": "Guarde estas contraseñas ahora: solo se muestran una vez y no las almacenamos. Siempre podrá operar con esta cuenta desde la app sin ellas.",
  "checkout.passwordsShown": "Las contraseñas de trading se mostraron cuando se confirmó esta compra. Puede operar con esta cuenta desde la app sin ellas.",
  "checkout.viewChallenge": "Ver desafío",
  "checkout.readOnly": "Esta sesión no puede comprar desafíos.",

  // Credenciales de la cuenta
  "cred.login": "Login",
  "cred.server": "Servidor",
  "cred.password": "Contraseña de trading",
  "cred.investorPassword": "Contraseña de inversor (solo lectura)",
  "cred.show": "Mostrar contraseña",
  "cred.hide": "Ocultar contraseña",
  // {what} es el nombre del campo copiado
  copied: "Copiado: {what}",
  "a11y.copy": "Copiar {what}",

  // Estados del desafío
  "status.pendingPayment": "Pendiente de pago",
  "status.provisioning": "Abriendo cuenta",
  "status.active": "Activo",
  "status.funded": "Financiada",
  "status.failed": "Suspendido",
  "status.closed": "Cerrado",
  "status.paymentFailed": "Pago fallido",
  // {phase} es el nombre de la fase del plan, p. ej. "Fase 2"
  "stage.active": "{phase} · Activa",
  "stage.failed": "{phase} · Suspendida",
  "phaseStatus.provisioning": "Abriendo",
  "phaseStatus.active": "Activa",
  "phaseStatus.passed": "Superada",
  "phaseStatus.failed": "Suspendida",
  "phaseStatus.closed": "Cerrada",

  // Tarjetas de desafío (inicio de Prop)
  "card.target": "Objetivo de beneficio",
  "card.profit": "Beneficio",
  "card.equity": "Patrimonio {amount}",
  "card.dailyLeft": "Pérdida diaria restante {amount}",
  "card.opening": "Su cuenta de trading se está abriendo. Tarda unos segundos.",

  // Panel
  "dash.equity": "Patrimonio",
  "dash.balance": "Balance",
  "dash.floating": "Flotante",
  "dash.open": "Abiertas",
  "dash.sinceStart": "desde el inicio de la fase",
  "dash.rules": "Reglas",
  "dash.rulesTitle": "Reglas de este desafío",
  // display
  "dash.notFound": "Desafío no encontrado",
  "dash.notFoundBody": "Puede que se haya abierto con otro acceso.",
  "dash.backToProp": "Volver a Prop",
  "live.live": "En directo",
  "live.connecting": "Conectando…",
  "live.offline": "Sin conexión",
  // {time}: fecha y hora de la última comprobación de reglas
  "live.updated": "Comprobado: {time}",
  // {time}: cuándo terminó la fase
  "live.final": "Final · {time}",

  // Nombres de reglas (indicadores, registro de reglas)
  "rule.dailyLoss": "Pérdida diaria",
  "rule.maxDrawdown": "Drawdown máximo",
  "rule.profitTarget": "Objetivo de beneficio",
  "rule.tradingDays": "Días de trading",
  "rule.timeLimit": "Límite de tiempo",
  "rule.weekendHolding": "Mantener en fin de semana",
  "rule.newsWindow": "Ventana de noticias",
  "rule.bannedStrategy": "Estrategia prohibida",
  "rule.consistency": "Consistencia",
  "rule.riskDesk": "Decisión del departamento de riesgos",
  "ruleState.ok": "En curso",
  "ruleState.passed": "Cumplida",
  "ruleState.failed": "Infringida",
  "ruleState.off": "Desactivada",

  // Indicadores
  "target.ofTarget": "del objetivo",
  "target.of": "Objetivo {amount} ({pct}%)",
  "target.left": "Faltan {amount}",
  "target.reachedBy": "Alcanzado, {amount} por encima",
  "limit.left": "Quedan {amount}",
  "limit.breachAt": "Infracción en {amount}",
  days: { one: "{count} día", many: "{count} días", other: "{count} días" },
  "days.of": "{v} de {min}",
  "days.count": { one: "{count} día", many: "{count} días", other: "{count} días" },
  "days.met": "Mínimo cumplido",
  "days.toGo": { one: "Falta {count}", many: "Faltan {count}", other: "Faltan {count}" },
  "days.noMinimum": "Sin mínimo",
  // d = días, h = horas
  "time.left": "Quedan {d} d {h} h",
  "time.deadline": "Termina el {date}",
  "consistency.rule": "Mejor día ≤ {pct}% del beneficio",
  "consistency.noProfit": "Aún sin beneficio",
  "reset.title": "La pérdida diaria se reinicia en",
  "reset.note": "17:00 New York, cada día de trading",

  // Cuenta financiada: anillo de la ventana de pago
  "payoutHero.title": "Próximo pago",
  "payoutHero.share": "Su parte hasta ahora",
  // display
  "payoutHero.open": "Abierta",
  // display
  "payoutHero.ready": "Listo",
  // display
  "payoutHero.days": { one: "{count} día", many: "{count} días", other: "{count} días" },
  "payoutHero.eligible": "Disponible ahora con su reparto del {split}%.",
  "payoutHero.opens": "La ventana de pago se abre el {date}.",
  "payoutHero.later": "Solicite un pago cuando tenga beneficio disponible.",

  // Estados grandes
  // display
  "hero.opening.title": "Abriendo su cuenta",
  "hero.opening.body": "El pago está confirmado y su cuenta de trading se está configurando. Esta página se actualiza sola.",
  // display
  "hero.closed.title": "Desafío cerrado",
  "hero.closed.body": "No se pudo abrir la cuenta de trading de este desafío, así que el desafío se cerró y la tarifa se reembolsó a su billetera USDT. Contacte con soporte si tiene preguntas.",
  // {reason} es el motivo del servicio prop, en inglés
  "hero.closed.reason": "{reason}. La tarifa se reembolsó a su billetera USDT.",
  // display
  "hero.failed.title": "{phase} suspendida",
  "hero.failed.on": "Finalizó el {date}",
  // {reason} es el motivo de la infracción según el motor de riesgo
  "hero.failed.body": "{reason}. Se cerraron todas las posiciones y la cuenta está desactivada.",
  "hero.failed.ruleBreached": "Se ha infringido una regla",
  // {rule} es el nombre de una regla, p. ej. "Pérdida diaria"
  "hero.failed.rule": "{rule}: límite infringido",
  "hero.failed.new": "Iniciar un nuevo desafío",
  // display
  "hero.passed.title": "{phase} superada",
  "hero.passed.on": "Superada el {date}.",
  "hero.passed.next": "Su cuenta de {phase} está abierta.",
  "hero.passed.nextLogin": "Su cuenta de {phase} está abierta (#{login}).",
  "hero.passed.opening": "Su siguiente cuenta se está abriendo.",
  "hero.passed.certificate": "Ver certificado",
  "hero.passed.goNext": "Ir a {phase}",
  // display
  "hero.funded.title": "Financiada",
  "hero.funded.body": "Opere con la cuenta financiada y reciba el {split}% del beneficio en pagos.",
  "hero.funded.certificate": "Ver su certificado de cuenta financiada",

  // Avisos durante el trading
  "warn.lossUsed": "Ha usado el {pct}% del límite de pérdida de hoy",
  "warn.lossUsedBody": "Un patrimonio igual o inferior a {floor} suspende la cuenta y cierra todas las posiciones. Restante hoy: {left}.",
  "warn.weekend": "Cierre de fin de semana",
  "warn.weekendBody": "Este plan no permite mantener posiciones durante el fin de semana: las posiciones abiertas se cierran el viernes a las 16:45 New York.",

  // Acciones
  "action.openTrade": "Abrir en Operar",
  "action.trade": "Operar",
  "action.tradeBlocked": "Solo se puede operar con la cuenta activa de un desafío activo.",
  "action.payouts": "Pagos",
  "action.support": "Contactar con soporte",

  // Gráfico de patrimonio
  "chart.title": "Curva de patrimonio",
  "chart.start": "Inicio",
  "chart.target": "Objetivo",
  "chart.ddFloor": "Drawdown máximo",
  "chart.dailyFloor": "Pérdida diaria",
  "chart.now": "Ahora",
  "chart.empty": "La curva aparece tras los primeros minutos de trading.",

  // Estadísticas de trading
  "stats.title": "Estadísticas de trading",
  "stats.trades": "Operaciones",
  "stats.winRate": "Tasa de acierto",
  "stats.profitFactor": "Factor de beneficio",
  "stats.avgWin": "Ganancia media",
  "stats.avgLoss": "Pérdida media",
  "stats.lots": "Lotes",
  "stats.bestDay": "Mejor día {date}: {amount}",

  // Registro de reglas
  "events.title": "Registro de reglas",
  "events.empty": "Sin avisos ni infracciones. Siga así.",
  "events.equity": "patrimonio {amount}",
  "events.limit": "límite {amount}",
  "severity.breach": "Infracción",
  "severity.violation": "Incumplimiento",
  "severity.warning": "Aviso",
  "severity.info": "Info",

  // Operaciones cerradas
  "trades.title": "Operaciones cerradas",
  "trades.all": "Todas ({count})",
  "trades.count": { one: "{count} operación cerrada", many: "{count} operaciones cerradas", other: "{count} operaciones cerradas" },
  "trades.empty": "Aún no hay operaciones cerradas.",
  // Dirección de la operación (términos MT5)
  "trades.buy": "Buy",
  "trades.sell": "Sell",
  // duraciones compactas: s = segundos, min = minutos, h = horas, d = días
  "duration.s": "{s} s",
  "duration.ms": "{m} min {s} s",
  "duration.hm": "{h} h {m} min",
  "duration.dh": "{d} d {h} h",

  // Detalles de la cuenta
  "account.title": "Cuenta",
  "account.split": "Su parte",
  "account.initial": "Balance inicial",
  "account.started": "Inicio de la fase",
  "account.ended": "Finalizado",
  "account.deadline": "Fecha límite",
  "account.passwordNote": "Las contraseñas de trading se mostraron una vez, en la compra. Abrir en Operar inicia sesión en esta cuenta sin ellas.",

  // Pagos
  // display
  "payouts.title": "Pagos",
  "payouts.available": "Disponible ahora",
  "payouts.eligibleCount": {
    one: "{eligible} de {count} cuenta financiada disponible",
    many: "{eligible} de {count} cuentas financiadas disponibles",
    other: "{eligible} de {count} cuentas financiadas disponibles",
  },
  "payouts.requests": { one: "{count} solicitud", many: "{count} solicitudes", other: "{count} solicitudes" },
  "payouts.count": { one: "{count} pago", many: "{count} pagos", other: "{count} pagos" },
  "payouts.paidToDate": "Pagado hasta la fecha",
  "payouts.funded": "Cuentas financiadas",
  // display
  "payouts.account": "{size} financiada",
  "payouts.quote": "Estimación del pago",
  "payouts.eligibleNow": "Disponible ahora",
  "payouts.notYet": "Aún no disponible",
  "payouts.toWallet": "a su billetera",
  "payouts.yourSplit": "Su parte",
  "payouts.firmShare": "Parte de la empresa",
  "payouts.alreadyRefunded": "Ya reembolsada",
  "payouts.withFirst": "Con el primer pago",
  "payouts.opens": "Se habilita el {date}.",
  "payouts.minimum": "Mínimo {amount}.",
  "payouts.kycNote": "Verifique su identidad para solicitar este pago.",
  "payouts.kycPendingNote": "Podrá solicitar este pago cuando se apruebe su verificación de identidad.",
  "payouts.readOnly": "Esta sesión no puede solicitar pagos.",
  "payouts.request": "Solicitar pago",
  // abre el panel de reglas en tiempo real de la cuenta (en la web, "Panel de reglas"); corto: comparte fila con Operar
  "payouts.dashboard": "Reglas",
  "payouts.history": "Historial",
  "payouts.historyEmpty": "Aún no hay pagos.",
  // display
  "payouts.emptyTitle": "Aún sin cuenta financiada",
  "payouts.emptyBody": "Supere un desafío para obtener una cuenta financiada. Solicite pagos aquí cuando tenga beneficio disponible.",
  "payouts.emptyAction": "Consiga financiación",
  "payoutStatus.pending": "En revisión",
  "payoutStatus.approved": "Aprobado",
  "payoutStatus.paid": "Pagado",
  "payoutStatus.rejected": "Rechazado",
  "payoutStatus.failed": "Fallido",
  "split.title": "Reparto de beneficios y escalado",
  "split.upTo": "Hasta el {pct}% con escalado",
  "split.cycle": "Pagos",
  // {days} p. ej. "14 días"
  "split.first": "El primero tras {days}",
  "split.firstNow": "Desde el primer día",
  // {months} p. ej. "4 meses"; {cap} p. ej. "$2,000,000"
  "scaling.text": "Obtenga un {profit}% de beneficio en {months} y la cuenta crecerá un {increase}%, hasta {cap}.",
  "scaling.none": "Este plan no escala la cuenta.",
  months: { one: "{count} mes", many: "{count} meses", other: "{count} meses" },

  // Hoja de solicitud de pago
  "request.eyebrow": "Solicitar pago",
  "request.profit": "Beneficio de la cuenta",
  "request.share": "Su parte ({pct}%)",
  "request.feeRefund": "Reembolso de la tarifa del desafío",
  "request.total": "Total a su billetera",
  "request.note": "Todo el beneficio actual se retira ahora de la cuenta de trading, para que no se pueda perder operando mientras está en revisión. Una vez aprobado, su parte se abona en su billetera USDT; si se rechaza la solicitud, el beneficio vuelve a la cuenta.",
  "request.submit": "Solicitar {amount}",
  "request.done": "Pago solicitado",
  "request.doneBody": "{amount} se abonará en su billetera USDT una vez aprobado.",

  // Verificación de identidad (pagos)
  "kyc.verified": "Identidad verificada: los pagos pueden aprobarse.",
  "kyc.pendingTitle": "Verificación en revisión",
  "kyc.pendingText": "Su verificación está en revisión. Podrá solicitar pagos cuando se verifique su identidad.",
  "kyc.requiredTitle": "Verifique su identidad",
  "kyc.requiredText": "Los pagos solo se realizan a traders verificados. Verifíquese antes de su primer pago.",
  "kyc.rejectedText": "Su verificación fue rechazada. Envíela de nuevo para recibir pagos.",

  // Por qué aún no se puede solicitar un pago
  "blocker.notYetEligible": "La ventana de pago aún no está abierta.",
  "blocker.belowMinimum": "El beneficio es inferior al pago mínimo.",
  "blocker.positionsOpen": "Cierre todas las posiciones abiertas para solicitar un pago.",
  "blocker.payoutPending": "Ya hay un pago en revisión.",
  "blocker.consistency": "No se cumple la regla de consistencia: su mejor día representa una parte demasiado grande del beneficio.",

  // Certificados
  // display
  "certs.title": "Certificados",
  "certs.subtitle": "Cada fase superada, cada cuenta financiada y cada pago obtiene un certificado que cualquiera puede verificar.",
  "certs.kind.pass": "Fase superada",
  "certs.kind.funded": "Trader financiado",
  "certs.kind.payout": "Pago",
  "certs.revoked": "Revocado",
  "certs.revokedBody": "Kalks revocó este certificado y ya no es válido, así que no se puede compartir.",
  "certs.meta": "{plan} · {size} · {date}",
  "certs.number": "N.º {code}",
  "certs.shareImage": "Compartir imagen",
  "certs.shareLink": "Compartir enlace",
  "certs.copyLink": "Copiar enlace",
  "certs.linkCopied": "Enlace de verificación copiado",
  "certs.shareTitle": "Mi certificado de Kalks Prop",
  "certs.shareMessage": "Mi certificado de Kalks Prop. Se puede verificar aquí:",
  "certs.shareFailed": "No se pudo compartir el certificado. Inténtelo de nuevo.",
  "certs.shareUnavailable": "Compartir no está disponible en este dispositivo.",
  // display
  "certs.emptyTitle": "Aún no tiene certificados",
  "certs.emptyBody": "Supere una fase de desafío para obtener su primer certificado, con un enlace público que cualquiera puede verificar.",
  "certs.emptyAction": "Ver desafíos",

  // Palabras de reglas compartidas por la compra y la hoja de reglas
  accountSize: "Tamaño de la cuenta",
  profitSplit: "Reparto de beneficios",
  feeRefund: "Reembolso de la tarifa",
  nonRefundable: "No reembolsable",
  leverage: "Apalancamiento",
  none: "Ninguno",
  allowed: "Permitido",
  notAllowed: "No permitido",
  noTimeLimit: "Sin límite de tiempo",
  // {phase} es el nombre de la fase, p. ej. "Fase 1"
  "rules.phaseTarget": "Objetivo de {phase}",
  "rules.phaseMinDays": "Días mínimos de {phase}",
  "rules.phaseTimeLimit": "Límite de tiempo de {phase}",
  "rules.evaluation": "Evaluación",
  "rules.evaluationNone": "Ninguna, financiada desde el primer día",
  "rules.dailyLoss": "Límite de pérdida diaria",
  "rules.dailyLossBalance": "{pct}% · {amount} · desde el balance a las 17:00 New York",
  "rules.dailyLossEquity": "{pct}% · {amount} · desde el mayor entre balance y patrimonio a las 17:00 New York",
  "rules.ddStatic": "{pct}% estático",
  "rules.ddTrailing": "{pct}% dinámico",
  "rules.ddLocks": "{dd}, se fija en el inicial",
  // ≤ = como máximo
  "rules.consistencyValue": "Mejor día ≤ {pct}% del beneficio total",
  "rules.news": "Trading en noticias",
  "rules.newsBlocked": "No en ±{min} min alrededor de noticias de alto impacto",
  "rules.newsBlockedFails": "No en ±{min} min alrededor de noticias de alto impacto (suspende la cuenta)",
  "rules.weekendClosed": "Posiciones cerradas el viernes a las 16:45 New York",
  "rules.ea": "Expert Advisors",
  "rules.banned": "Estrategias prohibidas",
  "rules.splitScaling": "{split}%, ampliable hasta {max}%",
  "rules.firstPayout": "Primer pago",
  // {freq} es un ciclo de pago en minúsculas, p. ej. "semanal"
  "rules.firstPayoutValue": "Tras {days}, después {freq} · mín. {min}",
  "rules.refunded": "Se reembolsa con el primer pago",

  // Estrategias de trading prohibidas
  "banned.hft": "Trading de alta frecuencia",
  "banned.latencyArbitrage": "Arbitraje de latencia",
  "banned.tickScalping": "Scalping de ticks",
  "banned.crossAccountCopying": "Copia entre cuentas",
  "banned.crossAccountHedging": "Cobertura entre cuentas",
  "banned.martingale": "Martingala",
  "banned.grid": "Trading en rejilla",

  // Ciclo de pago, en minúsculas: se usa dentro de frases ("después semanal")
  "payoutFreq.weekly": "semanal",
  "payoutFreq.biWeekly": "cada 2 semanas",
  "payoutFreq.monthly": "mensual",
  "payoutFreq.onDemand": "a petición",

  // Errores (mensajes para los códigos de error del servicio prop)
  "errorLink.deposit": "Depositar",
  "errorLink.verify": "Verificar identidad",
  "error.insufficientFunds": "El saldo de su billetera USDT es insuficiente para esta tarifa. Deposite USDT e inténtelo de nuevo.",
  "error.kycRequired": "Verifique su identidad antes de solicitar un pago.",
  "error.paymentPending": "Aún no hemos podido confirmar el pago desde la billetera. Inténtelo de nuevo en un minuto: no se le cobrará dos veces.",
  "error.paymentFailed": "El pago desde la billetera no se completó. No se le ha cobrado nada.",
  "error.walletPending": "La billetera aún no lo ha confirmado. Inténtelo de nuevo en un minuto.",
  "error.walletRejected": "La billetera rechazó este pago. Póngase en contacto con soporte.",
  "error.provisioning": "Pago recibido. Su cuenta de trading todavía se está abriendo: aparecerá en sus desafíos en un minuto.",
  "error.planUnavailable": "Este plan o tamaño ya no está disponible. Elija otro.",
  "error.notYetEligible": "Esta cuenta todavía no puede solicitar un pago.",
  "error.belowMinimum": "El beneficio es inferior al pago mínimo.",
  "error.positionsOpen": "Cierre todas las posiciones abiertas antes de solicitar un pago.",
  "error.payoutPending": "Ya hay un pago de esta cuenta en revisión.",
  "error.consistency": "Aún no se cumple la regla de consistencia: su mejor día representa una parte demasiado grande del beneficio.",
  "error.notFunded": "Los pagos solo están disponibles en cuentas financiadas.",
  "error.accountUnavailable": "No pudimos abrir la cuenta de trading de este desafío, así que la tarifa se reembolsó a su billetera USDT. Contacte con soporte si vuelve a ocurrir.",
  "error.idempotencyConflict": "Este proceso de pago ya se usó para otra compra. Ciérrelo y empiece de nuevo.",
  "error.notActive": "Este desafío no está activo.",
  "error.accountLimit": "Ha alcanzado el número máximo de cuentas prop. Póngase en contacto con soporte para ampliar el límite.",
  "error.staffReadOnly": "Esta es una sesión de personal de solo lectura. No se permiten cambios.",
  "error.engine": "El servidor de trading no respondió. Inténtelo de nuevo en breve.",
  "error.generic": "Algo salió mal. Inténtelo de nuevo.",
  // display
  "load.title": "Prop no disponible",
  "load.body": "No pudimos conectar con el servicio prop. Sus cuentas están seguras; inténtelo de nuevo en un momento.",
};
export default mobileProp;
