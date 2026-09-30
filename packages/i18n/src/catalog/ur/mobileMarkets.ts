import type { NsMessages } from "../../core";

// Kalks mobile app: Markets tab (watchlist). Segment names, Bid / Ask and search reuse the `market` namespace.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "لائیو قیمتیں",
  "empty.favourites.title": "ابھی کوئی پسندیدہ نہیں",
  "empty.favourites.body": "کسی بھی سمبل کو یہاں پن کرنے کے لیے اسے دبا کر رکھیں۔",
  "empty.favourites.action": "فاریکس دیکھیں",
  "fav.added": "{symbol} پسندیدہ میں شامل ہو گیا",
  "fav.removed": "{symbol} پسندیدہ سے ہٹا دیا گیا",
  "a11y.row": "{symbol}، {name}۔ چارٹ کھولتا ہے؛ پسندیدہ میں شامل کرنے یا ہٹانے کے لیے دبا کر رکھیں۔",
  "a11y.search": "سمبلز تلاش کریں",
  cancel: "منسوخ کریں",
  "status.connecting": "قیمتوں سے رابطہ ہو رہا ہے…",
  "status.offline": "قیمتیں رکی ہوئی ہیں: کوئی کنکشن نہیں",
};
export default mobileMarkets;
