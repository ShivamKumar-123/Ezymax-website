import type { NsMessages } from "../../core";

// App mobile Kalks: scheda Mercati (watchlist). Segmenti, Bid / Ask e ricerca riusano `market`.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "Prezzi in tempo reale",
  "empty.favourites.title": "Ancora nessun preferito",
  "empty.favourites.body": "Tieni premuto un simbolo per fissarlo qui.",
  "empty.favourites.action": "Sfoglia il forex",
  "fav.added": "{symbol} aggiunto ai preferiti",
  "fav.removed": "{symbol} rimosso dai preferiti",
  "a11y.row": "{symbol}, {name}. Apre il grafico; tieni premuto per aggiungere o rimuovere un preferito.",
  "a11y.search": "Cerca simboli",
  cancel: "Annulla",
  "status.connecting": "Connessione ai prezzi…",
  "status.offline": "Prezzi in pausa: nessuna connessione",
};
export default mobileMarkets;
