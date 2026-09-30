import type { NsMessages } from "../../core";

// Kalks mobile app: Home tab. Headings are shown in tall uppercase display type: keep them short.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "Доброе утро, {name}",
  "greet.afternoon": "Добрый день, {name}",
  "greet.evening": "Добрый вечер, {name}",
  equity: "Средства",
  closedToday: "Закрыто сегодня",
  openPnl: "Открытый P&L",
  allLive: "Все реальные счета {amount}",
  "quick.deposit": "Пополнить",
  "quick.withdraw": "Вывести",
  "quick.transfer": "Перевести",
  "quick.trade": "Торговать",
  movers: "Лидеры движения",
  news: "Заголовки",
  allNews: "Все новости",
  notifications: "Уведомления",
  "kyc.title": "Подтвердите личность",
  "kyc.body": "Верификация открывает реальную торговлю и вывод средств. Это займёт несколько минут.",
  "kyc.pending": "Верификация на проверке",
  "kyc.pendingBody": "Мы проверяем Ваши документы. Вы получите уведомление, когда проверка завершится.",
  "kyc.action": "Продолжить",
  "noAccount.title": "Откройте первый счёт",
  "noAccount.body": "Демо-счёт с виртуальными средствами будет готов за секунды. Переходите на реальный, когда будете готовы.",
  "noAccount.action": "Открыть счёт",
  "news.empty": "Сейчас заголовков нет.",
  "a11y.bell": "Уведомления, непрочитанных: {count}",

  // Explore: one colour block per module (title in display type on two short lines at most, hint on two lines)
  "explore.title": "Возможности",
  "explore.copy": "Копитрейдинг",
  "explore.copyHint": "Копируйте опытных трейдеров",
  "explore.prop": "Проп-челлендж",
  "explore.propHint": "Получите капитал для торговли",
  "explore.academy": "Академия",
  "explore.academyHint": "Учитесь торговать шаг за шагом",
  "explore.ai": "AI Trader",
  "explore.aiHint": "Превратите идею в стратегию",
  "explore.invite": "Пригласите друзей",
  "explore.inviteHint": "Зарабатывайте на их торговле",
};
export default mobileHome;
