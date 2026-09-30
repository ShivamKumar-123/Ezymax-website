import type { NsMessages } from "../../core";

// Kalks Trader left panels: Market Watch (quotes list), segment chips and Navigator.
const market: NsMessages<"market"> = {
  // Market Watch header and tabs
  title: "Обзор рынка",
  collapse: "Свернуть",
  "tab.symbols": "Символы",
  "tab.details": "Детали",
  "tab.favourites": "Избранное",
  segmentAria: "Раздел обзора рынка",
  searchPlaceholder: "Поиск символа",
  searchAria: "Поиск в обзоре рынка",
  clear: "Очистить",

  // Market Watch columns (shown uppercase)
  "col.symbol": "Символ",
  "col.bid": "Bid",
  "col.ask": "Ask",
  "col.spread": "Спр",
  "col.spreadTitle": "Спред, пункты",
  "col.change": "Изм%",

  // Row / hover card
  "row.title": "{name} · спред {spread}",
  "tip.low": "Мин",
  "tip.high": "Макс",
  "tip.spread": "Спред",
  "tip.range": "Диап.",
  bid: "Bid",
  ask: "Ask",

  // Empty states and footer
  "empty.favourites": "В избранном пока пусто. Нажмите правой кнопкой на символ, чтобы добавить его.",
  "empty.favouritesTitle": "В избранном пусто",
  "empty.noMatch": "Символы не найдены.",
  "footer.count": "{shown} / {total} символов",
  "footer.hint": "двойной клик: график",

  // Context menu
  "menu.newOrder": "Новый ордер",
  "menu.chartWindow": "Окно графика",
  "menu.openInActive": "Открыть в активном графике",
  "menu.depth": "Стакан цен",
  "menu.specification": "Спецификация",
  "menu.removeFavourite": "Убрать из избранного",
  "menu.addFavourite": "Добавить в избранное",
  "menu.hide": "Скрыть",
  "menu.showAll": "Показать все",

  // Toasts
  "toast.hidden": "{symbol} скрыт из обзора рынка",
  "toast.hiddenDesc": "Показать все символы можно через контекстное меню.",
  "toast.opened": "{symbol} открыт в активном графике",

  // Segment chips (asset classes)
  "segment.favourites": "Избранное",
  "segment.forex": "Форекс",
  "segment.metals": "Металлы",
  "segment.indices": "Индексы",
  "segment.energies": "Энергоносители",
  "segment.crypto": "Крипто",
  "segment.stocks": "Акции",
  "segment.aria": "Класс активов",
  "segment.title": {
    one: "{label} · {count} символ",
    few: "{label} · {count} символа",
    many: "{label} · {count} символов",
    other: "{label} · {count} символа",
  },

  // Navigator tree
  "nav.title": "Навигатор",
  "nav.indicators": "Индикаторы",
  "nav.strategies": "Стратегии",
  "nav.scripts": "Скрипты",
  "nav.guest": "гость",
  "nav.noAccount": "Торгового счёта пока нет",
  "nav.openAccount": "Открыть счёт",
  "nav.openAccountTitle": "Создать аккаунт Kalks (откроется личный кабинет)",
  "nav.signIn": "Войти",
  "nav.signInTitle": "Войти в личный кабинет",
  "nav.accountType.live": "реальный",
  "nav.accountType.demo": "демо",
  "nav.category.trend": "Трендовые",
  "nav.category.oscillators": "Осцилляторы",
  "nav.category.volatility": "Волатильность",
  "nav.category.volume": "Объёмы",
  "nav.category.billWilliams": "Билл Вильямс",
  "nav.indicatorTitle": "{description} · Двойной клик или Enter, чтобы добавить на {symbol}, {tf}",
  "nav.strategyTitle": {
    one: "{server} · {login} · {count} сделка",
    few: "{server} · {login} · {count} сделки",
    many: "{server} · {login} · {count} сделок",
    other: "{server} · {login} · {count} сделки",
  },
  "nav.strategyRunning": "{name} уже запущена",
  "nav.strategyAttached": "{name} подключена",
  "nav.strategyDesc": "{login} · {server} · P&L за сегодня {pnl}",
  "nav.script.closeAll": "Закрыть все позиции",
  "nav.script.closeProfitable": "Закрыть прибыльные",
  "nav.script.closeLosing": "Закрыть убыточные",
  "nav.script.deletePendings": "Удалить все отложенные",
  "nav.script.breakevenAll": "Все в безубыток (SL → вход)",
  "nav.scriptTitle": "Двойной клик, чтобы запустить на текущем счёте",
  "nav.scriptsReadOnly": "Скрипты отключены в режиме только для чтения",
};
export default market;
