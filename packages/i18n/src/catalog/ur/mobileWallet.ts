import type { NsMessages } from "../../core";

// Kalks mobile app: the wallet screens (phone-only strings; the rest reuses `wallet` and `common`).
// Keep brand and network names as they are: Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Overview header: small uppercase line above the title (asset and networks)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "دستیاب",
  "balance.otherAssets": "دیگر اثاثے",

  // Copy / share / paste controls
  copyAddress: "ایڈریس کاپی کریں",
  share: "شیئر کریں",
  paste: "پیسٹ کریں",
  tokenContract: "ٹوکن کنٹریکٹ",
  viewOnExplorer: "ایکسپلورر پر دیکھیں",
  keep: "رہنے دیں",

  // Network picker; {min} is an amount, {count} a number of block confirmations
  "network.depositDetail": "کم از کم {min} USDT · {count} تصدیقات",
  "network.networkFee": "نیٹ ورک فیس {fee} USDT",
  "network.noNetworkFee": "کوئی نیٹ ورک فیس نہیں",
  "network.paused": "فی الحال معطل",

  // Deposit
  "deposit.belowMin": "کم از کم ڈپازٹ {min} USDT ہے۔",
  // {id} is the first characters of the deposit request id
  "deposit.request": "درخواست {id}",
  // Banner title above the network warning; {short} is BEP20 or TRC20
  "deposit.onlyUsdt": "صرف USDT {short} بھیجیں",
  "deposit.openWalletApp": "والیٹ ایپ میں کھولیں",
  "deposit.walletAppHint": "MetaMask یا کوئی دوسری والیٹ ایپ کھلتی ہے جس میں یہ USDT ٹرانسفر منظوری کے لیے تیار ہوتا ہے۔",
  "deposit.noWalletApp": "اس فون پر کوئی والیٹ ایپ اسے نہیں کھول سکتی۔ اس کے بجائے ایڈریس کاپی کریں یا QR کوڈ اسکین کریں۔",
  "deposit.hashInvalid": "ٹرانزیکشن ہیش میں 64 حروف (0–9، a–f) ہوتے ہیں، 0x کے ساتھ یا اس کے بغیر۔",
  "deposit.submitHash": "ٹرانزیکشن جمع کرائیں",
  "deposit.sentHelp": "اپنے والیٹ یا ایکسچینج سے ٹرانزیکشن ہیش پیسٹ کریں۔ ہم اسے نیٹ ورک پر تلاش کر کے خود بخود کریڈٹ کر دیتے ہیں۔",
  "deposit.expiredHelp": "اس درخواست کی میعاد ختم ہو گئی ہے۔ اگر آپ USDT بھیج چکے ہیں تو نیچے ٹرانزیکشن ہیش جمع کرائیں؛ ورنہ نیا ڈپازٹ شروع کریں۔",
  // Under the big credited amount; {currency} is USDT
  "deposit.creditedBody": "آپ کے والیٹ میں {currency} میں کریڈٹ ہو گیا",
  // How deposits work on the phone (steps 2 and 3)
  "how.sendTitle": "اپنے والیٹ یا ایکسچینج سے بھیجیں",
  "how.sendText": "ایڈریس کاپی کریں یا QR کوڈ اسکین کریں۔ BNB Chain پر ایک ٹیپ سے MetaMask تیار ٹرانسفر کے ساتھ کھل جاتا ہے۔",
  "how.hashTitle": "ٹرانزیکشن ہیش پیسٹ کریں",
  "how.hashText": "ہم نیٹ ورک پر اس کی تصدیق کرتے ہیں اور BNB Chain پر {bsc} یا TRON پر {tron} تصدیقات کے بعد کریڈٹ کر دیتے ہیں۔",

  // Withdraw
  "withdraw.available": "نکالنے کے لیے دستیاب",
  "withdraw.belowMin": "کم از کم {min} USDT نکالے جا سکتے ہیں۔",
  "withdraw.aboveMax": "ایک بار میں زیادہ سے زیادہ {max} USDT نکالے جا سکتے ہیں۔",
  "withdraw.paused": "رقم نکالنے کی سہولت اس وقت رکی ہوئی ہے۔ براہ کرم بعد میں دوبارہ کوشش کریں یا سپورٹ سے رابطہ کریں۔",
  "withdraw.cancelAction": "نکاسی منسوخ کریں",
  "withdraw.cancelConfirm": "یہ نکاسی منسوخ کریں؟ رقم آپ کے دستیاب بیلنس میں واپس آ جائے گی۔",

  // Destination address checks; {network} is a network name, {short} BEP20 / TRC20
  "address.valid": "درست {network} ایڈریس",
  "address.checksum": "اس ایڈریس میں ٹائپنگ کی غلطی ہے: اس کا چیک سم میل نہیں کھاتا۔ اسے اپنے والیٹ سے دوبارہ پیسٹ کریں۔",
  "address.otherNetwork": "یہ ایڈریس کسی دوسرے نیٹ ورک کا ہے۔ {network} ({short}) ایڈریس درج کریں، یا اوپر نیٹ ورک تبدیل کریں۔",
  "address.contract": "یہ USDT ٹوکن کنٹریکٹ ہے، والیٹ نہیں۔ اپنا والیٹ ایڈریس درج کریں۔",

  // Email code confirmation sheet
  "stepup.willEmail": "تصدیق کے لیے ہم آپ کو 6 ہندسوں کا کوڈ ای میل کرتے ہیں۔ جب تک آپ اسے درج نہ کریں، کچھ نہیں بھیجا جاتا۔",
  "stepup.sendCode": "مجھے کوڈ ای میل کریں",
  "stepup.codeLabel": "6 ہندسوں کا کوڈ",

  // Transfer
  "transfer.eyebrow": "والیٹ ↔ اکاؤنٹس",
  "transfer.swap": "سمت بدلیں",
  "transfer.freeMargin": "فری مارجن",
  "transfer.marginLevel": "مارجن لیول",
  // {amount} is in USD
  "transfer.overWithdrawable": "اس وقت اس اکاؤنٹ سے زیادہ سے زیادہ {amount} USD نکل سکتے ہیں (کھلی ٹریڈز اپنا مارجن برقرار رکھتی ہیں)۔",
  // {amount} is e.g. "USC 10,000.00"
  "transfer.arrivesAs": "{amount} کی صورت میں موصول ہوگا",
  "transfer.arrives": "موصول رقم",
  "transfer.confirmTitle": "ٹرانسفر کی تصدیق کریں",
  "transfer.confirm": "ٹرانسفر کی تصدیق کریں",

  // Transaction detail sheet
  "detail.confirmations": "تصدیقات",
  // Label of a Back Office statement note on an adjustment or other credit
  "detail.note": "نوٹ",
  "detail.reason": "وجہ",
  "detail.reference": "حوالہ",

  "error.staffReadOnly": "یہ صرف پڑھنے والا اسٹاف سیشن ہے۔ تبدیلیوں کی اجازت نہیں۔",
};
export default mobileWallet;
