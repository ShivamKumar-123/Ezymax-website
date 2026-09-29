import type { NsMessages } from "../../core";

// Client Area support: live chat, launcher, support page.
const support: NsMessages<"support"> = {
  // Página de suporte
  "page.title": "Suporte",
  "page.subtitle": "Converse com a Kalks AI para obter respostas imediatas. Peça para falar com uma pessoa a qualquer momento e nossa equipe assume com a conversa completa.",
  "email.prefer": "Prefere e-mail?",
  // <email> e <id> envolvem o e-mail e o ID do cliente
  "email.writeFrom": "Escreva a partir de <email>{email}</email> e inclua seu ID de cliente <id>{id}</id>.",
  "email.write": "Escrever ao suporte",
  "email.copyId": "Copiar ID de cliente",
  clientId: "ID de cliente",
  notice: "As respostas da nossa equipe também aparecem no sino de notificações, e enviamos um e-mail quando você estiver ausente. Altere isso em Perfil → Notificações.",
  "toast.copied": "{what} copiado",
  "toast.copyFailed": "Não foi possível copiar, selecione o texto manualmente",

  // Status da conversa
  "status.bot": "Assistente de IA",
  "status.waiting": "Na fila",
  "status.assigned": "Com um atendente",
  "status.resolved": "Encerrada",

  // Histórico de conversas
  "history.title": "Suas conversas",
  "history.subtitle": "As transcrições ficam salvas na sua Área do Cliente",
  "history.emptyTitle": "Nenhuma conversa ainda",
  "history.emptyText": "Faça uma pergunta no chat e ela aparecerá aqui.",
  conversation: "Conversa",
  "toast.openFailed": "Não foi possível abrir a conversa",

  // Botão flutuante
  "launcher.open": "Abrir chat de suporte",
  "launcher.close": "Fechar chat de suporte",

  // Chat
  you: "Você",
  agent: "Atendente",
  // Nome padrão para um membro da equipe sem nome
  supportName: "Suporte",
  // Tamanho do arquivo, ex.: "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // Primeiras perguntas sugeridas (enviadas como mensagem do cliente)
  "quick.verify": "Como verifico minha identidade?",
  "quick.deposit": "Como deposito USDT?",
  "quick.withdrawal": "Quando meu saque vai chegar?",
  "quick.stopOut": "O que é stop-out?",
  "header.supportTeam": "Equipe de suporte",
  "header.agentSub": "Suporte ao Cliente · Kalks",
  "header.connecting": "Conectando você a um atendente…",
  "header.replySoon": "Nossa equipe responderá aqui em breve",
  "header.helpCentre": "Respostas da central de ajuda · uma pessoa pode entrar a qualquer momento",
  "header.instant": "Respostas imediatas · uma pessoa pode entrar a qualquer momento",
  "chip.liveAgent": "Atendente ao vivo",
  "menu.aria": "Opções do chat",
  "menu.talkToPerson": "Falar com uma pessoa",
  "menu.endChat": "Encerrar chat",
  "menu.newChat": "Iniciar novo chat",
  closeChat: "Fechar chat",
  unavailable: "O chat está indisponível no momento.",
  greeting: "Olá, {name}.",
  "csat.question": "Como foi este chat?",
  "csat.stars": { one: "{count} estrela", other: "{count} estrelas" },
  "csat.placeholder": "Algo a acrescentar? (opcional)",
  "csat.send": "Enviar avaliação",
  "csat.rated": "Você avaliou este chat com {rating}/5",
  "composer.attach": "Anexar arquivo",
  "composer.messageTo": "Mensagem para {name}…",
  "composer.newChat": "Iniciar um novo chat…",
  "composer.ask": "Pergunte qualquer coisa a {name}…",
  "composer.aria": "Mensagem",
  disclaimer: "{name} pode cometer erros e nunca oferece recomendações de investimento. Os chats são gravados para fins de qualidade.",
  "toast.chattingWith": "Você está conversando com {name}",
  "toast.inQueue": "Você está na fila para um atendente",
  "toast.notSent": "Mensagem não enviada",
  "toast.teamUnreachable": "Não foi possível contatar a equipe",
  "toast.endFailed": "Não foi possível encerrar o chat",
  "toast.rateFailed": "Avaliação não salva",
  "toast.thanks": "Obrigado pelo seu feedback",
  "toast.fileTooLarge": "Arquivo muito grande",
  "toast.fileTooLargeText": "Os arquivos podem ter até {mb} MB.",
  "toast.unsupported": "Arquivo não suportado",
  "toast.unsupportedText": "Anexe uma imagem (PNG, JPG, GIF, WEBP) ou um PDF.",
  "toast.uploadFailed": "Falha no envio",
  "error.uploadFailed": "Falha no envio.",
};
export default support;
