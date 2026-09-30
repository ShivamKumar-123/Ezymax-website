import type { NsMessages } from "../../core";

// Kalks mobile app: Markets tab (watchlist). Segment names, Bid / Ask and search reuse the `market` namespace.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "லைவ் விலைகள்",
  "empty.favourites.title": "இன்னும் பிடித்தவை இல்லை",
  "empty.favourites.body": "இங்கே பின் செய்ய எந்தச் சிம்பலையும் அழுத்திப் பிடியுங்கள்.",
  "empty.favourites.action": "ஃபாரெக்ஸைப் பார்",
  "fav.added": "{symbol} பிடித்தவையில் சேர்க்கப்பட்டது",
  "fav.removed": "{symbol} பிடித்தவையிலிருந்து அகற்றப்பட்டது",
  "a11y.row": "{symbol}, {name}. சார்ட்டைத் திறக்கும்; பிடித்தவையில் சேர்க்க அல்லது அகற்ற அழுத்திப் பிடியுங்கள்.",
  "a11y.search": "சிம்பல்களைத் தேடு",
  cancel: "ரத்துசெய்",
  "status.connecting": "விலைகளுடன் இணைக்கிறது…",
  "status.offline": "விலைகள் நிறுத்தப்பட்டன: இணைப்பு இல்லை",
};
export default mobileMarkets;
