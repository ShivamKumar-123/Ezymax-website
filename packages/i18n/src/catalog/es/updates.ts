import type { NsMessages } from "../../core";

// Brand promotions in the Client Area and the app: the dashboard's hero carousel, Events & updates and the updates pages.
const updates: NsMessages<"updates"> = {
  title: "Eventos y novedades",
  subtitle: "Eventos, anuncios y noticias del equipo",
  all: "Todas las novedades",
  "filter.events": "Eventos",
  "filter.posts": "Anuncios",
  "kind.event": "Evento",
  "kind.post": "Anuncio",
  "state.upcoming": "Próximo",
  "state.live": "En curso",
  "state.ended": "Finalizado",
  when: "Cuándo",
  where: "Dónde",
  online: "En línea",
  join: "Unirse en línea",
  readMore: "Leer más",
  published: "Publicado el {date}",
  "empty.title": "No hay novedades por ahora",
  "empty.text": "Los nuevos eventos y anuncios aparecerán aquí.",
  "notFound.title": "Esta novedad no está disponible",
  "notFound.text": "Puede que haya terminado o se haya retirado.",
  "hero.label": "Destacado",
  "hero.slide": "Diapositiva {n} de {total}",
  "hero.previous": "Diapositiva anterior",
  "hero.next": "Diapositiva siguiente",
  "hero.pause": "Pausar presentación",
  "hero.play": "Reproducir presentación",
  "hero.dismiss": "Ocultar este banner",
};
export default updates;
