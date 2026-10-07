import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // Page header (Client Area home)
  "greeting.morning": "Доброе утро, {name}",
  "greeting.afternoon": "Добрый день, {name}",
  "greeting.evening": "Добрый вечер, {name}",
  "greeting.welcome": "Добро пожаловать, {name}",
  "subtitle.live": "Добро пожаловать в Kalks. Здесь Ваш аккаунт и рынки на сегодня.",
  "subtitle.demo": "Результаты Ваших счетов за сегодня.",
  launchTrader: "Запустить Kalks Trader",
  openTerminal: "Открыть торговый терминал",

  // Getting started checklist
  "steps.title": "Первые шаги",
  "steps.subtitle": "Ваш путь к реальной торговле",
  "steps.progress": "{done} из {total}",
  "steps.account.title": "Создайте аккаунт",
  "steps.account.text": "Регистрация: {date}.",
  "steps.email.title": "Подтвердите эл. почту",
  "steps.email.verified": "Адрес {email} подтверждён.",
  "steps.email.confirm": "Подтвердите {email} кодом, который мы Вам отправили.",
  "steps.kyc.title": "Подтвердите личность",
  "steps.kyc.verified": "Ваша личность подтверждена. Вывод средств доступен.",
  "steps.kyc.moreInfo": "Нашей команде нужен от Вас ещё один документ.",
  "steps.kyc.review": "Ваши документы проверяет отдел верификации.",
  "steps.kyc.draft": "Продолжите с того места, где остановились. Это займёт около 3 минут.",
  "steps.kyc.rejected": "Нам не удалось проверить Ваши документы. Вы можете начать заново.",
  "steps.kyc.todo": "Займёт около 3 минут. Открывает доступ к выводу средств.",
  "steps.accountOpen.title": "Откройте торговый счёт",
  "steps.accountOpen.opened": {
    one: "Открыто счетов: реальных — {live}, демо — {demo}.",
    few: "Открыто счетов: реальных — {live}, демо — {demo}.",
    many: "Открыто счетов: реальных — {live}, демо — {demo}.",
    other: "Открыто счетов: реальных — {live}, демо — {demo}.",
  },
  "steps.accountOpen.todo": "Откройте реальный или демо-счёт; логин выдаётся мгновенно.",
  "steps.wallet.title": "Пополните кошелёк",
  "steps.wallet.text": "Пополнение в USDT через TRC20 скоро будет подключено.",
  // Step status chips
  "steps.state.done": "Готово",
  "steps.state.todo": "Сделать",
  "steps.state.review": "На проверке",
  "steps.state.rejected": "Отклонено",
  "steps.state.soon": "Не начато",

  // Trading accounts card
  "accounts.title": "Торговые счета",
  "accounts.summary": "Реальные средства <b>{equity}</b> · реальных: {live} · демо: {demo} · открытых позиций: {positions}",
  "accounts.subtitle": "Ваши реальные и демо-счета",
  "accounts.all": "Все счета",
  "accounts.open": "Открыть счёт",
  "accounts.unavailable": "Торговые счета сейчас недоступны. Ваши средства в безопасности.",
  "accounts.openLive.title": "Открыть реальный счёт",
  "accounts.openLive.text": "Реальные рынки. Счёт открывается с нулевым балансом; пополните его из кошелька.",
  "accounts.openDemo.title": "Открыть демо-счёт",
  "accounts.openDemo.text": "Виртуальные средства на реальных котировках, пополнение каждый день.",
  "accounts.more": {
    one: "Ещё {count} счёт",
    few: "Ещё {count} счёта",
    many: "Ещё {count} счетов",
    other: "Ещё {count} счёта",
  },
  "accounts.myTitle": "Мои торговые счета",

  // Your account card
  "account.title": "Ваш аккаунт",
  "account.clientId": "ID клиента",
  "account.emailStatus": "Статус почты",
  "account.notVerified": "Не подтверждена",
  "account.identity": "Личность",
  "account.memberSince": "Клиент с",
  "account.profile": "Профиль",

  // Kalks Trader banner
  "trader.chip": "Котировки онлайн",
  "trader.text": "Котировки и графики в реальном времени по {count} инструментам: форекс, металлы, индексы, энергоносители, криптовалюты и акции. Работает в браузере, ничего не нужно устанавливать.",

  // Market clock / heatmap
  "sessions.title": "Торговые сессии",
  "sessions.open": "Открыто рынков: {open} из {total}",
  "heatmap.title": "Тепловая карта рынка",
  "heatmap.subtitle": "Изменение за сегодня по текущим ценам · пустая точка: рынок закрыт",
  "heatmap.up": "Рост: {count}",
  "heatmap.down": "Падение: {count}",
  "heatmap.allMarkets": "Все рынки",
  "heatmap.tipOpen": "{symbol} · рынок открыт",
  "heatmap.tipClosed": "{symbol} · рынок закрыт, изменение за прошлую сессию",

  // Support card
  "support.title": "Нужна помощь?",
  "support.text": "Напишите на <mail>{email}</mail> с адреса, указанного при регистрации, и укажите Ваш ID клиента.",
  "support.emailSupport": "Написать в поддержку",
  "support.copied": "Адрес скопирован",
  "support.copyFailed": "Не удалось скопировать, выделите адрес вручную",

  // Demo dashboard: onboarding strip
  "onboarding.title": "Завершите настройку аккаунта",
  "onboarding.text": "Пройдите KYC, чтобы открыть вывод средств и повышенные лимиты.",
  "onboarding.progress": "Прогресс",
  "onboarding.dismiss": "Скрыть",

  // Margin health
  "margin.title": "Состояние маржи",
  "margin.subtitle": "По всем реальным счетам",
  "margin.healthy": "В норме",
  "margin.level": "Уровень маржи",
  "margin.used": "Маржа",
  "margin.free": "Свободная маржа",

  // Equity / P&L
  "equity.title": "Общие средства",
  "equity.changeOver": "Изменение за {range}",
  "pnl.title": "Прибыль / убыток · месяц",
  "pnl.lowRisk": "Низкий риск",
  "pnl.winRate": "Доля прибыльных (30 дн.)",
  "pnl.trades": "Сделки (30 дн.)",
  "pnl.avgWin": "Средняя прибыльная сделка",
  "pnl.avgLoss": "Средняя убыточная сделка",
  "pnl.charges": "Уплачено сборов",

  // KPI cards
  "kpi.wallet": "Кошелёк",
  "kpi.today": "+{pct}% сегодня",
  "kpi.monthPnl": "P&L за месяц",
  "kpi.vsLastMonth": "+{pct}% к прошлому месяцу",
  "kpi.partnerEarnings": "Партнёрский доход",
  "kpi.copy": "Copy {amount}",

  // Top movers
  "movers.title": "Лидеры движения",
  "movers.gainers": "Рост",
  "movers.losers": "Падение",

  // Economic calendar. A = Actual, F = Forecast, P = Previous
  "calendar.title": "Экономический календарь",
  "calendar.subtitle": "Сегодня · время сервера GMT+3",
  "calendar.actual": "Ф {value} · ",
  "calendar.forecastPrevious": "П {forecast} · Пр {previous}",

  // News / world
  "news.title": "Новости рынков",
  "news.all": "Все новости",
  "news.pinned": "Закреплено",
  "world.title": "Рынки и новости по всему миру",
  "world.subtitle": "Свежие заголовки по странам и настроения по валютам",
  "world.stories": {
    one: "{count} новость сегодня",
    few: "{count} новости сегодня",
    many: "{count} новостей сегодня",
    other: "{count} новости сегодня",
  },

  // Open positions
  "positions.title": "Открытые позиции",
  "positions.summary": {
    one: "{count} позиция · плавающий P&L",
    few: "{count} позиции · плавающий P&L",
    many: "{count} позиций · плавающий P&L",
    other: "{count} позиции · плавающий P&L",
  },
  "positions.terminal": "Терминал",

  // Partner banner
  "partner.chip": "Партнёрская программа",
  "partner.title": "Приглашайте трейдеров. Получайте до $15 за лот — пожизненно.",
  "partner.text": "Многоуровневые комиссии, CPA-бонусы и отслеживание в реальном времени. Ваша ссылка: <link>{url}</link>",
  "partner.open": "Открыть кабинет партнёра",

  // Short relative times
  "time.justNow": "Только что",
  "time.minutesAgo": "{count} мин назад",
  "time.hoursAgo": "{count} ч назад",
  "time.daysAgo": "{count} дн. назад",
  "time.ago": "{time} назад",

  // Notifications bell / panel
  "notifications.title": "Уведомления",
  "notifications.ariaUnread": "Уведомления, непрочитанных: {count}",
  "notifications.markAll": "Прочитать все",
  "notifications.clear": "Очистить",
  "notifications.emptyTitle": "Уведомлений пока нет",
  "notifications.emptyText": "Здесь появятся пополнения, выводы, верификация, торговые оповещения и ответы поддержки.",
  "notifications.settings": "Настройки уведомлений",

  // Client Area redesign: side menu, dashboard overview
  "chrome.expand": "Развернуть меню",
  "chrome.collapse": "Свернуть меню",
  "chrome.menu": "Меню",
  "home.todayPnl": "P&L за сегодня",
  "home.walletBalance": "Баланс кошелька",
  "home.rewardsEarnings": "Бонусы и доход IB",
  "home.todayPct": "{pct}% сегодня",
  "home.floating": "Плавающий P&L",
  "home.rewards": "Бонусы",
  "home.accountsChip": "{live} реальных · {positions} открытых позиций",
  "home.statistics": "Статистика",
  "home.pnl": "P&L",
  "home.weekly": "Неделя",
  "home.monthly": "Месяц",
  "home.lastYear": "Прошлый год",
  "home.noHistory": "История эквити появится здесь, когда на ваших реальных счетах будет активность.",
  "home.thisPeriod": "Этот период",
  "home.previousPeriod": "Предыдущий период",
  "home.yourAccounts": "Ваши счета",
  "home.tradingAccount": "Торговый счёт",
  "home.accountInfo": "Информация о счёте",
  "home.accountName": "Название счёта",
  "home.leverage": "Кредитное плечо",
  "home.previous": "Предыдущий счёт",
  "home.next": "Следующий счёт",
  "home.showBalances": "Показать балансы",
  "home.hideBalances": "Скрыть балансы",
  "home.trade": "Торговать",
  "home.history": "История",
  "home.funding": "Пополнение",
  "home.linked": "Подключено",
  "home.connected": "Подключено",
  "home.subscriptions": { one: "{count} активная подписка", few: "{count} активные подписки", many: "{count} активных подписок", other: "{count} активной подписки" },
  "home.points": "{points} баллов",
  "home.redeem": "Обменять",
  "home.networkUnavailable": "Приостановлено",
  "home.totalBalance": "Общий баланс",
  "home.totalBalanceSub": "Реальные счета и кошелёк",
  "home.transferFunds": "Перевести средства",
  "home.quickActions": "Быстрые действия",
  "home.later": "Позже",
  "home.viewDetails": "Подробнее",
  "home.verifyNow": "Пройти верификацию",
  "home.fundTitle": "Пополните кошелёк",
  "home.fundText": "Внесите USDT, чтобы начать торговлю на реальном счёте.",
  "home.depositNow": "Пополнить",
  "home.tradingTitle": "Торговля",
  "home.marketsTitle": "Рынки",
  "home.moreTitle": "Ещё для вас",
};
export default dashboard;
