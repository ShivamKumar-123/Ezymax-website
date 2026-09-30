import type { NsMessages } from "../../core";

// Kalks mobile app: Markets tab (watchlist). Segment names, Bid / Ask and search reuse the `market` namespace.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "लाइव कीमतें",
  "empty.favourites.title": "अभी कोई पसंदीदा नहीं",
  "empty.favourites.body": "किसी भी सिंबल को यहाँ पिन करने के लिए उसे दबाकर रखें।",
  "empty.favourites.action": "फ़ॉरेक्स देखें",
  "fav.added": "{symbol} पसंदीदा में जोड़ा गया",
  "fav.removed": "{symbol} पसंदीदा से हटाया गया",
  "a11y.row": "{symbol}, {name}। चार्ट खोलता है; पसंदीदा में जोड़ने या हटाने के लिए दबाकर रखें।",
  "a11y.search": "सिंबल खोजें",
  cancel: "रद्द करें",
  "status.connecting": "कीमतों से कनेक्ट हो रहा है…",
  "status.offline": "कीमतें रुकी हैं: कोई कनेक्शन नहीं",
};
export default mobileMarkets;
