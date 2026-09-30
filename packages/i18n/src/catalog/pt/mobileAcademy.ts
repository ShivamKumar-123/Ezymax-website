import type { NsMessages } from "../../core";

// App móvel da Kalks: telas da Academia (fases, leitor de capítulos, quizzes, provas finais, glossário, progresso e
// certificados). A maioria dos textos vem do namespace `academy`; aqui ficam só os textos do celular.
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Linha pequena em maiúsculas acima do título da Academia
  eyebrow: "Academia Kalks",
  // Abaixo do título; {count} = número de capítulos
  "home.subtitle": "{count} capítulos em oito fases, com quizzes, provas finais e certificados.",
  // Blocos com números grandes no início da Academia (rótulos curtos abaixo de um número)
  "stats.chapters": "Capítulos concluídos",
  "stats.streakDays": "Dias seguidos",
  "stats.certificates": "Certificados",
  // {n} = número da fase, {title} = título da fase
  "home.phaseA11y": "Fase {n}: {title}",

  // Leitor de capítulos
  "reader.updated": "Atualizado em {date}",
  "reader.completedOn": "Concluído em {date}",
  "reader.upNext": "A seguir",
  "reader.completeHint": "Seja aprovado no quiz para concluir este capítulo.",
  "reader.zoomHint": "Abre o diagrama em tela cheia",
  "reader.tapToZoom": "Toque para ampliar",
  "reader.zoomHelp": "Pince ou toque duas vezes para ampliar",

  // Praticar o exercício do capítulo na aba Negociar do app; {login} = número da conta demo
  "practice.title": "Pratique em demo",
  "practice.onDemo": "Negociar na demo #{login}",

  // Tela da prova final
  "exam.answerAll": "Responda a todas as questões para enviar.",

  // Glossário; "termos" é o rótulo pequeno ao lado do número grande de termos
  "glossary.terms": { one: "termo em linguagem simples", other: "termos em linguagem simples" },
  "glossary.letters": "Índice alfabético",
  "glossary.openTerm": "Abre a definição",

  // Certificados
  "cert.share": "Compartilhar",
  // Texto compartilhado; {brand} = nome da corretora, {n} = número da fase, {title} = título da fase, {url} = link de verificação
  "cert.shareText": "Meu certificado da Academia {brand}, Fase {n}, {title}: {url}",
  "cert.imageA11y": "Certificado da Fase {n}",

  // Rótulos de acessibilidade
  "a11y.glossary": "Abrir o glossário",
  "a11y.progress": "Meu progresso",
  "a11y.contents": "Conteúdo do capítulo",

  // Estados
  "state.viewer.title": "Não compartilhado com você",
  "state.viewer.body": "A Academia não faz parte do que foi compartilhado com este login somente leitura.",
  "state.disabled.title": "Indisponível",
  "state.disabled.body": "A Academia não está disponível na sua conta.",
};
export default mobileAcademy;
