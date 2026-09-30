import type { NsMessages } from "../../core";

// App móvel da Kalks: aba Início. Títulos em maiúsculas altas: manter curtos.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "Bom dia, {name}",
  "greet.afternoon": "Boa tarde, {name}",
  "greet.evening": "Boa noite, {name}",
  equity: "Patrimônio",
  closedToday: "Realizado hoje",
  openPnl: "L/P em aberto",
  allLive: "Todas as contas reais {amount}",
  "quick.deposit": "Depositar",
  "quick.withdraw": "Sacar",
  "quick.transfer": "Transferir",
  "quick.trade": "Negociar",
  movers: "Maiores variações",
  news: "Manchetes",
  allNews: "Todas as notícias",
  notifications: "Notificações",
  "kyc.title": "Verifique sua identidade",
  "kyc.body": "A verificação libera a negociação real e os saques. Leva poucos minutos.",
  "kyc.pending": "Verificação em análise",
  "kyc.pendingBody": "Estamos conferindo seus documentos. Você será notificado quando terminarmos.",
  "kyc.action": "Continuar",
  "noAccount.title": "Abra sua primeira conta",
  "noAccount.body": "Uma conta demo fica pronta em segundos, com fundos virtuais. Passe para a real quando estiver pronto.",
  "noAccount.action": "Abrir uma conta",
  "news.empty": "Nenhuma manchete no momento.",
  "a11y.bell": "Notificações, {count} não lidas",

  // Explorar: um bloco de cor por módulo (título em fonte de destaque, no máximo duas linhas curtas; dica em duas linhas)
  "explore.title": "Explorar",
  "explore.copy": "Copy trading",
  "explore.copyHint": "Siga traders de sucesso",
  "explore.prop": "Desafio Prop",
  "explore.propHint": "Seja financiado para negociar",
  "explore.academy": "Academia",
  "explore.academyHint": "Aprenda a negociar, passo a passo",
  "explore.ai": "AI Trader",
  "explore.aiHint": "Transforme uma ideia em estratégia",
  "explore.invite": "Convide amigos",
  "explore.inviteHint": "Ganhe quando eles negociarem",
};
export default mobileHome;
