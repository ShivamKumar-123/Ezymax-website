import type { NsMessages } from "../../core";

// Kalks mobile app: Markets tab (watchlist). Segment names, Bid / Ask and search reuse the `market` namespace.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "Котировки онлайн",
  "empty.favourites.title": "В избранном пусто",
  "empty.favourites.body": "Нажмите и удерживайте любой символ, чтобы закрепить его здесь.",
  "empty.favourites.action": "Смотреть форекс",
  "fav.added": "{symbol} добавлен в избранное",
  "fav.removed": "{symbol} удалён из избранного",
  "a11y.row": "{symbol}, {name}. Открывает график; нажмите и удерживайте, чтобы добавить в избранное или убрать из него.",
  "a11y.search": "Поиск символов",
  cancel: "Отмена",
  "status.connecting": "Подключение к котировкам…",
  "status.offline": "Котировки приостановлены: нет соединения",
};
export default mobileMarkets;
