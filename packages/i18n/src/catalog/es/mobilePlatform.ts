import type { NsMessages } from "../../core";

// App móvil de Kalks (src/features/platform): bandeja de notificaciones, notificaciones push, bloqueo de la app
// (Face ID / huella / código del teléfono), "Continuar con Google" y enlaces que abren la app.
// Se mantienen los nombres de marca y de producto: Kalks, Face ID, Touch ID, Google.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // Bandeja de notificaciones (/notifications). Encabezados de día: Hoy, Ayer y luego la fecha.
  "inbox.eyebrow": "Bandeja de entrada",
  "inbox.unread": { one: "{count} sin leer", many: "{count} sin leer", other: "{count} sin leer" },
  "inbox.caughtUp": "Está al día",
  "inbox.filter.unread": "Sin leer",
  "inbox.markedAll": "Todo marcado como leído",
  "inbox.emptyUnread.title": "Está al día",
  "inbox.emptyUnread.body": "Ha leído todas las notificaciones. Las nuevas aparecerán aquí en cuanto lleguen.",
  "inbox.loadMoreFailed": "No se pudieron cargar las notificaciones anteriores. Toque para reintentar.",
  // Bajo el título cuando el teléfono no tiene conexión y la bandeja muestra lo que guardó antes
  "inbox.offlineCached": "No tiene conexión. Estas son las notificaciones guardadas en este teléfono.",
  // Accesibilidad de la fila: "Sin leer. Depósito acreditado. Se acreditaron 100 USDT. Hace 2 minutos"
  "inbox.a11y.unread": "Sin leer",
  "inbox.a11y.settings": "Ajustes de notificaciones",
  // Hoja de detalle de una notificación sin pantalla que abrir
  "inbox.detail.openWeb": "Abrir enlace",
  "inbox.detail.received": "Recibida el {time}",

  // Solicitud del permiso push (nunca en el primer inicio): una hoja en Inicio y una tarjeta en la bandeja
  "push.ask.eyebrow": "Notificaciones",
  "push.ask.title": "Entérese al instante",
  "push.ask.body": "Depósitos acreditados, retiros pagados, margin calls, stop outs y respuestas de soporte, directamente en su pantalla de bloqueo.",
  "push.ask.point.money": "Depósitos y retiros",
  "push.ask.point.risk": "Margin calls y stop outs",
  "push.ask.point.support": "Respuestas de soporte",
  "push.ask.allow": "Activar notificaciones",
  "push.ask.later": "Ahora no",
  "push.ask.note": "Usted elige los temas en Perfil › Notificaciones. Las ofertas solo se envían si las activa.",
  // Notificación de ejemplo dibujada en la solicitud, como se vería en la pantalla de bloqueo ("now" = su hora)
  "push.ask.now": "ahora",
  "push.ask.sampleTitle": "Depósito acreditado",
  "push.ask.sampleBody": "Se acreditaron 250.00 USDT en su billetera.",
  "push.card.title": "Active las notificaciones push",
  "push.card.body": "Reciba depósitos, ejecuciones y margin calls en su pantalla de bloqueo.",
  "push.card.action": "Activar",
  "push.card.deniedTitle": "Las notificaciones push están desactivadas",
  "push.card.deniedBody": "Permita las notificaciones de Kalks en los ajustes del teléfono para recibirlas en la pantalla de bloqueo.",
  "push.card.deniedAction": "Abrir ajustes",
  "push.card.dismiss": "Ocultar",
  "push.enabled": "Notificaciones push activadas",
  // Canales de notificación de Android (se muestran en los ajustes del teléfono para la app)
  "push.channel.alerts": "Margin calls y seguridad",
  "push.channel.alertsHint": "Avisos de margin call y stop out, sus alertas de precio, nuevos inicios de sesión",
  "push.channel.activity": "Actividad de la cuenta",
  "push.channel.activityHint": "Depósitos, retiros, ejecuciones, verificación y respuestas de soporte",
  "push.channel.news": "Noticias y ofertas",
  "push.channel.newsHint": "Promociones y novedades del producto que ha aceptado recibir",
  // Banner en la app para un push que llega con la app abierta
  "push.banner.a11y": "Nueva notificación: {title}. Toque dos veces para abrirla.",

  // Pantalla de bloqueo de la app (al iniciar, tras el tiempo elegido en segundo plano y /lock)
  "lock.eyebrow": "App bloqueada",
  "lock.title": "Hola de nuevo",
  "lock.subtitle": "Desbloquee para ver sus cuentas y saldos.",
  // {method}: Face ID, Touch ID, huella digital, reconocimiento facial o código
  "lock.unlockWith": "Desbloquear con {method}",
  "lock.unlock": "Desbloquear",
  "lock.prompt": "Desbloquear Kalks",
  "lock.promptSubtitle": "Confirme que es usted",
  "lock.failed": "No ha funcionado. Inténtelo de nuevo.",
  "lock.lockout": "Demasiados intentos. Desbloquee el teléfono con su código y vuelva a intentarlo.",
  "lock.noScreenLock": "Su teléfono ya no tiene bloqueo de pantalla, así que Kalks no puede confirmar que es usted. Cierre sesión y vuelva a entrar con su contraseña.",
  "lock.notYou": "¿No es usted o no puede desbloquear?",
  "lock.signOut": "Cerrar sesión",
  "lock.signOutTitle": "¿Cerrar sesión en Kalks?",
  "lock.signOutBody": "Volverá a iniciar sesión con su correo y contraseña. Sus posiciones y fondos no se ven afectados.",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "huella digital",
  "lock.method.face": "reconocimiento facial",
  "lock.method.iris": "iris",
  "lock.method.passcode": "código",

  // Ajustes › Bloqueo de la app (/settings/app-lock)
  "settings.eyebrow": "Seguridad",
  "settings.title": "Bloqueo de la app",
  "settings.subtitle": "Proteja Kalks con {method} al abrir la app y cuando vuelva del segundo plano.",
  "settings.toggle": "Bloquear Kalks",
  "settings.toggleHint": "Usa {method}, con el código del teléfono como alternativa",
  "settings.on": "Bloqueo de la app activado",
  "settings.off": "Bloqueo de la app desactivado",
  "settings.after": "Volver a bloquear tras",
  "settings.afterHint": "Cuánto tiempo puede estar Kalks en segundo plano antes de volver a pedirlo. Al iniciarse, siempre lo pide.",
  "settings.timeout.0": "Inmediatamente",
  "settings.timeout.60": "1 minuto",
  "settings.timeout.300": "5 minutos",
  "settings.timeout.900": "15 minutos",
  "settings.timeout.3600": "1 hora",
  "settings.privacy": "Con el bloqueo de la app activado, el selector de apps muestra una portada en lugar de sus saldos.",
  "settings.lockNow": "Bloquear ahora",
  "settings.confirmOn": "Confirme para activar el bloqueo de la app",
  "settings.confirmOff": "Confirme para desactivar el bloqueo de la app",
  // Aviso del sistema cuando se elige un tiempo más largo en "Volver a bloquear tras"
  "settings.confirmTimeout": "Confirme para cambiar cuándo se bloquea Kalks",
  // Cuerpo del aviso tras entrar con contraseña en un teléfono sin bloqueo de pantalla (sin él no hay bloqueo de la app)
  "settings.turnedOffNoScreenLock": "Este teléfono no tiene bloqueo de pantalla, así que Kalks no puede confirmar que es usted. Configure uno en los ajustes del teléfono para volver a usar el bloqueo de la app.",
  "settings.notConfirmed": "No confirmado; no se ha cambiado nada",
  "settings.unavailableTitle": "Configure primero un bloqueo de pantalla",
  "settings.unavailableBody": "El bloqueo de la app usa el Face ID, la huella digital o el código de su teléfono. Active uno en los ajustes del teléfono y vuelva.",
  "settings.webTitle": "Disponible en la app",
  "settings.webBody": "El bloqueo de la app funciona en la app de Kalks para iPhone y Android.",
  "settings.thisPhone": "Solo se aplica a este teléfono",

  // Enlaces que abren la app (kalks://…, toques en notificaciones) pero no corresponden a ninguna pantalla
  "link.notFound.title": "Aquí no hay nada que abrir",
  "link.notFound.body": "Este enlace no corresponde a ninguna pantalla de la app. Puede ser antiguo o estar pensado para el Área de clientes web.",
  "link.notFound.home": "Ir a Inicio",
  "link.openFailed": "No se pudo abrir este enlace.",
};
export default mobilePlatform;
