import type { NsMessages } from "../../core";

// Kalks mobile app: the wallet screens (overview, deposit, withdraw, transfer, history). Most wording is reused from
// the `wallet` and `common` namespaces; these are the phone-only strings.
// Brand and network names stay as they are: Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Overview header: small line above the title (asset and networks)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "المتاح",
  "balance.otherAssets": "أصول أخرى",

  // Copy / share / paste controls
  copyAddress: "نسخ العنوان",
  share: "مشاركة",
  paste: "لصق",
  tokenContract: "عقد الرمز",
  viewOnExplorer: "عرض في مستكشف الكتل",
  keep: "الإبقاء عليها",

  // Network picker (deposit / withdraw); {min} is an amount, {count} a number of block confirmations
  "network.depositDetail": "الحد الأدنى {min} USDT · {count} تأكيدًا",
  "network.networkFee": "رسوم الشبكة {fee} USDT",
  "network.noNetworkFee": "بدون رسوم شبكة",
  "network.paused": "متوقفة حاليًا",

  // Deposit
  "deposit.belowMin": "الحد الأدنى للإيداع {min} USDT.",
  // {id} is the first characters of the deposit request id
  "deposit.request": "الطلب {id}",
  // Banner title above the network warning; {short} is BEP20 or TRC20
  "deposit.onlyUsdt": "أرسل USDT {short} فقط",
  "deposit.openWalletApp": "فتح في تطبيق المحفظة",
  "deposit.walletAppHint": "يفتح MetaMask أو تطبيق محفظة آخر مع تجهيز تحويل USDT هذا للموافقة عليه.",
  "deposit.noWalletApp": "لا يوجد على هذا الهاتف تطبيق محفظة يمكنه فتحه. انسخ العنوان أو امسح رمز QR بدلًا من ذلك.",
  "deposit.hashInvalid": "يتكون هاش المعاملة من 64 حرفًا (0–9، a–f)، مع 0x أو بدونها.",
  "deposit.submitHash": "إرسال المعاملة",
  "deposit.sentHelp": "الصق هاش المعاملة من محفظتك أو منصة التداول. نعثر عليها على الشبكة ونضيفها تلقائيًا.",
  "deposit.expiredHelp": "انتهت صلاحية هذا الطلب. إذا كنت قد أرسلت USDT بالفعل، فأرسل هاش المعاملة أدناه؛ وإلا فابدأ إيداعًا جديدًا.",
  // Under the big credited amount; {currency} is USDT
  "deposit.creditedBody": "أُضيف إلى محفظتك بعملة {currency}",
  // How deposits work on the phone (steps 2 and 3; steps 1 and 4 are shared with the Client Area)
  "how.sendTitle": "أرسل من محفظتك أو منصة التداول",
  "how.sendText": "انسخ العنوان أو امسح رمز QR. على BNB Chain، تفتح لمسة واحدة MetaMask مع تجهيز التحويل.",
  "how.hashTitle": "الصق هاش المعاملة",
  "how.hashText": "نتحقق منها على الشبكة ونضيفها بعد {bsc} تأكيدًا على BNB Chain أو {tron} على TRON.",

  // Withdraw
  "withdraw.available": "المتاح للسحب",
  "withdraw.belowMin": "الحد الأدنى للسحب {min} USDT.",
  "withdraw.aboveMax": "الحد الأقصى لكل عملية سحب {max} USDT.",
  "withdraw.paused": "عمليات السحب متوقفة حاليًا. يرجى المحاولة لاحقًا أو التواصل مع الدعم.",
  "withdraw.cancelAction": "إلغاء السحب",
  "withdraw.cancelConfirm": "إلغاء عملية السحب هذه؟ يعود المبلغ إلى رصيدك المتاح.",

  // Destination address checks; {network} is a network name, {short} BEP20 / TRC20
  "address.valid": "عنوان {network} صالح",
  "address.checksum": "في هذا العنوان خطأ مطبعي: المجموع الاختباري غير مطابق. الصقه مرة أخرى من محفظتك.",
  "address.otherNetwork": "هذا العنوان على شبكة أخرى. أدخل عنوانًا على {network} ({short})، أو غيّر الشبكة في الأعلى.",
  "address.contract": "هذا عقد رمز USDT وليس محفظة. أدخل عنوان محفظتك الخاصة.",

  // Email code confirmation sheet
  "stepup.willEmail": "سنرسل إليك رمزًا مكوّنًا من 6 أرقام عبر البريد الإلكتروني للتأكيد. لن يُرسل أي شيء حتى تُدخله.",
  "stepup.sendCode": "أرسل لي الرمز",
  "stepup.codeLabel": "رمز من 6 أرقام",

  // Transfer
  "transfer.eyebrow": "المحفظة ↔ الحسابات",
  "transfer.swap": "عكس الاتجاه",
  "transfer.freeMargin": "الهامش الحر",
  "transfer.marginLevel": "مستوى الهامش",
  // {amount} is in USD
  "transfer.overWithdrawable": "يمكن سحب ما يصل إلى {amount} USD من هذا الحساب الآن (تحتفظ الصفقات المفتوحة بهامشها).",
  // {amount} is e.g. "USC 10,000.00"
  "transfer.arrivesAs": "يصل بقيمة {amount}",
  "transfer.arrives": "الوصول",
  "transfer.confirmTitle": "تأكيد التحويل",
  "transfer.confirm": "تأكيد التحويل",

  // Transaction detail sheet
  "detail.confirmations": "التأكيدات",
  // Label of a Back Office statement note on an adjustment or other credit
  "detail.note": "ملاحظة",
  "detail.reason": "السبب",
  "detail.reference": "المرجع",

  "error.staffReadOnly": "هذه جلسة موظف للقراءة فقط. لا يُسمح بإجراء تغييرات.",
};
export default mobileWallet;
