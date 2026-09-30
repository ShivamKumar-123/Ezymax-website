import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile): app shell, onboarding and the states every screen shares.
const mobile: NsMessages<"mobile"> = {
  // Tab bar (short: one word each)
  "tab.home": "Главная",
  "tab.markets": "Рынки",
  "tab.trade": "Торговля",
  "tab.portfolio": "Портфель",
  "tab.more": "Ещё",

  // Onboarding (3 slides). Titles are shown in tall uppercase display type: keep them short.
  "onboarding.skip": "Пропустить",
  "onboarding.next": "Далее",
  "onboarding.getStarted": "Начать",
  "onboarding.haveAccount": "У меня есть аккаунт",
  "onboarding.welcome.title": "Выходите на рынки",
  "onboarding.welcome.body": "Форекс, металлы, индексы, энергоносители, криптовалюты и акции на одном счёте с мгновенным пополнением в USDT.",
  "onboarding.markets.title": "Каждый тик онлайн",
  "onboarding.markets.body": "Реальные цены Bid и Ask, собственные графики и Buy и Sell в одно касание — всё создано для телефона.",
  "onboarding.security.title": "Под защитой",
  "onboarding.security.body": "Коды по эл. почте для новых устройств, коды подтверждения для вывода средств и защищённое хранилище для Вашего сеанса.",
  "onboarding.step": "{n} из {total}", // slide counter, e.g. "1 из 3"

  // Shared states
  "state.offline.title": "Соединение потеряно",
  "state.offline.body": "Проверьте подключение к интернету. Цены и Ваш счёт переподключатся автоматически.",
  "state.reconnecting": "Переподключение…",
  "state.error.title": "Что-то пошло не так",
  "state.error.body": "Не удалось загрузить данные. Потяните вниз или нажмите, чтобы повторить.",
  "state.maintenance.title": "Технические работы",
  "state.maintenance.body": "Мы обновляем Kalks. Ваши позиции и средства в безопасности. Пожалуйста, загляните чуть позже.",
  "state.sessionExpired": "Ваш сеанс завершён. Пожалуйста, войдите снова.",
  "state.updated": "Обновлено {time}",
  "state.pullToRefresh": "Потяните, чтобы обновить",

  "viewOnly": "Доступ только для просмотра",
  "viewOnlyBody": "С этим входом можно просматривать предоставленные счета, но нельзя вносить изменения.",

  // Common short labels
  "action.retry": "Повторить",
  "action.openWeb": "Открыть в личном кабинете",
  "action.signOut": "Выйти",
  "action.seeAll": "Смотреть все",
  "a11y.close": "Закрыть",
  "a11y.back": "Назад",
};
export default mobile;
