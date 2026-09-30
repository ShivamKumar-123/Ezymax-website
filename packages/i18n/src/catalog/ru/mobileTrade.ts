import type { NsMessages } from "../../core";

// Kalks mobile app: Trade tab (chart, Sell / Buy bar, order ticket) and trade notifications.
// Trading terms follow the MetaTrader 5 localisation (see the `order` namespace). {placeholders} stay as they are.
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Header
  pickSymbol: "Выберите символ",
  searchSymbol: "Поиск символов",
  depth: "Стакан цен",
  alert: "Ценовое оповещение",
  news: "Новости по {symbol}", // a header button's accessibility label
  calendar: "Экономический календарь {currency}", // a header button's accessibility label
  "account.chip": "{type} · #{login}",
  "account.manage": "Управление счетами",
  "account.open": "Открыть счёт",

  // Chart
  "chart.indicators": "Индикаторы",
  "chart.type.candles": "Свечи",
  "chart.type.line": "Линия",
  "ind.ma": "Скользящая средняя 20",
  "ind.ema": "Экспоненциальная MA 50",
  "ind.bb": "Полосы Боллинджера 20, 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "По этому символу пока нет истории графика",
  "chart.hint": "Сведите пальцы для масштаба · проведите для прокрутки · удерживайте для перекрестия · дважды коснитесь для сброса",

  // Sell / Buy bar and ticket
  "bar.volume": "Лоты",
  "ticket.title": "Новый ордер",
  "ticket.confirmBuy": "Buy {volume} {symbol}",
  "ticket.confirmSell": "Sell {volume} {symbol}",
  "ticket.atMarket": "по рынку",
  "ticket.at": "по {price}",
  "ticket.addSl": "Добавить Стоп Лосс",
  "ticket.addTp": "Добавить Тейк Профит",
  "ticket.ifHit": "{money} при срабатывании",
  "ticket.required": "Маржа",
  "ticket.pip": "Стоимость пункта",
  "ticket.after": "Своб. маржа после",
  "ticket.notEnough": "Недостаточно свободной маржи для этого объёма.",
  "ticket.noSpecs": "Загрузка параметров контракта…",
  "ticket.distance": "{n} пп. от цены",
  "ticket.price": "Цена",

  // Rejections: a plain-language line under the reason (order.reject.<code>); the engine's own detail follows it
  "reject.no_money": "Свободной маржи не хватает для этого ордера. Уменьшите объём или пополните этот счёт.",
  "reject.insufficient_funds": "Свободной маржи не хватает для этого ордера. Уменьшите объём или пополните этот счёт.",
  "reject.market_closed": "Этот рынок сейчас закрыт. Попробуйте снова после открытия.",
  "reject.invalid_volume": "Укажите объём в пределах лимитов этого символа и с учётом шага лота.",
  "reject.max_lot": "Этот объём превышает максимум на один ордер для Вашего счёта.",
  "reject.close_only": "Сейчас на Вашем счёте можно закрывать позиции, но нельзя открывать новые.",
  "reject.symbol_close_only": "Сейчас по этому символу можно закрывать позиции, но нельзя открывать.",
  "reject.trading_disabled": "Торговля на этом счёте отключена. Подробности уточните в поддержке.",
  "reject.symbol_halted": "Торговля по этому символу приостановлена. Попробуйте позже.",
  "reject.requote.title": "Цена изменилась",
  "reject.requote": "Рынок сдвинулся, пока Ваш ордер был в пути. Проверьте новую цену и подтвердите снова.",
  "reject.invalid_sl": "Стоп Лосс находится не с той стороны от цены или слишком близко к ней.",
  "reject.invalid_tp": "Тейк Профит находится не с той стороны от цены или слишком близко к ней.",
  "reject.invalid_price": "Для этого типа ордера цена находится не с той стороны рынка.",
  "reject.off_market": "Эта цена слишком далеко от рынка. Проверьте значение.",
  "reject.stale_price": "Котировки по этому символу ненадолго приостановлены. Попробуйте чуть позже.",
  "reject.no_price": "Сейчас по этому символу нет текущей цены.",
  "reject.read_only": "С этим входом можно просматривать счёт, но нельзя торговать.",
  "reject.uncertain.title": "Нет ответа от торгового сервера",
  "reject.uncertain": "Возможно, ордер прошёл. Проверьте вкладку «Портфель», прежде чем пробовать снова.",
  "reject.uncertain.ticket": "Подтвердить повторно безопасно: один и тот же ордер нельзя разместить дважды.",

  // States
  "state.noAccount.title": "Торгового счёта пока нет",
  "state.noAccount.body": "Откройте демо-счёт, чтобы практиковаться, или реальный счёт, чтобы торговать по-настоящему.",
  "state.noAccount.action": "Открыть счёт",
  "state.connecting": "Подключение к торговому серверу…",
  "state.readOnly": "Здесь этот счёт доступен только для просмотра: цены и графики онлайн, торговля отключена.",
  "state.marketClosed.title": "Рынок закрыт",
  "state.marketClosed.body": "{symbol} снова откроется со следующей сессией. Ордера можно будет разместить после открытия.",
  "state.streamError": "Нет связи с торговым сервером",
  "state.streamErrorBody": "Ваши позиции и ордера в безопасности на сервере. Мы продолжаем попытки переподключения.",

  // Results
  "toast.filled": "{side} {volume} {symbol} исполнен",
  "toast.at": "по {price}",
  "toast.placed": "{symbol}: отложенный ордер размещён",
  "toast.duplicate": "Уже размещён как #{ticket}",
  "toast.duplicateBody": "Этот ордер уже дошёл до сервера ранее; ничего нового не открыто.",
  "toast.closed": "Позиция #{ticket} закрыта",
  "toast.partial": "Закрыто {volume} лот. по #{ticket}",
  "toast.modified": "#{ticket}: изменения сохранены",
  "toast.cancelled": "Ордер #{ticket} отменён",

  // Engine notifications while the app is open
  "notify.sl": "Сработал Стоп Лосс",
  "notify.tp": "Сработал Тейк Профит",
  "notify.order_filled": "Отложенный ордер исполнен",
  "notify.order_triggered": "Ордер сработал",
  "notify.margin_call": "Маржин-колл",
  "notify.stop_out": "Стоп-аут",
  "notify.order_rejected": "Ордер отклонён",
  "notify.order_expired": "Срок ордера истёк",
  "notify.order_cancelled": "Ордер отменён",
};
export default mobileTrade;
