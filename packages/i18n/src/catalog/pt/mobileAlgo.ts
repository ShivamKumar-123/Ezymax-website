import type { NsMessages } from "../../core";

// App móvel da Kalks: Algo (/algo): estratégias rodando 24/7 no servidor (implantações), o kill switch, relatórios de
// backtest, o marketplace de estratégias, chaves de API e webhooks.
// Mantidos como estão: Kalks, Algo, API, USDT, USD, nomes de indicadores (EMA, RSI, MACD, ATR, CCI, ADX, DI…), símbolos
// (EURUSD, XAUUSD), timeframes (M15, H1, H4), "R" (múltiplo da distância do stop), pips, pontos, DD, SL / TP, kill switch.
// Títulos marcados como (exibição) aparecem em maiúsculas altas: manter curtos.
// "Implantação" = uma versão de estratégia rodando em uma conta de negociação. "Kill switch" = parada de emergência.
const mobileAlgo: NsMessages<"mobileAlgo"> = {
  never: "nunca",
  // {n} dias, compacto
  days: "{n} d",
  lot: "lote",
  // Tempo de permanência de uma negociação: m = minutos, h = horas, d = dias (compacto)
  "dur.m": "{m}m",
  "dur.h": "{h}h",
  "dur.hm": "{h}h {m}m",
  "dur.d": "{d}d",
  "dur.dh": "{d}d {h}h",
  nTrades: { one: "{count} negociação", other: "{count} negociações" },
  readOnly: "Este login pode ver as estratégias, mas não pode alterar nada.",

  /* ---------------------------------------------------------------- */
  /* Estados da tela                                                   */
  /* ---------------------------------------------------------------- */
  // (exibição)
  "state.unavailable.title": "Algo indisponível",
  "state.unavailable.text": "Não foi possível acessar o serviço de estratégias. Suas estratégias continuam rodando no servidor; tente novamente em instantes.",
  // (exibição)
  "state.disabled.title": "Indisponível",
  "state.disabled.text": "Este recurso não está disponível na sua conta.",
  // (exibição)
  "state.notFound.title": "Não encontrado",
  "state.notFound.text": "Pode ter sido removido, ou o link está incorreto.",
  "state.back": "Voltar ao Algo",

  /* ---------------------------------------------------------------- */
  /* Erros do servidor (códigos do serviço de estratégias)            */
  /* ---------------------------------------------------------------- */
  "error.haltedMine": "Seu kill switch está ativado. Desative-o na tela do Algo antes de iniciar estratégias novamente.",
  "error.haltedPlatform": "A negociação automatizada está pausada pela corretora no momento. Tente novamente mais tarde.",
  // {n} = máximo de estratégias que podem rodar ao mesmo tempo
  "error.limitRunning": "Você pode executar até {n} estratégias ao mesmo tempo. Pare uma primeiro.",
  "error.accountStatus": "Esta conta não pode negociar no momento.",
  "error.alreadyRunning": "Esta versão já está em execução nessa conta.",
  "error.invalidStrategy": "Corrija os erros da estratégia primeiro (na Área do Cliente ou com o AI Trader).",
  "error.state": "O estado já mudou. Puxe para baixo para ver o estado atual.",
  "error.queueFull": "Você já tem 3 backtests na fila ou em execução. Aguarde um terminar.",
  "error.dailyLimit": "Você atingiu o limite de hoje de {n} backtests.",
  "error.ownListing": "Você não pode assinar sua própria estratégia.",
  "error.subscribed": "Você já assina esta estratégia.",
  "error.cloneNotAllowed": "O autor não permite clonar; copie a estratégia para sua conta.",
  // {amount} em USDT
  "error.insufficientFunds": "O saldo da sua carteira está abaixo de {amount} USDT. Deposite USDT para assinar.",
  "error.insufficientFundsPlain": "O saldo da sua carteira é insuficiente. Deposite USDT para assinar.",
  "error.inactive": "Esta assinatura não está mais ativa.",
  "error.archiveRunning": "Pare as implantações desta estratégia antes de arquivá-la.",
  "error.archived": "Esta estratégia está arquivada.",
  "error.finished": "Este backtest já terminou.",
  "error.revoked": "Esta chave já foi revogada.",
  "error.notFound": "Isto não existe mais.",
  // {tf} = timeframe (H1), {days} = número de dias
  "error.rangeTooLong": "Backtests em {tf} podem cobrir no máximo {days} dias. Escolha um período menor.",
  "error.balanceRange": "O saldo inicial deve ficar entre 100 e 10,000,000.",
  "error.dates": "A data inicial deve ser anterior à data final.",

  /* ---------------------------------------------------------------- */
  /* Início                                                            */
  /* ---------------------------------------------------------------- */
  "home.eyebrow": "Negociação automatizada",
  // (exibição)
  "home.title": "Algo",
  "home.heroEyebrow": "Em execução agora",
  "home.heroRunning": {
    zero: "estratégias negociando 24/7 no servidor",
    one: "estratégia negociando 24/7 no servidor",
    other: "estratégias negociando 24/7 no servidor",
  },
  "home.heroRealized": "L/P realizado",
  "home.heroOpen": "Abertas agora",
  // Negociações fechadas até agora
  "home.heroTrades": "Negociações",
  "home.qaAi": "Criar com IA",
  "home.qaAiHint": "Descreva uma ideia, receba regras exatas",
  "home.qaMarket": "Marketplace",
  "home.qaMarketHint": "Copie estratégias verificadas",
  "home.qaKeys": "Chaves de API e webhooks",
  "home.qaKeysHint": "Uso, revogação, alertas recentes",
  // (exibição)
  "home.running": "Implantações",
  "home.runningSub": { zero: "Nada em execução no momento", one: "{count} em execução", other: "{count} em execução" },
  // {n} = contagem exibida no filtro
  "home.filterActive": "Ativas · {n}",
  "home.filterAll": "Todas · {n}",
  // (exibição)
  "home.strategies": "Minhas estratégias",
  "home.strategiesSub": { zero: "Nenhuma salva ainda", one: "{count} salva", other: "{count} salvas" },
  "home.newWithAi": "Nova com IA",
  // (exibição)
  "home.backtests": "Backtests",
  "home.backtestsSub": "As execuções mais recentes primeiro",
  "home.emptyDeps": "Nada foi executado ainda. Abra uma das suas estratégias abaixo e implante-a primeiro em uma conta demo.",
  "home.emptyActive": "Nada está em execução no momento. As estratégias paradas estão em Todas.",
  "home.showAll": "Mostrar todas",
  "home.emptyStrats": "Nenhuma estratégia própria ainda. Descreva sua ideia ao AI Trader e ela vira regras exatas que você pode testar.",
  "home.browseMarket": "Explorar o marketplace",
  "home.emptyBts": "Nenhum backtest ainda. Abra uma estratégia e execute um com histórico de preços real.",
  "home.startEyebrow": "Primeiros passos",
  // (exibição)
  "home.startTitle": "Automatize sua estratégia",
  "home.step1": "Descreva sua ideia ao AI Trader: ela vira regras exatas que você pode ler e alterar.",
  "home.step2": "Faça o backtest das regras com histórico de preços real, com os custos da sua conta.",
  "home.step3": "Execute 24/7 primeiro em uma conta demo. Pause, pare ou encerre a qualquer momento.",
  "home.footnote": "As estratégias rodam nos servidores da Kalks 24 horas por dia, em barras fechadas, com as mesmas verificações de ordem da negociação manual: margem, horário do mercado, seus limites. Crie e edite estratégias com o AI Trader ou na Área do Cliente.",
  "home.openWeb": "Abrir o criador de estratégias na web",

  /* ---------------------------------------------------------------- */
  /* Kill switch (em toda a conta)                                     */
  /* ---------------------------------------------------------------- */
  "kill.cardTitle": "Kill switch",
  "kill.cardBody": "Pare todas as estratégias de uma vez e bloqueie ordens via webhook e API.",
  "kill.stopAll": "Parar tudo",
  "kill.onTitle": "O kill switch está ativado",
  // {at} = data e hora
  "kill.onSince": "Desde {at}. As estratégias estão paradas; ordens via webhook e API estão bloqueadas.",
  "kill.onBody": "As estratégias estão paradas; ordens via webhook e API estão bloqueadas.",
  "kill.release": "Desativar",
  // (exibição)
  "kill.title": "Parar tudo?",
  "kill.body": {
    zero: "Todas as estratégias param imediatamente, e as ordens via webhook e API ficam bloqueadas até você desativar o kill switch.",
    one: "A estratégia em execução para imediatamente, e as ordens via webhook e API ficam bloqueadas até você desativar o kill switch.",
    other: "As {count} estratégias em execução param imediatamente, e as ordens via webhook e API ficam bloqueadas até você desativar o kill switch.",
  },
  "kill.alsoClose": "Fechar também as posições delas",
  "kill.alsoCloseHint": "Fecha a mercado todas as posições abertas por uma estratégia, um webhook ou a API em todas as suas contas. Suas negociações manuais continuam abertas.",
  "kill.confirm": "Parar tudo agora",
  // (exibição)
  "kill.doneTitle": "Tudo parado",
  "kill.stopped": "Estratégias paradas",
  "kill.doneBody": "O kill switch fica ativado até você desativá-lo. As estratégias paradas não reiniciam sozinhas.",
  // (exibição)
  "kill.releaseTitle": "Desativar o kill switch?",
  "kill.releaseBody": "As ordens via webhook e API voltam a ser permitidas. As estratégias paradas continuam paradas: implante-as novamente quando estiver pronto.",
  // (exibição)
  "kill.releasedTitle": "Kill switch desativado",
  "kill.releasedBody": "As ordens via webhook e API voltam a ser permitidas. Implante uma estratégia para iniciá-la.",
  "kill.globalTitle": "A negociação automatizada está pausada",
  "kill.globalBody": "A corretora pausou todas as estratégias e ordens via webhook e API por enquanto. As posições abertas mantêm seus stops.",

  /* ---------------------------------------------------------------- */
  /* Status e controles das implantações                               */
  /* ---------------------------------------------------------------- */
  "dep.status.running": "Em execução",
  "dep.status.paused": "Pausada",
  "dep.status.stopped": "Parada",
  "dep.status.killed": "Encerrada",
  "dep.status.error": "Erro",
  "dep.realized": "L/P realizado",
  "dep.trades": "Negociações",
  "dep.winRate": "Taxa de acerto",
  "dep.open": "Abertas",
  "dep.orders": "Ordens",
  "dep.openNow": "Abertas",
  // {ago} = "há 5 minutos"
  "dep.lastCheck": "Última barra verificada: {ago}",
  // {since} = data de início
  "dep.lastCheckSince": "Última barra verificada: {ago} · em execução desde {since}",
  // {reason} = motivo enviado pelo serviço, ex.: "parada pelo dono"
  "dep.stoppedWhy": "Parada: {reason}",
  "dep.stoppedTitle": "Parada em {at}",
  "dep.errorTitle": "A estratégia encontrou um erro",
  // {account} = "Demo 50000083"
  "dep.eyebrow": "Implantação · {account}",
  "dep.marketplaceCopy": "Cópia do marketplace",
  "dep.openStrategy": "Abrir a estratégia",
  "dep.openSubscription": "Abrir minhas assinaturas",
  // {pct} = retorno %, {amount} = saldo inicial
  "dep.onStart": "{pct} sobre {amount}",
  "dep.curveA11y": "Saldo por dia ao longo de {days} dias, realizado {pnl}",
  "dep.tabLog": "Log · {n}",
  "dep.tabTrades": "Negociações · {n}",
  "dep.tabSetup": "Configuração",
  "dep.noLogs": "Nada registrado ainda: a primeira barra fechada é de aquecimento.",
  "dep.noTrades": "Nenhuma negociação ainda.",
  "dep.older": "Carregar entradas anteriores",
  "dep.logStart": "Essa é a primeira entrada.",
  "dep.rules": "Regras",
  "dep.rulesHidden": "O autor mantém as regras privadas: a estratégia roda na sua conta conforme publicada.",
  "dep.lotMultiplier": "Multiplicador de lote",
  "dep.maxLots": "Máx. de lotes por ordem",
  "dep.maxOpen": "Máx. de posições abertas",
  "dep.dailyLoss": "Limite de perda diária",
  "dep.started": "Iniciada",
  "dep.startBalance": "Saldo inicial",
  "dep.setupNote": "Uma implantação roda uma versão exata: salvar uma nova versão não a altera. Implante a nova versão para trocar.",

  "ctl.pause": "Pausar",
  "ctl.resume": "Retomar",
  "ctl.stop": "Parar",
  "ctl.kill": "Encerrar",
  "ctl.killNow": "Encerrar agora",
  "ctl.closePositions": "Fechar posições",
  // (exibição)
  "ctl.pauseTitle": "Pausar?",
  "ctl.pauseBody": "Nenhuma nova negociação. As posições abertas mantêm seu stop, alvo e breakeven. Retome quando quiser.",
  // (exibição)
  "ctl.resumeTitle": "Retomar?",
  "ctl.resumeBody": "Ela volta a negociar a partir da próxima barra fechada.",
  // (exibição)
  "ctl.stopTitle": "Parar?",
  "ctl.stopBody": "Ela para de vez: nenhuma nova negociação. Para executá-la de novo, implante-a novamente.",
  "ctl.keepTitle": "Manter as posições abertas",
  "ctl.keepText": { one: "A posição aberta mantém seu stop e alvo; gerencie-a você mesmo.", other: "As {count} posições abertas mantêm seus stops e alvos; gerencie-as você mesmo." },
  "ctl.closeAllTitle": "Fechá-las agora",
  "ctl.closeAllText": { one: "A posição aberta é fechada a mercado.", other: "As {count} posições abertas são fechadas a mercado." },
  // (exibição)
  "ctl.killTitle": "Encerrar agora?",
  "ctl.killBody": "O kill switch para esta estratégia imediatamente e, por padrão, fecha a mercado as posições que ela abriu.",
  "ctl.killClose": "Fechar as posições dela",
  "ctl.killCloseHint": "A mercado, agora. Desative para mantê-las abertas com seus stops.",
  // (exibição)
  "ctl.closeTitle": "Fechar as posições dela?",
  "ctl.closeBody": {
    one: "A posição que esta estratégia abriu é fechada a mercado. A estratégia continua rodando.",
    other: "As {count} posições que esta estratégia abriu são fechadas a mercado. A estratégia continua rodando.",
  },
  // (exibição)
  "ctl.done.pause": "Pausada",
  // (exibição)
  "ctl.done.resume": "Rodando de novo",
  // (exibição)
  "ctl.done.stop": "Parada",
  // (exibição)
  "ctl.done.kill": "Encerrada",
  // (exibição)
  "ctl.done.close": "Posições fechadas",
  "ctl.donePause": "Nenhuma nova negociação até você retomá-la.",
  "ctl.doneResume": "Ela volta a negociar a partir da próxima barra fechada.",
  "ctl.doneClosed": { one: "{count} posição foi fechada.", other: "{count} posições foram fechadas." },
  "ctl.doneKept": "As posições abertas dela, se houver, continuam abertas com seus stops e alvos.",
  "ctl.doneNothing": "Não havia nada aberto para fechar.",
  "ctl.closedLabel": "Fechadas",
  "ctl.failedLabel": "Não fechadas",
  "ctl.failedTitle": { one: "{count} posição não pôde ser fechada", other: "{count} posições não puderam ser fechadas" },
  "ctl.failedBody": "O mercado pode estar fechado. Feche pelo Portfólio quando a negociação reabrir.",
  // Parar ou encerrar uma cópia do marketplace mantém a assinatura (e as renovações de uma paga)
  "ctl.copyNote": "Esta é uma cópia do marketplace: pará-la não encerra a assinatura. Para deixar de pagar, cancele-a em Marketplace › Assinaturas.",

  /* ---------------------------------------------------------------- */
  /* Estratégia                                                        */
  /* ---------------------------------------------------------------- */
  // {version} = número da versão
  "strat.eyebrow": "Estratégia · v{version}",
  "strat.runningN": { one: "Em execução", other: "{count} em execução" },
  "strat.draft": "Rascunho",
  "strat.ready": "Pronta",
  "strat.errors": { one: "{count} erro", other: "{count} erros" },
  "strat.archivedTag": "Arquivada",
  "strat.lastBacktest": "Último backtest",
  "strat.backtested": "backtest",
  // (exibição)
  "strat.notTested": "Sem backtest ainda",
  "strat.notTestedBody": "Teste as regras com histórico de preços real, com os custos da sua conta, antes de executá-las.",
  "strat.runFirst": "Executar um backtest",
  "strat.openReport": "Abrir o relatório completo",
  "strat.deployV": "Implantar v{version}",
  "strat.backtest": "Backtest",
  "strat.fixFirst": "Corrija isto antes de testar ou implantar",
  "strat.line": "Linha {n}:",
  // (exibição)
  "strat.rules": "Regras",
  "strat.rulesSub": "Verificadas a cada barra fechada",
  "strat.rulesCodeSub": "Os sinais do código, verificados a cada barra fechada",
  "strat.showCode": "Mostrar como código",
  // (exibição)
  "strat.risk": "Risco",
  "strat.riskSub": "Tamanho, stops, horários e limites",
  "strat.editVisual": "Para alterar as regras, peça ao AI Trader ou edite-as na Área do Cliente; cada alteração é salva como uma nova versão.",
  "strat.editCode": "Estratégias em código são editadas na Área do Cliente, na web; cada alteração é salva como uma nova versão.",
  "strat.openWeb": "Editar o código na web",
  // (exibição)
  "strat.deployments": "Implantações",
  "strat.deploymentsSub": { zero: "Não está rodando em nenhuma conta", one: "{count} implantação", other: "{count} implantações" },
  "strat.notRunning": "Não está em execução. Implante-a primeiro em uma conta demo para ver como ela negocia ao vivo.",
  // (exibição)
  "strat.backtests": "Backtests",
  "strat.backtestsSub": { zero: "Nenhum ainda", one: "{count} execução", other: "{count} execuções" },
  "strat.runNew": "Executar novo",
  "strat.noBacktests": "Nenhum backtest ainda.",
  // (exibição)
  "strat.versions": "Versões",
  "strat.versionsSub": { one: "{count} versão", other: "{count} versões" },
  "strat.current": "Atual",
  "strat.archive": "Arquivar",
  // (exibição)
  "strat.archiveTitle": "Arquivar?",
  "strat.archiveBody": "“{name}” sai da sua lista. Os backtests e as implantações anteriores dela continuam no seu histórico.",
  "strat.archived": "“{name}” arquivada",

  "kind.visual": "Regras visuais",
  "kind.code": "Código",
  // De onde veio a estratégia
  "origin.ai": "AI Trader",
  "origin.template": "Modelo",
  "origin.manual": "Criada manualmente",
  "origin.marketplace": "Marketplace",

  /* ---------------------------------------------------------------- */
  /* Regras por extenso                                                */
  /* ---------------------------------------------------------------- */
  "rules.buy": "Comprar quando",
  "rules.sell": "Vender quando",
  "rules.exitBuy": "Fechar compras quando",
  "rules.exitSell": "Fechar vendas quando",
  "rules.and": "e",
  "rules.or": "ou",
  // {tf} = timeframe, ex.: "no H4"
  "rules.onTf": "no {tf}",
  "rules.noRules": "Nenhuma regra de entrada ainda.",
  "rules.size": "Tamanho",
  "rules.stop": "Stop loss",
  "rules.target": "Take profit",
  "rules.trailing": "Trailing",
  "rules.window": "Horário de negociação",
  "rules.limits": "Limites",
  "rules.none": "Nenhum",
  "rules.lots": "{lots} lote",
  "rules.riskPct": "{pct}% de risco por negociação",
  "rules.maxLots": "máx. {lots} lote",
  // Pontos: move o stop para a entrada + {o} após {v} pontos de lucro
  "rules.breakeven": "breakeven em {v} pontos (+{o})",
  "rules.allDay": "24 horas por dia",
  "rules.perDay": { one: "{count} negociação por dia", other: "{count} negociações por dia" },
  "rules.dailyLoss": "Para no dia com uma perda de {amount}",
  "rules.oneAtATime": "Uma posição por vez",
  "rules.closeOutside": "Fecha fora do horário",
  "rules.noLimits": "Sem limites diários",
  "op.crossesAbove": "cruza acima de",
  "op.crossesBelow": "cruza abaixo de",
  "dist.pips": "{v} pips",
  "dist.points": "{v} pontos",
  "dist.price": "em {v}",
  "dist.percent": "{v}% do preço",
  // {v} × ATR({p})
  "dist.atr": "{v} × ATR({p})",
  "dist.level": "nível {v}",
  // Múltiplo da distância do stop
  "dist.rr": "{v}R",
  "field.close": "Fechamento",
  "field.open": "Abertura",
  "field.high": "Máxima",
  "field.low": "Mínima",
  "field.hl2": "Preço mediano",
  "field.hlc3": "Preço típico",
  "field.ohlc4": "Preço médio",
  "field.volume": "Volume",
  "pattern.bullish": "Candle de alta",
  "pattern.bearish": "Candle de baixa",
  "pattern.bullish_engulfing": "Engolfo de alta",
  "pattern.bearish_engulfing": "Engolfo de baixa",
  "pattern.hammer": "Martelo",
  "pattern.shooting_star": "Estrela cadente",
  "pattern.doji": "Doji",
  "pattern.inside_bar": "Inside bar",
  "ind.sma": "SMA",
  "ind.ema": "EMA",
  "ind.wma": "WMA",
  "ind.rsi": "RSI",
  "ind.macd": "MACD",
  "ind.macd_signal": "Sinal do MACD",
  "ind.macd_hist": "Histograma do MACD",
  "ind.bb_upper": "Bollinger superior",
  "ind.bb_middle": "Bollinger central",
  "ind.bb_lower": "Bollinger inferior",
  "ind.atr": "ATR",
  "ind.stoch_k": "Estocástico %K",
  "ind.stoch_d": "Estocástico %D",
  "ind.highest": "Máxima mais alta",
  "ind.lowest": "Mínima mais baixa",
  "ind.cci": "CCI",
  "ind.willr": "Williams %R",
  "ind.adx": "ADX",
  "ind.plus_di": "+DI",
  "ind.minus_di": "−DI",
  "ind.momentum": "Momentum",
  "ind.roc": "ROC",
  "ind.stddev": "Desvio padrão",
  "note.noDailyLimit": "Sem limite diário de negociações",
  "note.noStop": "Sem stop loss: as posições ficam desprotegidas",
  "note.riskNeedsStop": "O dimensionamento por risco exige stop loss",
  "note.rrNeedsStop": "Um take profit em R exige stop loss",
  "note.noEntry": "Sem regra de entrada: adicione uma condição de compra ou venda",

  /* ---------------------------------------------------------------- */
  /* Implantar (formulário)                                            */
  /* ---------------------------------------------------------------- */
  "deploy.eyebrow": "Implantar · v{version}",
  // (exibição)
  "deploy.title": "Execute 24/7",
  "deploy.body": "“{name}” v{version} negocia {symbol} a cada barra {tf} fechada, nos servidores da Kalks, mesmo com o celular desligado. Pause, pare ou encerre a qualquer momento.",
  "deploy.account": "Conta",
  "deploy.equity": "Patrimônio {amount}",
  "deploy.noAccounts": "Você precisa de uma conta de negociação ativa. Abra uma conta demo para testar estratégias sem risco.",
  "deploy.openAccount": "Abrir uma conta",
  "deploy.multiplier": "Multiplicador de lote",
  "deploy.multiplierHint": "Ajusta o tamanho de cada ordem. 1× negocia o tamanho da própria estratégia.",
  "deploy.maxOpen": "Máx. de posições abertas",
  "deploy.maxOpenHint": "Um limite além das regras da própria estratégia.",
  "deploy.strategyDefault": "Regra da estratégia",
  "deploy.dailyLoss": "Limite de perda diária",
  "deploy.dailyLossHint": "Quando a perda fechada e aberta do dia chegar a ele, nenhuma nova negociação até amanhã (horário do servidor).",
  "deploy.off": "Desativado",
  "deploy.custom": "Personalizado",
  "deploy.dailyLossAmount": "Perda por dia",
  "deploy.lossInvalid": "Informe um valor acima de 0.",
  "deploy.liveTitle": "Dinheiro real",
  "deploy.liveBody": "Esta é uma conta real. A estratégia envia ordens reais com dinheiro real e pode perdê-lo.",
  "deploy.ack": "Entendo que a estratégia negocia com dinheiro real na minha conta real e que sou responsável por ela.",
  "deploy.note": "A negociação automatizada pode gerar prejuízo. Backtests são simulações e não preveem resultados futuros. Isto não é recomendação de investimento.",
  // {account} = "Demo 50000083"
  "deploy.confirm": "Implantar na conta {account}",
  // (exibição)
  "deploy.doneTitle": "Em execução",
  "deploy.doneBody": "“{name}” v{version} está rodando na conta {account}.",
  "deploy.warmup": "A primeira barra {tf} fechada é de aquecimento; as ordens podem começar a partir da seguinte.",
  "deploy.open": "Abrir implantação",

  /* ---------------------------------------------------------------- */
  /* Backtests                                                         */
  /* ---------------------------------------------------------------- */
  "bt.status.queued": "Na fila",
  "bt.status.running": "Em execução",
  "bt.status.done": "Concluído",
  "bt.status.failed": "Falhou",
  "bt.status.cancelled": "Cancelado",
  "bt.stage.queued": "Aguardando um processador livre",
  "bt.stage.loading": "Carregando o histórico de preços",
  "bt.stage.m1": "Carregando barras de minuto",
  "bt.stage.simulating": "Simulando negociações",
  "bt.stage.running": "Em execução",
  // {id} = número do backtest, {version} = versão da estratégia
  "bt.eyebrow": "Backtest #{id} · v{version}",
  // (exibição)
  "bt.title": "Backtest",
  "bt.start": "Início {amount}",
  "bt.runningNote": "Ele roda no servidor: você pode sair desta tela e voltar depois.",
  "bt.failed": "O backtest falhou",
  // (exibição)
  "bt.cancelled": "Cancelado",
  "bt.runAgain": "Executar novamente",
  "bt.net": "Lucro líquido",
  // {pct} = retorno, {amount} = saldo inicial
  "bt.returnOf": "{pct} sobre {amount}",
  "bt.pf": "Fator de lucro",
  "bt.winRate": "Taxa de acerto",
  "bt.winsOf": "{wins} de {trades}",
  "bt.maxDd": "Drawdown máximo",
  "bt.maxDdShort": "DD máx.",
  "bt.sharpe": "Sharpe",
  "bt.sortino": "Sortino {v}",
  "bt.trades": "Negociações",
  "bt.longShort": "{long} compras · {short} vendas",
  "bt.expectancy": "Expectativa",
  "bt.perTrade": "por negociação",
  // (exibição)
  "bt.equity": "Patrimônio",
  "bt.drawdown": "Drawdown",
  "bt.legendEquity": "Patrimônio",
  "bt.legendBalance": "Saldo",
  "bt.legendStart": "Início",
  "bt.noCurve": "Barras insuficientes para uma curva.",
  "bt.scrubHint": "Arraste pelo gráfico, ou toque e segure, para ler qualquer ponto.",
  "bt.curveA11y": "Patrimônio de {from} a {to}; drawdown máximo {dd}",
  // (exibição)
  "bt.monthly": "Mensal",
  "bt.monthlySub": "Retorno de cada mês, % do saldo",
  "bt.noTradesMonth": "sem negociações",
  // (exibição)
  "bt.statistics": "Estatísticas",
  // (exibição)
  "bt.tradeList": "Negociações",
  "bt.tradeListSub": "Mais recentes primeiro, já descontados os custos",
  "bt.truncated": "As primeiras {n} negociações, mais recentes primeiro",
  "bt.fAll": "Todas · {n}",
  "bt.fWins": "Ganhos · {n}",
  "bt.fLosses": "Perdas · {n}",
  "bt.noTrades": "As regras não negociaram neste período.",
  // (exibição)
  "bt.data": "Dados e custos",
  "bt.m1Bars": "Barras de minuto (intrabarra)",
  "bt.since": "desde {date}",
  "bt.signals": "Sinais",
  "bt.signalsValue": "{buy} de compra · {sell} de venda · {exits} de saída",
  "bt.skipped": "Ignorados: {reason}",
  "bt.model": "Modelo",
  "bt.group": "Tipo de conta",
  "bt.spread": "Spread",
  "bt.spreadValue": "{points} pontos ({source})",
  "bt.commission": "Comissão",
  "bt.perLot": "{amount} por lote",
  "bt.swaps": "Swaps",
  "bt.swapsOn": "Cobrados a cada rolagem",
  "bt.swapsOff": "Não cobrados (sem swap)",
  "bt.conversion": "Conversão de L/P",
  "bt.usdBase": "Base em USD: pelo preço de saída",
  "bt.usdQuoted": "Cotado em USD",
  "bt.currentRate": "Pela taxa atual ({rate})",
  "bt.simNote": "O backtest #{id} é uma simulação com preços passados: execuções na abertura da barra seguinte, stops e alvos em um trajeto OHLC (barras de minuto onde existirem), spread, comissão e swaps do seu tipo de conta. Resultados passados não preveem resultados futuros.",
  // Fontes de histórico e motivos de descarte enviados pelo serviço
  "source.native": "nativo",
  "source.built_from_M1": "montado a partir do M1",
  "source.built_from_M5": "montado a partir do M5",
  "source.built_from_M15": "montado a partir do M15",
  "source.built_from_M30": "montado a partir do M30",
  "source.built_from_H1": "montado a partir do H1",
  "skip.outside_trading_window": "fora do horário de negociação",
  "skip.position_already_open": "já havia uma posição aberta",
  "skip.daily_trade_limit": "limite diário de negociações",
  "skip.max_daily_loss": "limite de perda diária",
  "skip.market_closed": "mercado fechado",
  "skip.20_open_positions": "20 posições já abertas",
  "skip.buy_and_sell_on_the_same_bar": "compra e venda na mesma barra",
  "skip.stop_distance_not_ready": "distância do stop ainda indisponível",
  "skip.SL_level_on_the_wrong_side": "nível do stop do lado errado",
  "skip.volume_below_the_minimum_lot": "tamanho abaixo do lote mínimo",
  "spreadSource.group_quote": "cotação ao vivo do seu tipo de conta",
  "spreadSource.catalogue": "spread do catálogo",
  "spreadSource.fixed": "fixo",

  // (exibição)
  "btNew.title": "Executar backtest",
  "btNew.period": "Período",
  "btNew.balance": "Saldo inicial",
  "btNew.other": "Outro",
  "btNew.amount": "Valor",
  "btNew.costs": "Custos de",
  "btNew.accountType": "Tipo de conta",
  "btNew.myAccount": "Minha conta",
  "btNew.costsGroupHint": "Spread, comissão e swaps desse tipo de conta.",
  "btNew.costsAccountHint": "Spread, comissão e swaps do grupo dessa conta.",
  "btNew.noAccounts": "Você ainda não tem uma conta de negociação ativa.",
  "btNew.run": "Executar backtest",
  "btNew.note": "O período máximo depende do timeframe. Até 3 backtests podem rodar ao mesmo tempo.",

  // Períodos (M = meses, A = anos)
  "period.p1m": "1M",
  "period.p3m": "3M",
  "period.p6m": "6M",
  "period.p1y": "1A",
  "period.p2y": "2A",
  "period.p5y": "5A",

  // Motivos de saída da negociação (códigos do servidor)
  "exit.sl": "Stop loss",
  "exit.tp": "Take profit",
  "exit.trailing": "Trailing stop",
  "exit.breakeven": "Breakeven",
  "exit.signal": "Sinal",
  "exit.exit_rule": "Regra de saída",
  "exit.session": "Fora do horário",
  "exit.end_of_test": "Fim do teste",
  "exit.stop_out": "Stop out",
  "exit.kill": "Kill switch",
  "exit.stopped": "Parada",
  "exit.client": "Fechada",
  "exit.close": "Fechada",

  "stat.balance": "Saldo",
  "stat.gross": "Lucro / prejuízo bruto",
  "stat.cagr": "Crescimento anual (CAGR)",
  "stat.avgWinLoss": "Ganho / perda médios",
  "stat.largest": "Maior ganho / perda",
  "stat.payoff": "Payoff",
  "stat.long": "Compras · taxa de acerto",
  "stat.short": "Vendas · taxa de acerto",
  "stat.streaks": "Mais ganhos / perdas seguidos",
  "stat.maxDd": "Drawdown máximo",
  "stat.recovery": "Fator de recuperação",
  "stat.sharpeSortino": "Sharpe / Sortino",
  "stat.avgBars": "Média de barras mantidas",
  "stat.exposure": "Tempo no mercado",
  "stat.costs": "Comissão / swap / spread",
  "stat.bars": "Barras testadas",
  "stat.cpu": "Calculado em",
  "stat.seconds": "{s} s",

  /* ---------------------------------------------------------------- */
  /* Tipos de entrada no log (execução)                                */
  /* ---------------------------------------------------------------- */
  "log.eval": "Barra",
  "log.signal": "Sinal",
  "log.order": "Ordem",
  "log.close": "Fechamento",
  "log.manage": "Gestão",
  "log.error": "Erro",
  "log.info": "Info",

  /* ---------------------------------------------------------------- */
  /* Marketplace                                                       */
  /* ---------------------------------------------------------------- */
  "house.badge": "Estratégia da casa · Operada pela Kalks",
  "house.disclosure": "Estratégia da casa operada pela Kalks: uma conta real da corretora executando esta estratégia. O histórico inclui apenas as próprias negociações reais desde o início; nada é simulado ou preenchido retroativamente.",
  "market.eyebrow": "Marketplace de estratégias",
  // (exibição)
  "market.title": "Marketplace",
  "market.subtitle": "Estratégias com histórico verificado em contas da Kalks. Copie uma para sua conta ou clone as regras quando o autor permitir.",
  "market.browse": "Explorar",
  "market.subs": "Assinaturas",
  "market.subsN": "Assinaturas · {n}",
  "market.mine": "Seus anúncios",
  "market.search": "Pesquisar estratégias, autores…",
  "market.clear": "Limpar a pesquisa",
  "market.all": "Todas",
  "market.free": "Grátis",
  "market.paid": "Pagas",
  "market.newest": "Mais recentes",
  "market.topRated": "Mais bem avaliadas",
  "market.popular": "Populares",
  // {price} em USDT
  "market.perMonth": "{price} USDT/mês",
  "market.by": "por {author}",
  "market.return": "Retorno",
  "market.winRate": "Taxa de acerto",
  "market.maxDd": "DD máx.",
  "market.trades": "Negociações",
  // {type} = Real / Demo (conta)
  "market.verified": "{type} verificada",
  "market.verifiedDays": "{type} verificada · {days} dias",
  // Histórico com menos de um dia
  "market.verifiedNew": "{type} verificada · menos de um dia",
  "market.subscribed": "Assinada",
  "market.ratings": { zero: "Sem avaliações", one: "{count} avaliação", other: "{count} avaliações" },
  "market.subscribers": { one: "{count} assinante", other: "{count} assinantes" },
  // (exibição)
  "market.emptyTitle": "Nada anunciado ainda",
  "market.emptyText": "As estratégias aparecem aqui assim que os autores as publicam com um histórico verificado.",
  // (exibição)
  "market.noMatchTitle": "Nenhum resultado",
  "market.noMatchText": "Tente outra pesquisa ou filtro.",
  // (exibição)
  "market.noSubsTitle": "Nenhuma assinatura",
  "market.noSubsText": "As estratégias que você copiar ou clonar do marketplace aparecem aqui.",
  "market.disclaimer": "Resultados passados não garantem resultados futuros. Os históricos vêm de contas reais ou demo na Kalks e são identificados assim. Taxa da plataforma sobre assinaturas pagas: {pct}%.",
  "market.houseFootnote": "As estratégias da casa rodam em contas reais da corretora; seus históricos incluem apenas as próprias negociações reais.",
  "market.earned": "Ganhos",
  "market.fees": "Taxas da plataforma",
  "market.payments": "Pagamentos",
  "market.publishWeb": "Publicar uma estratégia (com seu histórico verificado) e editar um anúncio são feitos na Área do Cliente, na web.",
  "market.openWeb": "Abrir o marketplace na web",

  // Status do anúncio (valores do servidor)
  "listing.pending": "Em análise",
  "listing.approved": "Anunciada",
  "listing.rejected": "Rejeitada",
  "listing.suspended": "Suspensa",
  "listing.unlisted": "Fora da lista",
  "listing.eyebrow": "Marketplace · {symbol} {tf}",
  // {type} = real / demo (minúsculas)
  "listing.verified": "Histórico verificado em conta {type}",
  "listing.cloneAllowed": "Clonagem permitida",
  "listing.trackReturn": "Retorno verificado",
  "listing.net": "Líquido",
  "listing.noCurve": "A curva dia a dia aparece após dois dias de negociação.",
  "listing.curveA11y": "Patrimônio por dia ao longo de {days} dias, retorno {ret}",
  "listing.trackNote": "Da própria implantação do autor na Kalks desde {since}, calculado a partir das operações fechadas no mecanismo de negociação: nunca informado pelo autor.",
  "listing.btSimulated": "Backtest · simulado",
  "listing.btNote": "Como as regras teriam negociado com preços passados e os custos deste tipo de conta. Não faz parte do histórico real acima.",
  "listing.btA11y": "Curva de patrimônio do backtest (simulada)",
  // (exibição)
  "listing.about": "Sobre",
  // (exibição)
  "listing.risk": "Risco",
  // (exibição)
  "listing.rules": "Regras",
  "listing.rulesPrivate": "As regras são privadas: copie a estratégia para executá-la na sua conta.",
  // (exibição)
  "listing.reviews": "Avaliações · {n}",
  "listing.noReviews": "Nenhuma avaliação ainda.",
  "listing.subscribeFree": "Assinar grátis",
  "listing.subscribePaid": "Assinar · {price} USDT / mês",
  "listing.copying": "Copiando na conta {login}",
  "listing.clonedTo": "Clonada para suas estratégias",
  "listing.openDeployment": "Abrir implantação",
  "listing.openStrategy": "Abrir estratégia",
  "listing.cancel": "Cancelar",
  "listing.cancelConfirm": "Cancelar a assinatura",
  "listing.keep": "Manter",
  // (exibição)
  "listing.cancelTitle": "Cancelar?",
  "listing.cancelCopy": "A estratégia para na sua conta agora. As posições abertas dela continuam abertas com seus stops e alvos.",
  "listing.cancelClone": "A assinatura termina. A estratégia clonada continua na sua lista.",
  // {date} = fim do período pago
  "listing.cancelPaid": "Ela continua rodando até {date} e não será renovada. Nada é reembolsado pelo período atual.",
  "listing.cancelled": "Assinatura cancelada",
  "listing.cancelledPaid": "Ela não será renovada",
  "listing.yours": "Seu anúncio",
  "listing.manageWeb": "Gerenciar na web",

  /* ---------------------------------------------------------------- */
  /* Assinar (formulário), assinaturas                                 */
  /* ---------------------------------------------------------------- */
  "sub.eyebrow": "Assinar",
  "sub.title": "Assinar",
  "sub.body": "por {author} · {symbol} {tf}",
  "sub.how": "Como",
  "sub.copyTitle": "Copiar para minha conta",
  "sub.copyText": "A versão exata do autor roda na sua conta, 24/7. As regras continuam privadas.",
  "sub.copyTextOpen": "A versão exata do autor roda na sua conta, 24/7.",
  "sub.cloneTitle": "Clonar as regras",
  "sub.cloneText": "As regras viram uma das suas estratégias: teste, altere e implante-as você mesmo.",
  "sub.multiplierHint": "Ajusta o tamanho das ordens da estratégia na sua conta.",
  "sub.price": "Preço",
  "sub.dueNow": "A pagar agora",
  "sub.wallet": "Carteira (disponível)",
  "sub.renewal": "Renovação",
  "sub.noCharge": "Grátis, nada é cobrado",
  "sub.shortTitle": "USDT insuficiente",
  "sub.shortBody": "Sua carteira precisa ter pelo menos {amount} USDT disponíveis.",
  "sub.deposit": "Depositar",
  "sub.liveBody": "A estratégia envia ordens reais com dinheiro real nesta conta e pode perdê-lo.",
  "sub.ackPay": "Cobrar {price} USDT da minha carteira Kalks agora e a cada 30 dias até eu cancelar.",
  // (exibição)
  "sub.doneTitle": "Assinatura ativa",
  // {title} = estratégia, {account} = "Demo 50000083"
  "sub.doneCopy": "“{title}” está rodando na conta {account}.",
  "sub.doneClone": "“{title}” agora é uma das suas estratégias.",
  "sub.charged": "{amount} USDT foram cobrados da sua carteira.",
  // A resposta a um pedido de assinatura se perdeu (conexão, tempo esgotado): o app relê o anúncio antes de tentar de novo
  "sub.noAnswer": "Não recebemos resposta. A assinatura pode ter sido concluída.",
  "sub.checkingTitle": "Verificando sua assinatura",
  "sub.checkingBody": "A resposta se perdeu no caminho. Estamos verificando com o servidor antes que você possa tentar de novo, para que você nunca seja cobrado duas vezes.",
  "sub.noAnswerRetry": "Ainda sem resposta, e nenhuma assinatura nova na sua conta. Você pode tentar novamente.",
  "sub.notThrough": "Não foi concluída, e nada fica cobrado (uma cobrança é reembolsada na sua carteira). Você pode tentar novamente.",
  "sub.unfinished": "Ainda está sendo configurada no servidor. Confira Marketplace › Assinaturas e o histórico da sua carteira, ou fale com o suporte, antes de tentar novamente.",
  "sub.free": "Assinatura gratuita: nada foi cobrado.",
  "sub.copyOn": "cópia na conta {login}",
  "sub.cloned": "clonada",
  "sub.renews": "renova em {date}",
  "sub.ends": "termina em {date}",
  "sub.status.active": "Ativa",
  "sub.status.cancelled": "Cancelada",
  "sub.status.expired": "Expirada",
  "sub.status.past_due": "Pagamento pendente",

  // (exibição)
  "review.title": "Avaliar",
  "review.rating": "Sua avaliação",
  "review.stars": { one: "{count} estrela", other: "{count} estrelas" },
  "review.comment": "Comentário (opcional)",
  "review.placeholder": "Como ela negociou para você?",
  "review.post": "Publicar avaliação",
  "review.saved": "Avaliação salva",
  "review.rate": "Avaliar",
  "review.edit": "Editar avaliação",
  "review.you": "Você",

  /* ---------------------------------------------------------------- */
  /* Chaves de API e webhooks                                          */
  /* ---------------------------------------------------------------- */
  "keys.eyebrow": "Desenvolvedores",
  // (exibição)
  "keys.title": "API",
  "keys.subtitle": "Chaves para seus próprios programas de negociação e URLs de webhook para alertas (TradingView e outros).",
  "keys.requests24h": "Requisições · últimas 24 h",
  "keys.errors": "Erros",
  // Requisições recusadas pelo limite de taxa
  "keys.limited": "Limitadas",
  "keys.p50": "Mediana",
  "keys.writes": "Ordens",
  // (exibição)
  "keys.keys": "Chaves de API",
  "keys.keysSub": "{n} ativas · até 20",
  "keys.none": "Nenhuma chave de API. Crie uma na Área do Cliente, na web.",
  "keys.status.active": "Ativa",
  "keys.status.revoked": "Revogada",
  "keys.status.expired": "Expirada",
  "keys.scope.read": "Leitura",
  "keys.scope.trade": "Negociação",
  // {ips} = lista de endereços IP
  "keys.ips": "Somente de {ips}",
  "keys.anyIp": "De qualquer endereço IP",
  "keys.expires": "Expira em {date}",
  "keys.noExpiry": "Nunca expira",
  "keys.lastUsed": "último uso: {ago}",
  "keys.revoke": "Revogar",
  // (exibição)
  "keys.revokeTitle": "Revogar esta chave?",
  "keys.revokeBody": "“{name}” ({id}) para de funcionar imediatamente para todos os programas que a usam. Isso não pode ser desfeito.",
  "keys.revoked": "“{name}” revogada",
  "keys.webTitle": "Criar na web",
  "keys.webBody": "Novas chaves e webhooks são criados na Área do Cliente: o segredo de uma chave e a URL de um webhook são exibidos uma única vez, lá, onde você pode copiá-los para suas ferramentas de negociação.",
  "keys.openWeb": "Abrir a Área do Cliente",
  "keys.killHint": "Precisa parar tudo? O kill switch na tela do Algo para todas as estratégias e bloqueia ordens via webhook e API.",

  // (exibição)
  "hooks.title": "Webhooks",
  "hooks.sub": "{n} de até 20",
  "hooks.none": "Nenhum webhook. Crie um na Área do Cliente, na web.",
  // {hint} = últimos caracteres da URL
  "hooks.hint": "URL …{hint}",
  "hooks.accounts": { one: "{count} conta", other: "{count} contas" },
  "hooks.today": { zero: "nenhum alerta hoje", one: "{count} alerta hoje", other: "{count} alertas hoje" },
  "hooks.used": "último uso: {ago}",
  "hooks.on": "Ativado",
  "hooks.off": "Desativado",
  "hooks.switch": "Webhook “{name}” ativado",
  "hooks.passphrase": "Frase secreta obrigatória",
  "hooks.noPassphrase": "Sem frase secreta",
  "hooks.delete": "Excluir",
  // (exibição)
  "hooks.deleteTitle": "Excluir este webhook?",
  "hooks.deleteBody": "“{name}” e sua URL secreta param de funcionar imediatamente; os alertas enviados a ele são recusados. Isso não pode ser desfeito.",
  "hooks.deleted": "“{name}” excluído",
  // (exibição)
  "hooks.alerts": "Alertas recentes",
  "hooks.alertsSub": "Cada alerta com o resultado em cada conta",
  // Status do alerta (valores do servidor)
  "hooks.status.accepted": "Aceito",
  "hooks.status.partial": "Parcialmente concluído",
  "hooks.status.failed": "Falhou",
  "hooks.status.received": "Recebido",
  "hooks.status.rejected": "Rejeitado",
  "hooks.status.blocked": "Bloqueado (kill switch)",
  // Resultado de um alerta em cada conta (valores do servidor)
  "hooks.result.filled": "executada",
  "hooks.result.pending": "ordem colocada",
  "hooks.result.closed": "fechada",
  "hooks.result.nothing_to_close": "nada para fechar",
  "hooks.result.rejected": "rejeitada",
};
export default mobileAlgo;
