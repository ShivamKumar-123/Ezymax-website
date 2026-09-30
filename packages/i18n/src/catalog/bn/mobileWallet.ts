import type { NsMessages } from "../../core";

// Kalks mobile app: the wallet screens (overview, deposit, withdraw, transfer, history). Most wording is reused
// from the `wallet` and `common` namespaces; these are the phone-only strings.
// Brand and network names stay as they are: Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Overview header: small uppercase line above the title (asset and networks)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "উপলব্ধ",
  "balance.otherAssets": "অন্যান্য অ্যাসেট",

  // Copy / share / paste controls
  copyAddress: "ঠিকানা কপি করুন",
  share: "শেয়ার",
  paste: "পেস্ট",
  tokenContract: "টোকেন কন্ট্র্যাক্ট",
  viewOnExplorer: "এক্সপ্লোরারে দেখুন",
  keep: "রেখে দিন",

  // Network picker (deposit / withdraw); {min} is an amount, {count} a number of block confirmations
  "network.depositDetail": "ন্যূনতম {min} USDT · {count}টি কনফার্মেশন",
  "network.networkFee": "নেটওয়ার্ক ফি {fee} USDT",
  "network.noNetworkFee": "কোনো নেটওয়ার্ক ফি নেই",
  "network.paused": "আপাতত স্থগিত",

  // Deposit
  "deposit.belowMin": "ন্যূনতম জমা {min} USDT।",
  // {id} is the first characters of the deposit request id
  "deposit.request": "অনুরোধ {id}",
  // Banner title above the network warning; {short} is BEP20 or TRC20
  "deposit.onlyUsdt": "শুধু USDT {short} পাঠান",
  "deposit.openWalletApp": "ওয়ালেট অ্যাপে খুলুন",
  "deposit.walletAppHint": "অনুমোদনের জন্য এই USDT ট্রান্সফার প্রস্তুত অবস্থায় MetaMask বা অন্য কোনো ওয়ালেট অ্যাপ খোলে।",
  "deposit.noWalletApp": "এই ফোনের কোনো ওয়ালেট অ্যাপ এটি খুলতে পারছে না। এর বদলে ঠিকানা কপি করুন বা QR কোড স্ক্যান করুন।",
  "deposit.hashInvalid": "ট্রানজ্যাকশন হ্যাশে 64টি অক্ষর থাকে (0–9, a–f), 0x সহ বা ছাড়া।",
  "deposit.submitHash": "ট্রানজ্যাকশন জমা দিন",
  "deposit.sentHelp": "আপনার ওয়ালেট বা এক্সচেঞ্জ থেকে ট্রানজ্যাকশন হ্যাশ পেস্ট করুন। আমরা নেটওয়ার্কে এটি খুঁজে স্বয়ংক্রিয়ভাবে ক্রেডিট করি।",
  "deposit.expiredHelp": "এই অনুরোধের মেয়াদ শেষ হয়েছে। আপনি ইতিমধ্যে USDT পাঠিয়ে থাকলে নিচে ট্রানজ্যাকশন হ্যাশ জমা দিন; না হলে নতুন জমা শুরু করুন।",
  // Under the big credited amount; {currency} is USDT
  "deposit.creditedBody": "আপনার ওয়ালেটে {currency}-তে ক্রেডিট হয়েছে",
  // How deposits work on the phone (steps 2 and 3; steps 1 and 4 are shared with the Client Area)
  "how.sendTitle": "আপনার ওয়ালেট বা এক্সচেঞ্জ থেকে পাঠান",
  "how.sendText": "ঠিকানা কপি করুন বা QR কোড স্ক্যান করুন। BNB Chain-এ এক ট্যাপেই ট্রান্সফার প্রস্তুত অবস্থায় MetaMask খোলে।",
  "how.hashTitle": "ট্রানজ্যাকশন হ্যাশ পেস্ট করুন",
  "how.hashText": "আমরা নেটওয়ার্কে এটি যাচাই করি এবং BNB Chain-এ {bsc}টি বা TRON-এ {tron}টি কনফার্মেশনের পর ক্রেডিট করি।",

  // Withdraw
  "withdraw.available": "উত্তোলনের জন্য উপলব্ধ",
  "withdraw.belowMin": "ন্যূনতম উত্তোলন {min} USDT।",
  "withdraw.aboveMax": "প্রতি উত্তোলনে সর্বোচ্চ {max} USDT।",
  "withdraw.paused": "এই মুহূর্তে উত্তোলন স্থগিত আছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন বা সাপোর্টে যোগাযোগ করুন।",
  "withdraw.cancelAction": "উত্তোলন বাতিল করুন",
  "withdraw.cancelConfirm": "এই উত্তোলন বাতিল করবেন? পরিমাণটি আপনার উপলব্ধ ব্যালেন্সে ফেরত যাবে।",

  // Destination address checks; {network} is a network name, {short} BEP20 / TRC20
  "address.valid": "বৈধ {network} ঠিকানা",
  "address.checksum": "এই ঠিকানায় টাইপের ভুল আছে: এর চেকসাম মিলছে না। আপনার ওয়ালেট থেকে আবার পেস্ট করুন।",
  "address.otherNetwork": "এই ঠিকানাটি অন্য নেটওয়ার্কের। একটি {network} ({short}) ঠিকানা দিন, অথবা উপরে নেটওয়ার্ক পরিবর্তন করুন।",
  "address.contract": "এটি USDT টোকেন কন্ট্র্যাক্ট, কোনো ওয়ালেট নয়। আপনার নিজের ওয়ালেট ঠিকানা দিন।",

  // Email code confirmation sheet
  "stepup.willEmail": "নিশ্চিত করতে আমরা আপনাকে একটি 6-সংখ্যার কোড ইমেইল করব। কোডটি না দেওয়া পর্যন্ত কিছুই পাঠানো হবে না।",
  "stepup.sendCode": "আমাকে কোড ইমেইল করুন",
  "stepup.codeLabel": "6-সংখ্যার কোড",

  // Transfer
  "transfer.eyebrow": "ওয়ালেট ↔ অ্যাকাউন্ট",
  "transfer.swap": "দিক পরিবর্তন",
  "transfer.freeMargin": "ফ্রি মার্জিন",
  "transfer.marginLevel": "মার্জিন লেভেল",
  // {amount} is in USD
  "transfer.overWithdrawable": "এই মুহূর্তে এই অ্যাকাউন্ট থেকে সর্বোচ্চ {amount} USD সরানো যাবে (খোলা ট্রেডের মার্জিন আটকে থাকে)।",
  // {amount} is e.g. "USC 10,000.00"
  "transfer.arrivesAs": "{amount} হিসেবে পৌঁছাবে",
  "transfer.arrives": "পৌঁছাবে",
  "transfer.confirmTitle": "ট্রান্সফার নিশ্চিত করুন",
  "transfer.confirm": "ট্রান্সফার নিশ্চিত করুন",

  // Transaction detail sheet
  "detail.confirmations": "কনফার্মেশন",
  // Label of a Back Office statement note on an adjustment or other credit
  "detail.note": "নোট",
  "detail.reason": "কারণ",
  "detail.reference": "রেফারেন্স",

  "error.staffReadOnly": "এটি একটি শুধু দেখার স্টাফ সেশন। কোনো পরিবর্তনের অনুমতি নেই।",
};
export default mobileWallet;
