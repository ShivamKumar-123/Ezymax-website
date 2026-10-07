import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // Cabeçalho da página (início da Área do Cliente). {name} = primeiro nome do cliente
  "greeting.morning": "Bom dia, {name}",
  "greeting.afternoon": "Boa tarde, {name}",
  "greeting.evening": "Boa noite, {name}",
  "greeting.welcome": "Bem-vindo, {name}",
  "subtitle.live": "Bem-vindo à Kalks. Veja sua conta e os mercados de hoje.",
  "subtitle.demo": "Veja o desempenho das suas contas hoje.",
  launchTrader: "Abrir o Kalks Trader",
  openTerminal: "Abrir terminal de negociação",

  // Primeiros passos
  "steps.title": "Primeiros passos",
  "steps.subtitle": "Seu progresso rumo à negociação real",
  "steps.progress": "{done} de {total}",
  "steps.account.title": "Crie sua conta",
  "steps.account.text": "Cadastrado em {date}.",
  "steps.email.title": "Verifique seu e-mail",
  "steps.email.verified": "{email} está verificado.",
  "steps.email.confirm": "Confirme {email} com o código que enviamos.",
  "steps.kyc.title": "Verifique sua identidade",
  "steps.kyc.verified": "Sua identidade está verificada. Os saques estão liberados.",
  "steps.kyc.moreInfo": "Nossa equipe precisa de mais um documento seu.",
  "steps.kyc.review": "Seus documentos estão com nossa equipe de verificação.",
  "steps.kyc.draft": "Continue de onde parou. Leva cerca de 3 minutos.",
  "steps.kyc.rejected": "Não foi possível verificar seus documentos. Você pode começar de novo.",
  "steps.kyc.todo": "Leva cerca de 3 minutos. Libera os saques.",
  "steps.accountOpen.title": "Abra uma conta de negociação",
  // {count} = total de contas reais + demo
  "steps.accountOpen.opened": { one: "Conta aberta: {live} real e {demo} demo.", other: "Contas abertas: {live} reais e {demo} demo." },
  "steps.accountOpen.todo": "Abra uma conta real ou demo; seu login é emitido na hora.",
  "steps.wallet.title": "Deposite na sua carteira",
  "steps.wallet.text": "Os depósitos em USDT via TRC20 estão sendo integrados.",
  // Status das etapas
  "steps.state.done": "Concluído",
  "steps.state.todo": "A fazer",
  "steps.state.review": "Em análise",
  "steps.state.rejected": "Rejeitado",
  "steps.state.soon": "Não iniciado",

  // Cartão de contas de negociação. <b> envolve o valor do patrimônio
  "accounts.title": "Contas de negociação",
  "accounts.summary": "Patrimônio real <b>{equity}</b> · {live} reais · {demo} demo · {positions} posições abertas",
  "accounts.subtitle": "Suas contas reais e demo",
  "accounts.all": "Todas as contas",
  "accounts.open": "Abrir conta",
  "accounts.unavailable": "As contas de negociação estão indisponíveis no momento. Seus saldos estão seguros.",
  "accounts.openLive.title": "Abrir uma conta real",
  "accounts.openLive.text": "Mercados reais. Começa com saldo zero; deposite pela sua carteira.",
  "accounts.openDemo.title": "Abrir uma conta demo",
  "accounts.openDemo.text": "Fundos virtuais com preços em tempo real, recarregáveis todos os dias.",
  "accounts.more": { one: "Mais {count} conta", other: "Mais {count} contas" },
  "accounts.myTitle": "Minhas contas de negociação",

  // Cartão da sua conta
  "account.title": "Sua conta",
  "account.clientId": "ID do cliente",
  "account.emailStatus": "Status do e-mail",
  "account.notVerified": "Não verificado",
  "account.identity": "Identidade",
  "account.memberSince": "Membro desde",
  "account.profile": "Perfil",

  // Banner do Kalks Trader
  "trader.chip": "Preços em tempo real",
  "trader.text": "Cotações e gráficos em tempo real para {count} instrumentos de forex, metais, índices, energia, cripto e ações. Funciona no navegador, sem instalar nada.",

  // Relógio do mercado / mapa de calor
  "sessions.title": "Relógio do mercado",
  "sessions.open": "{open} de {total} mercados abertos",
  "heatmap.title": "Mapa de calor do mercado",
  "heatmap.subtitle": "Variação de hoje com preços em tempo real · ponto vazado: mercado fechado",
  "heatmap.up": "{count} em alta",
  "heatmap.down": "{count} em baixa",
  "heatmap.allMarkets": "Todos os mercados",
  "heatmap.tipOpen": "{symbol} · mercado aberto",
  "heatmap.tipClosed": "{symbol} · mercado fechado, variação da última sessão",

  // Cartão de suporte. <mail> envolve o e-mail do suporte
  "support.title": "Precisa de ajuda?",
  "support.text": "Escreva para <mail>{email}</mail> a partir do seu e-mail cadastrado e informe seu ID de cliente.",
  "support.emailSupport": "Enviar e-mail ao suporte",
  "support.copied": "Endereço de e-mail copiado",
  "support.copyFailed": "Não foi possível copiar; selecione o endereço manualmente",

  // Painel demo: faixa de integração
  "onboarding.title": "Conclua a configuração da sua conta",
  "onboarding.text": "Conclua o KYC para liberar saques e limites maiores.",
  "onboarding.progress": "Progresso",
  "onboarding.dismiss": "Dispensar",

  // Saúde da margem
  "margin.title": "Saúde da margem",
  "margin.subtitle": "Em todas as contas reais",
  "margin.healthy": "Saudável",
  "margin.level": "Nível de margem",
  "margin.used": "Margem utilizada",
  "margin.free": "Margem livre",

  // Patrimônio / L&P. {range} = 1W, 1M, 3M, YTD, 1Y, ALL (manter como está)
  "equity.title": "Patrimônio total",
  "equity.changeOver": "Variação em {range}",
  "pnl.title": "Lucro / prejuízo · mês",
  "pnl.lowRisk": "Risco baixo",
  "pnl.winRate": "Taxa de acerto (30d)",
  "pnl.trades": "Negociações (30d)",
  "pnl.avgWin": "Média das negociações vencedoras",
  "pnl.avgLoss": "Média das negociações perdedoras",
  "pnl.charges": "Tarifas pagas",

  // Cartões de KPI
  "kpi.wallet": "Carteira",
  "kpi.today": "+{pct}% hoje",
  "kpi.monthPnl": "L/P do mês",
  "kpi.vsLastMonth": "+{pct}% vs. mês passado",
  "kpi.partnerEarnings": "Ganhos de parceiro",
  // Copy = ganhos com copy trading
  "kpi.copy": "Copy {amount}",

  // Maiores variações
  "movers.title": "Maiores variações",
  "movers.gainers": "Altas",
  "movers.losers": "Baixas",

  // Calendário econômico. A = Atual, F = Previsão, P = Anterior (abreviações mantidas)
  "calendar.title": "Calendário econômico",
  "calendar.subtitle": "Hoje · horário do servidor GMT+3",
  "calendar.actual": "A {value} · ",
  "calendar.forecastPrevious": "F {forecast} · P {previous}",

  // Notícias / mundo
  "news.title": "Notícias do mercado",
  "news.all": "Todas as notícias",
  "news.pinned": "Fixada",
  "world.title": "Mercados e notícias pelo mundo",
  "world.subtitle": "Manchetes em tempo real por país e sentimento das moedas",
  "world.stories": { one: "{count} notícia hoje", other: "{count} notícias hoje" },

  // Posições abertas
  "positions.title": "Posições abertas",
  "positions.summary": { one: "{count} posição · flutuante", other: "{count} posições · flutuante" },
  "positions.terminal": "Terminal",

  // Banner de parceiro. <link> envolve o link de indicação
  "partner.chip": "Programa de parceiros",
  "partner.title": "Indique traders. Ganhe até $15 por lote — para sempre.",
  "partner.text": "Comissões multinível, bônus CPA e acompanhamento em tempo real. Seu link: <link>{url}</link>",
  "partner.open": "Abrir painel de parceiro",

  // Tempos relativos curtos (min = minutos, h = horas, d = dias)
  "time.justNow": "Agora mesmo",
  "time.minutesAgo": "há {count} min",
  "time.hoursAgo": "há {count} h",
  "time.daysAgo": "há {count} d",
  // {time} = valor como "5m"
  "time.ago": "há {time}",

  // Sino / painel de notificações
  "notifications.title": "Notificações",
  "notifications.ariaUnread": "Notificações, {count} não lidas",
  "notifications.markAll": "Marcar todas como lidas",
  "notifications.clear": "Limpar",
  "notifications.emptyTitle": "Nenhuma notificação ainda",
  "notifications.emptyText": "Depósitos, saques, verificação, alertas de negociação e respostas do suporte aparecem aqui.",
  "notifications.settings": "Configurações de notificação",

  // Client Area redesign: side menu, dashboard overview
  "chrome.expand": "Expandir menu",
  "chrome.collapse": "Recolher menu",
  "chrome.menu": "Menu",
  "home.todayPnl": "P&L de hoje",
  "home.walletBalance": "Saldo da carteira",
  "home.rewardsEarnings": "Recompensas e ganhos IB",
  "home.todayPct": "{pct}% hoje",
  "home.floating": "P&L flutuante",
  "home.rewards": "Recompensas",
  "home.accountsChip": "{live} reais · {positions} posições abertas",
  "home.statistics": "Estatísticas",
  "home.pnl": "P&L",
  "home.weekly": "Semanal",
  "home.monthly": "Mensal",
  "home.lastYear": "Último ano",
  "home.noHistory": "O histórico do seu patrimônio aparece aqui quando suas contas reais tiverem atividade.",
  "home.thisPeriod": "Este período",
  "home.previousPeriod": "Período anterior",
  "home.yourAccounts": "Suas contas",
  "home.tradingAccount": "Conta de trading",
  "home.accountInfo": "Informações da conta",
  "home.accountName": "Nome da conta",
  "home.leverage": "Alavancagem",
  "home.previous": "Conta anterior",
  "home.next": "Próxima conta",
  "home.showBalances": "Mostrar saldos",
  "home.hideBalances": "Ocultar saldos",
  "home.trade": "Negociar",
  "home.history": "Histórico",
  "home.funding": "Financiamento",
  "home.linked": "Vinculados",
  "home.connected": "Conectado",
  "home.subscriptions": { one: "{count} assinatura ativa", other: "{count} assinaturas ativas" },
  "home.points": "{points} pontos",
  "home.redeem": "Resgatar",
  "home.networkUnavailable": "Pausado",
  "home.totalBalance": "Saldo total",
  "home.totalBalanceSub": "Contas reais e carteira",
  "home.transferFunds": "Transferir fundos",
  "home.quickActions": "Ações rápidas",
  "home.later": "Depois",
  "home.viewDetails": "Ver detalhes",
  "home.verifyNow": "Verificar agora",
  "home.fundTitle": "Abasteça sua carteira",
  "home.fundText": "Deposite USDT para começar a negociar numa conta real.",
  "home.depositNow": "Depositar agora",
  "home.tradingTitle": "Trading",
  "home.marketsTitle": "Mercados",
  "home.moreTitle": "Mais para você",
};
export default dashboard;
