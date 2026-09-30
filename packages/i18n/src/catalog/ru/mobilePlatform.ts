import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile, src/features/platform): the notifications inbox, push notifications, the app lock
// (Face ID / fingerprint / the phone's passcode), "Continue with Google" and links that open the app.
// Keep brand and product names as they are: Kalks, Face ID, Touch ID, Google.
// lock.method.* are inserted after "через" and on their own, so they stay in the nominative (= accusative) form.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // Notifications inbox (/notifications). Day headers above each group: Today, Yesterday, then the date.
  "inbox.eyebrow": "Входящие",
  "inbox.unread": {
    one: "{count} непрочитанное",
    few: "{count} непрочитанных",
    many: "{count} непрочитанных",
    other: "{count} непрочитанного",
  },
  "inbox.caughtUp": "Всё прочитано",
  "inbox.filter.unread": "Непрочитанные",
  "inbox.markedAll": "Все отмечены как прочитанные",
  "inbox.emptyUnread.title": "Всё прочитано",
  "inbox.emptyUnread.body": "Вы прочитали все уведомления. Новые появятся здесь по мере поступления.",
  "inbox.loadMoreFailed": "Не удалось загрузить более ранние уведомления. Нажмите, чтобы повторить.",
  // Under the title while the phone is offline and the inbox shows what it saved earlier
  "inbox.offlineCached": "Нет подключения к сети. Показаны уведомления, сохранённые на этом телефоне.",
  // Row accessibility: "Не прочитано. Пополнение зачислено. …"
  "inbox.a11y.unread": "Не прочитано",
  "inbox.a11y.settings": "Настройки уведомлений",
  // Detail sheet of a notification without a screen to open
  "inbox.detail.openWeb": "Открыть ссылку",
  "inbox.detail.received": "Получено {time}",

  // Asking for push permission (never on the first launch): a sheet on Home and a card in the inbox
  "push.ask.eyebrow": "Уведомления",
  "push.ask.title": "Узнавайте обо всём сразу",
  "push.ask.body": "Зачисленные пополнения, выплаченные выводы, маржин-коллы, стоп-ауты и ответы поддержки — прямо на экране блокировки.",
  "push.ask.point.money": "Пополнения и выводы",
  "push.ask.point.risk": "Маржин-коллы и стоп-ауты",
  "push.ask.point.support": "Ответы поддержки",
  "push.ask.allow": "Включить уведомления",
  "push.ask.later": "Не сейчас",
  "push.ask.note": "Темы выбираются в разделе Профиль › Уведомления. Предложения приходят, только если Вы их включите.",
  // The sample notification drawn in the ask, as it would look on the lock screen ("now" = its time label)
  "push.ask.now": "сейчас",
  "push.ask.sampleTitle": "Пополнение зачислено",
  "push.ask.sampleBody": "На Ваш кошелёк зачислено 250,00 USDT.",
  "push.card.title": "Включите push-уведомления",
  "push.card.body": "Пополнения, исполнения ордеров и маржин-коллы — на экране блокировки.",
  "push.card.action": "Включить",
  "push.card.deniedTitle": "Push-уведомления выключены",
  "push.card.deniedBody": "Разрешите уведомления для Kalks в настройках телефона, чтобы получать их на экране блокировки.",
  "push.card.deniedAction": "Открыть настройки",
  "push.card.dismiss": "Скрыть",
  "push.enabled": "Push-уведомления включены",
  // Android notification channels (shown in the phone's settings for the app)
  "push.channel.alerts": "Маржин-коллы и безопасность",
  "push.channel.alertsHint": "Предупреждения о маржин-колле и стоп-ауте, Ваши ценовые оповещения, новые входы",
  "push.channel.activity": "Активность по счёту",
  "push.channel.activityHint": "Пополнения, выводы, исполнения ордеров, верификация и ответы поддержки",
  "push.channel.news": "Новости и предложения",
  "push.channel.newsHint": "Акции и новости продукта, на которые Вы подписались",
  // In-app banner for a push that arrives while the app is open
  "push.banner.a11y": "Новое уведомление: {title}. Дважды коснитесь, чтобы открыть.",

  // App lock screen (cold start, after the chosen time in the background, and /lock)
  "lock.eyebrow": "Заблокировано",
  "lock.title": "С возвращением",
  "lock.subtitle": "Разблокируйте, чтобы увидеть свои счета и балансы.",
  // {method}: Face ID, Touch ID, отпечаток пальца, распознавание лица или код разблокировки
  "lock.unlockWith": "Разблокировать через {method}",
  "lock.unlock": "Разблокировать",
  "lock.prompt": "Разблокировать Kalks",
  "lock.promptSubtitle": "Подтвердите, что это Вы",
  "lock.failed": "Не получилось. Попробуйте ещё раз.",
  "lock.lockout": "Слишком много попыток. Разблокируйте телефон кодом, затем попробуйте снова.",
  "lock.noScreenLock": "На телефоне больше нет блокировки экрана, поэтому Kalks не может подтвердить, что это Вы. Выйдите и войдите снова с паролем.",
  "lock.notYou": "Это не Вы или не удаётся разблокировать?",
  "lock.signOut": "Выйти",
  "lock.signOutTitle": "Выйти из Kalks?",
  "lock.signOutBody": "Вы снова войдёте с эл. почтой и паролем. Ваши позиции и средства это не затронет.",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "отпечаток пальца",
  "lock.method.face": "распознавание лица",
  "lock.method.iris": "сканер радужки",
  "lock.method.passcode": "код разблокировки",

  // Settings › App lock (/settings/app-lock)
  "settings.eyebrow": "Безопасность",
  "settings.title": "Блокировка приложения",
  "settings.subtitle": "Kalks блокируется при запуске и после работы в фоне. Разблокировка — через {method}.",
  "settings.toggle": "Блокировать Kalks",
  "settings.toggleHint": "Через {method}; запасной вариант — код разблокировки телефона",
  "settings.on": "Блокировка приложения включена",
  "settings.off": "Блокировка приложения выключена",
  "settings.after": "Блокировать снова через",
  "settings.afterHint": "Сколько Kalks может оставаться в фоне, прежде чем снова запросит разблокировку. При запуске запрос есть всегда.",
  "settings.timeout.0": "Сразу",
  "settings.timeout.60": "1 минута",
  "settings.timeout.300": "5 минут",
  "settings.timeout.900": "15 минут",
  "settings.timeout.3600": "1 час",
  "settings.privacy": "Пока блокировка включена, в переключателе приложений вместо балансов показывается заставка.",
  "settings.lockNow": "Заблокировать сейчас",
  "settings.confirmOn": "Подтвердите включение блокировки",
  "settings.confirmOff": "Подтвердите отключение блокировки",
  // System prompt when the reader picks a longer "Lock again after" time
  "settings.confirmTimeout": "Подтвердите изменение времени блокировки",
  // Toast body after a password sign-in on a phone whose screen lock was removed (the app lock can't work without it)
  "settings.turnedOffNoScreenLock": "На этом телефоне нет блокировки экрана, поэтому Kalks не может подтвердить, что это Вы. Настройте её в параметрах телефона, чтобы снова пользоваться блокировкой приложения.",
  "settings.notConfirmed": "Не подтверждено, ничего не изменилось",
  "settings.unavailableTitle": "Сначала настройте блокировку экрана",
  "settings.unavailableBody": "Блокировка приложения использует Face ID, отпечаток пальца или код разблокировки телефона. Включите один из способов в настройках телефона и вернитесь.",
  "settings.webTitle": "Доступно в приложении",
  "settings.webBody": "Блокировка работает в приложении Kalks для iPhone и Android.",
  "settings.thisPhone": "Действует только на этом телефоне",

  // Links that open the app (kalks://…, notification taps) but match no screen
  "link.notFound.title": "Здесь нечего открыть",
  "link.notFound.body": "Эта ссылка не ведёт ни на один экран приложения. Возможно, она устарела или предназначена для личного кабинета на сайте.",
  "link.notFound.home": "На главную",
  "link.openFailed": "Не удалось открыть эту ссылку.",
};
export default mobilePlatform;
