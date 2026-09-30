import type { NsMessages } from "../../core";

// App móvel da Kalks: aba Negociar (gráfico, barra Vender / Comprar, boleta) e notificações de negociação.
// Termos de negociação seguem a localização do MetaTrader 5 (veja as notas do namespace `order`).
// {placeholders} contêm números, preços, bilhetes e símbolos: manter, nunca traduzir.
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Cabeçalho
  pickSymbol: "Escolha um símbolo",
  searchSymbol: "Pesquisar símbolos",
  depth: "Profundidade do mercado",
  alert: "Alerta de preço",
  news: "Notícias de {symbol}", // rótulo de acessibilidade de um botão do cabeçalho
  calendar: "Calendário econômico de {currency}", // rótulo de acessibilidade de um botão do cabeçalho, ex.: "Calendário econômico de EUR"
  "account.chip": "{type} · #{login}",
  "account.manage": "Gerenciar contas",
  "account.open": "Abrir conta",

  // Gráfico
  "chart.indicators": "Indicadores",
  "chart.type.candles": "Candles",
  "chart.type.line": "Linha",
  "ind.ma": "Média móvel 20",
  "ind.ema": "Média exponencial 50",
  "ind.bb": "Bandas de Bollinger 20, 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "Ainda não há histórico de gráfico para este símbolo",
  "chart.hint": "Pince para ampliar · arraste para rolar · toque e segure para a cruz · toque duas vezes para redefinir",

  // Barra Vender / Comprar e boleta
  "bar.volume": "Lotes",
  "ticket.title": "Nova ordem",
  "ticket.confirmBuy": "Comprar {volume} {symbol}",
  "ticket.confirmSell": "Vender {volume} {symbol}",
  "ticket.atMarket": "a mercado",
  "ticket.at": "a {price}",
  "ticket.addSl": "Adicionar stop loss",
  "ticket.addTp": "Adicionar take profit",
  "ticket.ifHit": "{money} se atingido",
  "ticket.required": "Margem",
  "ticket.pip": "Valor do pip",
  "ticket.after": "Livre após",
  "ticket.notEnough": "Margem livre insuficiente para este volume.",
  "ticket.noSpecs": "Carregando detalhes do contrato…",
  "ticket.distance": "a {n} pips",
  "ticket.price": "Preço",

  // Rejeições: uma linha em linguagem simples abaixo do motivo (order.reject.<code>); o detalhe do servidor vem depois
  "reject.no_money": "Sua margem livre não cobre esta ordem. Reduza o volume ou adicione fundos a esta conta.",
  "reject.insufficient_funds": "Sua margem livre não cobre esta ordem. Reduza o volume ou adicione fundos a esta conta.",
  "reject.market_closed": "Este mercado está fechado agora. Tente novamente quando ele abrir.",
  "reject.invalid_volume": "Use um volume dentro dos limites e do passo de lote deste símbolo.",
  "reject.max_lot": "Este volume está acima do máximo por ordem da sua conta.",
  "reject.close_only": "No momento, sua conta pode fechar posições, mas não abrir novas.",
  "reject.symbol_close_only": "No momento, este símbolo permite fechar posições, mas não abrir novas.",
  "reject.trading_disabled": "A negociação está desativada nesta conta. Fale com o suporte para mais detalhes.",
  "reject.symbol_halted": "A negociação deste símbolo está pausada. Tente novamente mais tarde.",
  "reject.requote.title": "O preço mudou",
  "reject.requote": "O mercado se moveu enquanto sua ordem era enviada. Confira o novo preço e confirme novamente.",
  "reject.invalid_sl": "O stop loss está do lado errado do preço ou muito perto dele.",
  "reject.invalid_tp": "O take profit está do lado errado do preço ou muito perto dele.",
  "reject.invalid_price": "Este preço está do lado errado do mercado para este tipo de ordem.",
  "reject.off_market": "Este preço está longe demais do mercado. Confira o valor.",
  "reject.stale_price": "Os preços deste símbolo estão pausados por um momento. Tente novamente em instantes.",
  "reject.no_price": "Não há preço ao vivo para este símbolo no momento.",
  "reject.read_only": "Este login pode ver a conta, mas não negociar.",
  "reject.uncertain.title": "Sem resposta do servidor de negociação",
  "reject.uncertain": "A ordem pode ter sido processada. Confira o Portfólio antes de tentar novamente.",
  "reject.uncertain.ticket": "Confirmar novamente é seguro: a mesma ordem não pode ser enviada duas vezes.",

  // Estados
  "state.noAccount.title": "Nenhuma conta de negociação ainda",
  "state.noAccount.body": "Abra uma conta demo para praticar ou uma conta real para negociar de verdade.",
  "state.noAccount.action": "Abrir uma conta",
  "state.connecting": "Conectando ao servidor de negociação…",
  "state.readOnly": "Aqui esta conta é somente leitura: preços e gráficos ao vivo, negociação desativada.",
  "state.marketClosed.title": "Mercado fechado",
  "state.marketClosed.body": "{symbol} abre novamente na próxima sessão. As ordens podem ser enviadas assim que abrir.",
  "state.streamError": "Sem conexão com o servidor de negociação",
  "state.streamErrorBody": "Suas posições e ordens estão seguras no servidor. Continuamos tentando reconectar.",

  // Resultados ({side} é "Comprar" ou "Vender")
  "toast.filled": "Executada: {side} {volume} {symbol}",
  "toast.at": "a {price}",
  "toast.placed": "Ordem pendente de {symbol} colocada",
  "toast.duplicate": "Já colocada como #{ticket}",
  "toast.duplicateBody": "Esta ordem já tinha chegado ao servidor; nada novo foi aberto.",
  "toast.closed": "Posição #{ticket} fechada",
  "toast.partial": "{volume} lotes de #{ticket} fechados",
  "toast.modified": "#{ticket} atualizada",
  "toast.cancelled": "Ordem #{ticket} cancelada",

  // Notificações do servidor com o app aberto
  "notify.sl": "Stop loss atingido",
  "notify.tp": "Take profit atingido",
  "notify.order_filled": "Ordem pendente executada",
  "notify.order_triggered": "Ordem acionada",
  "notify.margin_call": "Margin call",
  "notify.stop_out": "Stop out",
  "notify.order_rejected": "Ordem rejeitada",
  "notify.order_expired": "Ordem expirada",
  "notify.order_cancelled": "Ordem cancelada",
};
export default mobileTrade;
