import type { NsMessages } from "../../core";

// App móvel da Kalks (src/features/platform): caixa de notificações, notificações push, bloqueio do app
// (Face ID / impressão digital / código do celular), "Continuar com Google" e links que abrem o app.
// Nomes de marcas e produtos mantidos: Kalks, Face ID, Touch ID, Google.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // Caixa de notificações (/notifications). Cabeçalhos de dia acima de cada grupo: Hoje, Ontem e depois a data.
  "inbox.eyebrow": "Caixa de entrada",
  "inbox.unread": { one: "{count} não lida", other: "{count} não lidas" },
  "inbox.caughtUp": "Tudo em dia",
  "inbox.filter.unread": "Não lidas",
  "inbox.markedAll": "Todas marcadas como lidas",
  "inbox.emptyUnread.title": "Tudo em dia",
  "inbox.emptyUnread.body": "Você leu todas as notificações. As novas aparecem aqui assim que chegarem.",
  "inbox.loadMoreFailed": "Não foi possível carregar as notificações anteriores. Toque para tentar novamente.",
  // Abaixo do título quando o celular está offline e a caixa mostra o que salvou antes
  "inbox.offlineCached": "Você está offline. Estas são as notificações salvas neste celular.",
  // Acessibilidade da linha: "Não lida. Depósito creditado. 100 USDT foram creditados. há 2 minutos"
  "inbox.a11y.unread": "Não lida",
  "inbox.a11y.settings": "Configurações de notificação",
  // Detalhes de uma notificação sem tela para abrir
  "inbox.detail.openWeb": "Abrir link",
  "inbox.detail.received": "Recebida em {time}",

  // Pedido de permissão para push (nunca na primeira abertura): uma folha no Início e um card na caixa de entrada
  "push.ask.eyebrow": "Notificações",
  "push.ask.title": "Saiba na hora",
  "push.ask.body": "Depósitos creditados, saques pagos, margin calls, stop outs e respostas do suporte, direto na sua tela de bloqueio.",
  "push.ask.point.money": "Depósitos e saques",
  "push.ask.point.risk": "Margin calls e stop outs",
  "push.ask.point.support": "Respostas do suporte",
  "push.ask.allow": "Ativar notificações",
  "push.ask.later": "Agora não",
  "push.ask.note": "Você escolhe os tópicos em Perfil › Notificações. Ofertas só são enviadas se você ativá-las.",
  // Notificação de exemplo desenhada no pedido, como apareceria na tela de bloqueio ("agora" = rótulo de horário)
  "push.ask.now": "agora",
  "push.ask.sampleTitle": "Depósito creditado",
  "push.ask.sampleBody": "250.00 USDT foram creditados na sua carteira.",
  "push.card.title": "Ative as notificações push",
  "push.card.body": "Receba depósitos, execuções e margin calls na sua tela de bloqueio.",
  "push.card.action": "Ativar",
  "push.card.deniedTitle": "As notificações push estão desativadas",
  "push.card.deniedBody": "Permita as notificações da Kalks nas configurações do celular para recebê-las na tela de bloqueio.",
  "push.card.deniedAction": "Abrir configurações",
  "push.card.dismiss": "Ocultar",
  "push.enabled": "Notificações push ativadas",
  // Canais de notificação do Android (exibidos nas configurações do app no celular)
  "push.channel.alerts": "Margin calls e segurança",
  "push.channel.alertsHint": "Avisos de margin call e stop out, seus alertas de preço, novos logins",
  "push.channel.activity": "Atividade da conta",
  "push.channel.activityHint": "Depósitos, saques, execuções, verificação e respostas do suporte",
  "push.channel.news": "Notícias e ofertas",
  "push.channel.newsHint": "Promoções e novidades de produto que você escolheu receber",
  // Aviso no app para um push que chega com o app aberto
  "push.banner.a11y": "Nova notificação: {title}. Toque duas vezes para abrir.",

  // Tela de bloqueio do app (abertura, após o tempo escolhido em segundo plano e /lock)
  "lock.eyebrow": "Bloqueado",
  "lock.title": "Bem-vindo de volta",
  "lock.subtitle": "Desbloqueie para ver suas contas e saldos.",
  // {method}: Face ID, Touch ID, impressão digital, desbloqueio facial ou código do celular
  "lock.unlockWith": "Desbloquear com {method}",
  "lock.unlock": "Desbloquear",
  "lock.prompt": "Desbloquear a Kalks",
  "lock.promptSubtitle": "Confirme que é você",
  "lock.failed": "Não funcionou. Tente novamente.",
  "lock.lockout": "Muitas tentativas. Desbloqueie o celular com o código dele e tente novamente.",
  "lock.noScreenLock": "Seu celular não tem mais bloqueio de tela, então a Kalks não consegue confirmar que é você. Saia e entre com sua senha.",
  "lock.notYou": "Não é você ou não consegue desbloquear?",
  "lock.signOut": "Sair",
  "lock.signOutTitle": "Sair da Kalks?",
  "lock.signOutBody": "Você entrará novamente com seu e-mail e sua senha. Suas posições e seus fundos não são afetados.",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "impressão digital",
  "lock.method.face": "desbloqueio facial",
  "lock.method.iris": "íris",
  "lock.method.passcode": "código do celular",

  // Configurações › Bloqueio do app (/settings/app-lock)
  "settings.eyebrow": "Segurança",
  "settings.title": "Bloqueio do app",
  "settings.subtitle": "Mantenha a Kalks bloqueada com {method} ao abrir e depois de ficar em segundo plano.",
  "settings.toggle": "Bloquear a Kalks",
  "settings.toggleHint": "Usa {method}, com o código do celular como alternativa",
  "settings.on": "Bloqueio do app ativado",
  "settings.off": "Bloqueio do app desativado",
  "settings.after": "Bloquear novamente após",
  "settings.afterHint": "Quanto tempo a Kalks pode ficar em segundo plano antes de pedir de novo. Ela sempre pede ao iniciar.",
  "settings.timeout.0": "Imediatamente",
  "settings.timeout.60": "1 minuto",
  "settings.timeout.300": "5 minutos",
  "settings.timeout.900": "15 minutos",
  "settings.timeout.3600": "1 hora",
  "settings.privacy": "Com o bloqueio do app ativado, o alternador de apps mostra uma capa em vez dos seus saldos.",
  "settings.lockNow": "Bloquear agora",
  "settings.confirmOn": "Confirme para ativar o bloqueio do app",
  "settings.confirmOff": "Confirme para desativar o bloqueio do app",
  // Pedido do sistema quando o leitor escolhe um tempo maior em "Bloquear novamente após"
  "settings.confirmTimeout": "Confirme para alterar quando a Kalks é bloqueada",
  // Aviso após um login com senha em um celular cujo bloqueio de tela foi removido (o bloqueio do app depende dele)
  "settings.turnedOffNoScreenLock": "Este celular não tem bloqueio de tela, então a Kalks não consegue confirmar que é você. Configure um nas configurações do celular para usar o bloqueio do app de novo.",
  "settings.notConfirmed": "Não confirmado, nada foi alterado",
  "settings.unavailableTitle": "Configure um bloqueio de tela primeiro",
  "settings.unavailableBody": "O bloqueio do app usa o Face ID, a impressão digital ou o código do celular. Ative um deles nas configurações do celular e volte aqui.",
  "settings.webTitle": "Disponível no app",
  "settings.webBody": "O bloqueio do app funciona no app Kalks para iPhone e Android.",
  "settings.thisPhone": "Vale apenas para este celular",

  // Links que abrem o app (kalks://…, toques em notificações) mas não correspondem a nenhuma tela
  "link.notFound.title": "Nada para abrir aqui",
  "link.notFound.body": "Este link não corresponde a nenhuma tela do app. Ele pode ser antigo ou ser destinado à Área do Cliente na web.",
  "link.notFound.home": "Ir para o Início",
  "link.openFailed": "Não foi possível abrir este link.",
};
export default mobilePlatform;
