import type { NsMessages } from "../../core";

// App móvel da Kalks: aba Mercados (lista de cotações). Segmentos, Bid / Ask e pesquisa vêm do namespace `market`.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "Preços ao vivo",
  "empty.favourites.title": "Nenhum favorito ainda",
  "empty.favourites.body": "Toque e segure qualquer símbolo para fixá-lo aqui.",
  "empty.favourites.action": "Explorar forex",
  "fav.added": "{symbol} adicionado aos favoritos",
  "fav.removed": "{symbol} removido dos favoritos",
  "a11y.row": "{symbol}, {name}. Abre o gráfico; toque e segure para adicionar ou remover dos favoritos.",
  "a11y.search": "Pesquisar símbolos",
  cancel: "Cancelar",
  "status.connecting": "Conectando aos preços…",
  "status.offline": "Preços pausados: sem conexão",
};
export default mobileMarkets;
