import type { NsMessages } from "../../core";

// App móvel da Kalks: estrutura do app, onboarding e estados compartilhados por todas as telas.
const mobile: NsMessages<"mobile"> = {
  // Barra de abas (curto: uma palavra cada)
  "tab.home": "Início",
  "tab.markets": "Mercados",
  "tab.trade": "Negociar",
  "tab.portfolio": "Portfólio",
  "tab.more": "Mais",

  // Onboarding (3 telas). Títulos em maiúsculas altas: manter curtos.
  "onboarding.skip": "Pular",
  "onboarding.next": "Próximo",
  "onboarding.getStarted": "Começar",
  "onboarding.haveAccount": "Já tenho uma conta",
  "onboarding.welcome.title": "Entre nos mercados",
  "onboarding.welcome.body": "Forex, metais, índices, energia, cripto e ações em uma só conta, com depósitos instantâneos em USDT.",
  "onboarding.markets.title": "Cada tick, ao vivo",
  "onboarding.markets.body": "Preços bid e ask reais, seus próprios gráficos e Comprar e Vender com um toque, feitos para o celular.",
  "onboarding.security.title": "Proteção total",
  "onboarding.security.body": "Códigos por e-mail em novos dispositivos, códigos de confirmação para saques e um cofre seguro para sua sessão.",
  // Contador de telas, ex.: "1 de 3"
  "onboarding.step": "{n} de {total}",

  // Estados compartilhados
  "state.offline.title": "Sem conexão",
  "state.offline.body": "Verifique sua conexão com a internet. Os preços e sua conta se reconectam automaticamente.",
  "state.reconnecting": "Reconectando…",
  "state.error.title": "Algo deu errado",
  "state.error.body": "Não foi possível carregar. Puxe para baixo ou toque para tentar novamente.",
  "state.maintenance.title": "Em manutenção",
  "state.maintenance.body": "Estamos atualizando a Kalks. Suas posições e seus fundos estão seguros. Volte em instantes.",
  "state.sessionExpired": "Sua sessão terminou. Entre novamente.",
  "state.updated": "Atualizado {time}",
  "state.pullToRefresh": "Puxe para atualizar",

  "viewOnly": "Acesso somente leitura",
  "viewOnlyBody": "Este login pode ver as contas compartilhadas, mas não pode fazer alterações.",

  // Rótulos curtos comuns
  "action.retry": "Tentar novamente",
  "action.openWeb": "Abrir na Área do Cliente",
  "action.signOut": "Sair",
  "action.seeAll": "Ver tudo",
  "a11y.close": "Fechar",
  "a11y.back": "Voltar",
};
export default mobile;
