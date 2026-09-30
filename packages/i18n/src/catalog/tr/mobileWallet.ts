import type { NsMessages } from "../../core";

// Kalks mobile app: the wallet screens (overview, deposit, withdraw, transfer, history). Phone-only strings; the rest
// comes from the `wallet` and `common` namespaces.
// Brand and network names stay as they are: Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // Overview header: small uppercase line above the title (asset and networks)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "Kullanılabilir",
  "balance.otherAssets": "Diğer varlıklar",

  // Copy / share / paste controls
  copyAddress: "Adresi kopyala",
  share: "Paylaş",
  paste: "Yapıştır",
  tokenContract: "Token kontratı",
  viewOnExplorer: "Blok gezgininde görüntüle",
  keep: "Vazgeç",

  // Network picker (deposit / withdraw); {min} is an amount, {count} a number of block confirmations
  "network.depositDetail": "Min {min} USDT · {count} onay",
  "network.networkFee": "Ağ ücreti {fee} USDT",
  "network.noNetworkFee": "Ağ ücreti yok",
  "network.paused": "Şimdilik duraklatıldı",

  // Deposit
  "deposit.belowMin": "Minimum yatırım {min} USDT.",
  // {id} is the first characters of the deposit request id
  "deposit.request": "Talep {id}",
  // Banner title above the network warning; {short} is BEP20 or TRC20
  "deposit.onlyUsdt": "Yalnızca USDT {short} gönderin",
  "deposit.openWalletApp": "Cüzdan uygulamasında aç",
  "deposit.walletAppHint": "MetaMask'i veya başka bir cüzdan uygulamasını bu USDT transferi onaya hazır şekilde açar.",
  "deposit.noWalletApp": "Bu telefondaki hiçbir cüzdan uygulaması bunu açamıyor. Bunun yerine adresi kopyalayın veya QR kodunu okutun.",
  "deposit.hashInvalid": "İşlem hash'i, 0x ile veya 0x olmadan 64 karakterdir (0–9, a–f).",
  "deposit.submitHash": "İşlemi gönder",
  "deposit.sentHelp": "Cüzdanınızdaki veya borsanızdaki işlem hash'ini yapıştırın. Ağda bulur ve otomatik olarak hesabınıza geçiririz.",
  "deposit.expiredHelp": "Bu talebin süresi doldu. USDT'yi zaten gönderdiyseniz işlem hash'ini aşağıdan gönderin; göndermediyseniz yeni bir yatırım başlatın.",
  // Under the big credited amount; {currency} is USDT
  "deposit.creditedBody": "Cüzdanınıza {currency} olarak geçti",
  // How deposits work on the phone (steps 2 and 3; steps 1 and 4 are shared with the Client Area)
  "how.sendTitle": "Cüzdanınızdan veya borsanızdan gönderin",
  "how.sendText": "Adresi kopyalayın veya QR kodunu okutun. BNB Chain'de tek dokunuşla MetaMask, transfer hazır şekilde açılır.",
  "how.hashTitle": "İşlem hash'ini yapıştırın",
  "how.hashText": "Ağda doğrular; BNB Chain'de {bsc}, TRON'da {tron} onaydan sonra hesabınıza geçiririz.",

  // Withdraw
  "withdraw.available": "Çekilebilir tutar",
  "withdraw.belowMin": "Minimum çekim {min} USDT.",
  "withdraw.aboveMax": "Çekim başına maksimum {max} USDT.",
  "withdraw.paused": "Para çekme şu anda duraklatıldı. Lütfen daha sonra tekrar deneyin veya destekle iletişime geçin.",
  "withdraw.cancelAction": "Çekimi iptal et",
  "withdraw.cancelConfirm": "Bu çekim iptal edilsin mi? Tutar kullanılabilir bakiyenize geri döner.",

  // Destination address checks; {network} is a network name, {short} BEP20 / TRC20
  "address.valid": "Geçerli {network} adresi",
  "address.checksum": "Bu adreste yazım hatası var: sağlama toplamı tutmuyor. Cüzdanınızdan tekrar yapıştırın.",
  "address.otherNetwork": "Bu adres başka bir ağa ait. Bir {network} ({short}) adresi girin veya yukarıdan ağı değiştirin.",
  "address.contract": "Bu bir cüzdan değil, USDT token kontratı. Kendi cüzdan adresinizi girin.",

  // Email code confirmation sheet
  "stepup.willEmail": "Onay için size 6 haneli bir kod e-postalarız. Kodu girene kadar hiçbir şey gönderilmez.",
  "stepup.sendCode": "Kodu e-postama gönder",
  "stepup.codeLabel": "6 haneli kod",

  // Transfer
  "transfer.eyebrow": "Cüzdan ↔ hesaplar",
  "transfer.swap": "Yönü değiştir",
  "transfer.freeMargin": "Serbest teminat",
  "transfer.marginLevel": "Teminat seviyesi",
  // {amount} is in USD
  "transfer.overWithdrawable": "Bu hesaptan şu anda en fazla {amount} USD çıkabilir (açık işlemler teminatlarını korur).",
  // {amount} is e.g. "USC 10,000.00"
  "transfer.arrivesAs": "{amount} olarak ulaşır",
  "transfer.arrives": "Varış",
  "transfer.confirmTitle": "Transferi onaylayın",
  "transfer.confirm": "Transferi onayla",

  // Transaction detail sheet
  "detail.confirmations": "Onaylar",
  // Label of a Back Office statement note on an adjustment or other credit
  "detail.note": "Not",
  "detail.reason": "Neden",
  "detail.reference": "Referans",

  "error.staffReadOnly": "Bu, salt okunur bir personel oturumu. Değişiklik yapılamaz.",
};
export default mobileWallet;
