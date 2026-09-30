import type { NsMessages } from "../../core";

// App móvel da Kalks: login, cadastro e redefinição de senha (a maioria dos textos vem do namespace `auth`).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "Criar uma conta",
  "signIn.newHere": "Novo na Kalks?",
  "signUp.eyebrow": "Abra sua conta",
  "signUp.haveAccount": "Já tem uma conta?",
  "signUp.signIn": "Entrar",
  "signUp.dobPlaceholder": "AAAA-MM-DD",
  "signUp.dobHint": "Você precisa ter 18 anos ou mais.",
  "signUp.phonePlaceholder": "Número de telefone",
  "signUp.marketing": "Quero receber por e-mail dicas de trading, novidades e ofertas. Cancele quando quiser.",
  "signUp.chooseCountry": "Escolha seu país",
  "signUp.continue": "Continuar para a Kalks",
  "forgot.eyebrow": "Redefinição de senha",
  "forgot.continue": "Continuar",
  "otp.eyebrow": "Verificação de segurança",
  "otp.wrongEmail": "Usar outro e-mail",
  "googleSoon": "O login com Google está disponível na Área do Cliente, na web.",
};
export default mobileAuth;
