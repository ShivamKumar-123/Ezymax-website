import type { NsMessages } from "../../core";

// Kalks mobile app: sign in, sign up and password reset (most texts reuse the `auth` namespace).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "Создать аккаунт",
  "signIn.newHere": "Впервые в Kalks?",
  "signUp.eyebrow": "Откройте аккаунт",
  "signUp.haveAccount": "Уже есть аккаунт?",
  "signUp.signIn": "Войти",
  "signUp.dobPlaceholder": "ГГГГ-ММ-ДД",
  "signUp.dobHint": "Вам должно быть не менее 18 лет.",
  "signUp.phonePlaceholder": "Номер телефона",
  "signUp.marketing": "Присылать мне на почту торговые советы, новости продукта и предложения. Отписаться можно в любой момент.",
  "signUp.chooseCountry": "Выберите страну",
  "signUp.continue": "Перейти в Kalks",
  "forgot.eyebrow": "Сброс пароля",
  "forgot.continue": "Продолжить",
  "otp.eyebrow": "Проверка безопасности",
  "otp.wrongEmail": "Указать другую почту",
  "googleSoon": "Вход через Google доступен в личном кабинете на сайте.",
};
export default mobileAuth;
