import type { NsMessages } from "../../core";

// Kalks mobile app: Markets tab (watchlist). Segment names, Bid / Ask and search reuse the `market` namespace.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "أسعار مباشرة",
  "empty.favourites.title": "لا توجد مفضّلات بعد",
  "empty.favourites.body": "اضغط مطولًا على أي رمز لتثبيته هنا.",
  "empty.favourites.action": "تصفّح الفوركس",
  "fav.added": "تمت إضافة {symbol} إلى المفضّلة",
  "fav.removed": "تمت إزالة {symbol} من المفضّلة",
  "a11y.row": "{symbol}، {name}. يفتح الرسم البياني؛ اضغط مطولًا للإضافة إلى المفضّلة أو الإزالة منها.",
  "a11y.search": "بحث عن رموز",
  cancel: "إلغاء",
  "status.connecting": "جارٍ الاتصال بالأسعار…",
  "status.offline": "الأسعار متوقفة: لا يوجد اتصال",
};
export default mobileMarkets;
