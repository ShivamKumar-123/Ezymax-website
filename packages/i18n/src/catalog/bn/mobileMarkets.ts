import type { NsMessages } from "../../core";

// Kalks mobile app: Markets tab (watchlist). Segment names, Bid / Ask and search reuse the `market` namespace.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "লাইভ প্রাইস",
  "empty.favourites.title": "এখনো কোনো পছন্দের সিম্বল নেই",
  "empty.favourites.body": "এখানে পিন করতে যেকোনো সিম্বল চেপে ধরে রাখুন।",
  "empty.favourites.action": "ফরেক্স দেখুন",
  "fav.added": "{symbol} পছন্দের তালিকায় যোগ হয়েছে",
  "fav.removed": "{symbol} পছন্দের তালিকা থেকে সরানো হয়েছে",
  "a11y.row": "{symbol}, {name}। চার্ট খোলে; পছন্দের তালিকায় যোগ করতে বা সরাতে চেপে ধরে রাখুন।",
  "a11y.search": "সিম্বল খুঁজুন",
  cancel: "বাতিল",
  "status.connecting": "প্রাইসের সাথে সংযোগ করা হচ্ছে…",
  "status.offline": "প্রাইস থেমে আছে: সংযোগ নেই",
};
export default mobileMarkets;
