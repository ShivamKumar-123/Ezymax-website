import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile), Reports: Statements (/reports/statements) and Analytics (/reports/analytics).
// Most labels reuse the Client Area's portfolio.st.* / portfolio.an.* keys; only mobile-specific text is here.
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "Отчёты",
  "eyebrow.analytics": "Отчёты · USD · время сервера",

  // Account picker (a card that opens a sheet)
  "account.title": "Счёт",
  "account.choose": "Выберите счёт",
  "account.allHint": {
    one: "{count} реальный счёт",
    few: "{count} реальных счёта",
    many: "{count} реальных счетов",
    other: "{count} реального счёта",
  },
  "account.change": "Сменить счёт",

  // Statements
  "st.day": "День",
  "st.pickDay": "Выберите день",
  "st.pickFrom": "Дата начала",
  "st.pickTo": "Дата окончания",
  "st.include": "Включить",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "Подготовка…",
  "st.ready": "Выписка готова",
  "st.saved": "Сохранено как {file}",
  "st.shareTitle": "Поделиться выпиской",
  "st.failed": "Не удалось скачать выписку",
  "st.offline": "Нет подключения к сети. Подключитесь, чтобы скачивать выписки.",
  "st.monthly.empty": "Ежемесячных выписок пока нет.",
  "st.monthly.offline": "Нет подключения к сети. Подключитесь, чтобы увидеть ежемесячные выписки.",
  "st.monthly.a11y": "{month}: итог {net}, {trades}. Открывает загрузки.",
  "st.month.title": "Выписка за {month}",
  "st.month.formats": "Скачать в формате",
  "st.prevMonth": "Предыдущий месяц",
  "st.nextMonth": "Следующий месяц",

  // Analytics: hero and stat tiles
  "an.hero.label": "Чистый P&L · {period}",
  "an.hero.return": "Доходность",
  "an.hero.trades": "Сделки",
  "an.hero.lots": "Лоты",
  "an.tile.sharpe": "Коэффициент Шарпа",
  "an.tile.expectancy": "Мат. ожидание",
  "an.tile.sortino": "Сортино {value}",
  "an.tile.avgWinLoss": "Ср. прибыль / убыток",
  "an.tile.rr": "Прибыль : риск 1 : {value}",
  "an.tile.holdSplit": "Прибыльные {win} · убыточные {loss}",
  "an.tile.streaks": "Серии",
  "an.tile.streaksSub": "Прибыльных / убыточных подряд",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "Сделок пока нет",

  // Analytics: curves
  "an.curve.hint": "Коснитесь графика и удерживайте, чтобы увидеть каждый день",
  "an.curve.drawdown": "Просадка",
  "an.curve.a11y": "Средства {equity}, баланс {balance} на {date}. Максимальная просадка {drawdown}.",

  // Analytics: P&L calendar (net of closed trades per server day)
  "an.cal.title": "Календарь P&L",
  "an.cal.subtitle": "Чистый результат закрытых сделок по дням сервера",
  "an.cal.subtitleEstimated": "Дневное изменение баланса без учёта пополнений и выводов",
  "an.cal.days": {
    one: "{count} торговый день",
    few: "{count} торговых дня",
    many: "{count} торговых дней",
    other: "{count} торгового дня",
  },
  "an.cal.green": "Прибыльных: {count}",
  "an.cal.red": "Убыточных: {count}",
  "an.cal.noTrades": "Нет закрытых сделок",
  "an.cal.select": "Нажмите на день, чтобы увидеть результат",
  "an.cal.a11yDay": "{date}: {net}, {trades}",

  // Analytics: breakdowns
  "an.hour.byHour": "Чистый P&L по часам",
  "an.hour.byDayHour": "День недели × час",
  "an.hour.tap": "Нажмите на столбец или ячейку, чтобы увидеть детали",
  "an.tapBar": "Нажмите на столбец, чтобы увидеть детали",
  "an.session.best": "Лучшая",
  "an.session.asia": "Азия",
  "an.session.london": "Лондон",
  "an.session.overlap": "Лондон / Нью-Йорк",
  "an.session.newYork": "Нью-Йорк",
  "an.session.lateNewYork": "Поздний Нью-Йорк",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "Средства сейчас",
  "an.charges.total": "Уплаченные расходы",

  // Behaviour insights (the numbers come from the reports service)
  "insight.overtrading.title": {
    one: "Чрезмерная торговля: {count} день",
    few: "Чрезмерная торговля: {count} дня",
    many: "Чрезмерная торговля: {count} дней",
    other: "Чрезмерная торговля: {count} дня",
  },
  "insight.overtrading.text": "В эти дни число сделок превышало {limit} (в обычный день — {median}). Чистый результат за эти дни: {net}.",
  "insight.overtrading.tip": "Установите дневной лимит сделок: {cap}.",
  "insight.revenge.title": {
    one: "{count} возможная сделка «на отыгрыш»",
    few: "{count} возможные сделки «на отыгрыш»",
    many: "{count} возможных сделок «на отыгрыш»",
    other: "{count} возможной сделки «на отыгрыш»",
  },
  "insight.revenge.text": "Сделки, открытые в течение 15 минут после убыточного закрытия тем же объёмом или больше. Они были прибыльными в {rate}% случаев, итог — {net}.",
  "insight.revenge.tip": "После убытка сделайте паузу на 15 минут перед следующей сделкой.",
  "insight.risk.title": "Риск на убыточную сделку",
  "insight.risk.text": {
    one: "Убыточная сделка в среднем стоила {avg}% баланса, максимум — {max}%. {count} убыток превысил 2%.",
    few: "Убыточная сделка в среднем стоила {avg}% баланса, максимум — {max}%. {count} убытка превысили 2%.",
    many: "Убыточная сделка в среднем стоила {avg}% баланса, максимум — {max}%. {count} убытков превысили 2%.",
    other: "Убыточная сделка в среднем стоила {avg}% баланса, максимум — {max}%. {count} убытка превысили 2%.",
  },
  "insight.risk.tip": "Подбирайте объём позиций так, чтобы стоп-лосс стоил не более 1–2% баланса.",
  "insight.holdLosers.title": "Убыточные сделки держатся дольше прибыльных",
  "insight.holdLosers.text": "Убыточные сделки в среднем открыты {loss}, прибыльные — {win}.",
  "insight.holdLosers.tip": "Ставьте стоп-лосс при открытии сделки и не сдвигайте его.",
  "insight.stopOut.title": {
    one: "{count} закрытие по стоп-ауту",
    few: "{count} закрытия по стоп-ауту",
    many: "{count} закрытий по стоп-ауту",
    other: "{count} закрытия по стоп-ауту",
  },
  "insight.stopOut.text": "Позиции были закрыты по стоп-ауту, а не Вашим собственным стоп-лоссом.",
  "insight.stopOut.tip": "Открывайте позиции меньшего объёма, чтобы уровень маржи оставался выше уровня маржин-колла.",
  "insight.slTp.title": "Сделки, закрытые по стоп-лоссу или тейк-профиту",
  "insight.slTp.text": "По тейк-профиту: {tp}, по стоп-лоссу: {sl}, остальные закрыты вручную или дилингом.",
  "insight.slTp.tip": "Запланированные выходы делают результаты стабильнее.",
  "insight.session.title": "Лучшая сессия: {session}",
  "insight.session.text": "Сделок: {trades}, доля прибыльных {rate}%. Самая слабая: {worst} ({net}).",
  "insight.session.tip": "Сосредоточьтесь на сессии {session}.",
  "insight.tip": "Совет",

  // States
  "state.updating": "Обновление…",
  "state.stale": "Показаны сохранённые данные. Потяните вниз, чтобы обновить.",
  "state.notShared.title": "Нет доступа",
  "state.footer": "Все суммы в USD (центовые счета пересчитаны). Время — по серверу, GMT+2 / GMT+3.",
  "state.footerStatements": "Выписки — в валюте счёта (USC для центовых счетов). Время — по серверу, GMT+2 / GMT+3.",
};
export default mobileReports;
