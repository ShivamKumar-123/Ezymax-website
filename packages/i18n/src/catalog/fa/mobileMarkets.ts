import type { NsMessages } from "../../core";

// Kalks mobile app: Markets tab (watchlist). Segment names, Bid / Ask and search reuse the `market` namespace.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "قیمت‌های زنده",
  "empty.favourites.title": "هنوز علاقه‌مندی ندارید",
  "empty.favourites.body": "هر نمادی را لمس کنید و نگه دارید تا اینجا سنجاق شود.",
  "empty.favourites.action": "مرور فارکس",
  "fav.added": "{symbol} به علاقه‌مندی‌ها اضافه شد",
  "fav.removed": "{symbol} از علاقه‌مندی‌ها حذف شد",
  "a11y.row": "{symbol}، {name}. نمودار را باز می‌کند؛ برای افزودن یا حذف از علاقه‌مندی‌ها، لمس کنید و نگه دارید.",
  "a11y.search": "جستجوی نمادها",
  cancel: "لغو",
  "status.connecting": "در حال اتصال به قیمت‌ها…",
  "status.offline": "قیمت‌ها متوقف شد: اتصال برقرار نیست",
};
export default mobileMarkets;
