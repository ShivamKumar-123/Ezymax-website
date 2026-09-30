import type { NsMessages } from "../../core";

// App móvel da Kalks, Relatórios: Relatórios (/reports/statements) e Análises (/reports/analytics).
// A maioria dos rótulos vem das chaves portfolio.st.* / portfolio.an.* da Área do Cliente; aqui ficam só os do celular.
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "Relatórios",
  "eyebrow.analytics": "Relatórios · USD · horário do servidor",

  // Seletor de conta (um card que abre uma folha)
  "account.title": "Conta",
  "account.choose": "Escolha uma conta",
  "account.allHint": { one: "{count} conta real", other: "{count} contas reais" },
  "account.change": "Trocar de conta",

  // Relatórios
  "st.day": "Dia",
  "st.pickDay": "Escolha um dia",
  "st.pickFrom": "Data inicial",
  "st.pickTo": "Data final",
  "st.include": "Incluir",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "Preparando…",
  "st.ready": "Relatório pronto",
  "st.saved": "Salvo como {file}",
  "st.shareTitle": "Compartilhar relatório",
  "st.failed": "Não foi possível baixar o relatório",
  "st.offline": "Você está offline. Conecte-se para baixar relatórios.",
  "st.monthly.empty": "Ainda não há meses com relatório.",
  "st.monthly.offline": "Você está offline. Conecte-se para ver os relatórios mensais.",
  "st.monthly.a11y": "{month}: líquido {net}, {trades}. Abre os downloads.",
  "st.month.title": "Relatório de {month}",
  "st.month.formats": "Baixar como",
  "st.prevMonth": "Mês anterior",
  "st.nextMonth": "Próximo mês",

  // Análises: destaque e blocos de estatísticas
  "an.hero.label": "L/P líquido · {period}",
  "an.hero.return": "Retorno",
  "an.hero.trades": "Negociações",
  "an.hero.lots": "Lotes",
  "an.tile.sharpe": "Índice de Sharpe",
  "an.tile.expectancy": "Expectativa",
  "an.tile.sortino": "Sortino {value}",
  "an.tile.avgWinLoss": "Ganho / perda médios",
  "an.tile.rr": "Retorno : risco 1 : {value}",
  "an.tile.holdSplit": "Vencedoras {win} · perdedoras {loss}",
  "an.tile.streaks": "Sequências",
  "an.tile.streaksSub": "Ganhos / perdas seguidos",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "Nenhuma negociação ainda",

  // Análises: curvas
  "an.curve.hint": "Toque e segure o gráfico para ver cada dia",
  "an.curve.drawdown": "Drawdown",
  "an.curve.a11y": "Patrimônio {equity}, saldo {balance} em {date}. Drawdown máximo {drawdown}.",

  // Análises: calendário de L/P (resultado líquido das negociações fechadas por dia do servidor)
  "an.cal.title": "Calendário de L/P",
  "an.cal.subtitle": "Resultado líquido das negociações fechadas por dia do servidor",
  "an.cal.subtitleEstimated": "Variação diária do saldo, sem depósitos e saques",
  "an.cal.days": { one: "{count} dia de negociação", other: "{count} dias de negociação" },
  // Dias que fecharam com lucro / prejuízo
  "an.cal.green": "{count} no verde",
  "an.cal.red": "{count} no vermelho",
  "an.cal.noTrades": "Nenhuma negociação fechada",
  "an.cal.select": "Toque em um dia para ver o resultado",
  "an.cal.a11yDay": "{date}: {net}, {trades}",

  // Análises: detalhamentos
  "an.hour.byHour": "L/P líquido por hora",
  "an.hour.byDayHour": "Dia da semana × hora",
  "an.hour.tap": "Toque em uma barra ou célula para ver detalhes",
  "an.tapBar": "Toque em uma barra para ver detalhes",
  "an.session.best": "Melhor",
  "an.session.asia": "Ásia",
  "an.session.london": "Londres",
  "an.session.overlap": "Londres / Nova York",
  "an.session.newYork": "Nova York",
  "an.session.lateNewYork": "Fim de Nova York",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "Patrimônio atual",
  "an.charges.total": "Encargos pagos",

  // Insights de comportamento (os números vêm do serviço de relatórios)
  "insight.overtrading.title": { one: "Excesso de operações em {count} dia", other: "Excesso de operações em {count} dias" },
  "insight.overtrading.text": "Nesses dias, você fez mais de {limit} negociações (seu dia típico tem {median}). Resultado líquido nesses dias: {net}.",
  "insight.overtrading.tip": "Defina um limite diário de {cap} negociações.",
  "insight.revenge.title": { one: "{count} possível negociação por vingança", other: "{count} possíveis negociações por vingança" },
  "insight.revenge.text": "Negociações abertas até 15 minutos após um fechamento com prejuízo, com o mesmo tamanho ou maior. Deram lucro em {rate}% das vezes, com {net} no total.",
  "insight.revenge.tip": "Faça uma pausa de 15 minutos após uma perda antes da próxima negociação.",
  "insight.risk.title": "Risco por negociação perdedora",
  "insight.risk.text": {
    one: "Uma negociação perdedora custou em média {avg}% do seu saldo, no máximo {max}%. {count} perda passou de 2%.",
    other: "Uma negociação perdedora custou em média {avg}% do seu saldo, no máximo {max}%. {count} perdas passaram de 2%.",
  },
  "insight.risk.tip": "Dimensione as posições para que um stop loss custe no máximo 1–2% do saldo.",
  "insight.holdLosers.title": "As perdedoras ficam abertas mais tempo que as vencedoras",
  "insight.holdLosers.text": "As negociações perdedoras ficam abertas em média {loss}; as vencedoras, {win}.",
  "insight.holdLosers.tip": "Coloque um stop loss ao abrir a negociação e mantenha-o.",
  "insight.stopOut.title": { one: "{count} fechamento por stop out", other: "{count} fechamentos por stop out" },
  "insight.stopOut.text": "Posições foram fechadas pelo stop out de margem, e não pelo seu próprio stop loss.",
  "insight.stopOut.tip": "Com posições menores, mantenha o nível de margem acima do nível de margin call.",
  "insight.slTp.title": "Negociações fechadas por stop loss ou take profit",
  "insight.slTp.text": "{tp} por take profit, {sl} por stop loss; as demais foram fechadas manualmente ou pela mesa.",
  "insight.slTp.tip": "Saídas planejadas mantêm os resultados consistentes.",
  "insight.session.title": "Melhor sessão: {session}",
  "insight.session.text": "{trades} negociações com taxa de acerto de {rate}%. A mais fraca: {worst} ({net}).",
  "insight.session.tip": "Concentre-se na sessão de {session}.",
  "insight.tip": "Dica",

  // Estados
  "state.updating": "Atualizando…",
  "state.stale": "Mostrando dados salvos. Puxe para baixo para atualizar.",
  "state.notShared.title": "Não compartilhado com você",
  "state.footer": "Todos os valores em USD (contas cent convertidas). Horários no horário do servidor, GMT+2 / GMT+3.",
  "state.footerStatements": "Os relatórios ficam na moeda da conta (USC para contas cent). Horários no horário do servidor, GMT+2 / GMT+3.",
};
export default mobileReports;
