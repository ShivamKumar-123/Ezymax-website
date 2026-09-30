import type { NsMessages } from "../../core";

// Kalks mobile app: Algo (/algo): strategies running 24/7 on the server (deployments), the kill switch, backtest
// reports, the strategy marketplace, API keys and webhooks. Terms follow the Client Area (developer namespace):
// deployment = «запуск», kill switch = «аварийная остановка». Kalks, Algo, API, USDT, USD, indicator names, symbols,
// timeframes, "R", pips, P&L, DD, SL / TP stay as they are. Titles marked (display): keep them short.
const mobileAlgo: NsMessages<"mobileAlgo"> = {
  never: "никогда",
  // {n} days, compact
  days: "{n} дн.",
  lot: "лот",
  // How long a trade was held: m = minutes, h = hours, d = days (compact)
  "dur.m": "{m} мин",
  "dur.h": "{h} ч",
  "dur.hm": "{h} ч {m} мин",
  "dur.d": "{d} д",
  "dur.dh": "{d} д {h} ч",
  nTrades: {
    one: "{count} сделка",
    few: "{count} сделки",
    many: "{count} сделок",
    other: "{count} сделки",
  },
  readOnly: "С этим входом можно просматривать стратегии, но нельзя ничего изменять.",

  /* ---------------------------------------------------------------- */
  /* Screen states                                                     */
  /* ---------------------------------------------------------------- */
  "state.unavailable.title": "Algo недоступен", // (display)
  "state.unavailable.text": "Не удалось связаться с сервисом стратегий. Ваши стратегии продолжают работать на сервере; пожалуйста, повторите попытку чуть позже.",
  "state.disabled.title": "Недоступно", // (display)
  "state.disabled.text": "Эта функция недоступна для Вашего аккаунта.",
  "state.notFound.title": "Не найдено", // (display)
  "state.notFound.text": "Возможно, объект удалён или ссылка неверна.",
  "state.back": "Назад в Algo",

  /* ---------------------------------------------------------------- */
  /* Server errors (codes of the strategy service)                     */
  /* ---------------------------------------------------------------- */
  "error.haltedMine": "Ваша аварийная остановка включена. Отключите её на экране Algo, прежде чем снова запускать стратегии.",
  "error.haltedPlatform": "Автоматическая торговля сейчас приостановлена брокером. Пожалуйста, повторите попытку позже.",
  // {n} = the most strategies that can run at once
  "error.limitRunning": "Одновременно может работать не более {n} стратегий. Сначала остановите одну из них.",
  "error.accountStatus": "На этом счёте сейчас нельзя торговать.",
  "error.alreadyRunning": "Эта версия уже работает на этом счёте.",
  "error.invalidStrategy": "Сначала исправьте ошибки стратегии (в личном кабинете или с помощью AI Trader).",
  "error.state": "Состояние уже изменилось. Потяните вниз, чтобы увидеть текущее.",
  "error.queueFull": "У Вас уже 3 бэктеста в очереди или в работе. Дождитесь завершения одного из них.",
  "error.dailyLimit": "Вы достигли дневного лимита бэктестов: {n}.",
  "error.ownListing": "Нельзя подписаться на собственную стратегию.",
  "error.subscribed": "Вы уже подписаны на эту стратегию.",
  "error.cloneNotAllowed": "Автор не разрешает копировать правила; вместо этого скопируйте стратегию на свой счёт.",
  // {amount} in USDT
  "error.insufficientFunds": "Баланс Вашего кошелька меньше {amount} USDT. Внесите USDT, чтобы оформить подписку.",
  "error.insufficientFundsPlain": "Баланса Вашего кошелька недостаточно. Внесите USDT, чтобы оформить подписку.",
  "error.inactive": "Эта подписка больше не активна.",
  "error.archiveRunning": "Остановите запуски этой стратегии, прежде чем архивировать её.",
  "error.archived": "Эта стратегия в архиве.",
  "error.finished": "Этот бэктест уже завершён.",
  "error.revoked": "Этот ключ уже отозван.",
  "error.notFound": "Этого объекта больше нет.",
  // {tf} = timeframe (H1), {days} = number of days
  "error.rangeTooLong": "Бэктест на {tf} охватывает не более {days} дн. Выберите более короткий период.",
  "error.balanceRange": "Начальный баланс должен быть от 100 до 10 000 000.",
  "error.dates": "Дата начала должна быть раньше даты окончания.",

  /* ---------------------------------------------------------------- */
  /* Home                                                              */
  /* ---------------------------------------------------------------- */
  "home.eyebrow": "Автоматическая торговля",
  "home.title": "Algo", // (display)
  "home.heroEyebrow": "Работает сейчас",
  "home.heroRunning": {
    zero: "стратегий торгуют круглосуточно на сервере",
    one: "стратегия торгует круглосуточно на сервере",
    few: "стратегии торгуют круглосуточно на сервере",
    many: "стратегий торгуют круглосуточно на сервере",
    other: "стратегии торгуют круглосуточно на сервере",
  },
  "home.heroRealized": "Зафиксированный P&L",
  "home.heroOpen": "Открыто сейчас",
  // closed trades so far
  "home.heroTrades": "Сделки",
  "home.qaAi": "Создать с ИИ",
  "home.qaAiHint": "Опишите идею — получите точные правила",
  "home.qaMarket": "Маркетплейс",
  "home.qaMarketHint": "Копируйте проверенные стратегии",
  "home.qaKeys": "API-ключи и вебхуки",
  "home.qaKeysHint": "Использование, отзыв, последние сигналы",
  "home.running": "Запуски", // (display)
  "home.runningSub": {
    zero: "Сейчас ничего не работает",
    one: "Работает: {count}",
    few: "Работает: {count}",
    many: "Работает: {count}",
    other: "Работает: {count}",
  },
  // {n} = count shown on the filter pill
  "home.filterActive": "Активные · {n}",
  "home.filterAll": "Все · {n}",
  "home.strategies": "Мои стратегии", // (display)
  "home.strategiesSub": {
    zero: "Пока ничего не сохранено",
    one: "Сохранено: {count}",
    few: "Сохранено: {count}",
    many: "Сохранено: {count}",
    other: "Сохранено: {count}",
  },
  "home.newWithAi": "Новая с ИИ",
  "home.backtests": "Бэктесты", // (display)
  "home.backtestsSub": "Последние бэктесты, сначала новые",
  "home.emptyDeps": "Пока ничего не запускалось. Откройте одну из своих стратегий ниже и для начала запустите её на демо-счёте.",
  "home.emptyActive": "Сейчас ничего не работает. Остановленные стратегии — в разделе «Все».",
  "home.showAll": "Показать все",
  "home.emptyStrats": "Собственных стратегий пока нет. Опишите идею AI Trader, и она превратится в точные правила, которые можно протестировать.",
  "home.browseMarket": "Открыть маркетплейс",
  "home.emptyBts": "Бэктестов пока нет. Откройте стратегию и запустите бэктест на реальной истории цен.",
  "home.startEyebrow": "С чего начать",
  "home.startTitle": "Запустите стратегию", // (display)
  "home.step1": "Опишите идею AI Trader: она превратится в точные правила, которые можно прочитать и изменить.",
  "home.step2": "Проведите бэктест правил на реальной истории цен с затратами Вашего счёта.",
  "home.step3": "Сначала запустите её круглосуточно на демо-счёте. Приостановить, остановить или аварийно остановить её можно в любой момент.",
  "home.footnote": "Стратегии работают на серверах Kalks круглосуточно, по закрытым барам, с теми же проверками ордеров, что и при ручной торговле: маржа, часы работы рынка, Ваши лимиты. Создавайте и изменяйте стратегии с AI Trader или в личном кабинете.",
  "home.openWeb": "Открыть конструктор стратегий на сайте",

  /* ---------------------------------------------------------------- */
  /* Kill switch (account-wide)                                        */
  /* ---------------------------------------------------------------- */
  "kill.cardTitle": "Аварийная остановка",
  "kill.cardBody": "Мгновенно остановите все стратегии и заблокируйте ордера через вебхуки и API.",
  "kill.stopAll": "Остановить всё",
  "kill.onTitle": "Аварийная остановка включена",
  // {at} = date and time
  "kill.onSince": "С {at}. Стратегии остановлены; ордера через вебхуки и API заблокированы.",
  "kill.onBody": "Стратегии остановлены; ордера через вебхуки и API заблокированы.",
  "kill.release": "Отключить",
  "kill.title": "Остановить всё?", // (display)
  "kill.body": {
    zero: "Все стратегии немедленно остановятся, а ордера через вебхуки и API будут заблокированы, пока Вы не отключите аварийную остановку.",
    one: "{count} работающая стратегия немедленно остановится, а ордера через вебхуки и API будут заблокированы, пока Вы не отключите аварийную остановку.",
    few: "Все {count} работающие стратегии немедленно остановятся, а ордера через вебхуки и API будут заблокированы, пока Вы не отключите аварийную остановку.",
    many: "Все {count} работающих стратегий немедленно остановятся, а ордера через вебхуки и API будут заблокированы, пока Вы не отключите аварийную остановку.",
    other: "Все работающие стратегии ({count}) немедленно остановятся, а ордера через вебхуки и API будут заблокированы, пока Вы не отключите аварийную остановку.",
  },
  "kill.alsoClose": "Также закрыть их позиции",
  "kill.alsoCloseHint": "По рынку закрываются все позиции, открытые стратегиями, вебхуками или через API на всех Ваших счетах. Ваши ручные сделки остаются открытыми.",
  "kill.confirm": "Остановить всё сейчас",
  "kill.doneTitle": "Всё остановлено", // (display)
  "kill.stopped": "Остановлено стратегий",
  "kill.doneBody": "Аварийная остановка действует, пока Вы её не отключите. Остановленные стратегии сами не перезапускаются.",
  "kill.releaseTitle": "Отключить остановку?", // (display)
  "kill.releaseBody": "Ордера через вебхуки и API снова будут разрешены. Остановленные стратегии останутся остановленными: запустите их снова, когда будете готовы.",
  "kill.releasedTitle": "Остановка отключена", // (display)
  "kill.releasedBody": "Ордера через вебхуки и API снова разрешены. Запустите стратегию, чтобы она начала работать.",
  "kill.globalTitle": "Автоматическая торговля приостановлена",
  "kill.globalBody": "Брокер временно приостановил все стратегии, вебхуки и API-ордера. Открытые позиции сохраняют свои стопы.",

  /* ---------------------------------------------------------------- */
  /* Deployment statuses, controls                                     */
  /* ---------------------------------------------------------------- */
  "dep.status.running": "Работает",
  "dep.status.paused": "Приостановлена",
  "dep.status.stopped": "Остановлена",
  "dep.status.killed": "Аварийно остановлена",
  "dep.status.error": "Ошибка",
  "dep.realized": "Зафиксированный P&L",
  "dep.trades": "Сделки",
  "dep.winRate": "Доля прибыльных",
  "dep.open": "Открыто",
  "dep.orders": "Ордера",
  "dep.openNow": "Открыта",
  // {ago} = "5 minutes ago"
  "dep.lastCheck": "Последний бар проверен {ago}",
  // {since} = start date
  "dep.lastCheckSince": "Последний бар проверен {ago} · работает с {since}",
  // {reason} = the service's reason, e.g. "stopped by the owner"
  "dep.stoppedWhy": "Остановлена: {reason}",
  "dep.stoppedTitle": "Остановлена {at}",
  "dep.errorTitle": "В стратегии произошла ошибка",
  // {account} = "Demo 50000083"
  "dep.eyebrow": "Запуск · {account}",
  "dep.marketplaceCopy": "Копия из маркетплейса",
  "dep.openStrategy": "Открыть стратегию",
  "dep.openSubscription": "Открыть мои подписки",
  // {pct} = return %, {amount} = starting balance
  "dep.onStart": "{pct} от {amount}",
  "dep.curveA11y": "Баланс по дням за {days} дн., зафиксировано {pnl}",
  "dep.tabLog": "Журнал · {n}",
  "dep.tabTrades": "Сделки · {n}",
  "dep.tabSetup": "Настройки",
  "dep.noLogs": "Записей пока нет: первый закрытый бар — разогрев.",
  "dep.noTrades": "Сделок пока нет.",
  "dep.older": "Загрузить более ранние записи",
  "dep.logStart": "Это первая запись.",
  "dep.rules": "Правила",
  "dep.rulesHidden": "Автор скрывает правила: стратегия работает на Вашем счёте в опубликованном виде.",
  "dep.lotMultiplier": "Множитель лота",
  "dep.maxLots": "Макс. лотов на ордер",
  "dep.maxOpen": "Макс. открытых позиций",
  "dep.dailyLoss": "Лимит дневного убытка",
  "dep.started": "Запущена",
  "dep.startBalance": "Начальный баланс",
  "dep.setupNote": "Запуск выполняет одну конкретную версию: сохранение новой версии его не меняет. Чтобы перейти на новую версию, запустите её.",

  "ctl.pause": "Приостановить",
  "ctl.resume": "Возобновить",
  "ctl.stop": "Остановить",
  "ctl.kill": "Аварийный стоп",
  "ctl.killNow": "Остановить аварийно",
  "ctl.closePositions": "Закрыть позиции",
  "ctl.pauseTitle": "Приостановить?", // (display)
  "ctl.pauseBody": "Новых сделок не будет. Открытые позиции сохраняют стоп, цель и безубыток. Возобновить можно в любой момент.",
  "ctl.resumeTitle": "Возобновить?", // (display)
  "ctl.resumeBody": "Стратегия снова начнёт торговать со следующего закрытого бара.",
  "ctl.stopTitle": "Остановить?", // (display)
  "ctl.stopBody": "Стратегия остановится окончательно: новых сделок не будет. Чтобы снова её использовать, запустите её заново.",
  "ctl.keepTitle": "Оставить позиции открытыми",
  "ctl.keepText": {
    one: "{count} открытая позиция сохраняет стоп и цель; управляйте ею сами.",
    few: "{count} открытые позиции сохраняют стопы и цели; управляйте ими сами.",
    many: "{count} открытых позиций сохраняют стопы и цели; управляйте ими сами.",
    other: "Открытые позиции ({count}) сохраняют стопы и цели; управляйте ими сами.",
  },
  "ctl.closeAllTitle": "Закрыть их сейчас",
  "ctl.closeAllText": {
    one: "{count} открытая позиция будет закрыта по рынку.",
    few: "{count} открытые позиции будут закрыты по рынку.",
    many: "{count} открытых позиций будут закрыты по рынку.",
    other: "Открытые позиции ({count}) будут закрыты по рынку.",
  },
  "ctl.killTitle": "Аварийный стоп?", // (display)
  "ctl.killBody": "Аварийная остановка немедленно останавливает эту стратегию и по умолчанию закрывает по рынку открытые ею позиции.",
  "ctl.killClose": "Закрыть её позиции",
  "ctl.killCloseHint": "По рынку, сейчас. Выключите, чтобы оставить их открытыми со стопами.",
  "ctl.closeTitle": "Закрыть позиции?", // (display)
  "ctl.closeBody": {
    one: "{count} позиция, открытая этой стратегией, будет закрыта по рынку. Стратегия продолжит работать.",
    few: "{count} позиции, открытые этой стратегией, будут закрыты по рынку. Стратегия продолжит работать.",
    many: "{count} позиций, открытых этой стратегией, будут закрыты по рынку. Стратегия продолжит работать.",
    other: "Позиции, открытые этой стратегией ({count}), будут закрыты по рынку. Стратегия продолжит работать.",
  },
  "ctl.done.pause": "Приостановлена", // (display)
  "ctl.done.resume": "Снова работает", // (display)
  "ctl.done.stop": "Остановлена", // (display)
  "ctl.done.kill": "Аварийно остановлена", // (display)
  "ctl.done.close": "Позиции закрыты", // (display)
  "ctl.donePause": "Новых сделок не будет, пока Вы её не возобновите.",
  "ctl.doneResume": "Стратегия снова торгует со следующего закрытого бара.",
  "ctl.doneClosed": {
    one: "Закрыта {count} позиция.",
    few: "Закрыто {count} позиции.",
    many: "Закрыто {count} позиций.",
    other: "Закрыто {count} позиции.",
  },
  "ctl.doneKept": "Её открытые позиции, если они есть, остаются открытыми со своими стопами и целями.",
  "ctl.doneNothing": "Открытых позиций для закрытия не было.",
  "ctl.closedLabel": "Закрыто",
  "ctl.failedLabel": "Не удалось закрыть",
  "ctl.failedTitle": {
    one: "Не удалось закрыть {count} позицию",
    few: "Не удалось закрыть {count} позиции",
    many: "Не удалось закрыть {count} позиций",
    other: "Не удалось закрыть {count} позиции",
  },
  "ctl.failedBody": "Возможно, рынок закрыт. Закройте позицию на вкладке «Портфель», когда торговля возобновится.",
  // stopping or killing a marketplace copy leaves its subscription (and a paid one's renewals) running
  "ctl.copyNote": "Это копия из маркетплейса: её остановка не завершает подписку. Чтобы прекратить оплату, отмените подписку в разделе Маркетплейс › Подписки.",

  /* ---------------------------------------------------------------- */
  /* Strategy                                                          */
  /* ---------------------------------------------------------------- */
  // {version} = version number
  "strat.eyebrow": "Стратегия · v{version}",
  "strat.runningN": {
    one: "Работает: {count}",
    few: "Работает: {count}",
    many: "Работает: {count}",
    other: "Работает: {count}",
  },
  "strat.draft": "Черновик",
  "strat.ready": "Готова",
  "strat.errors": {
    one: "{count} ошибка",
    few: "{count} ошибки",
    many: "{count} ошибок",
    other: "{count} ошибки",
  },
  "strat.archivedTag": "В архиве",
  "strat.lastBacktest": "Последний бэктест",
  "strat.backtested": "бэктест",
  "strat.notTested": "Бэктеста ещё не было", // (display)
  "strat.notTestedBody": "Проверьте правила на реальной истории цен с затратами Вашего счёта, прежде чем запускать их.",
  "strat.runFirst": "Запустить бэктест",
  "strat.openReport": "Открыть полный отчёт",
  "strat.deployV": "Запустить v{version}",
  "strat.backtest": "Бэктест",
  "strat.fixFirst": "Исправьте это перед тестом или запуском",
  "strat.line": "Строка {n}:",
  "strat.rules": "Правила", // (display)
  "strat.rulesSub": "Проверяются на каждом закрытом баре",
  "strat.rulesCodeSub": "Сигналы кода, проверяются на каждом закрытом баре",
  "strat.showCode": "Показать в виде кода",
  "strat.risk": "Риск", // (display)
  "strat.riskSub": "Объём, стопы, часы и лимиты",
  "strat.editVisual": "Чтобы изменить правила, попросите AI Trader или отредактируйте их в личном кабинете; каждое изменение сохраняется как новая версия.",
  "strat.editCode": "Стратегии в виде кода редактируются в личном кабинете на сайте; каждое изменение сохраняется как новая версия.",
  "strat.openWeb": "Изменить код на сайте",
  "strat.deployments": "Запуски", // (display)
  "strat.deploymentsSub": {
    zero: "Нигде не работает",
    one: "{count} запуск",
    few: "{count} запуска",
    many: "{count} запусков",
    other: "{count} запуска",
  },
  "strat.notRunning": "Не работает. Сначала запустите её на демо-счёте, чтобы увидеть, как она торгует в реальном времени.",
  "strat.backtests": "Бэктесты", // (display)
  "strat.backtestsSub": {
    zero: "Пока нет",
    one: "{count} бэктест",
    few: "{count} бэктеста",
    many: "{count} бэктестов",
    other: "{count} бэктеста",
  },
  "strat.runNew": "Новый бэктест",
  "strat.noBacktests": "Бэктестов пока нет.",
  "strat.versions": "Версии", // (display)
  "strat.versionsSub": {
    one: "{count} версия",
    few: "{count} версии",
    many: "{count} версий",
    other: "{count} версии",
  },
  "strat.current": "Текущая",
  "strat.archive": "Архивировать",
  "strat.archiveTitle": "В архив?", // (display)
  "strat.archiveBody": "«{name}» исчезнет из списка. Её бэктесты и прошлые запуски останутся в истории.",
  "strat.archived": "«{name}» перемещена в архив",

  "kind.visual": "Визуальные правила",
  "kind.code": "Код",
  // Where a strategy came from
  "origin.ai": "AI Trader",
  "origin.template": "Шаблон",
  "origin.manual": "Вручную",
  "origin.marketplace": "Маркетплейс",

  /* ---------------------------------------------------------------- */
  /* Rules in words                                                    */
  /* ---------------------------------------------------------------- */
  "rules.buy": "Покупать, когда",
  "rules.sell": "Продавать, когда",
  "rules.exitBuy": "Закрывать покупки, когда",
  "rules.exitSell": "Закрывать продажи, когда",
  "rules.and": "и",
  "rules.or": "или",
  // {tf} = timeframe, e.g. "on H4"
  "rules.onTf": "на {tf}",
  "rules.noRules": "Правил входа пока нет.",
  "rules.size": "Объём",
  "rules.stop": "Стоп Лосс",
  "rules.target": "Тейк Профит",
  "rules.trailing": "Трейлинг",
  "rules.window": "Торговые часы",
  "rules.limits": "Лимиты",
  "rules.none": "Нет",
  "rules.lots": "{lots} лот.",
  "rules.riskPct": "Риск {pct}% на сделку",
  "rules.maxLots": "макс. {lots} лот.",
  // points: move the stop to entry + {o} after {v} points in profit
  "rules.breakeven": "безубыток при {v} пп. (+{o})",
  "rules.allDay": "Круглосуточно",
  "rules.perDay": {
    one: "{count} сделка в день",
    few: "{count} сделки в день",
    many: "{count} сделок в день",
    other: "{count} сделки в день",
  },
  "rules.dailyLoss": "Остановка на день при убытке {amount}",
  "rules.oneAtATime": "Одна позиция одновременно",
  "rules.closeOutside": "Закрывает позиции вне торговых часов",
  "rules.noLimits": "Без дневных лимитов",
  "op.crossesAbove": "пересекает снизу вверх",
  "op.crossesBelow": "пересекает сверху вниз",
  "dist.pips": "{v} pips",
  "dist.points": "{v} пп.",
  "dist.price": "на {v}",
  "dist.percent": "{v}% от цены",
  // {v} × ATR({p})
  "dist.atr": "{v} × ATR({p})",
  "dist.level": "уровень {v}",
  // a multiple of the stop distance
  "dist.rr": "{v}R",
  "field.close": "Close",
  "field.open": "Open",
  "field.high": "High",
  "field.low": "Low",
  "field.hl2": "Медианная цена",
  "field.hlc3": "Типичная цена",
  "field.ohlc4": "Средняя цена",
  "field.volume": "Объём",
  "pattern.bullish": "Бычья свеча",
  "pattern.bearish": "Медвежья свеча",
  "pattern.bullish_engulfing": "Бычье поглощение",
  "pattern.bearish_engulfing": "Медвежье поглощение",
  "pattern.hammer": "Молот",
  "pattern.shooting_star": "Падающая звезда",
  "pattern.doji": "Доджи",
  "pattern.inside_bar": "Внутренний бар",
  "ind.sma": "SMA",
  "ind.ema": "EMA",
  "ind.wma": "WMA",
  "ind.rsi": "RSI",
  "ind.macd": "MACD",
  "ind.macd_signal": "Сигнальная MACD",
  "ind.macd_hist": "Гистограмма MACD",
  "ind.bb_upper": "Верх. Bollinger",
  "ind.bb_middle": "Средн. Bollinger",
  "ind.bb_lower": "Нижн. Bollinger",
  "ind.atr": "ATR",
  "ind.stoch_k": "Stochastic %K",
  "ind.stoch_d": "Stochastic %D",
  "ind.highest": "Макс. High",
  "ind.lowest": "Мин. Low",
  "ind.cci": "CCI",
  "ind.willr": "Williams %R",
  "ind.adx": "ADX",
  "ind.plus_di": "+DI",
  "ind.minus_di": "−DI",
  "ind.momentum": "Momentum",
  "ind.roc": "ROC",
  "ind.stddev": "Станд. отклонение",
  "note.noDailyLimit": "Нет дневного лимита сделок",
  "note.noStop": "Нет стоп-лосса: позиции не защищены",
  "note.riskNeedsStop": "Для расчёта объёма по риску нужен стоп-лосс",
  "note.rrNeedsStop": "Для тейк-профита в R нужен стоп-лосс",
  "note.noEntry": "Нет правила входа: добавьте условие покупки или продажи",

  /* ---------------------------------------------------------------- */
  /* Deploy (form)                                                     */
  /* ---------------------------------------------------------------- */
  "deploy.eyebrow": "Запуск · v{version}",
  "deploy.title": "Круглосуточный запуск", // (display)
  "deploy.body": "«{name}» v{version} торгует {symbol} на каждом закрытом баре {tf} на серверах Kalks, даже когда Ваш телефон выключен. Приостановить, остановить или аварийно остановить её можно в любой момент.",
  "deploy.account": "Счёт",
  "deploy.equity": "Средства {amount}",
  "deploy.noAccounts": "Нужен активный торговый счёт. Откройте демо-счёт, чтобы испытать стратегии без риска.",
  "deploy.openAccount": "Открыть счёт",
  "deploy.multiplier": "Множитель лота",
  "deploy.multiplierHint": "Масштабирует объём каждого ордера. 1× — собственный объём стратегии.",
  "deploy.maxOpen": "Макс. открытых позиций",
  "deploy.maxOpenHint": "Ограничение поверх собственных правил стратегии.",
  "deploy.strategyDefault": "Правило стратегии",
  "deploy.dailyLoss": "Лимит дневного убытка",
  "deploy.dailyLossHint": "Когда закрытый и плавающий убыток за день достигает лимита, новых сделок не будет до завтра (по времени сервера).",
  "deploy.off": "Выкл.",
  "deploy.custom": "Свой",
  "deploy.dailyLossAmount": "Убыток за день",
  "deploy.lossInvalid": "Введите сумму больше 0.",
  "deploy.liveTitle": "Реальные деньги",
  "deploy.liveBody": "Это реальный счёт. Стратегия размещает реальные ордера на реальные деньги и может их потерять.",
  "deploy.ack": "Я понимаю, что стратегия торгует реальными деньгами на моём реальном счёте, и несу за это ответственность.",
  "deploy.note": "Автоматическая торговля может приводить к убыткам. Бэктесты — это симуляция, они не предсказывают будущие результаты. Это не финансовая рекомендация.",
  // {account} = "Demo 50000083"
  "deploy.confirm": "Запустить на {account}",
  "deploy.doneTitle": "Работает", // (display)
  "deploy.doneBody": "«{name}» v{version} работает на {account}.",
  "deploy.warmup": "Первый закрытый бар {tf} — разогрев; ордера могут начаться со следующего.",
  "deploy.open": "Открыть запуск",

  /* ---------------------------------------------------------------- */
  /* Backtests                                                         */
  /* ---------------------------------------------------------------- */
  "bt.status.queued": "В очереди",
  "bt.status.running": "Выполняется",
  "bt.status.done": "Готово",
  "bt.status.failed": "Ошибка",
  "bt.status.cancelled": "Отменён",
  "bt.stage.queued": "Ожидание свободного обработчика",
  "bt.stage.loading": "Загрузка истории цен",
  "bt.stage.m1": "Загрузка минутных баров",
  "bt.stage.simulating": "Моделирование сделок",
  "bt.stage.running": "Выполняется",
  // {id} = backtest number, {version} = strategy version
  "bt.eyebrow": "Бэктест #{id} · v{version}",
  "bt.title": "Бэктест", // (display)
  "bt.start": "Старт {amount}",
  "bt.runningNote": "Он выполняется на сервере: можно покинуть этот экран и вернуться позже.",
  "bt.failed": "Бэктест завершился с ошибкой",
  "bt.cancelled": "Отменён", // (display)
  "bt.runAgain": "Запустить снова",
  "bt.net": "Чистая прибыль",
  // {pct} = return, {amount} = starting balance
  "bt.returnOf": "{pct} от {amount}",
  "bt.pf": "Профит-фактор",
  "bt.winRate": "Доля прибыльных",
  "bt.winsOf": "{wins} из {trades}",
  "bt.maxDd": "Макс. просадка",
  "bt.maxDdShort": "Макс. DD",
  "bt.sharpe": "Шарп",
  "bt.sortino": "Сортино {v}",
  "bt.trades": "Сделки",
  "bt.longShort": "Покупки: {long} · продажи: {short}",
  "bt.expectancy": "Мат. ожидание",
  "bt.perTrade": "на сделку",
  "bt.equity": "Средства", // (display)
  "bt.drawdown": "Просадка",
  "bt.legendEquity": "Средства",
  "bt.legendBalance": "Баланс",
  "bt.legendStart": "Старт",
  "bt.noCurve": "Недостаточно баров для построения кривой.",
  "bt.scrubHint": "Проведите по графику или коснитесь и удерживайте, чтобы увидеть любую точку.",
  "bt.curveA11y": "Средства с {from} по {to}; максимальная просадка {dd}",
  "bt.monthly": "По месяцам", // (display)
  "bt.monthlySub": "Доходность каждого месяца, % от баланса",
  "bt.noTradesMonth": "нет сделок",
  "bt.statistics": "Статистика", // (display)
  "bt.tradeList": "Сделки", // (display)
  "bt.tradeListSub": "Сначала новые, за вычетом затрат",
  "bt.truncated": "Первые {n} сделок, сначала новые",
  "bt.fAll": "Все · {n}",
  "bt.fWins": "Прибыльные · {n}",
  "bt.fLosses": "Убыточные · {n}",
  "bt.noTrades": "За этот период правила не совершили ни одной сделки.",
  "bt.data": "Данные и затраты", // (display)
  "bt.m1Bars": "Минутные бары (внутри бара)",
  "bt.since": "с {date}",
  "bt.signals": "Сигналы",
  "bt.signalsValue": "покупка: {buy} · продажа: {sell} · выход: {exits}",
  "bt.skipped": "Пропущено: {reason}",
  "bt.model": "Модель",
  "bt.group": "Тип счёта",
  "bt.spread": "Спред",
  "bt.spreadValue": "{points} пп. ({source})",
  "bt.commission": "Комиссия",
  "bt.perLot": "{amount} за лот",
  "bt.swaps": "Свопы",
  "bt.swapsOn": "Начисляются при каждом переносе",
  "bt.swapsOff": "Не начисляются (без свопов)",
  "bt.conversion": "Пересчёт P&L",
  "bt.usdBase": "USD — базовая: по цене выхода",
  "bt.usdQuoted": "Котируется в USD",
  "bt.currentRate": "По текущему курсу ({rate})",
  "bt.simNote": "Бэктест #{id} — это симуляция на прошлых ценах: исполнение по открытию следующего бара, стопы и цели по пути OHLC (по минутным барам, где они есть), спред, комиссия и свопы Вашего типа счёта. Прошлые результаты не предсказывают будущие.",
  // History sources and skip reasons from the service
  "source.native": "исходные",
  "source.built_from_M1": "построено из M1",
  "source.built_from_M5": "построено из M5",
  "source.built_from_M15": "построено из M15",
  "source.built_from_M30": "построено из M30",
  "source.built_from_H1": "построено из H1",
  "skip.outside_trading_window": "вне торговых часов",
  "skip.position_already_open": "позиция уже была открыта",
  "skip.daily_trade_limit": "дневной лимит сделок",
  "skip.max_daily_loss": "лимит дневного убытка",
  "skip.market_closed": "рынок закрыт",
  "skip.20_open_positions": "уже открыто 20 позиций",
  "skip.buy_and_sell_on_the_same_bar": "покупка и продажа на одном баре",
  "skip.stop_distance_not_ready": "дистанция стопа ещё не рассчитана",
  "skip.SL_level_on_the_wrong_side": "уровень стопа не с той стороны",
  "skip.volume_below_the_minimum_lot": "объём меньше минимального лота",
  "spreadSource.group_quote": "текущая котировка Вашего типа счёта",
  "spreadSource.catalogue": "спред из каталога",
  "spreadSource.fixed": "фиксированный",

  "btNew.title": "Новый бэктест", // (display)
  "btNew.period": "Период",
  "btNew.balance": "Начальный баланс",
  "btNew.other": "Другая",
  "btNew.amount": "Сумма",
  "btNew.costs": "Затраты",
  "btNew.accountType": "Тип счёта",
  "btNew.myAccount": "Мой счёт",
  "btNew.costsGroupHint": "Спред, комиссия и свопы этого типа счёта.",
  "btNew.costsAccountHint": "Спред, комиссия и свопы группы этого счёта.",
  "btNew.noAccounts": "У Вас пока нет активного торгового счёта.",
  "btNew.run": "Запустить бэктест",
  "btNew.note": "Максимальный период зависит от таймфрейма. Одновременно может выполняться до 3 бэктестов.",

  "period.p1m": "1М",
  "period.p3m": "3М",
  "period.p6m": "6М",
  "period.p1y": "1Г",
  "period.p2y": "2Г",
  "period.p5y": "5Л",

  // Trade exit reasons (server codes)
  "exit.sl": "Стоп Лосс",
  "exit.tp": "Тейк Профит",
  "exit.trailing": "Трейлинг-стоп",
  "exit.breakeven": "Безубыток",
  "exit.signal": "Сигнал",
  "exit.exit_rule": "Правило выхода",
  "exit.session": "Вне торговых часов",
  "exit.end_of_test": "Конец теста",
  "exit.stop_out": "Стоп-аут",
  "exit.kill": "Аварийная остановка",
  "exit.stopped": "Остановлена",
  "exit.client": "Закрыта",
  "exit.close": "Закрыта",

  "stat.balance": "Баланс",
  "stat.gross": "Общая прибыль / убыток",
  "stat.cagr": "Годовой рост (CAGR)",
  "stat.avgWinLoss": "Средняя прибыль / убыток",
  "stat.largest": "Крупнейшая прибыль / убыток",
  "stat.payoff": "Отношение прибыли к убытку",
  "stat.long": "Сделки на покупку · доля прибыльных",
  "stat.short": "Сделки на продажу · доля прибыльных",
  "stat.streaks": "Макс. серия прибыльных / убыточных",
  "stat.maxDd": "Макс. просадка",
  "stat.recovery": "Фактор восстановления",
  "stat.sharpeSortino": "Шарп / Сортино",
  "stat.avgBars": "Среднее число баров в позиции",
  "stat.exposure": "Время в рынке",
  "stat.costs": "Комиссия / своп / спред",
  "stat.bars": "Протестировано баров",
  "stat.cpu": "Время расчёта",
  "stat.seconds": "{s} с",

  /* ---------------------------------------------------------------- */
  /* Log kinds (runtime)                                               */
  /* ---------------------------------------------------------------- */
  "log.eval": "Бар",
  "log.signal": "Сигнал",
  "log.order": "Ордер",
  "log.close": "Закрытие",
  "log.manage": "Управление",
  "log.error": "Ошибка",
  "log.info": "Инфо",

  /* ---------------------------------------------------------------- */
  /* Marketplace                                                       */
  /* ---------------------------------------------------------------- */
  "house.badge": "Собственная стратегия · Под управлением Kalks",
  "house.disclosure":
    "Собственная стратегия Kalks: реальный счёт брокера, торгующий по этой стратегии. История торговли включает только её реальные сделки с момента запуска; ничего не смоделировано и не добавлено задним числом.",
  "market.eyebrow": "Маркетплейс стратегий",
  "market.title": "Маркетплейс", // (display)
  "market.subtitle": "Стратегии с подтверждённой историей торговли на реальных счетах Kalks. Скопируйте стратегию на свой счёт или скопируйте её правила, если автор это разрешает.",
  "market.browse": "Обзор",
  "market.subs": "Подписки",
  "market.subsN": "Подписки · {n}",
  "market.mine": "Ваши публикации",
  "market.search": "Поиск стратегий, авторов…",
  "market.clear": "Очистить поиск",
  "market.all": "Все",
  "market.free": "Бесплатно",
  "market.paid": "Платно",
  "market.newest": "Новые",
  "market.topRated": "С высоким рейтингом",
  "market.popular": "Популярные",
  // {price} in USDT
  "market.perMonth": "{price} USDT/мес.",
  "market.by": "автор: {author}",
  "market.return": "Доходность",
  "market.winRate": "Доля прибыльных",
  "market.maxDd": "Макс. DD",
  "market.trades": "Сделки",
  // {type} = live / demo
  "market.verified": "Подтверждено · {type}",
  "market.verifiedDays": "подтверждено · {type} · {days} дн.",
  // a track record younger than a day
  "market.verifiedNew": "подтверждено · {type} · меньше дня",
  "market.subscribed": "Вы подписаны",
  "market.ratings": {
    zero: "Нет оценок",
    one: "{count} оценка",
    few: "{count} оценки",
    many: "{count} оценок",
    other: "{count} оценки",
  },
  "market.subscribers": {
    one: "{count} подписчик",
    few: "{count} подписчика",
    many: "{count} подписчиков",
    other: "{count} подписчика",
  },
  "market.emptyTitle": "Пока ничего не опубликовано", // (display)
  "market.emptyText": "Стратегии появятся здесь, когда авторы опубликуют их с подтверждённой историей торговли.",
  "market.noMatchTitle": "Ничего не найдено", // (display)
  "market.noMatchText": "Попробуйте другой запрос или фильтр.",
  "market.noSubsTitle": "Подписок нет", // (display)
  "market.noSubsText": "Здесь появятся стратегии, которые Вы копируете из маркетплейса или чьи правила копируете.",
  "market.disclaimer": "Прошлые результаты не гарантируют будущих. История торговли берётся с реальных или демо-счетов Kalks и имеет соответствующую пометку. Комиссия платформы с платных подписок: {pct}%.",
  "market.houseFootnote": "Собственные стратегии работают на реальных счетах брокера; их история торговли включает только их собственные реальные сделки.",
  "market.earned": "Заработано",
  "market.fees": "Комиссии платформы",
  "market.payments": "Платежи",
  "market.publishWeb": "Публикация стратегии (с подтверждённой историей торговли) и редактирование публикации выполняются в личном кабинете на сайте.",
  "market.openWeb": "Открыть маркетплейс на сайте",

  // Listing statuses (server values)
  "listing.pending": "На проверке",
  "listing.approved": "Опубликована",
  "listing.rejected": "Отклонена",
  "listing.suspended": "Приостановлена",
  "listing.unlisted": "Снята с публикации",
  "listing.eyebrow": "Маркетплейс · {symbol} {tf}",
  "listing.verified": "Подтверждённая история ({type})",
  "listing.cloneAllowed": "Копирование правил разрешено",
  "listing.trackReturn": "Подтверждённая доходность",
  "listing.net": "Итог",
  "listing.noCurve": "Кривая по дням появится после двух дней торговли.",
  "listing.curveA11y": "Средства по дням за {days} дн., доходность {ret}",
  "listing.trackNote": "По собственному запуску автора в Kalks с {since}; рассчитывается по закрытым сделкам торгового движка, а не вводится автором.",
  "listing.btSimulated": "Бэктест · моделирование",
  "listing.btNote": "Как правила торговали бы на исторических ценах с затратами этого типа счёта. Не входит в подтверждённую историю торговли выше.",
  "listing.btA11y": "Кривая средств бэктеста (моделирование)",
  "listing.about": "О стратегии", // (display)
  "listing.risk": "Риск", // (display)
  "listing.rules": "Правила", // (display)
  "listing.rulesPrivate": "Правила скрыты: скопируйте стратегию, чтобы запустить её на своём счёте.",
  "listing.reviews": "Отзывы · {n}", // (display)
  "listing.noReviews": "Отзывов пока нет.",
  "listing.subscribeFree": "Подписаться бесплатно",
  "listing.subscribePaid": "Подписаться · {price} USDT / месяц",
  "listing.copying": "Копируется на {login}",
  "listing.clonedTo": "Скопирована в Ваши стратегии",
  "listing.openDeployment": "Открыть запуск",
  "listing.openStrategy": "Открыть стратегию",
  "listing.cancel": "Отменить",
  "listing.cancelConfirm": "Отменить подписку",
  "listing.keep": "Оставить",
  "listing.cancelTitle": "Отменить подписку?", // (display)
  "listing.cancelCopy": "Стратегия сразу остановится на Вашем счёте. Её открытые позиции останутся открытыми со своими стопами и целями.",
  "listing.cancelClone": "Подписка завершится. Скопированная стратегия останется в Вашем списке.",
  // {date} = end of the paid period
  "listing.cancelPaid": "Она действует до {date} и не будет продлена. Оплата за текущий период не возвращается.",
  "listing.cancelled": "Подписка отменена",
  "listing.cancelledPaid": "Продления не будет",
  "listing.yours": "Ваша публикация",
  "listing.manageWeb": "Управлять на сайте",

  /* ---------------------------------------------------------------- */
  /* Subscribe (form), subscriptions                                   */
  /* ---------------------------------------------------------------- */
  "sub.eyebrow": "Подписка",
  "sub.title": "Подписка",
  "sub.body": "автор: {author} · {symbol} {tf}",
  "sub.how": "Способ",
  "sub.copyTitle": "Копировать на мой счёт",
  "sub.copyText": "Точная версия автора работает на Вашем счёте круглосуточно. Правила остаются скрытыми.",
  "sub.copyTextOpen": "Точная версия автора работает на Вашем счёте круглосуточно.",
  "sub.cloneTitle": "Скопировать правила",
  "sub.cloneText": "Правила станут одной из Ваших стратегий: тестируйте, изменяйте и запускайте их сами.",
  "sub.multiplierHint": "Масштабирует объёмы ордеров стратегии на Вашем счёте.",
  "sub.price": "Цена",
  "sub.dueNow": "К оплате сейчас",
  "sub.wallet": "Кошелёк (доступно)",
  "sub.renewal": "Продление",
  "sub.noCharge": "Бесплатно, ничего не списывается",
  "sub.shortTitle": "Недостаточно USDT",
  "sub.shortBody": "В кошельке должно быть доступно не менее {amount} USDT.",
  "sub.deposit": "Пополнить",
  "sub.liveBody": "Стратегия размещает на этом счёте реальные ордера на реальные деньги и может их потерять.",
  "sub.ackPay": "Списать {price} USDT с моего кошелька Kalks сейчас и каждые 30 дней, пока я не отменю подписку.",
  "sub.doneTitle": "Подписка оформлена", // (display)
  // {title} = strategy, {account} = "Demo 50000083"
  "sub.doneCopy": "«{title}» работает на {account}.",
  "sub.doneClone": "«{title}» теперь одна из Ваших стратегий.",
  "sub.charged": "С Вашего кошелька списано {amount} USDT.",
  // the answer to a subscribe request was lost: the app re-reads the listing before a retry
  "sub.noAnswer": "Ответ не получен. Возможно, подписка всё же оформлена.",
  "sub.checkingTitle": "Проверяем подписку",
  "sub.checkingBody": "Ответ потерялся по пути. Мы сверяемся с сервером, прежде чем Вы сможете повторить попытку, чтобы оплата не списалась дважды.",
  "sub.noAnswerRetry": "Ответа по-прежнему нет, и новой подписки на Вашем аккаунте нет. Можно попробовать снова.",
  "sub.notThrough": "Подписка не оформлена, и ничего не списано (списанная сумма возвращается в кошелёк). Можно попробовать снова.",
  "sub.unfinished": "Подписка ещё настраивается на сервере. Прежде чем пробовать снова, проверьте раздел Маркетплейс › Подписки и историю кошелька или обратитесь в поддержку.",
  "sub.free": "Бесплатная подписка: ничего не списано.",
  "sub.copyOn": "копирование на {login}",
  "sub.cloned": "правила скопированы",
  "sub.renews": "продление {date}",
  "sub.ends": "окончание {date}",
  "sub.status.active": "Активна",
  "sub.status.cancelled": "Отменена",
  "sub.status.expired": "Истекла",
  "sub.status.past_due": "Ожидает оплаты",

  "review.title": "Оцените", // (display)
  "review.rating": "Ваша оценка",
  "review.stars": {
    one: "{count} звезда",
    few: "{count} звезды",
    many: "{count} звёзд",
    other: "{count} звезды",
  },
  "review.comment": "Комментарий (необязательно)",
  "review.placeholder": "Как она торговала у Вас?",
  "review.post": "Опубликовать отзыв",
  "review.saved": "Отзыв сохранён",
  "review.rate": "Оценить",
  "review.edit": "Изменить отзыв",
  "review.you": "Вы",

  /* ---------------------------------------------------------------- */
  /* API keys and webhooks                                             */
  /* ---------------------------------------------------------------- */
  "keys.eyebrow": "Разработчикам",
  "keys.title": "API", // (display)
  "keys.subtitle": "Ключи для Ваших торговых программ и URL вебхуков для сигналов (TradingView и других).",
  "keys.requests24h": "Запросы · 24 ч",
  "keys.errors": "Ошибки",
  // requests refused by the rate limit
  "keys.limited": "Ограничено",
  "keys.p50": "Медиана",
  "keys.writes": "Ордера",
  "keys.keys": "API-ключи", // (display)
  "keys.keysSub": "Активных: {n} · до 20",
  "keys.none": "API-ключей нет. Создайте ключ в личном кабинете на сайте.",
  "keys.status.active": "Активен",
  "keys.status.revoked": "Отозван",
  "keys.status.expired": "Истёк",
  "keys.scope.read": "Чтение",
  "keys.scope.trade": "Торговля",
  // {ips} = list of IP addresses
  "keys.ips": "Только с {ips}",
  "keys.anyIp": "С любого IP-адреса",
  "keys.expires": "Действует до {date}",
  "keys.noExpiry": "Бессрочно",
  "keys.lastUsed": "использован {ago}",
  "keys.revoke": "Отозвать",
  "keys.revokeTitle": "Отозвать ключ?", // (display)
  "keys.revokeBody": "«{name}» ({id}) сразу перестанет работать во всех программах, которые его используют. Это действие нельзя отменить.",
  "keys.revoked": "«{name}» отозван",
  "keys.webTitle": "Создание на сайте",
  "keys.webBody": "Новые ключи и вебхуки создаются в личном кабинете: секрет ключа и URL вебхука показываются один раз, там их можно скопировать в Ваши торговые инструменты.",
  "keys.openWeb": "Открыть личный кабинет",
  "keys.killHint": "Нужно остановить всё сразу? Аварийная остановка на экране Algo останавливает все стратегии и блокирует ордера через вебхуки и API.",

  "hooks.title": "Вебхуки", // (display)
  "hooks.sub": "{n} из 20",
  "hooks.none": "Вебхуков нет. Создайте вебхук в личном кабинете на сайте.",
  // {hint} = the URL's last characters
  "hooks.hint": "URL …{hint}",
  "hooks.accounts": {
    one: "{count} счёт",
    few: "{count} счёта",
    many: "{count} счетов",
    other: "{count} счёта",
  },
  "hooks.today": {
    zero: "сегодня сигналов нет",
    one: "{count} сигнал сегодня",
    few: "{count} сигнала сегодня",
    many: "{count} сигналов сегодня",
    other: "{count} сигнала сегодня",
  },
  "hooks.used": "использован {ago}",
  "hooks.on": "Вкл.",
  "hooks.off": "Выкл.",
  "hooks.switch": "Вебхук «{name}» включён",
  "hooks.passphrase": "Нужна кодовая фраза",
  "hooks.noPassphrase": "Без кодовой фразы",
  "hooks.delete": "Удалить",
  "hooks.deleteTitle": "Удалить вебхук?", // (display)
  "hooks.deleteBody": "«{name}» и его секретный URL сразу перестанут работать; отправленные на него сигналы будут отклоняться. Это действие нельзя отменить.",
  "hooks.deleted": "«{name}» удалён",
  "hooks.alerts": "Последние сигналы", // (display)
  "hooks.alertsSub": "Каждый сигнал с результатом по каждому счёту",
  // Alert statuses (server values)
  "hooks.status.accepted": "Принят",
  "hooks.status.partial": "Частично",
  "hooks.status.failed": "Ошибка",
  "hooks.status.received": "Получен",
  "hooks.status.rejected": "Отклонён",
  "hooks.status.blocked": "Заблокирован (аварийная остановка)",
  // Each account's result of an alert (server values)
  "hooks.result.filled": "исполнен",
  "hooks.result.pending": "ордер размещён",
  "hooks.result.closed": "закрыт",
  "hooks.result.nothing_to_close": "нечего закрывать",
  "hooks.result.rejected": "отклонён",
};
export default mobileAlgo;
