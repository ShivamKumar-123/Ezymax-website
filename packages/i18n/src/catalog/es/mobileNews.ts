import type { NsMessages } from "../../core";

// App móvil de Kalks: noticias del mercado (/news, /news/[id]) y calendario económico (/calendar).
// Los textos compartidos ya traducidos en `news` (tono, impacto, columnas del calendario, resumen, alertas) se
// reutilizan desde allí; aquí solo va lo que añade la app.
const mobileNews: NsMessages<"mobileNews"> = {
  // Noticias
  eyebrow: "Actualidad del mercado",
  // título grande en mayúsculas: una palabra corta
  title: "Noticias",
  latest: "Lo último",
  filters: "Filtros",
  // n = número de filtros activos
  filtersOn: "Filtros · {n}",
  "importance.all": "Todas",
  "importance.important": "Importantes",
  "importance.top": "Destacadas",
  "importance.label": "Importancia",
  // Chips de una noticia (nivel de importancia)
  "chip.top": "Destacada",
  "chip.important": "Importante",
  "filter.tone": "Tono",
  "filter.anyTone": "Cualquier tono",
  "filter.currency": "Divisa",
  "filter.anyCurrency": "Cualquier divisa",
  "filter.symbol": "Instrumento",
  "filter.anySymbol": "Cualquier instrumento",
  "filter.mentioned": "En los titulares de hoy",
  "filter.clear": "Borrar filtros",
  "filter.remove": "Quitar el filtro {label}",
  "list.loadingMore": "Cargando noticias anteriores…",
  "list.end": "Está al día",
  "list.endBody": "Estas son todas las noticias de los últimos días con estos filtros.",
  "empty.title": "Aún no hay noticias",
  "empty.filteredTitle": "Nada coincide",
  updated: "Actualizado a las {time}",

  // Tarjeta del resumen diario
  "brief.label": "Resumen diario",
  "brief.readMore": "Leer el resumen completo",
  "brief.watch": "A vigilar hoy",
  "brief.calendarNote": "En el calendario",
  "brief.writtenAt": "Redactado el {time}",

  // Pantalla de la noticia
  "story.readAt": "Leer en {source}",
  "story.noTeaser": "El medio solo comparte el titular. La noticia completa está en su web.",
  "story.currencies": "Divisas",
  "story.calendarFor": "Calendario de {currency}",
  "story.relatedSymbol": "Más sobre {symbol}",
  "story.relatedCurrency": "Más sobre {currency}",
  "story.share": "Compartir",
  "story.notFound.title": "Noticia no encontrada",
  "story.notFound.body": "Puede que se haya eliminado. Los últimos titulares están en el feed de noticias.",
  "story.backToNews": "Volver a noticias",
  "story.openChart": "Abrir el gráfico de {symbol}",
  "story.published": "Publicada el {time}",

  // Calendario económico
  "cal.eyebrow": "Calendario económico",
  // título grande en mayúsculas: una palabra corta
  "cal.title": "Calendario",
  "cal.summary.events": "Eventos",
  "cal.prevWeekShort": "Anterior",
  "cal.nextWeekShort": "Siguiente",
  "cal.startsNow": "Empieza ahora",
  "cal.startsIn": "Empieza en",
  "cal.zone.local": "Su hora · {tz}",
  "cal.zone.server": "Hora del servidor · {tz}",
  "cal.zoneNote.local": "Las horas están en su zona horaria ({local}). La hora del servidor, el reloj de su cuenta de trading, es {server}.",
  "cal.zoneNote.server": "Las horas están en hora del servidor ({server}), el reloj de su cuenta de trading. Su zona horaria es {local}.",
  "cal.zone.title": "Mostrar las horas en",
  "cal.zone.myTime": "Mi hora ({tz})",
  "cal.zone.serverTime": "Hora del servidor ({tz})",
  "cal.filters.currencies": "Divisas",
  "cal.filters.allCurrencies": "Todas las divisas",
  "cal.filters.reset": "Restablecer",
  "cal.empty.title": "Semana tranquila",
  "cal.empty.body": "Aún no hay publicaciones programadas para esta semana.",
  "cal.empty.filteredTitle": "Nada coincide",
  "cal.impact.high": "Impacto alto",
  "cal.impact.medium": "Impacto medio",
  "cal.impact.low": "Impacto bajo",
  "cal.row.a11y": "{time}, {currency}, {title}, {impact}",
  "cal.remind": "Recordarme",
  "cal.reminderOn": "Recordatorio activado",
  "cal.remindBefore": "Recordarme antes",
  "cal.reminderSetDesc": "Le avisaremos {minutes} minutos antes de {currency} {title}.",
  "cal.reminderChanged": "Recordatorio movido a {minutes} minutos antes",
  "cal.viewOnlyRemind": "Los accesos de solo lectura no pueden crear recordatorios.",
  "cal.newsFor": "Noticias de {currency}",
  "cal.eventTime.local": "{day} · {local} su hora · {server} hora del servidor ({tz})",
  "cal.eventTime.server": "{day} · {server} hora del servidor ({tz}) · {local} su hora",
  "cal.eventTime.allDay": "{day} · todo el día",
  "cal.alertsAria": "Alertas de alto impacto",
  "cal.filtersAria": "Filtros del calendario",
  "cal.dayAria": "{day}, eventos: {count}",
};
export default mobileNews;
