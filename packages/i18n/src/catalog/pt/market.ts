import type { NsMessages } from "../../core";

// Painéis esquerdos do Kalks Trader: Observação do Mercado, segmentos e Navegador.
const market: NsMessages<"market"> = {
  // Cabeçalho e abas da Observação do Mercado
  title: "Observação do Mercado",
  collapse: "Recolher",
  "tab.symbols": "Símbolos",
  "tab.details": "Detalhes",
  "tab.favourites": "Favoritos",
  segmentAria: "Segmento da Observação do Mercado",
  searchPlaceholder: "Pesquisar símbolo",
  searchAria: "Pesquisar na Observação do Mercado",
  clear: "Limpar",

  // Colunas (exibidas em maiúsculas)
  "col.symbol": "Símbolo",
  "col.bid": "Bid",
  "col.ask": "Ask",
  "col.spread": "Sp",
  "col.spreadTitle": "Spread, pontos",
  "col.change": "Var%",

  // Linha / cartão ao passar o mouse
  "row.title": "{name} · spread {spread}",
  "tip.low": "Mín",
  "tip.high": "Máx",
  "tip.spread": "Sprd",
  "tip.range": "Faixa",
  bid: "Bid",
  ask: "Ask",

  // Estados vazios e rodapé
  "empty.favourites": "Nenhum favorito ainda. Clique com o botão direito em um símbolo para adicioná-lo.",
  "empty.favouritesTitle": "Nenhum favorito ainda",
  "empty.noMatch": "Nenhum símbolo encontrado.",
  "footer.count": "{shown} / {total} símbolos",
  "footer.hint": "clique duplo: gráfico",

  // Menu de contexto
  "menu.newOrder": "Nova Ordem",
  "menu.chartWindow": "Janela de Gráfico",
  "menu.openInActive": "Abrir no gráfico ativo",
  "menu.depth": "Profundidade do Mercado",
  "menu.specification": "Especificação",
  "menu.removeFavourite": "Remover dos Favoritos",
  "menu.addFavourite": "Adicionar aos Favoritos",
  "menu.hide": "Ocultar",
  "menu.showAll": "Mostrar Tudo",

  // Notificações rápidas
  "toast.hidden": "{symbol} oculto na Observação do Mercado",
  "toast.hiddenDesc": "Mostre todos os símbolos pelo menu de contexto.",
  "toast.opened": "{symbol} aberto no gráfico ativo",

  // Segmentos (classes de ativos)
  "segment.favourites": "Favoritos",
  "segment.forex": "Forex",
  "segment.metals": "Metais",
  "segment.indices": "Índices",
  "segment.energies": "Energia",
  "segment.crypto": "Cripto",
  "segment.stocks": "Ações",
  "segment.aria": "Classe de ativo",
  "segment.title": { one: "{label} · {count} símbolo", other: "{label} · {count} símbolos" },

  // Árvore do Navegador
  "nav.title": "Navegador",
  "nav.indicators": "Indicadores",
  "nav.strategies": "Estratégias",
  "nav.scripts": "Scripts",
  "nav.guest": "visitante",
  "nav.noAccount": "Nenhuma conta de negociação ainda",
  "nav.openAccount": "Abrir conta",
  "nav.openAccountTitle": "Crie sua conta Kalks (abre a Área do Cliente)",
  "nav.signIn": "Entrar",
  "nav.signInTitle": "Entrar na Área do Cliente",
  "nav.accountType.live": "real",
  "nav.accountType.demo": "demo",
  "nav.category.trend": "Tendência",
  "nav.category.oscillators": "Osciladores",
  "nav.category.volatility": "Volatilidade",
  "nav.category.volume": "Volume",
  "nav.category.billWilliams": "Bill Williams",
  "nav.indicatorTitle": "{description} · Clique duplo ou Enter para anexar a {symbol}, {tf}",
  "nav.strategyTitle": { one: "{server} · {login} · {count} negociação", other: "{server} · {login} · {count} negociações" },
  "nav.strategyRunning": "{name} já está em execução",
  "nav.strategyAttached": "{name} anexada",
  "nav.strategyDesc": "{login} · {server} · L/P hoje {pnl}",
  "nav.script.closeAll": "Fechar todas as posições",
  "nav.script.closeProfitable": "Fechar lucrativas",
  "nav.script.closeLosing": "Fechar perdedoras",
  "nav.script.deletePendings": "Excluir todas as pendentes",
  "nav.script.breakevenAll": "Breakeven em todas (SL → entrada)",
  "nav.scriptTitle": "Clique duplo para executar na conta atual",
  "nav.scriptsReadOnly": "Scripts estão desativados no modo somente leitura",
};
export default market;
