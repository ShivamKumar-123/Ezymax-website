import type { NsMessages } from "../../core";

// Kalks mobile app: Prop (challenge catalogue and checkout, live rule dashboard, payouts, certificates).
// "Kalks", "Kalks Prop", "Kalks Trader", "Kalks-Live", "USDT", "New York" and "17:00" stay as they are.
// Titles shown in tall uppercase display type are marked "display": keep them short.
const mobileProp: NsMessages<"mobileProp"> = {
  // Prop home
  "home.eyebrow": "Kalks Prop",
  "home.title": "Получите капитал", // display
  "home.subtitle": "Пройдите челлендж, получите фондированный счёт и оставляйте себе до {split}% прибыли. Все проп-счета симулированные.",
  "home.subtitleNoSplit": "Пройдите челлендж, получите фондированный счёт и оставляйте себе долю прибыли. Все проп-счета симулированные.",
  "home.payouts": "Выплаты",
  "home.payoutsReady": "Доступно {amount}",
  "home.payoutsNone": "Пока нет доступных",
  "home.certificates": "Сертификаты",
  "home.certCount": {
    one: "Получено: {count}",
    few: "Получено: {count}",
    many: "Получено: {count}",
    other: "Получено: {count}",
  },
  "home.mine": "Ваши челленджи",
  "home.past": "Прошлые челленджи",
  "home.showAll": "Показать все ({count})",
  "home.yourCertificates": "Ваши сертификаты",
  "home.plans": "Выберите челлендж",
  "home.newChallenge": "Начать новый челлендж",
  "home.emptyTitle": "Челленджей нет", // display
  "home.emptyBody": "Новые планы челленджей готовятся. Пожалуйста, загляните позже.",
  "home.mineError": "Не удалось загрузить Ваши челленджи.",
  "home.plansError": "Не удалось загрузить планы челленджей.",

  // How it works (numbered 01–04 on the Prop home)
  "how.title": "Как это работает",
  "how.1.title": "Выберите план",
  "how.1.body": "Выберите модель и размер счёта. Оплата списывается с Вашего USDT-кошелька один раз.",
  "how.2.title": "Достигните цели",
  "how.2.body": "Достигните цели по прибыли в рамках лимитов дневного убытка и просадки, торгуя не меньше минимального числа дней.",
  "how.3.title": "Получите фондирование",
  "how.3.body": "После прохождения фондированный счёт открывается автоматически, а Вы получаете сертификат, которым можно поделиться.",
  "how.4.title": "Получайте выплаты",
  "how.4.body": "Запрашивайте свою долю прибыли на USDT-кошелёк в каждом цикле выплат.",
  "how.enforce": "Лимиты проверяются на сервере каждую секунду по средствам. Предупреждения приходят при 50, 75 и 90% дневного убытка; нарушение закрывает все позиции и завершает челлендж.",

  // Plan models
  "type.oneStep": "1 этап",
  "type.twoStep": "2 этапа",
  "type.instant": "Мгновенный",
  "typeText.oneStep": "Один этап оценки. Достигните цели, соблюдайте лимиты — и получите фондирование.",
  "typeText.twoStep": "Два этапа оценки с более низкими целями и более широкими лимитами.",
  "typeText.instant": "Без оценки. Сразу начните на фондированном счёте с более строгими лимитами.",

  // Plan card
  "plan.refundable": "С возвратом оплаты",
  "plan.fee": "Стоимость",
  "plan.account": "Счёт",
  "plan.leverage": "Плечо 1:{n}",
  "plan.target": "Цель",
  "plan.dailyLoss": "Дневной убыток",
  "plan.maxDD": "Макс. просадка",
  "plan.static": "статическая",
  "plan.trailing": "трейлинговая",
  "plan.start": "Начать · {fee}",

  // Checkout
  "checkout.eyebrow": "Оплата",
  "checkout.fee": "Разовая оплата",
  "checkout.chargedRefund": "Оплата с Вашего USDT-кошелька. Возвращается с первой выплатой.",
  "checkout.chargedNoRefund": "Оплата с Вашего USDT-кошелька. Без возврата.",
  "checkout.walletBalance": "Баланс кошелька: {balance} USDT",
  "checkout.shortTitle": "На кошельке не хватает средств",
  "checkout.short": "На кошельке {balance} USDT. Пополните его ещё на {missing} USDT, чтобы оплатить этот челлендж.",
  "checkout.rules": "Правила",
  "checkout.limitsNote": "Лимиты рассчитываются в процентах от начального баланса. Нарушение дневного убытка или максимальной просадки приводит к провалу счёта и закрытию всех позиций по рынку. Торговый день начинается в 17:00 New York.",
  "checkout.agree": "Я ознакомился(-ась) с правилами и понимаю, что счёт симулированный и автоматически считается проваленным при нарушении лимита убытка.",
  "checkout.pay": "Оплатить {fee}",
  "checkout.retry": "Повторить · {fee}",
  "checkout.paying": "Оплата…",
  "checkout.goToMine": "Мои челленджи",
  "checkout.readyTitle": "Челлендж начат", // display
  "checkout.readyBody": "{fee} оплачено с Вашего USDT-кошелька, счёт {size} ({phase}) открыт. Правила действуют с этого момента.",
  "checkout.savePasswords": "Сохраните эти пароли сейчас: они показываются только один раз, и мы их не храним. Торговать на этом счёте из приложения можно и без них.",
  "checkout.passwordsShown": "Торговые пароли были показаны при первом подтверждении покупки. Торговать на этом счёте из приложения можно и без них.",
  "checkout.viewChallenge": "Открыть челлендж",
  "checkout.readOnly": "В этом сеансе нельзя покупать челленджи.",

  // Account credentials
  "cred.login": "Логин",
  "cred.server": "Сервер",
  "cred.password": "Торговый пароль",
  "cred.investorPassword": "Инвесторский пароль (только чтение)",
  "cred.show": "Показать пароль",
  "cred.hide": "Скрыть пароль",
  "copied": "Скопировано: {what}",
  "a11y.copy": "Копировать: {what}",

  // Challenge statuses
  "status.pendingPayment": "Ожидает оплаты",
  "status.provisioning": "Открытие счёта",
  "status.active": "Активен",
  "status.funded": "Фондирован",
  "status.failed": "Не пройден",
  "status.closed": "Закрыт",
  "status.paymentFailed": "Ошибка оплаты",
  // {phase} is the phase name from the plan, e.g. "Phase 2"
  "stage.active": "{phase} · Активен",
  "stage.failed": "{phase} · Не пройден",
  "phaseStatus.provisioning": "Открывается",
  "phaseStatus.active": "Текущий",
  "phaseStatus.passed": "Пройден",
  "phaseStatus.failed": "Не пройден",
  "phaseStatus.closed": "Закрыт",

  // Challenge cards (Prop home)
  "card.target": "Цель по прибыли",
  "card.profit": "Прибыль",
  "card.equity": "Средства {amount}",
  "card.dailyLeft": "Остаток дневного лимита {amount}",
  "card.opening": "Ваш торговый счёт открывается. Это займёт несколько секунд.",

  // Dashboard
  "dash.equity": "Средства",
  "dash.balance": "Баланс",
  "dash.floating": "Плавающий",
  "dash.open": "Открыто",
  "dash.sinceStart": "с начала этапа",
  "dash.rules": "Правила",
  "dash.rulesTitle": "Правила этого челленджа",
  "dash.notFound": "Челлендж не найден", // display
  "dash.notFoundBody": "Возможно, он был открыт под другим входом.",
  "dash.backToProp": "К проп-челленджам",
  "live.live": "Онлайн",
  "live.connecting": "Подключение…",
  "live.offline": "Офлайн",
  // {time}: date and time of the last rule check
  "live.updated": "Проверено {time}",
  // {time}: when the phase ended
  "live.final": "Итог · {time}",

  // Rule names (gauges, the rule log)
  "rule.dailyLoss": "Дневной убыток",
  "rule.maxDrawdown": "Макс. просадка",
  "rule.profitTarget": "Цель по прибыли",
  "rule.tradingDays": "Торговые дни",
  "rule.timeLimit": "Лимит времени",
  "rule.weekendHolding": "Удержание на выходных",
  "rule.newsWindow": "Окно новостей",
  "rule.bannedStrategy": "Запрещённая стратегия",
  "rule.consistency": "Стабильность",
  "rule.riskDesk": "Решение отдела рисков",
  "ruleState.ok": "В процессе",
  "ruleState.passed": "Выполнено",
  "ruleState.failed": "Нарушено",
  "ruleState.off": "Выкл.",

  // Gauges
  "target.ofTarget": "от цели",
  "target.of": "Цель {amount} ({pct}%)",
  "target.left": "Осталось {amount}",
  "target.reachedBy": "Достигнута, сверх цели {amount}",
  "limit.left": "Осталось {amount}",
  "limit.breachAt": "Нарушение при {amount}",
  "days": {
    one: "{count} день",
    few: "{count} дня",
    many: "{count} дней",
    other: "{count} дня",
  },
  "days.of": "{v} из {min}",
  "days.count": {
    one: "{count} день",
    few: "{count} дня",
    many: "{count} дней",
    other: "{count} дня",
  },
  "days.met": "Минимум выполнен",
  "days.toGo": {
    one: "Осталось {count}",
    few: "Осталось {count}",
    many: "Осталось {count}",
    other: "Осталось {count}",
  },
  "days.noMinimum": "Без минимума",
  "time.left": "Осталось {d} д {h} ч",
  "time.deadline": "До {date}",
  "consistency.rule": "Лучший день ≤ {pct}% прибыли",
  "consistency.noProfit": "Прибыли пока нет",
  "reset.title": "Дневной лимит обновится через",
  "reset.note": "В 17:00 New York каждый торговый день",

  // Funded account: payout window ring
  "payoutHero.title": "Следующая выплата",
  "payoutHero.share": "Ваша доля на сейчас",
  "payoutHero.open": "Открыто", // display
  "payoutHero.ready": "Доступно", // display
  "payoutHero.days": {
    one: "{count} день",
    few: "{count} дня",
    many: "{count} дней",
    other: "{count} дня",
  }, // display
  "payoutHero.eligible": "Доступно сейчас при Вашей доле {split}%.",
  "payoutHero.opens": "Окно выплат откроется {date}.",
  "payoutHero.later": "Запросите выплату, когда появится прибыль, доступная для выплаты.",

  // Big states
  "hero.opening.title": "Открываем счёт", // display
  "hero.opening.body": "Оплата подтверждена, торговый счёт настраивается. Страница обновится автоматически.",
  "hero.closed.title": "Челлендж закрыт", // display
  "hero.closed.body": "Не удалось открыть торговый счёт для этого челленджа, поэтому он закрыт, а оплата возвращена на Ваш USDT-кошелёк. Если остались вопросы, обратитесь в поддержку.",
  // {reason} is the prop service's reason, in English
  "hero.closed.reason": "{reason}. Оплата возвращена на Ваш USDT-кошелёк.",
  "hero.failed.title": "{phase} не пройден", // display
  "hero.failed.on": "Завершён {date}",
  // {reason} is the breach reason from the risk engine
  "hero.failed.body": "{reason}. Все позиции закрыты, счёт отключён.",
  "hero.failed.ruleBreached": "Нарушено правило",
  // {rule} is a rule name, e.g. "Daily loss"
  "hero.failed.rule": "{rule}: лимит нарушен",
  "hero.failed.new": "Начать новый челлендж",
  "hero.passed.title": "{phase} пройден", // display
  "hero.passed.on": "Пройден {date}.",
  "hero.passed.next": "Ваш счёт для этапа «{phase}» открыт.",
  "hero.passed.nextLogin": "Ваш счёт для этапа «{phase}» открыт (#{login}).",
  "hero.passed.opening": "Следующий счёт открывается.",
  "hero.passed.certificate": "Открыть сертификат",
  "hero.passed.goNext": "Перейти к этапу «{phase}»",
  "hero.funded.title": "Фондирован", // display
  "hero.funded.body": "Торгуйте на фондированном счёте и получайте {split}% прибыли в виде выплат.",
  "hero.funded.certificate": "Открыть сертификат фондирования",

  // Warnings while trading
  "warn.lossUsed": "Использовано {pct}% дневного лимита убытка",
  "warn.lossUsedBody": "Если средства опустятся до {floor} или ниже, счёт будет провален, а все позиции закрыты. Остаток на сегодня: {left}.",
  "warn.weekend": "Закрытие перед выходными",
  "warn.weekendBody": "Этот план не допускает удержание позиций на выходных: открытые позиции закрываются в пятницу в 16:45 New York.",

  // Actions
  "action.openTrade": "Торговать на этом счёте",
  "action.trade": "Торговать",
  "action.tradeBlocked": "Торговать можно только на текущем счёте активного челленджа.",
  "action.payouts": "Выплаты",
  "action.support": "Связаться с поддержкой",

  // Equity chart
  "chart.title": "Кривая средств",
  "chart.start": "Старт",
  "chart.target": "Цель",
  "chart.ddFloor": "Макс. просадка",
  "chart.dailyFloor": "Дневной убыток",
  "chart.now": "Сейчас",
  "chart.empty": "Кривая появится после первых минут торговли.",

  // Trading stats
  "stats.title": "Торговая статистика",
  "stats.trades": "Сделки",
  "stats.winRate": "Доля прибыльных",
  "stats.profitFactor": "Профит-фактор",
  "stats.avgWin": "Ср. прибыль",
  "stats.avgLoss": "Ср. убыток",
  "stats.lots": "Лоты",
  "stats.bestDay": "Лучший день {date}: {amount}",

  // Rule log
  "events.title": "Журнал правил",
  "events.empty": "Ни предупреждений, ни нарушений. Так держать.",
  "events.equity": "средства {amount}",
  "events.limit": "лимит {amount}",
  "severity.breach": "Нарушение",
  "severity.violation": "Несоблюдение",
  "severity.warning": "Предупреждение",
  "severity.info": "Инфо",

  // Closed trades
  "trades.title": "Закрытые сделки",
  "trades.all": "Все ({count})",
  "trades.count": {
    one: "{count} закрытая сделка",
    few: "{count} закрытые сделки",
    many: "{count} закрытых сделок",
    other: "{count} закрытой сделки",
  },
  "trades.empty": "Закрытых сделок пока нет.",
  "trades.buy": "Buy",
  "trades.sell": "Sell",
  // compact durations: s = seconds, m = minutes, h = hours, d = days
  "duration.s": "{s} с",
  "duration.ms": "{m} мин {s} с",
  "duration.hm": "{h} ч {m} мин",
  "duration.dh": "{d} д {h} ч",

  // Account details
  "account.title": "Счёт",
  "account.split": "Ваша доля",
  "account.initial": "Начальный баланс",
  "account.started": "Начало этапа",
  "account.ended": "Завершён",
  "account.deadline": "Срок",
  "account.passwordNote": "Торговые пароли были показаны один раз при покупке. Кнопка «Торговать на этом счёте» выполняет вход без них.",

  // Payouts
  "payouts.title": "Выплаты", // display
  "payouts.available": "Доступно сейчас",
  "payouts.eligibleCount": {
    one: "Доступно: {eligible} из {count} фондированного счёта",
    few: "Доступно: {eligible} из {count} фондированных счетов",
    many: "Доступно: {eligible} из {count} фондированных счетов",
    other: "Доступно: {eligible} из {count} фондированных счетов",
  },
  "payouts.requests": {
    one: "{count} запрос",
    few: "{count} запроса",
    many: "{count} запросов",
    other: "{count} запроса",
  },
  "payouts.count": {
    one: "{count} выплата",
    few: "{count} выплаты",
    many: "{count} выплат",
    other: "{count} выплаты",
  },
  "payouts.paidToDate": "Выплачено всего",
  "payouts.funded": "Фондированные счета",
  "payouts.account": "Счёт {size}", // display
  "payouts.quote": "Расчёт выплаты",
  "payouts.eligibleNow": "Доступно сейчас",
  "payouts.notYet": "Пока недоступно",
  "payouts.toWallet": "на Ваш кошелёк",
  "payouts.yourSplit": "Ваша доля",
  "payouts.firmShare": "Доля компании",
  "payouts.alreadyRefunded": "Уже возвращено",
  "payouts.withFirst": "С первой выплатой",
  "payouts.opens": "Откроется {date}.",
  "payouts.minimum": "Минимум {amount}.",
  "payouts.kycNote": "Подтвердите личность, чтобы запросить эту выплату.",
  "payouts.kycPendingNote": "Вы сможете запросить эту выплату после одобрения верификации личности.",
  "payouts.readOnly": "В этом сеансе нельзя запрашивать выплаты.",
  "payouts.request": "Запросить выплату",
  // opens the account's live rule dashboard; short: it shares a row with Trade
  "payouts.dashboard": "Правила",
  "payouts.history": "История",
  "payouts.historyEmpty": "Выплат пока нет.",
  "payouts.emptyTitle": "Нет фондированных счетов", // display
  "payouts.emptyBody": "Пройдите челлендж, чтобы получить фондированный счёт. Когда на нём появится прибыль, доступная для выплаты, запросите её здесь.",
  "payouts.emptyAction": "Получить фондирование",
  "payoutStatus.pending": "На рассмотрении",
  "payoutStatus.approved": "Одобрено",
  "payoutStatus.paid": "Выплачено",
  "payoutStatus.rejected": "Отклонено",
  "payoutStatus.failed": "Ошибка",
  "split.title": "Доля прибыли и масштабирование",
  "split.upTo": "До {pct}% с масштабированием",
  "split.cycle": "Выплаты",
  // {days} e.g. "14 days"
  "split.first": "Первая через {days}",
  "split.firstNow": "С первого дня",
  // {months} e.g. "4 months"; {cap} e.g. "$2,000,000"
  "scaling.text": "Получите {profit}% прибыли за {months}, и счёт увеличится на {increase}%, но не более чем до {cap}.",
  "scaling.none": "Этот план не предусматривает масштабирования счёта.",
  "months": {
    one: "{count} месяц",
    few: "{count} месяца",
    many: "{count} месяцев",
    other: "{count} месяца",
  },

  // Payout request sheet
  "request.eyebrow": "Запрос выплаты",
  "request.profit": "Прибыль на счёте",
  "request.share": "Ваша доля ({pct}%)",
  "request.feeRefund": "Возврат оплаты челленджа",
  "request.total": "Итого на кошелёк",
  "request.note": "Вся текущая прибыль сразу списывается с торгового счёта, чтобы её нельзя было потерять в торговле, пока идёт рассмотрение. После одобрения Ваша доля зачисляется на USDT-кошелёк; если запрос отклонён, прибыль возвращается на счёт.",
  "request.submit": "Запросить {amount}",
  "request.done": "Выплата запрошена",
  "request.doneBody": "{amount} поступит на Ваш USDT-кошелёк после одобрения.",

  // Identity verification (payouts)
  "kyc.verified": "Личность подтверждена: выплаты могут быть одобрены.",
  "kyc.pendingTitle": "Верификация на проверке",
  "kyc.pendingText": "Ваша верификация на проверке. Вы сможете запросить выплату после подтверждения Вашей личности.",
  "kyc.requiredTitle": "Подтвердите личность",
  "kyc.requiredText": "Выплаты производятся только верифицированным трейдерам. Пройдите верификацию до первой выплаты.",
  "kyc.rejectedText": "Ваша верификация отклонена. Отправьте документы повторно, чтобы получать выплаты.",

  // Why a payout can't be requested yet
  "blocker.notYetEligible": "Окно выплат ещё не открыто.",
  "blocker.belowMinimum": "Прибыль ниже минимальной выплаты.",
  "blocker.positionsOpen": "Закройте все открытые позиции, чтобы запросить выплату.",
  "blocker.payoutPending": "Выплата уже на рассмотрении.",
  "blocker.consistency": "Правило стабильности не выполнено: на Ваш лучший день приходится слишком большая доля прибыли.",

  // Certificates
  "certs.title": "Сертификаты", // display
  "certs.subtitle": "За каждый пройденный этап, каждый фондированный счёт и каждую выплату выдаётся сертификат, который может проверить любой.",
  "certs.kind.pass": "Этап пройден",
  "certs.kind.funded": "Фондированный трейдер",
  "certs.kind.payout": "Выплата",
  "certs.revoked": "Отозван",
  "certs.revokedBody": "Этот сертификат отозван Kalks и больше не действителен, поэтому им нельзя поделиться.",
  "certs.meta": "{plan} · {size} · {date}",
  "certs.number": "№ {code}",
  "certs.shareImage": "Поделиться изображением",
  "certs.shareLink": "Поделиться ссылкой",
  "certs.copyLink": "Копировать ссылку",
  "certs.linkCopied": "Ссылка для проверки скопирована",
  "certs.shareTitle": "Мой сертификат Kalks Prop",
  "certs.shareMessage": "Мой сертификат Kalks Prop. Проверить его можно здесь:",
  "certs.shareFailed": "Не удалось поделиться сертификатом. Пожалуйста, попробуйте ещё раз.",
  "certs.shareUnavailable": "На этом устройстве функция «Поделиться» недоступна.",
  "certs.emptyTitle": "Сертификатов пока нет", // display
  "certs.emptyBody": "Пройдите этап челленджа, чтобы получить первый сертификат с публичной ссылкой, которую может проверить любой.",
  "certs.emptyAction": "Смотреть челленджи",

  // Rule words shared by the checkout and the rules sheet
  "accountSize": "Размер счёта",
  "profitSplit": "Доля прибыли",
  "feeRefund": "Возврат оплаты",
  "nonRefundable": "Без возврата",
  "leverage": "Кредитное плечо",
  "none": "Нет",
  "allowed": "Разрешено",
  "notAllowed": "Запрещено",
  "noTimeLimit": "Без ограничения по времени",
  // {phase} is the phase name, e.g. "Phase 1"
  "rules.phaseTarget": "{phase}: цель",
  "rules.phaseMinDays": "{phase}: минимум дней",
  "rules.phaseTimeLimit": "{phase}: лимит времени",
  "rules.evaluation": "Оценка",
  "rules.evaluationNone": "Нет, фондирование с первого дня",
  "rules.dailyLoss": "Лимит дневного убытка",
  "rules.dailyLossBalance": "{pct}% · {amount} · от баланса на 17:00 New York",
  "rules.dailyLossEquity": "{pct}% · {amount} · от большего из баланса и средств на 17:00 New York",
  "rules.ddStatic": "{pct}% статическая",
  "rules.ddTrailing": "{pct}% трейлинговая",
  "rules.ddLocks": "{dd}, фиксируется на стартовом уровне",
  // ≤ = at most
  "rules.consistencyValue": "Лучший день ≤ {pct}% общей прибыли",
  "rules.news": "Торговля на новостях",
  "rules.newsBlocked": "Запрещено в пределах ±{min} мин от важных новостей",
  "rules.newsBlockedFails": "Запрещено в пределах ±{min} мин от важных новостей (нарушение приводит к провалу счёта)",
  "rules.weekendClosed": "Позиции закрываются в пятницу в 16:45 New York",
  "rules.ea": "Советники (EA)",
  "rules.banned": "Запрещённые стратегии",
  "rules.splitScaling": "{split}% с ростом до {max}%",
  "rules.firstPayout": "Первая выплата",
  // {freq} is a lower-case payout cycle, e.g. "weekly"
  "rules.firstPayoutValue": "Через {days}, затем {freq} · мин. {min}",
  "rules.refunded": "Возвращается с первой выплатой",

  // Banned trading strategies
  "banned.hft": "Высокочастотная торговля",
  "banned.latencyArbitrage": "Арбитраж задержек",
  "banned.tickScalping": "Тиковый скальпинг",
  "banned.crossAccountCopying": "Копирование между счетами",
  "banned.crossAccountHedging": "Хеджирование между счетами",
  "banned.martingale": "Мартингейл",
  "banned.grid": "Сеточная торговля",

  // Payout cycle, lower case: used inside sentences ("then weekly")
  "payoutFreq.weekly": "еженедельно",
  "payoutFreq.biWeekly": "раз в 2 недели",
  "payoutFreq.monthly": "ежемесячно",
  "payoutFreq.onDemand": "по запросу",

  // Errors (messages for the prop service's error codes)
  "errorLink.deposit": "Пополнить",
  "errorLink.verify": "Пройти верификацию",
  "error.insufficientFunds": "Баланса Вашего USDT-кошелька недостаточно для этой оплаты. Внесите USDT и повторите попытку.",
  "error.kycRequired": "Пройдите верификацию личности, прежде чем запрашивать выплату.",
  "error.paymentPending": "Нам пока не удалось подтвердить оплату из кошелька. Повторите попытку через минуту: повторного списания не будет.",
  "error.paymentFailed": "Оплата из кошелька не прошла. Средства не списаны.",
  "error.walletPending": "Кошелёк ещё не подтвердил операцию. Пожалуйста, повторите попытку через минуту.",
  "error.walletRejected": "Кошелёк отклонил этот платёж. Пожалуйста, обратитесь в поддержку.",
  "error.provisioning": "Оплата получена. Ваш торговый счёт ещё открывается: он появится среди Ваших челленджей в течение минуты.",
  "error.planUnavailable": "Этот план или размер больше недоступен. Пожалуйста, выберите другой.",
  "error.notYetEligible": "Этот счёт пока не имеет права на выплату.",
  "error.belowMinimum": "Прибыль ниже минимальной суммы выплаты.",
  "error.positionsOpen": "Закройте все открытые позиции, прежде чем запрашивать выплату.",
  "error.payoutPending": "Выплата по этому счёту уже на рассмотрении.",
  "error.consistency": "Правило стабильности пока не выполнено: на Ваш лучший день приходится слишком большая доля прибыли.",
  "error.notFunded": "Выплаты доступны только на фондированных счетах.",
  "error.accountUnavailable": "Не удалось открыть торговый счёт для этого челленджа, поэтому оплата возвращена на Ваш USDT-кошелёк. Если это повторяется, обратитесь в поддержку.",
  "error.idempotencyConflict": "Эта оплата уже использовалась для другой покупки. Закройте её и начните заново.",
  "error.notActive": "Этот челлендж неактивен.",
  "error.accountLimit": "Вы достигли максимального числа проп-счетов. Обратитесь в поддержку, чтобы увеличить лимит.",
  "error.staffReadOnly": "Это сеанс сотрудника только для чтения. Изменения запрещены.",
  "error.engine": "Торговый сервер не ответил. Пожалуйста, повторите попытку чуть позже.",
  "error.generic": "Что-то пошло не так. Пожалуйста, повторите попытку.",
  "load.title": "Проп недоступен", // display
  "load.body": "Не удалось связаться с проп-сервисом. Ваши счета в безопасности; пожалуйста, повторите попытку чуть позже.",
};
export default mobileProp;
