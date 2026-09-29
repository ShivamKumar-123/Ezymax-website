import type { NsMessages } from "../../core";

// Client Area support: live chat, launcher, support page.
const support: NsMessages<"support"> = {
  // Support page
  "page.title": "Поддержка",
  "page.subtitle": "Задайте вопрос Kalks AI и получите мгновенный ответ. В любой момент можно позвать сотрудника — он продолжит диалог с полной историей переписки.",
  "email.prefer": "Удобнее по почте?",
  "email.writeFrom": "Напишите с адреса <email>{email}</email> и укажите Ваш ID клиента <id>{id}</id>.",
  "email.write": "Написать в поддержку",
  "email.copyId": "Скопировать ID клиента",
  clientId: "ID клиента",
  notice: "Ответы нашей команды также появляются в уведомлениях, а если Вас нет на сайте, мы пришлём письмо. Настроить это можно в разделе Профиль → Уведомления.",
  "toast.copied": "{what}: скопировано",
  "toast.copyFailed": "Не удалось скопировать, выделите текст вручную",

  // Conversation status
  "status.bot": "ИИ-ассистент",
  "status.waiting": "В очереди",
  "status.assigned": "У сотрудника",
  "status.resolved": "Завершён",

  // Conversation history
  "history.title": "Ваши обращения",
  "history.subtitle": "Переписка хранится в Вашем Личном кабинете",
  "history.emptyTitle": "Обращений пока нет",
  "history.emptyText": "Задайте вопрос в чате, и он появится здесь.",
  conversation: "Обращение",
  "toast.openFailed": "Не удалось открыть обращение",

  // Floating button
  "launcher.open": "Открыть чат поддержки",
  "launcher.close": "Закрыть чат поддержки",

  // Chat
  you: "Вы",
  agent: "Сотрудник",
  supportName: "Поддержка",
  attachmentSize: "{size} КБ · PDF",
  // Suggested first questions (sent as the client's message)
  "quick.verify": "Как пройти верификацию?",
  "quick.deposit": "Как внести USDT?",
  "quick.withdrawal": "Когда поступит мой вывод?",
  "quick.stopOut": "Что такое стоп-аут?",
  "header.supportTeam": "Служба поддержки",
  "header.agentSub": "Поддержка клиентов · Kalks",
  "header.connecting": "Соединяем Вас с сотрудником…",
  "header.replySoon": "Наша команда скоро ответит здесь",
  "header.helpCentre": "Ответы из справочного центра · сотрудник может подключиться в любой момент",
  "header.instant": "Мгновенные ответы · сотрудник может подключиться в любой момент",
  "chip.liveAgent": "Сотрудник",
  "menu.aria": "Параметры чата",
  "menu.talkToPerson": "Связаться с сотрудником",
  "menu.endChat": "Завершить чат",
  "menu.newChat": "Начать новый чат",
  closeChat: "Закрыть чат",
  unavailable: "Чат сейчас недоступен.",
  greeting: "Здравствуйте, {name}.",
  "csat.question": "Как Вам этот чат?",
  "csat.stars": {
    one: "{count} звезда",
    few: "{count} звезды",
    many: "{count} звёзд",
    other: "{count} звезды",
  },
  "csat.placeholder": "Хотите что-то добавить? (необязательно)",
  "csat.send": "Отправить оценку",
  "csat.rated": "Ваша оценка чата: {rating}/5",
  "composer.attach": "Прикрепить файл",
  "composer.messageTo": "Сообщение для {name}…",
  "composer.newChat": "Начните новый чат…",
  "composer.ask": "Спросите {name} о чём угодно…",
  "composer.aria": "Сообщение",
  disclaimer: "{name} может ошибаться и никогда не даёт инвестиционных советов. Чаты записываются для контроля качества.",
  "toast.chattingWith": "Вы общаетесь с {name}",
  "toast.inQueue": "Вы в очереди к сотруднику",
  "toast.notSent": "Сообщение не отправлено",
  "toast.teamUnreachable": "Не удалось связаться с командой",
  "toast.endFailed": "Не удалось завершить чат",
  "toast.rateFailed": "Оценка не сохранена",
  "toast.thanks": "Спасибо за отзыв",
  "toast.fileTooLarge": "Файл слишком большой",
  "toast.fileTooLargeText": "Максимальный размер файла — {mb} МБ.",
  "toast.unsupported": "Неподдерживаемый файл",
  "toast.unsupportedText": "Прикрепите изображение (PNG, JPG, GIF, WEBP) или PDF.",
  "toast.uploadFailed": "Ошибка загрузки",
  "error.uploadFailed": "Ошибка загрузки.",
};
export default support;
