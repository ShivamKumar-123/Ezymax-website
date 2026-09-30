import type { NsMessages } from "../../core";

// Kalks mobile app: Trade tab (chart, Sell / Buy bar, order ticket) and trade notifications.
// Trading terms follow the `order` namespace (ஸ்டாப் லாஸ், டேக் ப்ராஃபிட், லாட்கள், பிப்ஸ்).
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Header
  pickSymbol: "சிம்பலைத் தேர்வுசெய்",
  searchSymbol: "சிம்பல்களைத் தேடு",
  depth: "டெப்த் ஆஃப் மார்க்கெட்",
  alert: "விலை அலர்ட்",
  news: "{symbol} பற்றிய செய்திகள்",
  calendar: "{currency} பொருளாதாரக் காலண்டர்",
  "account.chip": "{type} · #{login}",
  "account.manage": "கணக்குகளை நிர்வகி",
  "account.open": "கணக்கைத் திற",

  // Chart
  "chart.indicators": "இண்டிகேட்டர்கள்",
  "chart.type.candles": "கேண்டில்கள்",
  "chart.type.line": "லைன்",
  "ind.ma": "மூவிங் ஆவரேஜ் 20",
  "ind.ema": "எக்ஸ்போனென்ஷியல் MA 50",
  "ind.bb": "பொலிங்கர் பேண்ட்ஸ் 20, 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "இந்தச் சிம்பலுக்கு இன்னும் சார்ட் வரலாறு இல்லை",
  "chart.hint": "பெரிதாக்கப் பிஞ்ச் செய்யவும் · நகர்த்த இழுக்கவும் · கிராஸ்ஹேருக்கு அழுத்திப் பிடிக்கவும் · மீட்டமைக்க இருமுறை தட்டவும்",

  // Sell / Buy bar and ticket
  "bar.volume": "லாட்கள்",
  "ticket.title": "புதிய ஆர்டர்",
  "ticket.confirmBuy": "{volume} {symbol} வாங்கு",
  "ticket.confirmSell": "{volume} {symbol} விற்பனை",
  "ticket.atMarket": "மார்க்கெட் விலையில்",
  "ticket.at": "{price} இல்",
  "ticket.addSl": "ஸ்டாப் லாஸ் சேர்",
  "ticket.addTp": "டேக் ப்ராஃபிட் சேர்",
  "ticket.ifHit": "தொட்டால் {money}",
  "ticket.required": "மார்ஜின்",
  "ticket.pip": "பிப் மதிப்பு",
  "ticket.after": "பிறகு ஃப்ரீ மார்ஜின்",
  "ticket.notEnough": "இந்த வால்யூமுக்குப் போதுமான ஃப்ரீ மார்ஜின் இல்லை.",
  "ticket.noSpecs": "ஒப்பந்த விவரங்களை ஏற்றுகிறது…",
  "ticket.distance": "{n} பிப்ஸ் தொலைவில்",
  "ticket.price": "விலை",

  // Rejections: a plain-language line under the reason
  "reject.no_money": "உங்கள் ஃப்ரீ மார்ஜின் இந்த ஆர்டருக்குப் போதாது. வால்யூமைக் குறையுங்கள் அல்லது இந்தக் கணக்கிற்கு நிதி சேருங்கள்.",
  "reject.insufficient_funds": "உங்கள் ஃப்ரீ மார்ஜின் இந்த ஆர்டருக்குப் போதாது. வால்யூமைக் குறையுங்கள் அல்லது இந்தக் கணக்கிற்கு நிதி சேருங்கள்.",
  "reject.market_closed": "இந்தச் சந்தை தற்போது மூடியுள்ளது. திறந்ததும் மீண்டும் முயலவும்.",
  "reject.invalid_volume": "இந்தச் சிம்பலின் வரம்புகள் மற்றும் லாட் படிக்குள் உள்ள வால்யூமைப் பயன்படுத்துங்கள்.",
  "reject.max_lot": "இந்த வால்யூம் உங்கள் கணக்கின் ஒரு ஆர்டருக்கான அதிகபட்சத்தை மீறுகிறது.",
  "reject.close_only": "உங்கள் கணக்கில் தற்போது பொசிஷன்களை மூடலாம், ஆனால் புதியவற்றைத் திறக்க முடியாது.",
  "reject.symbol_close_only": "இந்தச் சிம்பலில் தற்போது பொசிஷன்களை மூடலாம், ஆனால் திறக்க முடியாது.",
  "reject.trading_disabled": "இந்தக் கணக்கில் டிரேடிங் முடக்கப்பட்டுள்ளது. விவரங்களுக்கு உதவிக் குழுவைத் தொடர்புகொள்ளவும்.",
  "reject.symbol_halted": "இந்தச் சிம்பலில் டிரேடிங் இடைநிறுத்தப்பட்டுள்ளது. பின்னர் மீண்டும் முயலவும்.",
  "reject.requote.title": "விலை மாறிவிட்டது",
  "reject.requote": "உங்கள் ஆர்டர் செல்லும்போது சந்தை நகர்ந்தது. புதிய விலையைச் சரிபார்த்து மீண்டும் உறுதிப்படுத்துங்கள்.",
  "reject.invalid_sl": "ஸ்டாப் லாஸ் விலையின் தவறான பக்கத்தில் உள்ளது, அல்லது அதற்கு மிக அருகில் உள்ளது.",
  "reject.invalid_tp": "டேக் ப்ராஃபிட் விலையின் தவறான பக்கத்தில் உள்ளது, அல்லது அதற்கு மிக அருகில் உள்ளது.",
  "reject.invalid_price": "இந்த ஆர்டர் வகைக்கு இந்த விலை சந்தையின் தவறான பக்கத்தில் உள்ளது.",
  "reject.off_market": "இந்த விலை சந்தையிலிருந்து மிகத் தொலைவில் உள்ளது. மதிப்பைச் சரிபார்க்கவும்.",
  "reject.stale_price": "இந்தச் சிம்பலின் விலைகள் சிறிது நேரம் நிறுத்தப்பட்டுள்ளன. சற்று நேரத்தில் மீண்டும் முயலவும்.",
  "reject.no_price": "இந்தச் சிம்பலுக்குத் தற்போது லைவ் விலை இல்லை.",
  "reject.read_only": "இந்த உள்நுழைவில் கணக்கைப் பார்க்கலாம், ஆனால் டிரேட் செய்ய முடியாது.",
  "reject.uncertain.title": "டிரேட் சர்வரிடமிருந்து பதில் இல்லை",
  "reject.uncertain": "அது நிறைவேறியிருக்கலாம். மீண்டும் முயலும் முன் போர்ட்ஃபோலியோவைச் சரிபார்க்கவும்.",
  "reject.uncertain.ticket": "மீண்டும் உறுதிப்படுத்துவது பாதுகாப்பானது: அதே ஆர்டர் இருமுறை வைக்கப்படாது.",

  // States
  "state.noAccount.title": "இன்னும் டிரேடிங் கணக்கு இல்லை",
  "state.noAccount.body": "பயிற்சி செய்ய டெமோ கணக்கையோ, உண்மையாக டிரேட் செய்ய லைவ் கணக்கையோ திறங்கள்.",
  "state.noAccount.action": "கணக்கைத் திற",
  "state.connecting": "டிரேட் சர்வருடன் இணைக்கிறது…",
  "state.readOnly": "இந்தக் கணக்கு இங்கே பார்வைக்கு மட்டும்: விலைகளும் சார்ட்களும் லைவ், டிரேடிங் முடக்கத்தில்.",
  "state.marketClosed.title": "சந்தை மூடியுள்ளது",
  "state.marketClosed.body": "{symbol} அடுத்த அமர்வில் மீண்டும் திறக்கும். திறந்ததும் ஆர்டர்களை வைக்கலாம்.",
  "state.streamError": "டிரேட் சர்வரை அடைய முடியவில்லை",
  "state.streamErrorBody": "உங்கள் பொசிஷன்களும் ஆர்டர்களும் சர்வரில் பாதுகாப்பாக உள்ளன. மீண்டும் இணைக்கத் தொடர்ந்து முயல்கிறோம்.",

  // Results
  "toast.filled": "{side} {volume} {symbol} நிறைவேறியது",
  "toast.at": "{price} இல்",
  "toast.placed": "{symbol} பெண்டிங் ஆர்டர் வைக்கப்பட்டது",
  "toast.duplicate": "ஏற்கனவே #{ticket} ஆக வைக்கப்பட்டது",
  "toast.duplicateBody": "இந்த ஆர்டர் முன்பே சர்வரை அடைந்தது; புதிதாக எதுவும் திறக்கப்படவில்லை.",
  "toast.closed": "பொசிஷன் #{ticket} மூடப்பட்டது",
  "toast.partial": "#{ticket} இல் {volume} லாட்கள் மூடப்பட்டன",
  "toast.modified": "#{ticket} புதுப்பிக்கப்பட்டது",
  "toast.cancelled": "ஆர்டர் #{ticket} ரத்துசெய்யப்பட்டது",

  // Engine notifications while the app is open
  "notify.sl": "ஸ்டாப் லாஸ் தொட்டது",
  "notify.tp": "டேக் ப்ராஃபிட் தொட்டது",
  "notify.order_filled": "பெண்டிங் ஆர்டர் நிறைவேறியது",
  "notify.order_triggered": "ஆர்டர் தூண்டப்பட்டது",
  "notify.margin_call": "மார்ஜின் கால்",
  "notify.stop_out": "ஸ்டாப் அவுட்",
  "notify.order_rejected": "ஆர்டர் நிராகரிக்கப்பட்டது",
  "notify.order_expired": "ஆர்டர் காலாவதியானது",
  "notify.order_cancelled": "ஆர்டர் ரத்துசெய்யப்பட்டது",
};
export default mobileTrade;
