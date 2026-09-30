import type { NsMessages } from "../../core";

// App móvil de Kalks: pestaña Inicio. Los encabezados van en mayúsculas grandes: cortos.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "Buenos días, {name}",
  "greet.afternoon": "Buenas tardes, {name}",
  "greet.evening": "Buenas noches, {name}",
  equity: "Patrimonio",
  closedToday: "Cerrado hoy",
  openPnl: "P&L abierto",
  allLive: "Todas las cuentas reales {amount}",
  "quick.deposit": "Depositar",
  "quick.withdraw": "Retirar",
  "quick.transfer": "Transferir",
  "quick.trade": "Operar",
  movers: "Mayores variaciones",
  news: "Titulares",
  allNews: "Todas las noticias",
  notifications: "Notificaciones",
  "kyc.title": "Verifique su identidad",
  "kyc.body": "La verificación desbloquea el trading real y los retiros. Tarda unos minutos.",
  "kyc.pending": "Verificación en revisión",
  "kyc.pendingBody": "Estamos revisando sus documentos. Recibirá una notificación cuando terminemos.",
  "kyc.action": "Continuar",
  "noAccount.title": "Abra su primera cuenta",
  "noAccount.body": "Una cuenta demo con fondos virtuales está lista en segundos. Pase a real cuando esté listo.",
  "noAccount.action": "Abrir una cuenta",
  "news.empty": "No hay titulares en este momento.",
  "a11y.bell": "Notificaciones, {count} sin leer",
};
export default mobileHome;
