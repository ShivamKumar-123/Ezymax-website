import type { NsMessages } from "../../core";

// App móvil de Kalks: pestaña Mercados (lista de seguimiento). Segmentos, Bid / Ask y búsqueda vienen de `market`.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "Precios en tiempo real",
  "empty.favourites.title": "Aún no hay favoritos",
  "empty.favourites.body": "Mantenga pulsado un símbolo para fijarlo aquí.",
  "empty.favourites.action": "Explorar forex",
  "fav.added": "{symbol} añadido a favoritos",
  "fav.removed": "{symbol} eliminado de favoritos",
  "a11y.row": "{symbol}, {name}. Abre el gráfico; mantenga pulsado para añadirlo a favoritos o quitarlo.",
  "a11y.search": "Buscar símbolos",
  cancel: "Cancelar",
  "status.connecting": "Conectando con los precios…",
  "status.offline": "Precios en pausa: sin conexión",
};
export default mobileMarkets;
