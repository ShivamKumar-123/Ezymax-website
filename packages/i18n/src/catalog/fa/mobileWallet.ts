import type { NsMessages } from "../../core";

// Kalks mobile app: the wallet screens (overview, deposit, withdraw, transfer, history). Most wording is reused
// from the `wallet` and `common` namespaces; these are the phone-only strings.
// Keep brand and network names as they are: Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Overview header: small line above the title (asset and networks)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "در دسترس",
  "balance.otherAssets": "سایر دارایی‌ها",

  // Copy / share / paste controls
  copyAddress: "کپی آدرس",
  share: "اشتراک‌گذاری",
  paste: "جای‌گذاری",
  tokenContract: "قرارداد توکن",
  viewOnExplorer: "مشاهده در اکسپلورر",
  keep: "نگه داشتن",

  // Network picker; {min} is an amount, {count} a number of block confirmations
  "network.depositDetail": "حداقل {min} USDT · {count} تأییدیه",
  "network.networkFee": "کارمزد شبکه {fee} USDT",
  "network.noNetworkFee": "بدون کارمزد شبکه",
  "network.paused": "فعلاً متوقف است",

  // Deposit
  "deposit.belowMin": "حداقل واریز {min} USDT است.",
  // {id} is the first characters of the deposit request id
  "deposit.request": "درخواست {id}",
  // Banner title above the network warning; {short} is BEP20 or TRC20
  "deposit.onlyUsdt": "فقط USDT {short} ارسال کنید",
  "deposit.openWalletApp": "باز کردن در برنامه کیف پول",
  "deposit.walletAppHint": "MetaMask یا برنامه کیف پول دیگری را با این انتقال USDT، آماده تأیید باز می‌کند.",
  "deposit.noWalletApp": "هیچ برنامه کیف پولی در این گوشی نمی‌تواند آن را باز کند. به‌جای آن، آدرس را کپی یا کد QR را اسکن کنید.",
  "deposit.hashInvalid": "هش تراکنش 64 کاراکتر (0–9، a–f) دارد، با یا بدون 0x.",
  "deposit.submitHash": "ثبت تراکنش",
  "deposit.sentHelp": "هش تراکنش را از کیف پول یا صرافی خود جای‌گذاری کنید. آن را در شبکه پیدا می‌کنیم و به‌طور خودکار به کیف پول شما واریز می‌کنیم.",
  "deposit.expiredHelp": "این درخواست منقضی شده است. اگر USDT را قبلاً ارسال کرده‌اید، هش تراکنش را در پایین ثبت کنید؛ در غیر این صورت یک واریز جدید شروع کنید.",
  // Under the big credited amount; {currency} is USDT
  "deposit.creditedBody": "به‌صورت {currency} به کیف پول شما واریز شد",
  // How deposits work on the phone (steps 2 and 3)
  "how.sendTitle": "از کیف پول یا صرافی خود ارسال کنید",
  "how.sendText": "آدرس را کپی یا کد QR را اسکن کنید. در BNB Chain، با یک لمس MetaMask با انتقال آماده باز می‌شود.",
  "how.hashTitle": "هش تراکنش را جای‌گذاری کنید",
  "how.hashText": "آن را در شبکه بررسی می‌کنیم و پس از {bsc} تأییدیه روی BNB Chain یا {tron} تأییدیه روی TRON واریز می‌کنیم.",

  // Withdraw
  "withdraw.available": "قابل برداشت",
  "withdraw.belowMin": "حداقل برداشت {min} USDT است.",
  "withdraw.aboveMax": "حداکثر هر برداشت {max} USDT است.",
  "withdraw.paused": "برداشت در حال حاضر متوقف است. لطفاً بعداً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.",
  "withdraw.cancelAction": "لغو برداشت",
  "withdraw.cancelConfirm": "این برداشت لغو شود؟ مبلغ به موجودی در دسترس شما بازمی‌گردد.",

  // Destination address checks; {network} is a network name, {short} BEP20 / TRC20
  "address.valid": "آدرس معتبر {network}",
  "address.checksum": "این آدرس غلط تایپی دارد: چک‌سام آن مطابقت ندارد. آن را دوباره از کیف پول خود جای‌گذاری کنید.",
  "address.otherNetwork": "این آدرس متعلق به شبکه دیگری است. یک آدرس {network} ({short}) وارد کنید یا شبکه را در بالا تغییر دهید.",
  "address.contract": "این آدرس قرارداد توکن USDT است، نه کیف پول. آدرس کیف پول خود را وارد کنید.",

  // Email code confirmation sheet
  "stepup.willEmail": "برای تأیید، یک کد 6 رقمی به ایمیل شما ارسال می‌کنیم. تا آن را وارد نکنید، چیزی ارسال نمی‌شود.",
  "stepup.sendCode": "ارسال کد به ایمیل من",
  "stepup.codeLabel": "کد 6 رقمی",

  // Transfer
  "transfer.eyebrow": "کیف پول ↔ حساب‌ها",
  "transfer.swap": "تغییر جهت",
  "transfer.freeMargin": "مارجین آزاد",
  "transfer.marginLevel": "سطح مارجین",
  // {amount} is in USD
  "transfer.overWithdrawable": "در حال حاضر حداکثر {amount} USD می‌تواند از این حساب خارج شود (معاملات باز مارجین خود را حفظ می‌کنند).",
  // {amount} is e.g. "USC 10,000.00"
  "transfer.arrivesAs": "به‌صورت {amount} واریز می‌شود",
  "transfer.arrives": "مبلغ دریافتی",
  "transfer.confirmTitle": "تأیید انتقال",
  "transfer.confirm": "تأیید انتقال",

  // Transaction detail sheet
  "detail.confirmations": "تأییدیه‌ها",
  // Label of a Back Office statement note on an adjustment or other credit
  "detail.note": "یادداشت",
  "detail.reason": "دلیل",
  "detail.reference": "شماره مرجع",

  "error.staffReadOnly": "این یک نشست فقط‌خواندنی کارکنان است. امکان ایجاد تغییر وجود ندارد.",
};
export default mobileWallet;
