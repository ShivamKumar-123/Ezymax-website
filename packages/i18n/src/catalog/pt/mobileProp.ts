import type { NsMessages } from "../../core";

// App móvel da Kalks: Prop (catálogo e compra de desafios, painel de regras ao vivo, pagamentos, certificados).
// "Kalks", "Kalks Prop", "Kalks Trader", "Kalks-Live", "USDT", "New York" e "17:00" ficam como estão.
// Títulos em maiúsculas altas estão marcados como "exibição": manter curtos.
const mobileProp: NsMessages<"mobileProp"> = {
  // Início do Prop
  "home.eyebrow": "Kalks Prop",
  // exibição
  "home.title": "Seja financiado",
  "home.subtitle": "Seja aprovado em um desafio, receba uma conta financiada e fique com até {split}% do lucro. Toda conta prop é simulada.",
  "home.subtitleNoSplit": "Seja aprovado em um desafio, receba uma conta financiada e fique com uma parte do lucro. Toda conta prop é simulada.",
  "home.payouts": "Pagamentos",
  "home.payoutsReady": "{amount} disponível",
  "home.payoutsNone": "Nenhum disponível ainda",
  "home.certificates": "Certificados",
  "home.certCount": { one: "{count} conquistado", other: "{count} conquistados" },
  "home.mine": "Seus desafios",
  "home.past": "Desafios anteriores",
  "home.showAll": "Mostrar todos ({count})",
  "home.yourCertificates": "Seus certificados",
  "home.plans": "Escolha seu desafio",
  "home.newChallenge": "Iniciar um novo desafio",
  // exibição
  "home.emptyTitle": "Nenhum desafio disponível",
  "home.emptyBody": "Novos planos de desafio estão sendo preparados. Volte em breve.",
  "home.mineError": "Não foi possível carregar seus desafios.",
  "home.plansError": "Não foi possível carregar os planos de desafio.",

  // Como funciona (numerado de 01 a 04 no início do Prop)
  "how.title": "Como funciona",
  "how.1.title": "Escolha um plano",
  "how.1.body": "Escolha o modelo e o tamanho da conta. A taxa sai da sua carteira USDT, uma única vez.",
  "how.2.title": "Atinja a meta",
  "how.2.body": "Alcance a meta de lucro dentro dos limites de perda diária e de drawdown, cumprindo os dias mínimos de negociação.",
  "how.3.title": "Seja financiado",
  "how.3.body": "Seja aprovado e sua conta financiada abre automaticamente, com um certificado para compartilhar.",
  "how.4.title": "Receba",
  "how.4.body": "Solicite sua parte do lucro para sua carteira USDT a cada ciclo de pagamento.",
  "how.enforce": "Os limites são verificados no servidor a cada segundo, sobre o patrimônio. Você é avisado em 50, 75 e 90% da perda diária; uma violação fecha todas as posições e encerra o desafio.",

  // Modelos de plano
  "type.oneStep": "1 Fase",
  "type.twoStep": "2 Fases",
  "type.instant": "Instantâneo",
  "typeText.oneStep": "Uma fase de avaliação. Atinja a meta, respeite os limites e seja financiado.",
  "typeText.twoStep": "Duas fases de avaliação com metas menores e limites mais amplos.",
  "typeText.instant": "Sem avaliação. Comece imediatamente em uma conta financiada, com limites mais rígidos.",

  // Card do plano
  "plan.refundable": "Taxa reembolsada",
  "plan.fee": "Taxa",
  "plan.account": "Conta",
  "plan.leverage": "Alavancagem 1:{n}",
  "plan.target": "Meta",
  "plan.dailyLoss": "Perda diária",
  "plan.maxDD": "Drawdown máx.",
  "plan.static": "estático",
  "plan.trailing": "móvel",
  "plan.start": "Começar · {fee}",

  // Compra
  "checkout.eyebrow": "Finalizar compra",
  "checkout.fee": "Taxa única",
  "checkout.chargedRefund": "Paga com sua carteira USDT. Reembolsada com seu primeiro pagamento.",
  "checkout.chargedNoRefund": "Paga com sua carteira USDT. Não reembolsável.",
  "checkout.walletBalance": "Saldo da carteira: {balance} USDT",
  "checkout.shortTitle": "Sua carteira não cobre a taxa",
  "checkout.short": "Você tem {balance} USDT. Deposite mais {missing} USDT para pagar este desafio.",
  "checkout.rules": "As regras",
  "checkout.limitsNote": "Os limites são um percentual do saldo inicial. Violar a perda diária ou o drawdown máximo reprova a conta e fecha todas as posições a mercado. O dia de negociação reinicia às 17:00 New York.",
  "checkout.agree": "Li as regras e entendo que a conta é simulada e é reprovada automaticamente quando um limite de perda é violado.",
  "checkout.pay": "Pagar {fee}",
  "checkout.retry": "Tentar novamente · {fee}",
  "checkout.paying": "Pagando…",
  "checkout.goToMine": "Ver meus desafios",
  // exibição
  "checkout.readyTitle": "Tudo pronto",
  "checkout.readyBody": "{fee} foi pago com sua carteira USDT e sua conta de {size} da {phase} está aberta. As regras valem a partir de agora.",
  "checkout.savePasswords": "Salve estas senhas agora: elas são exibidas apenas uma vez e não as armazenamos. Você sempre pode negociar nesta conta pelo app sem elas.",
  "checkout.passwordsShown": "As senhas de negociação foram exibidas quando esta compra foi confirmada pela primeira vez. Você pode negociar nesta conta pelo app sem elas.",
  "checkout.viewChallenge": "Ver desafio",
  "checkout.readOnly": "Esta sessão não pode comprar desafios.",

  // Credenciais da conta
  "cred.login": "Login",
  "cred.server": "Servidor",
  "cred.password": "Senha de negociação",
  "cred.investorPassword": "Senha de investidor (somente leitura)",
  "cred.show": "Mostrar senha",
  "cred.hide": "Ocultar senha",
  "copied": "Copiado: {what}",
  "a11y.copy": "Copiar {what}",

  // Status do desafio
  "status.pendingPayment": "Aguardando pagamento",
  "status.provisioning": "Abrindo conta",
  "status.active": "Ativo",
  "status.funded": "Financiada",
  "status.failed": "Reprovado",
  "status.closed": "Encerrado",
  "status.paymentFailed": "Falha no pagamento",
  // {phase} é o nome da fase no plano, ex.: "Fase 2"
  "stage.active": "{phase} · Ativa",
  "stage.failed": "{phase} · Reprovada",
  "phaseStatus.provisioning": "Abrindo",
  "phaseStatus.active": "Atual",
  "phaseStatus.passed": "Aprovada",
  "phaseStatus.failed": "Reprovada",
  "phaseStatus.closed": "Encerrada",

  // Cards de desafio (início do Prop)
  "card.target": "Meta de lucro",
  "card.profit": "Lucro",
  "card.equity": "Patrimônio {amount}",
  "card.dailyLeft": "Perda diária restante {amount}",
  "card.opening": "Sua conta de negociação está sendo aberta. Isso leva alguns segundos.",

  // Painel
  "dash.equity": "Patrimônio",
  "dash.balance": "Saldo",
  "dash.floating": "Flutuante",
  "dash.open": "Abertas",
  "dash.sinceStart": "desde o início da fase",
  "dash.rules": "Regras",
  "dash.rulesTitle": "Regras deste desafio",
  // exibição
  "dash.notFound": "Desafio não encontrado",
  "dash.notFoundBody": "Ele pode ter sido aberto com outro login.",
  "dash.backToProp": "Voltar ao Prop",
  "live.live": "Ao vivo",
  "live.connecting": "Conectando…",
  "live.offline": "Offline",
  // {time}: data e hora da última verificação das regras
  "live.updated": "Verificado em {time}",
  // {time}: quando a fase terminou
  "live.final": "Final · {time}",

  // Nomes das regras (medidores, registro de regras)
  "rule.dailyLoss": "Perda diária",
  "rule.maxDrawdown": "Drawdown máximo",
  "rule.profitTarget": "Meta de lucro",
  "rule.tradingDays": "Dias de negociação",
  "rule.timeLimit": "Prazo",
  "rule.weekendHolding": "Posições no fim de semana",
  "rule.newsWindow": "Janela de notícias",
  "rule.bannedStrategy": "Estratégia proibida",
  "rule.consistency": "Consistência",
  "rule.riskDesk": "Decisão da mesa de risco",
  "ruleState.ok": "Em andamento",
  "ruleState.passed": "Cumprida",
  "ruleState.failed": "Violada",
  "ruleState.off": "Desativada",

  // Medidores
  "target.ofTarget": "da meta",
  "target.of": "Meta {amount} ({pct}%)",
  "target.left": "Faltam {amount}",
  "target.reachedBy": "Atingida, {amount} acima",
  "limit.left": "Restam {amount}",
  "limit.breachAt": "Violação em {amount}",
  "days": { one: "{count} dia", other: "{count} dias" },
  "days.of": "{v} de {min}",
  "days.count": { one: "{count} dia", other: "{count} dias" },
  "days.met": "Mínimo cumprido",
  "days.toGo": { one: "Falta {count}", other: "Faltam {count}" },
  "days.noMinimum": "Sem mínimo",
  "time.left": "Restam {d}d {h}h",
  "time.deadline": "Termina em {date}",
  "consistency.rule": "Melhor dia ≤ {pct}% do lucro",
  "consistency.noProfit": "Nenhum lucro ainda",
  "reset.title": "A perda diária reinicia em",
  "reset.note": "17:00 New York, todo dia de negociação",

  // Conta financiada: anel da janela de pagamento
  "payoutHero.title": "Próximo pagamento",
  "payoutHero.share": "Sua parte até agora",
  // exibição
  "payoutHero.open": "Aberta",
  // exibição
  "payoutHero.ready": "Pronto",
  // exibição
  "payoutHero.days": { one: "{count} dia", other: "{count} dias" },
  "payoutHero.eligible": "Elegível agora com sua divisão de {split}%.",
  "payoutHero.opens": "A janela de pagamento abre em {date}.",
  "payoutHero.later": "Solicite um pagamento quando tiver lucro elegível.",

  // Estados principais
  // exibição
  "hero.opening.title": "Abrindo sua conta",
  "hero.opening.body": "O pagamento foi confirmado e sua conta de negociação está sendo configurada. Esta página é atualizada sozinha.",
  // exibição
  "hero.closed.title": "Desafio encerrado",
  "hero.closed.body": "Não foi possível abrir a conta de negociação deste desafio, então ele foi encerrado e a taxa foi reembolsada na sua carteira USDT. Fale com o suporte se tiver dúvidas.",
  // {reason} é o motivo enviado pelo serviço prop, em inglês
  "hero.closed.reason": "{reason}. A taxa foi reembolsada na sua carteira USDT.",
  // exibição
  "hero.failed.title": "{phase} reprovada",
  "hero.failed.on": "Encerrada em {date}",
  // {reason} é o motivo da violação enviado pelo motor de risco
  "hero.failed.body": "{reason}. Todas as posições foram fechadas e a conta foi desativada.",
  "hero.failed.ruleBreached": "Uma regra foi violada",
  // {rule} é o nome de uma regra, ex.: "Perda diária"
  "hero.failed.rule": "{rule}: limite violado",
  "hero.failed.new": "Iniciar um novo desafio",
  // exibição
  "hero.passed.title": "{phase} aprovada",
  "hero.passed.on": "Aprovada em {date}.",
  "hero.passed.next": "Sua conta da {phase} está aberta.",
  "hero.passed.nextLogin": "Sua conta da {phase} está aberta (#{login}).",
  "hero.passed.opening": "Sua próxima conta está sendo aberta.",
  "hero.passed.certificate": "Ver certificado",
  "hero.passed.goNext": "Ir para a {phase}",
  // exibição
  "hero.funded.title": "Financiada",
  "hero.funded.body": "Negocie a conta financiada e receba {split}% do lucro em pagamentos.",
  "hero.funded.certificate": "Ver seu certificado de trader financiado",

  // Avisos durante a negociação
  "warn.lossUsed": "{pct}% do limite de perda de hoje utilizado",
  "warn.lossUsedBody": "Patrimônio igual ou abaixo de {floor} reprova a conta e fecha todas as posições. Restante hoje: {left}.",
  "warn.weekend": "Fechamento de fim de semana",
  "warn.weekendBody": "Este plano não permite manter posições no fim de semana: as posições abertas são fechadas na sexta-feira às 16:45 New York.",

  // Ações
  "action.openTrade": "Abrir em Negociar",
  "action.trade": "Negociar",
  "action.tradeBlocked": "Somente a conta atual de um desafio ativo pode ser negociada.",
  "action.payouts": "Pagamentos",
  "action.support": "Falar com o suporte",

  // Gráfico de patrimônio
  "chart.title": "Curva de patrimônio",
  "chart.start": "Início",
  "chart.target": "Meta",
  "chart.ddFloor": "Drawdown máx.",
  "chart.dailyFloor": "Perda diária",
  "chart.now": "Agora",
  "chart.empty": "A curva aparece após os primeiros minutos de negociação.",

  // Estatísticas de negociação
  "stats.title": "Estatísticas de negociação",
  "stats.trades": "Negociações",
  "stats.winRate": "Taxa de acerto",
  "stats.profitFactor": "Fator de lucro",
  "stats.avgWin": "Ganho médio",
  "stats.avgLoss": "Perda média",
  "stats.lots": "Lotes",
  "stats.bestDay": "Melhor dia {date}: {amount}",

  // Registro de regras
  "events.title": "Registro de regras",
  "events.empty": "Nenhum aviso ou violação. Continue assim.",
  "events.equity": "patrimônio {amount}",
  "events.limit": "limite {amount}",
  "severity.breach": "Violação",
  "severity.violation": "Infração",
  "severity.warning": "Aviso",
  "severity.info": "Info",

  // Negociações fechadas
  "trades.title": "Negociações fechadas",
  "trades.all": "Todas ({count})",
  "trades.count": { one: "{count} negociação fechada", other: "{count} negociações fechadas" },
  "trades.empty": "Nenhuma negociação fechada ainda.",
  "trades.buy": "Compra",
  "trades.sell": "Venda",
  // Durações compactas: s = segundos, m = minutos, h = horas, d = dias
  "duration.s": "{s}s",
  "duration.ms": "{m}m {s}s",
  "duration.hm": "{h}h {m}m",
  "duration.dh": "{d}d {h}h",

  // Detalhes da conta
  "account.title": "Conta",
  "account.split": "Sua parte",
  "account.initial": "Saldo inicial",
  "account.started": "Início da fase",
  "account.ended": "Encerrada",
  "account.deadline": "Prazo final",
  "account.passwordNote": "As senhas de negociação foram exibidas uma única vez, na compra. Abrir em Negociar conecta você a esta conta sem elas.",

  // Pagamentos
  // exibição
  "payouts.title": "Pagamentos",
  "payouts.available": "Disponível agora",
  "payouts.eligibleCount": { one: "{eligible} de {count} conta financiada elegível", other: "{eligible} de {count} contas financiadas elegíveis" },
  "payouts.requests": { one: "{count} solicitação", other: "{count} solicitações" },
  "payouts.count": { one: "{count} pagamento", other: "{count} pagamentos" },
  "payouts.paidToDate": "Pago até hoje",
  "payouts.funded": "Contas financiadas",
  // exibição
  "payouts.account": "{size} financiada",
  "payouts.quote": "Simulação de pagamento",
  "payouts.eligibleNow": "Elegível agora",
  "payouts.notYet": "Ainda não",
  "payouts.toWallet": "para sua carteira",
  "payouts.yourSplit": "Sua parte",
  "payouts.firmShare": "Parte da empresa",
  "payouts.alreadyRefunded": "Já reembolsada",
  "payouts.withFirst": "Com o primeiro pagamento",
  "payouts.opens": "Liberado em {date}.",
  "payouts.minimum": "Mínimo de {amount}.",
  "payouts.kycNote": "Verifique sua identidade para solicitar este pagamento.",
  "payouts.kycPendingNote": "Você poderá solicitar este pagamento assim que sua verificação de identidade for aprovada.",
  "payouts.readOnly": "Esta sessão não pode solicitar pagamentos.",
  "payouts.request": "Solicitar pagamento",
  // Abre o painel de regras ao vivo da conta (na web, "Painel de regras"); curto: divide a linha com Negociar
  "payouts.dashboard": "Regras",
  "payouts.history": "Histórico",
  "payouts.historyEmpty": "Nenhum pagamento ainda.",
  // exibição
  "payouts.emptyTitle": "Nenhuma conta financiada",
  "payouts.emptyBody": "Seja aprovado em um desafio para obter uma conta financiada. Solicite pagamentos aqui quando ela tiver lucro elegível.",
  "payouts.emptyAction": "Seja financiado",
  "payoutStatus.pending": "Em análise",
  "payoutStatus.approved": "Aprovado",
  "payoutStatus.paid": "Pago",
  "payoutStatus.rejected": "Rejeitado",
  "payoutStatus.failed": "Falhou",
  "split.title": "Divisão de lucros e escalonamento",
  "split.upTo": "Até {pct}% com escalonamento",
  "split.cycle": "Pagamentos",
  // {days} ex.: "14 dias"
  "split.first": "Primeiro após {days}",
  "split.firstNow": "Desde o primeiro dia",
  // {months} ex.: "4 meses"; {cap} ex.: "$2,000,000"
  "scaling.text": "Obtenha {profit}% de lucro em {months} e a conta cresce {increase}%, até {cap}.",
  "scaling.none": "Este plano não escalona a conta.",
  "months": { one: "{count} mês", other: "{count} meses" },

  // Folha de solicitação de pagamento
  "request.eyebrow": "Solicitar pagamento",
  "request.profit": "Lucro na conta",
  "request.share": "Sua parte ({pct}%)",
  "request.feeRefund": "Reembolso da taxa do desafio",
  "request.total": "Total para sua carteira",
  "request.note": "Todo o lucro atual é retirado da conta de negociação agora, para que não se perca em negociações durante a análise. Após a aprovação, sua parte é creditada na sua carteira USDT; se a solicitação for rejeitada, o lucro volta para a conta.",
  "request.submit": "Solicitar {amount}",
  "request.done": "Pagamento solicitado",
  "request.doneBody": "{amount} irá para sua carteira USDT após a aprovação.",

  // Verificação de identidade (pagamentos)
  "kyc.verified": "Identidade verificada: os pagamentos podem ser aprovados.",
  "kyc.pendingTitle": "Verificação em análise",
  "kyc.pendingText": "Sua verificação está em análise. Você poderá solicitar pagamentos assim que sua identidade for verificada.",
  "kyc.requiredTitle": "Verifique sua identidade",
  "kyc.requiredText": "Os pagamentos são feitos apenas a traders verificados. Verifique-se antes do seu primeiro pagamento.",
  "kyc.rejectedText": "Sua verificação foi rejeitada. Envie-a novamente para receber pagamentos.",

  // Por que um pagamento ainda não pode ser solicitado
  "blocker.notYetEligible": "A janela de pagamento ainda não abriu.",
  "blocker.belowMinimum": "O lucro está abaixo do pagamento mínimo.",
  "blocker.positionsOpen": "Feche todas as posições abertas para solicitar um pagamento.",
  "blocker.payoutPending": "Um pagamento já está em análise.",
  "blocker.consistency": "Regra de consistência não cumprida: seu melhor dia representa uma parte grande demais do lucro.",

  // Certificados
  // exibição
  "certs.title": "Certificados",
  "certs.subtitle": "Cada fase aprovada, cada conta financiada e cada pagamento geram um certificado que qualquer pessoa pode verificar.",
  "certs.kind.pass": "Fase aprovada",
  "certs.kind.funded": "Trader financiado",
  "certs.kind.payout": "Pagamento",
  "certs.revoked": "Revogado",
  "certs.revokedBody": "Este certificado foi revogado pela Kalks e não é mais válido, por isso não pode ser compartilhado.",
  "certs.meta": "{plan} · {size} · {date}",
  "certs.number": "Nº {code}",
  "certs.shareImage": "Compartilhar imagem",
  "certs.shareLink": "Compartilhar link",
  "certs.copyLink": "Copiar link",
  "certs.linkCopied": "Link de verificação copiado",
  "certs.shareTitle": "Meu certificado Kalks Prop",
  "certs.shareMessage": "Meu certificado Kalks Prop. Verifique aqui:",
  "certs.shareFailed": "Não foi possível compartilhar o certificado. Tente novamente.",
  "certs.shareUnavailable": "O compartilhamento não está disponível neste dispositivo.",
  // exibição
  "certs.emptyTitle": "Nenhum certificado ainda",
  "certs.emptyBody": "Seja aprovado em uma fase do desafio para receber seu primeiro certificado, com um link público que qualquer pessoa pode verificar.",
  "certs.emptyAction": "Ver desafios",

  // Termos de regras compartilhados pela compra e pela folha de regras
  "accountSize": "Tamanho da conta",
  "profitSplit": "Divisão de lucros",
  "feeRefund": "Reembolso da taxa",
  "nonRefundable": "Não reembolsável",
  "leverage": "Alavancagem",
  "none": "Nenhum",
  "allowed": "Permitido",
  "notAllowed": "Não permitido",
  "noTimeLimit": "Sem prazo",
  // {phase} é o nome da fase, ex.: "Fase 1"
  "rules.phaseTarget": "Meta da {phase}",
  "rules.phaseMinDays": "Dias mínimos da {phase}",
  "rules.phaseTimeLimit": "Prazo da {phase}",
  "rules.evaluation": "Avaliação",
  "rules.evaluationNone": "Nenhuma, financiada desde o primeiro dia",
  "rules.dailyLoss": "Limite de perda diária",
  "rules.dailyLossBalance": "{pct}% · {amount} · a partir do saldo às 17:00 New York",
  "rules.dailyLossEquity": "{pct}% · {amount} · a partir do maior valor entre saldo e patrimônio às 17:00 New York",
  "rules.ddStatic": "{pct}% estático",
  "rules.ddTrailing": "{pct}% móvel",
  "rules.ddLocks": "{dd}, fixa no valor inicial",
  // ≤ = no máximo
  "rules.consistencyValue": "Melhor dia ≤ {pct}% do lucro total",
  "rules.news": "Negociação em notícias",
  "rules.newsBlocked": "Não dentro de ±{min} min de notícias de alto impacto",
  "rules.newsBlockedFails": "Não dentro de ±{min} min de notícias de alto impacto (reprova a conta)",
  "rules.weekendClosed": "Posições fechadas na sexta-feira às 16:45 New York",
  "rules.ea": "Expert Advisors",
  "rules.banned": "Estratégias proibidas",
  "rules.splitScaling": "{split}%, podendo chegar a {max}%",
  "rules.firstPayout": "Primeiro pagamento",
  // {freq} é um ciclo de pagamento em minúsculas, ex.: "semanal"
  "rules.firstPayoutValue": "Após {days}, depois {freq} · mín. {min}",
  "rules.refunded": "Reembolsada com o primeiro pagamento",

  // Estratégias de negociação proibidas
  "banned.hft": "Negociação de alta frequência",
  "banned.latencyArbitrage": "Arbitragem de latência",
  "banned.tickScalping": "Scalping de ticks",
  "banned.crossAccountCopying": "Cópia entre contas",
  "banned.crossAccountHedging": "Hedge entre contas",
  "banned.martingale": "Martingale",
  "banned.grid": "Negociação em grade",

  // Ciclo de pagamento, minúsculas: usado dentro de frases ("depois semanal")
  "payoutFreq.weekly": "semanal",
  "payoutFreq.biWeekly": "a cada 2 semanas",
  "payoutFreq.monthly": "mensal",
  "payoutFreq.onDemand": "sob demanda",

  // Erros (mensagens para os códigos de erro do serviço prop)
  "errorLink.deposit": "Depositar",
  "errorLink.verify": "Verificar identidade",
  "error.insufficientFunds": "O saldo da sua carteira USDT é insuficiente para esta taxa. Deposite USDT e tente novamente.",
  "error.kycRequired": "Verifique sua identidade antes de solicitar um pagamento.",
  "error.paymentPending": "Ainda não foi possível confirmar o pagamento pela carteira. Tente novamente em um minuto: você não será cobrado duas vezes.",
  "error.paymentFailed": "O pagamento pela carteira não foi concluído. Você não foi cobrado.",
  "error.walletPending": "A carteira ainda não confirmou. Tente novamente em um minuto.",
  "error.walletRejected": "A carteira recusou este pagamento. Entre em contato com o suporte.",
  "error.provisioning": "Pagamento recebido. Sua conta de negociação ainda está sendo aberta: ela aparecerá nos seus desafios em até um minuto.",
  "error.planUnavailable": "Este plano ou tamanho não está mais disponível. Escolha outro.",
  "error.notYetEligible": "Esta conta ainda não está elegível para pagamento.",
  "error.belowMinimum": "O lucro está abaixo do pagamento mínimo.",
  "error.positionsOpen": "Feche todas as posições abertas antes de solicitar um pagamento.",
  "error.payoutPending": "Um pagamento desta conta já está em análise.",
  "error.consistency": "A regra de consistência ainda não foi cumprida: seu melhor dia representa uma parte grande demais do lucro.",
  "error.notFunded": "Pagamentos estão disponíveis apenas em contas financiadas.",
  "error.accountUnavailable": "Não foi possível abrir a conta de negociação deste desafio, então a taxa foi reembolsada na sua carteira USDT. Fale com o suporte se isso continuar acontecendo.",
  "error.idempotencyConflict": "Esta compra já foi usada para outra aquisição. Feche-a e comece novamente.",
  "error.notActive": "Este desafio não está ativo.",
  "error.accountLimit": "Você atingiu o número máximo de contas prop. Entre em contato com o suporte para aumentar o limite.",
  "error.staffReadOnly": "Esta é uma sessão da equipe somente leitura. Alterações não são permitidas.",
  "error.engine": "O servidor de negociação não respondeu. Tente novamente em breve.",
  "error.generic": "Algo deu errado. Tente novamente.",
  // exibição
  "load.title": "Prop indisponível",
  "load.body": "Não foi possível conectar ao serviço prop. Suas contas estão seguras; tente novamente em instantes.",
};
export default mobileProp;
