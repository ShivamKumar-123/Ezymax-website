import type { NsMessages } from "../../core";

// Área de clientes, soporte: chat en vivo, botón flotante, página de soporte. Se mantienen "Ezymex" y "Ezymex AI".
const support: NsMessages<"support"> = {
  // Página de soporte
  "page.title": "Soporte",
  "page.subtitle": "Chatee con Ezymex AI para obtener respuestas al instante. Pida hablar con una persona en cualquier momento y nuestro equipo continuará con la conversación completa.",
  "email.prefer": "¿Prefiere el correo electrónico?",
  // <email> e <id> envuelven el correo electrónico y el ID de cliente
  "email.writeFrom": "Escriba desde <email>{email}</email> e incluya su ID de cliente <id>{id}</id>.",
  "email.write": "Escribir a soporte",
  "email.copyId": "Copiar ID de cliente",
  clientId: "ID de cliente",
  notice: "Las respuestas de nuestro equipo también aparecen en la campana de notificaciones, y le enviamos un correo cuando no está conectado. Puede cambiarlo en Perfil → Notificaciones.",
  "toast.copied": "{what} copiado",
  "toast.copyFailed": "No se pudo copiar, selecciónelo manualmente",

  // Estado de la conversación
  "status.bot": "Asistente de IA",
  "status.waiting": "En cola",
  "status.assigned": "Con un agente",
  "status.resolved": "Finalizada",

  // Historial de conversaciones
  "history.title": "Sus conversaciones",
  "history.subtitle": "Las transcripciones se guardan en su Área de clientes",
  "history.emptyTitle": "Aún no hay conversaciones",
  "history.emptyText": "Haga una pregunta en el chat y aparecerá aquí.",
  conversation: "Conversación",
  "toast.openFailed": "No se pudo abrir la conversación",

  // Botón flotante
  "launcher.open": "Abrir chat de soporte",
  "launcher.close": "Cerrar chat de soporte",

  // Chat
  you: "Usted",
  agent: "Agente",
  // Nombre por defecto para un miembro del equipo sin nombre
  supportName: "Soporte",
  // Tamaño del archivo, p. ej. "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // Primeras preguntas sugeridas (se envían como mensaje del cliente)
  "quick.verify": "¿Cómo verifico mi identidad?",
  "quick.deposit": "¿Cómo deposito USDT?",
  "quick.withdrawal": "¿Cuándo llegará mi retiro?",
  "quick.stopOut": "¿Qué es un stop out?",
  "header.supportTeam": "Equipo de soporte",
  "header.agentSub": "Atención al cliente · Ezymex",
  "header.connecting": "Conectándole con un agente…",
  "header.replySoon": "Nuestro equipo le responderá aquí en breve",
  "header.helpCentre": "Respuestas del centro de ayuda · una persona puede unirse en cualquier momento",
  "header.instant": "Respuestas al instante · una persona puede unirse en cualquier momento",
  "chip.liveAgent": "Agente en vivo",
  "menu.aria": "Opciones del chat",
  "menu.talkToPerson": "Hablar con una persona",
  "menu.endChat": "Finalizar chat",
  "menu.newChat": "Iniciar nuevo chat",
  closeChat: "Cerrar chat",
  unavailable: "El chat no está disponible en este momento.",
  greeting: "Hola, {name}.",
  "csat.question": "¿Qué le pareció este chat?",
  "csat.stars": { one: "{count} estrella", many: "{count} estrellas", other: "{count} estrellas" },
  "csat.placeholder": "¿Algo que añadir? (opcional)",
  "csat.send": "Enviar valoración",
  "csat.rated": "Ha valorado este chat con {rating}/5",
  "composer.attach": "Adjuntar archivo",
  "composer.messageTo": "Mensaje para {name}…",
  "composer.newChat": "Iniciar un nuevo chat…",
  "composer.ask": "Pregunte a {name} lo que quiera…",
  "composer.aria": "Mensaje",
  disclaimer: "{name} puede cometer errores y nunca ofrece asesoramiento de inversión. Los chats se graban con fines de calidad.",
  "toast.chattingWith": "Está chateando con {name}",
  "toast.inQueue": "Está en la cola para hablar con un agente",
  "toast.notSent": "Mensaje no enviado",
  "toast.teamUnreachable": "No se pudo contactar con el equipo",
  "toast.endFailed": "No se pudo finalizar el chat",
  "toast.rateFailed": "Valoración no guardada",
  "toast.thanks": "Gracias por sus comentarios",
  "toast.fileTooLarge": "Archivo demasiado grande",
  "toast.fileTooLargeText": "Los archivos pueden tener hasta {mb} MB.",
  "toast.unsupported": "Archivo no admitido",
  "toast.unsupportedText": "Adjunte una imagen (PNG, JPG, GIF, WEBP) o un PDF.",
  "toast.uploadFailed": "Error al subir el archivo",
  "error.uploadFailed": "Error al subir el archivo.",
};
export default support;
