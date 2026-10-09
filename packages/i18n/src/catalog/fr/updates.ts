import type { NsMessages } from "../../core";

// Brand promotions in the Client Area and the app: the dashboard's hero carousel, Events & updates and the updates pages.
const updates: NsMessages<"updates"> = {
  title: "Événements et actualités",
  subtitle: "Événements, annonces et nouvelles de l'équipe",
  all: "Toutes les actualités",
  "filter.events": "Événements",
  "filter.posts": "Annonces",
  "kind.event": "Événement",
  "kind.post": "Annonce",
  "state.upcoming": "À venir",
  "state.live": "En cours",
  "state.ended": "Terminé",
  when: "Quand",
  where: "Où",
  online: "En ligne",
  join: "Rejoindre en ligne",
  readMore: "Lire la suite",
  published: "Publié le {date}",
  "empty.title": "Aucune actualité pour le moment",
  "empty.text": "Les nouveaux événements et annonces apparaîtront ici.",
  "notFound.title": "Cette actualité n'est pas disponible",
  "notFound.text": "Elle est peut-être terminée ou a été retirée.",
  "hero.label": "À la une",
  "hero.slide": "Diapositive {n} sur {total}",
  "hero.previous": "Diapositive précédente",
  "hero.next": "Diapositive suivante",
  "hero.pause": "Mettre le diaporama en pause",
  "hero.play": "Lancer le diaporama",
  "hero.dismiss": "Masquer cette bannière",
};
export default updates;
